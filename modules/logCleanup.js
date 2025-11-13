'use strict';

// Grizzly Bot — Log Cleanup (manual + scheduled)
// Path: modules/logCleanup.js

const fs = require('fs');
const path = require('path');
const logger = require('../config/logger.js');
const { getPool } = require('../utils/db.js');

const pool = getPool();

// default schedule state (simple setInterval, no cron dep)
let schedule = null;

/**
 * Run cleanup once.
 * opts = {
 *   dryRun?: boolean,
 *   maxFileAgeHours?: number,    // default 72h
 *   maxRowsAgeDays?: number,     // default 14d
 *   limit?: number               // per-table limit when deleting
 * }
 */
async function runCleanup(opts = {}) {
  const {
    dryRun = false,
    maxFileAgeHours = 72,
    maxRowsAgeDays = 14,
    limit = 5_000,
  } = opts;

  const summary = {
    dryRun, maxFileAgeHours, maxRowsAgeDays, limit,
    filesRemoved: 0,
    tablesScanned: [],
    rowsDeleted: {},
    errors: [],
  };

  try {
    // 1) Clean local log files (project /logs folder)
    const logsDir = path.resolve(process.cwd(), 'logs');
    if (fs.existsSync(logsDir)) {
      const cutoff = Date.now() - maxFileAgeHours * 3600 * 1000;
      for (const name of fs.readdirSync(logsDir)) {
        const fp = path.join(logsDir, name);
        try {
          const st = fs.statSync(fp);
          if (st.isFile() && st.mtimeMs < cutoff) {
            if (!dryRun) fs.unlinkSync(fp);
            summary.filesRemoved++;
          }
        } catch (err) {
          summary.errors.push(`file ${name}: ${err.message}`);
        }
      }
    }

    // 2) Clean DB rows (best-effort, only if table + timestamp column exists)
    const tables = [
      { name: 'bot_logs', ts: 'created_at' },
      { name: 'channel_content_log', ts: 'created_at' },
      { name: 'audit_log', ts: 'created_at' },
      // Add more tables here if needed
    ];

    for (const t of tables) {
      try {
        const exists = await tableExists(t.name);
        if (!exists) continue;

        const colExists = await columnExists(t.name, t.ts);
        summary.tablesScanned.push(t.name);
        if (!colExists) continue;

        if (dryRun) {
          const { rows } = await pool.query(`
            SELECT COUNT(*)::int AS cnt
            FROM ${safeIdent(t.name)}
            WHERE ${safeIdent(t.ts)} < NOW() - INTERVAL '${maxRowsAgeDays} days'
          `);
          summary.rowsDeleted[t.name] = { wouldDelete: rows[0].cnt };
        } else {
          const { rows } = await pool.query(`
            WITH doomed AS (
              SELECT ctid
              FROM ${safeIdent(t.name)}
              WHERE ${safeIdent(t.ts)} < NOW() - INTERVAL '${maxRowsAgeDays} days'
              LIMIT $1
            )
            DELETE FROM ${safeIdent(t.name)} x
            USING doomed
            WHERE x.ctid = doomed.ctid
            RETURNING 1
          `, [limit]);
          summary.rowsDeleted[t.name] = { deleted: rows.length };
        }
      } catch (err) {
        summary.errors.push(`table ${t.name}: ${err.message}`);
      }
    }

    if (dryRun) {
      logger.info(`🧹 [DRY-RUN] Cleanup summary: ${JSON.stringify(summary)}`);
    } else {
      logger.info(`🧹 Cleanup summary: ${JSON.stringify(summary)}`);
    }
  } catch (err) {
    summary.errors.push(err.message);
    logger.error(`Cleanup failed: ${err.message}`);
  }

  return summary;
}

/**
 * Start a simple interval scheduler.
 * intervalMinutes default: 60
 * Uses runCleanup({ dryRun:false }) each tick.
 */
function scheduleCleanup(intervalMinutes = 60, opts = {}) {
  cancelScheduledCleanup();
  const ms = Math.max(1, intervalMinutes) * 60_000;
  schedule = setInterval(() => {
    runCleanup({ dryRun: false, ...opts }).catch(err =>
      logger.error(`Scheduled cleanup error: ${err.message}`)
    );
  }, ms);
  logger.info(`⏱️ Scheduled cleanup every ${intervalMinutes} min`);
}

function cancelScheduledCleanup() {
  if (schedule) {
    clearInterval(schedule);
    schedule = null;
    logger.info('⏹️ Scheduled cleanup canceled');
  }
}

/* ---------------- utility helpers ---------------- */

async function tableExists(table) {
  const q = `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = $1
    LIMIT 1
  `;
  const { rowCount } = await pool.query(q, [table]);
  return rowCount > 0;
}

async function columnExists(table, col) {
  const q = `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
    LIMIT 1
  `;
  const { rowCount } = await pool.query(q, [table, col]);
  return rowCount > 0;
}

function safeIdent(name) {
  // VERY basic identifier guard – wrap in double quotes and escape existing ones
  return '"' + String(name).replace(/"/g, '""') + '"';
}

module.exports = {
  runCleanup,
  scheduleCleanup,
  cancelScheduledCleanup,
};

// migrate.js
const dotenv = require('dotenv');
dotenv.config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  const files = fs
    .readdirSync(path.join(__dirname, 'migrations'))
    .filter(f => f.match(/^\d+.*\.sql$/))
    .sort();
  for (const file of files) {
    console.log('⏳ Running migration:', file);
    const sql = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8');
    await db.query(sql);
  }

  await db.end();
  console.log('✅ All migrations complete');
}

runMigrations().catch(console.error);

const { getPool } = require('./db');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryption');
const { createNitradoAPI } = require('./nitrado.js');

class NitradoNotificationsMonitor {
  constructor(client) {
    this.client = client;
    this.checkInterval = 5 * 60 * 1000; // Check every 5 minutes
    this.isRunning = false;
    this.intervalId = null;
    this.pool = null;
  }

  async start() {
    if (this.isRunning) {
      logger.info('⚠️  Notifications monitor already running');
      return;
    }

    this.pool = await getPool();
    this.isRunning = true;
    logger.info('🔔 Starting Nitrado notifications monitor...');

    await this.checkAllServices();
    this.intervalId = setInterval(() => this.checkAllServices(), this.checkInterval);

    logger.info(`✅ Notifications monitor started (checks every ${this.checkInterval / 1000 / 60} minutes)`);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.isRunning = false;
    logger.info('🔕 Notifications monitor stopped');
  }

  async checkAllServices() {
    try {
      const credResult = await this.pool.query(`
        SELECT DISTINCT nc.service_id, nc.guild_id, nc.encrypted_token, nc.token_iv, nc.auth_tag
        FROM nitrado_credentials nc
        INNER JOIN nitrado_oauth_tokens ot ON nc.discord_id = ot.discord_id
        WHERE ot.expires_at > NOW() + INTERVAL '5 minutes'
      `);

      if (credResult.rows.length === 0) return;

      logger.info(`🔍 Checking notifications for ${credResult.rows.length} services`);

      for (const cred of credResult.rows) {
        try {
          const token = decrypt(cred.encrypted_token, cred.token_iv, cred.auth_tag);
          await this.checkServiceNotifications(cred.service_id, cred.guild_id, token);
        } catch (error) {
          logger.error(`❌ Error checking service ${cred.service_id}:`, error.message);
        }
      }
    } catch (error) {
      logger.error('❌ Error in notifications monitor:', error);
    }
  }

  async checkServiceNotifications(serviceId, guildId, token) {
    try {
      const api = createNitradoAPI(token);
      const response = await api.nitradoRequest('GET', `/services/${serviceId}/notifications`, {
        params: { include_dismissed: false },
      });

      const notifications = response?.data?.data?.notifications || [];
      for (const notif of notifications) {
        await this.storeNotification(serviceId, guildId, notif);
      }

      logger.debug(`✅ Processed ${notifications.length} notifications for service ${serviceId}`);
    } catch (error) {
      const code = error.response?.status;
      if (code === 401) logger.warn(`🔒 Token expired for service ${serviceId}`);
      else if (code === 429) logger.warn(`⏱️  Rate limited on service ${serviceId}`);
      else logger.error(`❌ Error fetching notifications for ${serviceId}:`, error.message);
    }
  }

  async storeNotification(serviceId, guildId, notif) {
    try {
      const result = await this.pool.query(
        `
        INSERT INTO service_notifications (
          service_id, guild_id, notification_id, type, level, error_id,
          dismissed, message, message_long, data, created_at,
          created_at_timestamp, lifetime
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (service_id, notification_id)
        DO UPDATE SET
          dismissed = EXCLUDED.dismissed,
          message = EXCLUDED.message,
          message_long = EXCLUDED.message_long,
          data = EXCLUDED.data
        RETURNING id, level, discord_alerted
      `,
        [
          serviceId,
          guildId,
          notif.id,
          notif.type || null,
          notif.level || 'INFO',
          notif.error_id || null,
          notif.dismissed || false,
          notif.message || '',
          notif.message_long || notif.message_long_bbcode || '',
          JSON.stringify(notif.data || {}),
          notif.created_at || new Date().toISOString(),
          notif.created_at_timestamp || Math.floor(Date.now() / 1000),
          notif.lifetime || null,
        ]
      );

      const { id, level, discord_alerted } = result.rows[0];
      if (!discord_alerted && ['SEVERE', 'WARNING'].includes(level)) {
        await this.sendDiscordAlert(serviceId, guildId, notif);
        await this.pool.query(
          `UPDATE service_notifications SET discord_alerted = TRUE, discord_alert_time = NOW() WHERE id = $1`,
          [id]
        );
      }
    } catch (error) {
      logger.error(`❌ Error storing notification:`, error.message);
    }
  }

  async sendDiscordAlert(serviceId, guildId, notif) {
    try {
      const guild = await this.client.guilds.fetch(guildId).catch(() => null);
      if (!guild) return;

      const result = await this.pool.query(
        `SELECT kill_feed_channel_id FROM guild_channels WHERE guild_id = $1`,
        [guildId]
      );

      const channelId = result.rows[0]?.kill_feed_channel_id;
      if (!channelId) return;

      const channel = await guild.channels.fetch(channelId).catch(() => null);
      if (!channel) return;

      const emoji = notif.level === 'SEVERE' ? '🚨' : notif.level === 'WARNING' ? '⚠️' : 'ℹ️';
      const color = notif.level === 'SEVERE' ? 0xff0000 : notif.level === 'WARNING' ? 0xffa500 : 0x0099ff;

      await channel.send({
        embeds: [
          {
            title: `${emoji} Nitrado ${notif.level} Notification`,
            description: notif.message || 'No message provided',
            color,
            fields: [
              { name: '🆔 Service ID', value: String(serviceId), inline: true },
              { name: '📋 Type', value: notif.type || 'N/A', inline: true },
              notif.message_long
                ? { name: '📝 Details', value: notif.message_long.substring(0, 1000) }
                : null,
            ].filter(Boolean),
            timestamp: new Date(notif.created_at || Date.now()).toISOString(),
            footer: { text: 'Nitrado Service Alert' },
          },
        ],
      });

      logger.info(`🔔 Sent Discord alert for service ${serviceId} (${notif.level})`);
    } catch (error) {
      logger.error(`❌ Error sending Discord alert:`, error.message);
    }
  }
}

module.exports = NitradoNotificationsMonitor;

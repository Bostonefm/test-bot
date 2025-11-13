
const db = require('./db');
const logger = require('./logger');

class ReminderProcessor {
  constructor(client) {
    this.client = client;
    this.intervalId = null;
  }

  start() {
    // Check for due reminders every minute
    this.intervalId = setInterval(() => {
      this.processReminders();
    }, 60000);
    
    logger.info('Reminder processor started');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('Reminder processor stopped');
  }

  async processReminders() {
    try {
      const dueReminders = await db.query(
        'SELECT * FROM tickets WHERE type = $1 AND status = $2 AND resolved_at <= NOW()',
        ['reminder', 'scheduled']
      );

      for (const reminder of dueReminders.rows) {
        await this.sendReminder(reminder);
        
        // Mark as completed
        await db.query(
          'UPDATE tickets SET status = $1 WHERE ticket_id = $2',
          ['completed', reminder.ticket_id]
        );
      }
    } catch (error) {
      logger.error('Error processing reminders:', error);
    }
  }

  async sendReminder(reminder) {
    try {
      const user = await this.client.users.fetch(reminder.created_by);
      const channelId = reminder.data?.channel_id;
      
      if (channelId) {
        const channel = await this.client.channels.fetch(channelId);
        if (channel) {
          await channel.send(`⏰ <@${user.id}> **Reminder:** ${reminder.title}`);
        }
      } else {
        await user.send(`⏰ **Reminder:** ${reminder.title}`);
      }
    } catch (error) {
      logger.error('Error sending reminder:', error);
    }
  }
}

module.exports = ReminderProcessor;

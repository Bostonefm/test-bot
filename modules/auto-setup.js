
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const logger = require('./logger');

class AutomatedServerSetup {
  constructor(client) {
    this.client = client;
  }

  async setupNewServer(guild) {
    try {
      if (process.env.AUTO_SETUP_CHANNELS !== 'true') return;

      logger.info(`Starting automated setup for server: ${guild.name}`);

      // Create ticket category
      const ticketCategory = await guild.channels.create({
        name: '🎫 Support Tickets',
        type: ChannelType.GuildCategory,
        position: 0
      });

      // Create ticket info channel
      const ticketInfo = await guild.channels.create({
        name: '📋-ticket-info',
        type: ChannelType.GuildText,
        parent: ticketCategory,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [PermissionFlagsBits.SendMessages]
          }
        ]
      });

      // Send setup message with ticket button
      const setupEmbed = {
        title: '🎫 Support Ticket System',
        description: 'Need help? Click the button below to create a support ticket!\n\n' +
                    '**Available Commands:**\n' +
                    '• `/ticket-create` - Create a new ticket\n' +
                    '• `/ticket-list` - View your tickets\n' +
                    '• `/ticket-close` - Close a ticket\n\n' +
                    '**For Admins:**\n' +
                    '• `/ticket-button` - Setup instant ticket buttons\n' +
                    '• `/ticket-bulk` - Bulk operations\n' +
                    '• `/ticket-priority` - Change ticket priority',
        color: 0xFFD700,
        footer: { text: 'Grizzly Assistant Bot - Automated Setup' }
      };

      await ticketInfo.send({ 
        embeds: [setupEmbed],
        components: [{
          type: 1,
          components: [{
            type: 2,
            style: 1,
            label: '🎫 Create Ticket',
            custom_id: 'create_ticket'
          }]
        }]
      });

      // Update server registration with setup info
      await db.query(
        'UPDATE registered_servers SET ticket_category_id = $1, setup_completed = $2 WHERE guild_id = $3',
        [ticketCategory.id, true, guild.id]
      );

      logger.info(`✅ Automated setup completed for ${guild.name}`);

    } catch (error) {
      logger.error(`Failed automated setup for ${guild.name}:`, error);
    }
  }

  async setupExistingServers() {
    try {
      const unsetupServers = await db.query(
        'SELECT * FROM registered_servers WHERE setup_completed IS NULL OR setup_completed = false'
      );

      for (const server of unsetupServers.rows) {
        const guild = this.client.guilds.cache.get(server.guild_id);
        if (guild) {
          await this.setupNewServer(guild);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit protection
        }
      }
    } catch (error) {
      logger.error('Failed to setup existing servers:', error);
    }
  }
}

module.exports = AutomatedServerSetup;

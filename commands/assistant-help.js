const { SlashCommandBuilder } = require('discord.js');
const PermissionManager = require('../modules/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('assistant-help')
    .setDescription('Show all available Grizzly Bot commands and features'),

  async execute(interaction) {
    const userLevel = PermissionManager.getUserLevel(interaction.member);
    const isStaff = PermissionManager.hasAccess(interaction.member, 'STAFF', 'MANAGE_MESSAGES');
    const isMod = PermissionManager.hasAccess(interaction.member, 'MODERATOR', 'MANAGE_ROLES');
    const isAdmin = PermissionManager.hasAccess(interaction.member, 'ADMINISTRATOR', 'ADMINISTRATOR');

    const embed = {
      title: '🤖 **Grizzly Bot** - Command Center',
      description: '**Unified Discord Bot** • DayZ Server Management, Tickets, Moderation & Community',
      color: 0x00ff7f,
      fields: [
        {
          name: '🎫 **Support System**',
          value: '`/ticket-create` - Open a support ticket\n`/ticket-close` - Close current ticket' + 
                 (isStaff ? '\n`/ticket-list` - View all tickets **(Staff)**' : '') +
                 '\n`/server-info` - Server stats & information',
          inline: true
        },
        {
          name: '👤 **User Features**',
          value: '`/profile [user]` - View Discord profile stats\n`/balance` - Check your Grizzly Coins\n`/quick-links` - Community resources',
          inline: true
        },
        {
          name: '📋 **Productivity**',
          value: '`/todo` - Manage your personal todo list\n`/remind` - Set personal reminders\n`/apply` - Apply for server roles',
          inline: true
        }
      ],
      footer: { 
        text: `Your Level: ${userLevel}` 
      }
    };

    if (isMod) {
      embed.fields.push({
        name: '🛡️ **Moderation** (Staff Only)',
        value: '`/mod-ban` • `/mod-unban` • `/mute` • `/kick`\n`/approve` • `/deny` • `/announce`',
        inline: true
      });
    }

    if (isStaff) {
      embed.fields.push({
        name: '⚙️ **Server Management** (Staff Only)',
        value: '`/poll` - Create server polls\n`/role-sync` - Sync user roles\n`/server-status` - Check bot health',
        inline: true
      });
    }
    
    if (isAdmin) {
      embed.fields.push({
        name: '⚙️ **Administration** (Admin Only)',
        value: '`/setup-server` • `/poll`\n`/ticket-button` • `/ticket-list`',
        inline: false
      });
    }

    embed.fields.push({
      name: '🔧 **System**',
      value: '`/assistant-help` - Show this help\n`/help` - View all commands',
      inline: true
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

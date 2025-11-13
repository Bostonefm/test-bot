
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const PermissionManager = require('../modules/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin-guide')
    .setDescription('Complete administrative setup guide for new server admins')
    .addStringOption(option =>
      option.setName('section')
        .setDescription('Choose specific guide section')
        .addChoices(
          { name: '🚀 Quick Start Guide', value: 'quickstart' },
          { name: '🎫 Ticket System Setup', value: 'tickets' },
          { name: '👥 Role & Permission Management', value: 'roles' },
          { name: '📊 Server Analytics & Monitoring', value: 'analytics' },
          { name: '🛡️ Moderation & Security', value: 'moderation' },
          { name: '⚙️ Advanced Features', value: 'advanced' }
        )),

  execute: async interaction => {
    if (!PermissionManager.isAdmin(interaction.member)) {
      return interaction.reply({ 
        content: PermissionManager.createErrorMessage('ADMIN'), 
        ephemeral: true 
      });
    }

    const section = interaction.options.getString('section') || 'quickstart';

    const guides = {
      quickstart: {
        title: '🚀 Quick Start Admin Guide',
        description: '**Essential steps to get your server running professionally:**',
        fields: [
          {
            name: '1️⃣ **Initial Server Setup**',
            value: '• Run `/subscriber-setup` for streamlined admin structure\n• Use `/add-information-category` for welcome/rules channels\n• Use `/add-community-category` for general chat areas',
            inline: false
          },
          {
            name: '2️⃣ **Enable Ticket System**',
            value: '• Run `/ticket-button` in your #create-ticket channel\n• Test with `/ticket-create` to ensure it works\n• Check `/ticket-list` to manage support requests',
            inline: false
          },
          {
            name: '3️⃣ **Configure Roles & Permissions**',
            value: '• Auto-roles created: Member, Staff, Moderator, Admin\n• Assign staff roles manually to team members\n• Use `/server-info` to verify role structure',
            inline: false
          },
          {
            name: '4️⃣ **Essential Commands to Know**',
            value: '• `/help` - View all available commands\n• `/server-status` - Check bot health\n• `/announce` - Send official announcements\n• `/mod-logs` - View moderation history',
            inline: false
          }
        ],
        color: 0x00FF7F
      },

      tickets: {
        title: '🎫 Professional Ticket System Guide',
        description: '**Complete ticket system setup and management:**',
        fields: [
          {
            name: '📋 **Initial Setup**',
            value: '• Run `/ticket-button` in #create-ticket channel\n• Verify ticket-log channel exists for staff notifications\n• Test ticket creation with `/ticket-create`',
            inline: false
          },
          {
            name: '🛠️ **Staff Management Commands**',
            value: '• `/ticket-list` - View all open tickets\n• `/ticket-close` - Close resolved tickets\n• `/ticket-priority` - Set priority levels\n• `/ticket-bulk` - Bulk operations (delete old tickets)',
            inline: false
          },
          {
            name: '🌐 **Web Dashboard Access**',
            value: '• Visit: `https://tickets.grizzlygaming-gg.com`\n• Login with Discord to manage tickets\n• View analytics and ticket history\n• Export ticket data for records',
            inline: false
          },
          {
            name: '⚡ **Best Practices**',
            value: '• Respond to tickets within 24 hours\n• Use ticket-log for team coordination\n• Set priorities: High for urgent issues\n• Archive completed tickets monthly',
            inline: false
          }
        ],
        color: 0xFF6B35
      },

      roles: {
        title: '👥 Role & Permission Management',
        description: '**Professional role hierarchy and permission system:**',
        fields: [
          {
            name: '🎯 **Auto-Created Roles**',
            value: '• **Member** (Gray) - Basic chat permissions, auto-assigned\n• **Verified** (Green) - Enhanced permissions\n• **Staff** (Blue) - Manage messages, kick members\n• **Moderator** (Red) - Ban members, manage channels\n• **Admin** (Orange) - Full administrator access',
            inline: false
          },
          {
            name: '⚙️ **Permission Structure**',
            value: '• **Information Channels**: Staff can post, members view\n• **Support Channels**: Everyone can access\n• **Staff Areas**: Staff/Mod/Admin only\n• **Server Management**: Admin/Mod view only',
            inline: false
          },
          {
            name: '🔧 **Role Assignment**',
            value: '• Member role assigned automatically on join\n• Manually assign Staff/Moderator roles\n• Use Discord\'s role hierarchy\n• Regular role audits recommended',
            inline: false
          }
        ],
        color: 0x3498DB
      },

      analytics: {
        title: '📊 Server Analytics & Monitoring',
        description: '**Track your server performance and growth:**',
        fields: [
          {
            name: '📈 **Available Analytics**',
            value: '• `/server-info` - Complete server statistics\n• `/server-status` - Bot health and uptime\n• #server-logs - Real-time activity monitoring\n• #join-leave-log - Member activity tracking',
            inline: false
          },
          {
            name: '🎯 **Key Metrics to Monitor**',
            value: '• Daily active members\n• Ticket response times\n• Channel activity levels\n• Staff engagement rates\n• New member retention',
            inline: false
          },
          {
            name: '🌐 **Web Dashboard Analytics**',
            value: '• Login at: `https://tickets.grizzlygaming-gg.com`\n• View ticket statistics and trends\n• Member activity reports\n• Download data for external analysis',
            inline: false
          }
        ],
        color: 0x9932CC
      },

      moderation: {
        title: '🛡️ Moderation & Security Guide',
        description: '**Maintain a safe and professional community:**',
        fields: [
          {
            name: '⚔️ **Moderation Commands**',
            value: '• `/mod-ban [user] [reason]` - Ban with logging\n• `/mod-unban [user]` - Unban members\n• `/kick [user] [reason]` - Kick members\n• `/mute [user] [duration]` - Temporary mute\n• `/mod-logs [user]` - View moderation history',
            inline: false
          },
          {
            name: '🔍 **Monitoring Tools**',
            value: '• #reports - Staff reports and documentation\n• `/auto-filter` - Smart content filtering\n• Anti-spam protection (automatic)\n• Message logging in #message-log',
            inline: false
          },
          {
            name: '📝 **Best Practices**',
            value: '• Always provide reasons for actions\n• Document serious violations\n• Use progressive discipline\n• Regular staff training sessions\n• Review moderation logs weekly',
            inline: false
          }
        ],
        color: 0xE74C3C
      },

      advanced: {
        title: '⚙️ Advanced Features & Automation',
        description: '**Unlock the full potential of your server:**',
        fields: [
          {
            name: '🤖 **Automation Features**',
            value: '• Welcome messages (automatic)\n• Role assignment on join\n• Anti-spam protection\n• Content filtering\n• Staff notifications\n• Audit logging',
            inline: false
          },
          {
            name: '📢 **Community Engagement**',
            value: '• `/poll` - Create interactive polls\n• `/announce` - Professional announcements\n• `/remind` - Set community reminders\n• Events scheduling and management',
            inline: false
          },
          {
            name: '🔗 **Integration Options**',
            value: '• RESTful API connectivity\n• Database-driven user management\n• Multi-server deployment support\n• Custom bot integrations\n• Webhook notifications',
            inline: false
          },
          {
            name: '🎛️ **Server Features Management**',
            value: '• `/server-features` - Toggle features on/off\n• `/bot-features` - Configure bot behavior\n• Custom command creation\n• Advanced permission overrides',
            inline: false
          }
        ],
        color: 0xFFD700
      }
    };

    const guide = guides[section];
    
    const embed = new EmbedBuilder()
      .setTitle(guide.title)
      .setDescription(guide.description)
      .setColor(guide.color)
      .addFields(guide.fields)
      .setFooter({ 
        text: 'Grizzly Assistant Bot - Professional Server Management | Use /admin-guide for other sections' 
      })
      .setTimestamp();

    // Add navigation footer for all sections except quickstart
    if (section !== 'quickstart') {
      embed.addFields({
        name: '🧭 **Navigation**',
        value: 'Use `/admin-guide` to see all available sections or return to Quick Start guide.',
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

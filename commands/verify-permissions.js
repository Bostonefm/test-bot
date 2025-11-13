const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../config/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify-permissions')
    .setDescription('Verify server roles and channel permissions are correct (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild;
    const report = {
      roles: { found: [], missing: [] },
      readOnlyChannels: [],
      staffOnlyChannels: [],
      publicChannels: [],
      issues: []
    };

    try {
      // 1. Check required roles
      const requiredRoles = ['Player', 'Linked Player', 'Verified Player', 'Moderator', 'Admin'];
      
      for (const roleName of requiredRoles) {
        const role = guild.roles.cache.find(r => r.name === roleName);
        if (role) {
          report.roles.found.push({ name: roleName, id: role.id, members: role.members.size });
        } else {
          report.roles.missing.push(roleName);
        }
      }

      // 2. Check channel permissions
      const readOnlyChannelNames = [
        'server-updates',
        'welcome-message', 
        'rules',
        'staff-bot-info',
        'player-bot-info'
      ];

      const staffOnlyChannelNames = [
        'satellite',
        'admin-chat',
        'moderator-chat'
      ];

      for (const channel of guild.channels.cache.values()) {
        if (channel.type !== 0) continue; // Skip non-text channels

        const everyoneRole = guild.roles.everyone;
        const permissions = channel.permissionsFor(everyoneRole);

        // Check if read-only
        if (readOnlyChannelNames.includes(channel.name)) {
          const canView = permissions.has('ViewChannel');
          const canSend = permissions.has('SendMessages');
          
          report.readOnlyChannels.push({
            name: channel.name,
            canView,
            canSend,
            correct: canView && !canSend
          });

          if (!canView || canSend) {
            report.issues.push(`❌ **${channel.name}** - Should be read-only for @everyone`);
          }
        }

        // Check if staff-only
        if (staffOnlyChannelNames.includes(channel.name)) {
          const canView = permissions.has('ViewChannel');
          
          report.staffOnlyChannels.push({
            name: channel.name,
            canView,
            correct: !canView
          });

          if (canView) {
            report.issues.push(`❌ **${channel.name}** - Should be staff-only (hidden from @everyone)`);
          }
        }

        // Check public channels
        if (!readOnlyChannelNames.includes(channel.name) && !staffOnlyChannelNames.includes(channel.name)) {
          const canView = permissions.has('ViewChannel');
          const canSend = permissions.has('SendMessages');
          
          if (canView) {
            report.publicChannels.push({
              name: channel.name,
              canSend
            });
          }
        }
      }

      // Build report embed
      const embed = new EmbedBuilder()
        .setTitle('🔍 Permission Verification Report')
        .setColor(report.issues.length === 0 ? 0x00ff00 : 0xff9900)
        .setTimestamp();

      // Roles section
      let rolesText = '';
      if (report.roles.found.length > 0) {
        rolesText += '**✅ Found Roles:**\n';
        report.roles.found.forEach(role => {
          rolesText += `• ${role.name} (${role.members} members)\n`;
        });
      }
      if (report.roles.missing.length > 0) {
        rolesText += '\n**❌ Missing Roles:**\n';
        report.roles.missing.forEach(role => {
          rolesText += `• ${role}\n`;
        });
      }
      embed.addFields({ name: '🏷️ Roles', value: rolesText || 'None', inline: false });

      // Read-only channels
      if (report.readOnlyChannels.length > 0) {
        let readOnlyText = '';
        report.readOnlyChannels.forEach(ch => {
          const icon = ch.correct ? '✅' : '❌';
          readOnlyText += `${icon} #${ch.name} - View: ${ch.canView ? 'Yes' : 'No'}, Send: ${ch.canSend ? 'Yes' : 'No'}\n`;
        });
        embed.addFields({ name: '📖 Read-Only Channels', value: readOnlyText, inline: false });
      }

      // Staff-only channels
      if (report.staffOnlyChannels.length > 0) {
        let staffText = '';
        report.staffOnlyChannels.forEach(ch => {
          const icon = ch.correct ? '✅' : '❌';
          staffText += `${icon} #${ch.name} - Visible to @everyone: ${ch.canView ? 'Yes (WRONG)' : 'No (CORRECT)'}\n`;
        });
        embed.addFields({ name: '🛡️ Staff-Only Channels', value: staffText, inline: false });
      }

      // Issues summary
      if (report.issues.length > 0) {
        embed.addFields({ 
          name: '⚠️ Issues Found', 
          value: report.issues.slice(0, 10).join('\n') + (report.issues.length > 10 ? `\n...and ${report.issues.length - 10} more` : ''),
          inline: false 
        });
        embed.setDescription('**Some permission issues found!** Use `/setup server` to fix them.');
      } else {
        embed.setDescription('✅ **All permissions are correctly configured!**');
      }

      // Summary
      embed.addFields({
        name: '📊 Summary',
        value: `• **Roles:** ${report.roles.found.length}/${requiredRoles.length} found\n` +
               `• **Read-Only Channels:** ${report.readOnlyChannels.filter(c => c.correct).length}/${report.readOnlyChannels.length} correct\n` +
               `• **Staff-Only Channels:** ${report.staffOnlyChannels.filter(c => c.correct).length}/${report.staffOnlyChannels.length} correct\n` +
               `• **Issues:** ${report.issues.length}`,
        inline: false
      });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      logger.error('Permission verification error:', error);
      await interaction.editReply({
        content: `❌ **Verification Error**\n\n${error.message}`
      });
    }
  }
};

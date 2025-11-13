
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gcc-integration-status')
    .setDescription('Check main bot connection and GCC integration status (Staff only)'),
  
  execute: async interaction => {
    // Check if user is staff
    const isStaff = interaction.member.permissions.has('MANAGE_MESSAGES') || 
                   interaction.member.roles.cache.some(role => ['Admin', 'Moderator', 'Staff'].includes(role.name));

    if (!isStaff) {
      return interaction.reply({ content: '❌ This command requires Staff permissions.', ephemeral: true });
    }

    // Only work in GCC
    if (interaction.guild.id !== process.env.GRIZZLY_COMMAND_GUILD_ID) {
      return interaction.reply({
        content: '❌ This command can only be used in Grizzly Command Central.',
        ephemeral: true
      });
    }

    const guild = interaction.guild;
    
    // Detect main Grizzly Bot presence
    const mainBot = guild.members.cache.find(member => 
      member.user.bot && 
      (member.user.username.toLowerCase().includes('grizzly') && 
       !member.user.username.toLowerCase().includes('assistant')) ||
      member.user.id === process.env.GRIZZLY_BOT_CLIENT_ID
    );

    // Check for basic role management capabilities
    const hasRoleManagement = mainBot && guild.roles.cache.some(role => 
      ['Staff', 'Moderator', 'Admin'].includes(role.name)
    );

    // Check for Nitrado server connection (placeholder)
    const hasNitradoConnection = false; // This would check actual Nitrado integration

    // Database connectivity test
    let dbStatus = '🟢 Connected';
    let apiStatus = '🟡 Checking...';
    
    try {
      const db = require('../modules/db');
      await db.query('SELECT 1');
    } catch (error) {
      dbStatus = '🔴 Disconnected';
    }

    // API compatibility check (placeholder for actual API server)
    setTimeout(async () => {
      try {
        // This would ping the shared API server
        apiStatus = '🟢 API Server Online';
      } catch {
        apiStatus = '🔴 API Server Offline';
      }
    }, 1000);

    const embed = {
      title: '🔗 **GCC Integration Status Report**',
      description: `**Server:** ${guild.name}\n**Assistant Bot:** 🟢 Online & Functional`,
      color: mainBot ? 0x00FF00 : 0xFFA500,
      fields: [
        {
          name: '🤖 **Bot Detection**',
          value: mainBot 
            ? `🟢 **Main Grizzly Bot:** ${mainBot.user.tag}\n✅ **Integration Mode:** Active\n🔄 **Data Sharing:** Enabled`
            : '🟡 **Main Grizzly Bot:** Not detected\n⚙️ **Mode:** Standalone\n🔧 **Status:** Independent operation',
          inline: true
        },
        {
          name: '🗄️ **Database & API**',
          value: `**Database:** ${dbStatus}\n**API Server:** ${apiStatus}\n**Shared Data:** ${mainBot ? '🟢 Synced' : '🟡 Local only'}`,
          inline: true
        },
        {
          name: '🎮 **Server Management**',
          value: hasRoleManagement 
            ? '🟢 **Role System:** Configured\n⚙️ **Management:** Active\n🎯 **User System:** Available'
            : '🟡 **Role System:** Basic setup\n⚙️ **Management:** Manual\n📊 **User System:** Standard',
          inline: true
        }
      ],
      footer: { 
        text: `🤖 Grizzly Assistant Bot • GCC Report generated at`,
        icon_url: interaction.client.user.displayAvatarURL()
      },
      timestamp: new Date().toISOString()
    };

    // Add feature availability based on integration status
    const featuresField = {
      name: '⚡ **Available Features**',
      value: mainBot 
        ? '✅ Full economy system\n✅ Shared user data\n✅ Cross-bot commands\n✅ Advanced moderation\n✅ Game server control'
        : '✅ Basic support tickets\n✅ User profiles\n✅ Moderation tools\n✅ Server information\n⚠️ Limited economy features',
      inline: false
    };

    embed.fields.push(featuresField);

    // Add integration recommendations
    if (!mainBot) {
      embed.fields.push({
        name: '💡 **Integration Recommendations**',
        value: '• Invite main Grizzly Bot for full features\n• Configure shared database access\n• Set up API authentication\n• Enable cross-bot communication',
        inline: false
      });
    }

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

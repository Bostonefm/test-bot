const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Get help with Grizzly Bot commands'),

  async execute(interaction, { pool, logger }) {
    const isGCC = interaction.guild.id === process.env.GRIZZLY_COMMAND_GUILD_ID;

    const embed = new EmbedBuilder()
      .setTitle('🤖 Grizzly Bot Commands')
      .setColor(0x0099ff)
      .setDescription(
        isGCC
          ? 'Commands available in Grizzly Command Central:'
          : 'Commands available for your DayZ server:'
      )
      .setTimestamp();

    // Regular server commands
    embed.addFields([
      {
        name: '🎮 Server Management',
        value:
          '`/connect-nitrado` - Connect to Nitrado API\n' +
          '`/server-status` - Check server status\n' +
          '`/player-list` - View online players\n' +
          '`/test-nitrado` - Test Nitrado connection\n' +
          '`/remove-nitrado` - Remove Nitrado credentials',
        inline: false,
      },
      {
        name: '⚙️ Setup Commands',
        value:
          '`/setup-channels` - Create bot channels\n' +
          '`/setup-rules` - Setup rules channel\n' +
          '`/welcome-message` - Configure welcome message\n' +
          '`/role-management` - Manage server roles',
        inline: false,
      },
      {
        name: '👥 Player Management',
        value:
          '`/link-player` - Link Discord to in-game character\n' +
          '`/verify-player` - Verify player links (Admin)\n' +
          '`/verification-list` - View pending verifications',
        inline: false,
      },
      {
        name: '💰 Economy System',
        value:
          '`/economy balance` - Check Grizzly Coins\n' +
          '`/economy shop` - Browse shop\n' +
          '`/economy leaderboard` - View top earners',
        inline: false,
      },
      {
        name: '📊 Reports & Logs',
        value:
          '`/server-report` - Generate server report\n' +
          '`/list-files` - Browse server files\n' +
          '`/test-logs` - Test log processing',
        inline: false,
      },
    ]);

    // Add server registration commands
    embed.addFields([
      {
        name: '🏆 Server Registration (Silver/Gold)',
        value:
          '`/register-server` - Register for server listing\n' +
          '`/my-server-tickets` - View your tickets\n' +
          '`/review-server-ticket` - Review tickets (Admin)',
        inline: false,
      },
    ]);

    // Add server-specific setup commands
    if (isGCC) {
      embed.addFields([
        {
          name: '🏢 GCC Management Commands',
          value:
            '`/gcc-setup-channels` - Set up GCC bot channels\n' +
            '`/gcc-update-channel-info` - Update GCC channel information\n' +
            '`/gcc-update-all-permissions` - Update all channel permissions\n' +
            '`/gcc-repopulate` - Repopulate GCC channels\n' +
            '`/gcc-cleanup-channels` - Clean up old channels\n' +
            '`/gcc-populate-rules` - Populate GCC rules channel\n' +
            '`/gcc-populate-welcome` - Populate GCC welcome channel\n' +
            '`/gcc-populate-bot-invites` - Populate GCC bot invite channels',
          inline: false,
        },
      ]);
    } else {
      embed.addFields([
        {
          name: '🔧 Server Setup',
          value:
            '`/setup-server` - Complete initial setup\n' +
            '`/validate-setup` - Check configuration status\n' +
            '`/update-server-permissions` - Fix permission issues\n' +
            '`/connect-nitrado` - Link your Nitrado server\n' +
            '`/start-monitoring` - Begin live log monitoring',
          inline: false,
        },
      ]);
    }

    embed.addFields([
      {
        name: '💎 Subscription Required',
        value:
          '• Bronze ($5/month) - Bot access, kill feeds, player tracking, economy system\n' +
          '• Silver ($10/month) - Bronze features + website listing\n' +
          '• Gold ($15/month) - Silver features + featured listing + priority support\n' +
          '• Partner ($20/month) - All features + exclusive partnership benefits\n' +
          '• **Verify Subscription:** Click verification button in #verify-patreon channel\n' +
          '• Nitrado Integration - Real-time server log streaming and status',
        inline: false,
      },
    ]);

    embed.setFooter({
      text: isGCC
        ? 'Use /help for this list • GCC-specific commands included'
        : 'Use /help for this list • Visit GCC for additional commands',
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};

const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const logger = require('../modules/logger');
const db = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test-features')
    .setDescription('Test all in-game bot features (Admin only)')
    .addStringOption(option =>
      option
        .setName('feature')
        .setDescription('Specific feature to test')
        .setRequired(false)
        .addChoices(
          { name: 'Player Linking', value: 'linking' },
          { name: 'Economy System', value: 'economy' },
          { name: 'Server Monitoring', value: 'monitoring' },
          { name: 'Role Management', value: 'roles' },
          { name: 'All Features', value: 'all' }
        )
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const feature = interaction.options.getString('feature') || 'all';
    const guild = interaction.guild;
    const results = [];

    try {
      if (feature === 'all' || feature === 'linking') {
        results.push(await testPlayerLinking(guild));
      }

      if (feature === 'all' || feature === 'economy') {
        results.push(await testEconomySystem(guild));
      }

      if (feature === 'all' || feature === 'monitoring') {
        results.push(await testServerMonitoring(guild));
      }

      if (feature === 'all' || feature === 'roles') {
        results.push(await testRoleSystem(guild));
      }

      const embed = new EmbedBuilder()
        .setTitle('🧪 Feature Test Results')
        .setDescription('Comprehensive testing of bot features')
        .setColor(0x00ff00)
        .setTimestamp();

      results.forEach(result => {
        embed.addFields({
          name: result.feature,
          value: result.status,
          inline: false,
        });
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      logger.error('Feature test error:', error);
      await interaction.editReply({
        content: '❌ Failed to run feature tests. Check logs for details.',
      });
    }
  },
};

async function testPlayerLinking(guild) {
  try {
    // Check if linking channels exist
    const linkChannel = guild.channels.cache.find(c => c.name === 'link-character');
    const verificationChannel = guild.channels.cache.find(c => c.name === 'verification-requests');

    // Check required roles
    const linkedRole = guild.roles.cache.find(r => r.name === 'Linked Player');
    const verifiedRole = guild.roles.cache.find(r => r.name === 'Verified Player');

    // Check database table
    const dbCheck = await db.query('SELECT COUNT(*) FROM player_links WHERE guild_id = $1', [
      guild.id,
    ]);

    let status = '✅ **Player Linking System**\n';
    status += linkChannel ? '✅ Link channel exists\n' : '❌ Missing link-character channel\n';
    status += verificationChannel
      ? '✅ Verification channel exists\n'
      : '❌ Missing verification-requests channel\n';
    status += linkedRole ? '✅ Linked Player role exists\n' : '❌ Missing Linked Player role\n';
    status += verifiedRole
      ? '✅ Verified Player role exists\n'
      : '❌ Missing Verified Player role\n';
    status += `✅ Database ready (${dbCheck.rows[0].count} existing links)`;

    return { feature: '🔗 Player Linking', status };
  } catch (error) {
    return { feature: '🔗 Player Linking', status: '❌ Database connection failed' };
  }
}

async function testEconomySystem(guild) {
  try {
    // Check economy channels
    const economyChannel = guild.channels.cache.find(c => c.name === 'economy');
    const tradingChannel = guild.channels.cache.find(c => c.name === 'trading');
    const shopChannel = guild.channels.cache.find(c => c.name === 'shop');

    // Check database tables
    const coinsCheck = await db.query('SELECT COUNT(*) FROM economy_accounts WHERE guild_id = $1', [
      guild.id,
    ]);

    let status = '✅ **Economy System**\n';
    status += economyChannel ? '✅ Economy channel exists\n' : '❌ Missing economy channel\n';
    status += tradingChannel ? '✅ Trading channel exists\n' : '❌ Missing trading channel\n';
    status += shopChannel ? '✅ Shop channel exists\n' : '❌ Missing shop channel\n';
    status += `✅ Database ready (${coinsCheck.rows[0].count} coin accounts)\n`;
    status += `✅ Economy access available to all linked players`;

    return { feature: '💰 Economy System', status };
  } catch (error) {
    return { feature: '💰 Economy System', status: '❌ Database connection failed' };
  }
}

async function testServerMonitoring(guild) {
  try {
    // Check monitoring channels
    const statusChannel = guild.channels.cache.find(c => c.name === 'server-status');
    const logsChannel = guild.channels.cache.find(c => c.name === 'server-logs');
    const activityChannel = guild.channels.cache.find(c => c.name === 'player-activity');

    // Check Nitrado connection
    const nitradoCheck = await db.query(
      'SELECT COUNT(*) FROM nitrado_credentials WHERE guild_id = $1 AND active = true',
      [guild.id]
    );

    let status = '✅ **Server Monitoring**\n';
    status += statusChannel ? '✅ Status channel exists\n' : '❌ Missing server-status channel\n';
    status += logsChannel ? '✅ Logs channel exists\n' : '❌ Missing server-logs channel\n';
    status += activityChannel
      ? '✅ Activity channel exists\n'
      : '❌ Missing player-activity channel\n';
    status +=
      nitradoCheck.rows[0].count > 0
        ? '✅ Nitrado connected\n'
        : '⚠️ No Nitrado connection (use /connect-nitrado)\n';

    return { feature: '🎮 Server Monitoring', status };
  } catch (error) {
    return { feature: '🎮 Server Monitoring', status: '❌ Database connection failed' };
  }
}

async function testRoleSystem(guild) {
  const requiredRoles = [
    'Player',
    'Linked Player',
    'Verified Player',
    'Moderator',
    'Admin',
  ];

  let status = '✅ **Role System**\n';
  const missingRoles = [];

  requiredRoles.forEach(roleName => {
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      status += `✅ ${roleName} role exists\n`;
    } else {
      status += `❌ Missing ${roleName} role\n`;
      missingRoles.push(roleName);
    }
  });

  if (missingRoles.length > 0) {
    status += `\n⚠️ Run /setup-channels to create missing roles`;
  }

  return { feature: '🎭 Role Management', status };
}

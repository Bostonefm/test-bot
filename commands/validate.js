const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const logger = require('../modules/logger');
const subscriberConfig = require('../config/subscriber.config.json');
const { createNitradoAPI } = require('../modules/nitrado');
const { DayZLogAnalyzer } = require('../modules/logAnalyzer');
const { pool } = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('validate')
    .setDescription('Validate server setup or log processing')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Check configuration status of your DayZ server')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('logs')
        .setDescription('Validate log processing and show detailed statistics')
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'setup':
          await handleSetupValidation(interaction);
          break;
        case 'logs':
          await handleLogsValidation(interaction);
          break;
      }
    } catch (error) {
      logger.error(`Error in validate ${subcommand}:`, error);
      const reply = {
        content: `❌ **Validation Error**\n\n${error.message}`,
        ephemeral: true
      };
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  },
};

/**
 * Handle setup validation
 */
async function handleSetupValidation(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const guild = interaction.guild;

  // Prevent running in GCC
  if (guild.id === process.env.GRIZZLY_COMMAND_GUILD_ID) {
    return await interaction.editReply({
      content: '❌ This command is for external servers only.',
    });
  }

  const validation = {
    roles: { missing: [], present: [] },
    categories: { missing: [], present: [] },
    channels: { missing: [], present: [] },
    nitrado: { connected: false, hasCredentials: false },
    subscription: { tier: 'free', active: false },
    monitoring: { available: false, active: false }
  };

  // Check roles
  const requiredRoles = ['Player', 'Linked Player', 'Verified Player', 'Trader', 'Moderator', 'Admin'];
  for (const roleName of requiredRoles) {
    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      validation.roles.present.push(roleName);
    } else {
      validation.roles.missing.push(roleName);
    }
  }

  // Check categories and channels
  for (const categoryConfig of subscriberConfig.categories) {
    const category = guild.channels.cache.find(c => c.name === categoryConfig.name && c.type === 4);
    if (category) {
      validation.categories.present.push(categoryConfig.name);
      
      for (const channelName of categoryConfig.channels) {
        const channel = guild.channels.cache.find(c => c.name === channelName && c.parentId === category.id);
        if (channel) {
          validation.channels.present.push(channelName);
        } else {
          validation.channels.missing.push(channelName);
        }
      }
    } else {
      validation.categories.missing.push(categoryConfig.name);
      validation.channels.missing.push(...categoryConfig.channels);
    }
  }

  // Check subscription and Nitrado
  try {
    const subscriptionResult = await pool.query(
      'SELECT subscription_tier FROM guild_subscriptions WHERE guild_id = $1',
      [guild.id]
    );
    
    if (subscriptionResult.rows.length > 0) {
      validation.subscription.tier = subscriptionResult.rows[0].subscription_tier;
      validation.subscription.active = validation.subscription.tier && validation.subscription.tier !== 'None';
    }

    const nitradoResult = await pool.query(
      'SELECT service_id FROM nitrado_credentials WHERE guild_id = $1',
      [guild.id]
    );
    
    if (nitradoResult.rows.length > 0) {
      validation.nitrado.hasCredentials = true;
      validation.nitrado.connected = nitradoResult.rows[0].service_id != null;
    }

    validation.monitoring.available = validation.subscription.active && validation.nitrado.connected;
  } catch (error) {
    logger.error('Error checking subscription/Nitrado status:', error);
  }

  // Create validation report
  const embed = new EmbedBuilder()
    .setTitle('🔍 Server Validation Report')
    .setColor(validation.roles.missing.length === 0 && validation.channels.missing.length === 0 ? 0x00ff00 : 0xff9900)
    .setTimestamp();

  // Roles status
  embed.addFields({
    name: '🎭 Roles Status',
    value: `✅ Present: ${validation.roles.present.length}/6\n${validation.roles.missing.length > 0 ? `❌ Missing: ${validation.roles.missing.join(', ')}` : '✅ All roles present'}`,
    inline: false
  });

  // Channels status
  embed.addFields({
    name: '💬 Channels Status', 
    value: `✅ Present: ${validation.channels.present.length}\n${validation.channels.missing.length > 0 ? `❌ Missing: ${validation.channels.missing.slice(0, 5).join(', ')}${validation.channels.missing.length > 5 ? '...' : ''}` : '✅ All channels present'}`,
    inline: false
  });

  // Subscription status
  embed.addFields({
    name: '💎 Subscription Status',
    value: `Tier: ${validation.subscription.tier.toUpperCase()}\nStatus: ${validation.subscription.active ? '✅ Active' : '❌ Free (Limited Features)'}`,
    inline: true
  });

  // Nitrado status
  embed.addFields({
    name: '🔧 Nitrado Connection',
    value: `Credentials: ${validation.nitrado.hasCredentials ? '✅' : '❌'}\nConnected: ${validation.nitrado.connected ? '✅' : '❌'}`,
    inline: true
  });

  // Monitoring status
  embed.addFields({
    name: '📊 Live Monitoring',
    value: validation.monitoring.available ? '✅ Available' : '❌ Requires subscription + Nitrado',
    inline: true
  });

  // Recommendations
  const recommendations = [];
  if (validation.roles.missing.length > 0 || validation.channels.missing.length > 0) {
    recommendations.push('• Run `/setup server` to create missing components');
  }
  if (!validation.subscription.active) {
    recommendations.push('• Subscribe via Patreon for live monitoring features');
  }
  if (!validation.nitrado.connected) {
    recommendations.push('• Use `/nitrado-auth` to link your server');
  }
  if (validation.monitoring.available) {
    recommendations.push('• Use `/start-monitoring` to begin live log monitoring');
  }

  if (recommendations.length > 0) {
    embed.addFields({
      name: '💡 Recommendations',
      value: recommendations.join('\n'),
      inline: false
    });
  } else {
    embed.addFields({
      name: '🎉 Setup Complete!',
      value: 'Your server is fully configured and ready to use.',
      inline: false
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

/**
 * Handle logs validation
 */
async function handleLogsValidation(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const guildId = interaction.guildId;

    // Get Nitrado credentials
    const result = await pool.query(
      'SELECT service_id, encrypted_token, token_iv, auth_tag FROM nitrado_credentials WHERE guild_id = $1 AND service_id IS NOT NULL',
      [guildId]
    );

    if (result.rows.length === 0) {
      return interaction.editReply({
        content: '❌ No Nitrado connection found. Use `/register-server` first.',
      });
    }

    const { service_id, encrypted_token, token_iv, auth_tag } = result.rows[0];

    // Decrypt token
    const { decrypt } = require('../utils/encryption');
    const decryptedToken = decrypt(encrypted_token, token_iv, auth_tag);

    const api = createNitradoAPI(decryptedToken);
    const logAnalyzer = new DayZLogAnalyzer();

    await interaction.editReply({
      content: '🔍 Validating log processing... This may take a moment.',
    });

    // Get DayZ path and files
    const pathResult = await api.findDayzPath(service_id);
    if (!pathResult.success) {
      return interaction.editReply({
        content: '❌ Failed to find DayZ path on server.',
      });
    }

    logger.info(`📁 Found ${pathResult.files.length} files at ${pathResult.path}`);

    // Get restart.log for reference timestamp
    let lastRestartTimestamp = null;
    const restartLog = pathResult.files.find(f => (f.name || f.filename) === 'restart.log');
    if (restartLog && restartLog.size > 0) {
      try {
        const restartContent = await api.downloadFile(
          service_id,
          `${pathResult.path}/restart.log`
        );
        lastRestartTimestamp = logAnalyzer.getLastRestartTimestamp(
          restartContent.data || restartContent
        );
      } catch (error) {
        logger.warn(`Could not read restart.log: ${error.message}`);
      }
    }

    // Get the most recent log files
    const logFiles = logAnalyzer.getMostRecentLogFiles(pathResult.files, 3, lastRestartTimestamp);

    if (logFiles.length === 0) {
      return interaction.editReply({
        content: `❌ No valid log files found.\n\nAvailable files: ${pathResult.files
          .slice(0, 10)
          .map(f => f.name || f.filename)
          .join(', ')}`,
      });
    }

    // Process each log file and collect statistics
    const validationResults = [];
    let totalEvents = 0;
    let totalLines = 0;

    for (const logFile of logFiles) {
      const fileName = logFile.name || logFile.filename;
      const filePath = `${pathResult.path}/${fileName}`;

      try {
        logger.info(`🔍 Validating ${fileName}...`);

        const fileContent = await api.downloadFile(service_id, filePath);
        const content = fileContent.data || fileContent;

        const lines = content.split('\n').filter(line => line.trim()).length;
        const events = logAnalyzer.processLogContent(content, service_id, fileName);

        const eventTypes = {};
        events.forEach(e => {
          eventTypes[e.type] = (eventTypes[e.type] || 0) + 1;
        });

        validationResults.push({
          fileName,
          fileSize: Math.round((logFile.size || 0) / 1024),
          lines,
          events: events.length,
          eventTypes,
          timestamp: logAnalyzer.extractTimestampFromFilename(fileName),
        });

        totalEvents += events.length;
        totalLines += lines;
      } catch (error) {
        logger.error(`Error processing ${fileName}: ${error.message}`);
        validationResults.push({
          fileName,
          error: error.message,
          fileSize: Math.round((logFile.size || 0) / 1024),
        });
      }
    }

    // Create validation report embed
    const embed = new EmbedBuilder()
      .setTitle('📊 Log Validation Report')
      .setColor('#00FF00')
      .setTimestamp();

    // Summary
    embed.addFields({
      name: '📈 Summary',
      value: `**Files Processed:** ${validationResults.length}\n**Total Lines:** ${totalLines.toLocaleString()}\n**Total Events:** ${totalEvents.toLocaleString()}\n**Last Restart:** ${lastRestartTimestamp ? new Date(lastRestartTimestamp).toLocaleString() : 'Unknown'}`,
      inline: false,
    });

    // File details
    for (const result of validationResults.slice(0, 3)) {
      if (result.error) {
        embed.addFields({
          name: `❌ ${result.fileName}`,
          value: `**Size:** ${result.fileSize}KB\n**Error:** ${result.error}`,
          inline: true,
        });
      } else {
        const eventSummary =
          Object.entries(result.eventTypes)
            .map(([type, count]) => `${type}: ${count}`)
            .slice(0, 3)
            .join('\n') || 'No events';

        embed.addFields({
          name: `✅ ${result.fileName}`,
          value: `**Size:** ${result.fileSize}KB\n**Lines:** ${result.lines}\n**Events:** ${result.events}\n${eventSummary}`,
          inline: true,
        });
      }
    }

    // Event type distribution
    const allEventTypes = {};
    validationResults.forEach(result => {
      if (result.eventTypes) {
        Object.entries(result.eventTypes).forEach(([type, count]) => {
          allEventTypes[type] = (allEventTypes[type] || 0) + count;
        });
      }
    });

    if (Object.keys(allEventTypes).length > 0) {
      const eventDistribution = Object.entries(allEventTypes)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([type, count]) => `${type}: ${count}`)
        .join('\n');

      embed.addFields({
        name: '🎯 Event Distribution',
        value: eventDistribution,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('Validate logs error:', error);
    await interaction.editReply({
      content: `❌ Error validating logs: ${error.message}`,
    });
  }
}

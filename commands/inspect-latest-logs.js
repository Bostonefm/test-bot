const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createNitradoAPI } = require('../modules/nitrado');
const { db } = require('../modules/db');
const { decrypt } = require('../utils/encryption');
const logger = require('../modules/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inspect-latest-logs')
    .setDescription('Inspect the content of the latest ADM/RPT log files')
    .addStringOption(option =>
      option.setName('service-id').setDescription('Nitrado service ID').setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('lines')
        .setDescription('Number of recent lines to show (default: 10, max: 50)')
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('raw')
        .setDescription('Show raw file content without processing')
        .setRequired(false)
    )
    .setDefaultMemberPermissions('0'), // Admin only

  async execute(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const serviceId = interaction.options.getString('service-id');
      const linesToShow = Math.min(interaction.options.getInteger('lines') || 10, 50);
      const showRaw = interaction.options.getBoolean('raw') || false;

      // Get API token
      const token = await this.getApiToken(serviceId);
      if (!token) {
        await interaction.editReply({
          content: '❌ **No API token found for this service ID**',
        });
        return;
      }

      const api = createNitradoAPI(token);
      const specificPath = '/games/ni8504127_1/noftp/dayzps/config';

      logger.info(`🔍 Inspecting latest logs in: ${specificPath}`);

      // List files in the specific path with timeout
      const response = await Promise.race([
        api.listFiles(serviceId, specificPath),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('API timeout - file listing took too long')), 2000)
        ),
      ]);
      const files = response.data?.entries || [];

      if (files.length === 0) {
        await interaction.editReply({
          content: '❌ **No files found in config directory**',
        });
        return;
      }

      // Filter for ADM and RPT files
      const logFiles = files.filter(file => {
        const name = file.name || file.filename || '';
        return (name.endsWith('.ADM') || name.endsWith('.RPT')) && name.includes('DayZServer_PS4');
      });

      if (logFiles.length === 0) {
        await interaction.editReply({
          content: '❌ **No DayZ log files found**',
        });
        return;
      }

      // Get the latest ADM and RPT files
      const admFiles = logFiles.filter(f => (f.name || f.filename).endsWith('.ADM'));
      const rptFiles = logFiles.filter(f => (f.name || f.filename).endsWith('.RPT'));

      const latestFiles = [];

      // Find latest ADM file
      if (admFiles.length > 0) {
        const latestADM = admFiles.reduce((latest, current) => {
          const currentModified = new Date(current.last_modified || current.mtime || 0);
          const latestModified = new Date(latest.last_modified || latest.mtime || 0);
          return currentModified > latestModified ? current : latest;
        });
        latestFiles.push(latestADM);
      }

      // Find latest RPT file
      if (rptFiles.length > 0) {
        const latestRPT = rptFiles.reduce((latest, current) => {
          const currentModified = new Date(current.last_modified || current.mtime || 0);
          const latestModified = new Date(latest.last_modified || latest.mtime || 0);
          return currentModified > latestModified ? current : latest;
        });
        latestFiles.push(latestRPT);
      }

      if (latestFiles.length === 0) {
        await interaction.editReply({
          content: '❌ **No latest log files found**',
        });
        return;
      }

      // Process each latest file
      for (const file of latestFiles) {
        const fileName = file.name || file.filename;
        const fileSize = file.size || 0;
        const lastModified = file.last_modified || file.mtime;

        logger.info(
          `📋 Downloading and inspecting: ${fileName} (${Math.round(fileSize / 1024)}KB)`
        );

        try {
          // Download the file with timeout
          const filePath = `${specificPath}/${fileName}`;
          const fileContent = await Promise.race([
            api.downloadFile(serviceId, filePath),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Download timeout')), 3000)
            ),
          ]);

          if (!fileContent || fileContent.length === 0) {
            await interaction.followUp({
              content: `⚠️ **${fileName}** is empty or could not be downloaded`,
              ephemeral: true,
            });
            continue;
          }

          const logContent = fileContent.toString('utf8');
          const lines = logContent.split('\n').filter(line => line.trim().length > 0);

          // Detect content type
          let contentType = 'Unknown';
          let isJson = false;

          try {
            const parsed = JSON.parse(logContent);
            if (parsed.data?.token?.url) {
              contentType = 'Download Token Response';
              isJson = true;
            } else {
              contentType = 'JSON Response';
              isJson = true;
            }
          } catch {
            if (
              logContent.includes('Script Log:') ||
              logContent.includes('WARNING:') ||
              logContent.includes('ERROR:') ||
              logContent.includes('EXCEPTION:')
            ) {
              contentType = 'DayZ Server Log (RPT)';
            } else if (
              logContent.includes('sessionid') ||
              logContent.includes('kick') ||
              logContent.includes('connect') ||
              logContent.includes('Admin')
            ) {
              contentType = 'DayZ Admin Log (ADM)';
            } else if (logContent.includes('Player') && logContent.includes('killed')) {
              contentType = 'DayZ Kill Log';
            }
          }

          // Get the most recent lines or full content if raw requested
          let displayContent;
          let displayTitle;
          let recentLines = [];

          if (showRaw) {
            displayContent = logContent.substring(0, 1900);
            displayTitle = 'Raw Content';
          } else {
            recentLines = lines.slice(-linesToShow);
            displayContent = recentLines.join('\n').substring(0, 1900);
            displayTitle = `Last ${recentLines.length} Lines`;
          }

          const embed = new EmbedBuilder()
            .setTitle(`📄 Latest Log Content: ${fileName}`)
            .setColor(isJson ? '#ff9900' : '#00ff00')
            .addFields(
              {
                name: '📊 File Info',
                value: `**Size:** ${Math.round(fileSize / 1024)}KB\n**Lines:** ${lines.length}\n**Type:** ${contentType}\n**Modified:** <t:${Math.floor(new Date(lastModified).getTime() / 1000)}:R>`,
                inline: false,
              },
              {
                name: `📝 ${displayTitle}`,
                value:
                  displayContent.length > 0
                    ? `\`\`\`\n${displayContent}\n\`\`\``
                    : 'No content found',
                inline: false,
              }
            )
            .setTimestamp();

          // Add warning for JSON responses
          if (isJson) {
            embed.addFields({
              name: '⚠️ Notice',
              value:
                'This file returned a download token response. The download method has been updated to handle these tokens and fetch actual content.',
              inline: false,
            });
          }

          if (recentLines.join('\n').length > 1900) {
            embed.setFooter({ text: 'Content truncated due to Discord message limits' });
          }

          await interaction.followUp({ embeds: [embed], ephemeral: true });
        } catch (fileError) {
          logger.error(`❌ Error processing ${fileName}:`, fileError);
          await interaction.followUp({
            content: `❌ **Error downloading ${fileName}:** ${fileError.message}`,
            ephemeral: true,
          });
        }
      }
    } catch (error) {
      logger.error('Inspect latest logs error:', error);
      await interaction.editReply({
        content: `❌ **Command failed:**\n\`\`\`\n${error.message}\n\`\`\``,
      });
    }
  },

  async getApiToken(serviceId) {
    try {
      const result = await db.query(
        'SELECT encrypted_token, token_iv, auth_tag FROM nitrado_credentials WHERE service_id = $1 ORDER BY updated_at DESC LIMIT 1',
        [serviceId]
      );

      if (!result.rows[0]) {
        return null;
      }

      const { encrypted_token, token_iv, auth_tag } = result.rows[0];
      return decrypt(encrypted_token, token_iv, auth_tag);
    } catch (error) {
      logger.error('❌ Error getting API token:', error);
      return null;
    }
  },
};

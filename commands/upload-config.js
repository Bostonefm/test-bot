const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { pool } = require('../modules/db');
const { createNitradoAPI } = require('../modules/nitrado');
const logger = require('../modules/logger');

// Helper function to get Nitrado credentials for a guild
async function getNitradoCreds(guildId) {
  const result = await pool.query(
    'SELECT service_id, encrypted_token as api_token FROM nitrado_creds WHERE guild_id = $1',
    [guildId]
  );
  return result.rows[0] || null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('upload-config')
    .setDescription('Upload config files to your DayZ server')
    .addAttachmentOption(option =>
      option.setName('file')
        .setDescription('Config file to upload (.xml, .json, .cfg, .txt)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('path')
        .setDescription('Target path (defaults to noftp/dayzxb/config)')
        .setRequired(false)
        .addChoices(
          { name: 'noftp/dayzxb/config (Primary)', value: '/noftp/dayzxb/config' },
          { name: 'ftproot/dayzxb/config (Alternative)', value: '/ftproot/dayzxb/config' },
          { name: 'games/{serviceId}_1/noftp/dayzxb/config', value: '/games/{serviceId}_1/noftp/dayzxb/config' },
          { name: 'games/{serviceId}_1/ftproot/dayzxb/config', value: '/games/{serviceId}_1/ftproot/dayzxb/config' }
        )),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const creds = await getNitradoCreds(interaction.guildId);
      if (!creds) {
        return interaction.editReply({
          content: '❌ Nitrado not configured for this server. Use `/connect-nitrado` first.'
        });
      }

      const { service_id, api_token } = creds;
      const api = createNitradoAPI(api_token);

      const attachment = interaction.options.getAttachment('file');
      const customPath = interaction.options.getString('path');

      // Validate file type
      const allowedExtensions = ['.xml', '.json', '.cfg', '.txt', '.log', '.conf'];
      const fileExtension = attachment.name.toLowerCase().substring(attachment.name.lastIndexOf('.'));

      if (!allowedExtensions.includes(fileExtension)) {
        return interaction.editReply({
          content: `❌ Invalid file type. Allowed: ${allowedExtensions.join(', ')}`
        });
      }

      // Validate file size (max 10MB)
      if (attachment.size > 10 * 1024 * 1024) {
        return interaction.editReply({
          content: '❌ File too large. Maximum size: 10MB'
        });
      }

      // Determine target path
      let targetPath = customPath || '/noftp/dayzxb/config';

      // Replace serviceId placeholder if present
      if (targetPath.includes('{serviceId}')) {
        targetPath = targetPath.replace('{serviceId}', service_id);
      }

      // Ensure path starts with /games/ format for full path
      if (!targetPath.startsWith('/games/')) {
        targetPath = `/games/${service_id}_1${targetPath}`;
      }

      try {
        // Download file content using global fetch (Node.js 22+)
        const response = await globalThis.fetch(attachment.url);
        const fileContent = await response.text();

        // Construct full file path
        const fullFilePath = `${targetPath}/${attachment.name}`;

        logger.info(`📤 Uploading ${attachment.name} to ${fullFilePath}`);

        // Upload file using Nitrado API
        await api.uploadFile(service_id, fullFilePath, fileContent);

        // Verify upload by listing files
        const verifyResponse = await api.listFiles(service_id, targetPath);
        const uploadedFile = verifyResponse.data?.entries?.find(f => 
          (f.name || f.filename) === attachment.name
        );

        if (uploadedFile) {
          await interaction.editReply({
            content: `✅ **File Upload Successful!**\n\n` +
                    `📁 **Path:** \`${targetPath}\`\n` +
                    `📄 **File:** \`${attachment.name}\`\n` +
                    `📊 **Size:** ${Math.round(uploadedFile.size / 1024)}KB\n` +
                    `🕒 **Uploaded:** ${new Date().toLocaleString()}`
          });
        } else {
          await interaction.editReply({
            content: `⚠️ Upload completed but file verification failed. File may still be processing.`
          });
        }

      } catch (uploadError) {
        logger.error('File upload error:', uploadError);
        await interaction.editReply({
          content: `❌ Upload failed: ${uploadError.message}`
        });
      }

    } catch (error) {
      logger.error('Upload config command error:', error);
      await interaction.editReply({
        content: '❌ Failed to upload config file.'
      });
    }
  }
};

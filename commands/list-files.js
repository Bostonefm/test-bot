const { SlashCommandBuilder } = require('discord.js');
const { getPool } = require('../utils/db.js');
const { decrypt } = require('../utils/encryption.js');
const { getNitradoFiles } = require('../modules/nitrado.js');
const logger = require('../config/logger.js');

// 🧩 Helper — get Nitrado credentials from the database
async function getNitradoCreds(guildId) {
  try {
    const pool = await getPool();
    const { rows } = await pool.query(
      `
      SELECT service_id, encrypted_token, token_iv, auth_tag
      FROM nitrado_credentials
      WHERE guild_id = $1 AND active = TRUE
      LIMIT 1
      `,
      [guildId]
    );
    return rows[0] || null;
  } catch (err) {
    logger.error(`DB query failed while fetching Nitrado creds for ${guildId}: ${err.message}`);
    return null;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-files')
    .setDescription('📁 List files from your DayZ server directory')
    .addStringOption(opt =>
      opt
        .setName('path')
        .setDescription('Optional subpath (defaults to the DayZ root directory)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 }); // 64 = ephemeral in new Discord.js

    try {
      const creds = await getNitradoCreds(interaction.guildId);
      if (!creds) {
        return interaction.editReply({
          content:
            '❌ No active Nitrado link found. Use `/nitrado-auth` or `/connect-nitrado` to link your service first.',
        });
      }

      const token = decrypt(creds.encrypted_token, creds.token_iv, creds.auth_tag);
      const path = interaction.options.getString('path') || '/games/dayzps/ftproot/dayzps';

      // Fetch files from Nitrado API
      const files = await getNitradoFiles(creds.service_id, token, path);

      if (!files?.length) {
        return interaction.editReply({ content: `📂 No files found in \`${path}\`.` });
      }

      // Format file list (limit to 20 entries for Discord safety)
      const display = files
        .slice(0, 20)
        .map(f => `📄 **${f.name || f.filename}** — ${Math.round((f.size || 0) / 1024)} KB`)
        .join('\n');

      await interaction.editReply({
        content:
          `📁 **Files in \`${path}\`:**\n${display}\n` +
          (files.length > 20 ? `\n*...and ${files.length - 20} more*` : ''),
      });
    } catch (err) {
      logger.error('List files command error:', err);
      await interaction.editReply({
        content: `❌ Failed to list files: ${err.message}`,
      });
    }
  },
};

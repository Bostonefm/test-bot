
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { db } = require('../modules/db');
const logger = require('../modules/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kill-feed')
    .setDescription('View recent kill feed and combat statistics')
    .addStringOption(option =>
      option.setName('service-id')
        .setDescription('Nitrado service ID (optional)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('hours')
        .setDescription('Hours to look back (default: 24)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(168)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const serviceId = interaction.options.getString('service-id');
      const hours = interaction.options.getInteger('hours') || 24;
      const guildId = interaction.guild.id;

      let serviceCondition = '';
      let params = [guildId, hours];

      if (serviceId) {
        serviceCondition = 'AND nc.service_id = $3';
        params.push(serviceId);
      }

      // Get recent kills
      const killsResult = await db.query(`
        SELECT 
          ke.killer_name,
          ke.victim_name,
          ke.weapon,
          ke.location_x,
          ke.location_y,
          ke.timestamp,
          nc.service_id
        FROM kill_events ke
        JOIN nitrado_credentials nc ON ke.service_id = nc.service_id
        WHERE nc.guild_id = $1 AND ke.timestamp >= NOW() - INTERVAL '$2 hours' ${serviceCondition}
        ORDER BY ke.timestamp DESC
        LIMIT 15
      `, params);

      // Get kill statistics
      const statsResult = await db.query(`
        SELECT 
          COUNT(*) as total_kills,
          COUNT(DISTINCT killer_name) as unique_killers,
          COUNT(DISTINCT victim_name) as unique_victims,
          COUNT(DISTINCT weapon) as unique_weapons
        FROM kill_events ke
        JOIN nitrado_credentials nc ON ke.service_id = nc.service_id
        WHERE nc.guild_id = $1 AND ke.timestamp >= NOW() - INTERVAL '$2 hours' ${serviceCondition}
      `, params);

      // Get top weapons
      const weaponsResult = await db.query(`
        SELECT weapon, COUNT(*) as kill_count
        FROM kill_events ke
        JOIN nitrado_credentials nc ON ke.service_id = nc.service_id
        WHERE nc.guild_id = $1 AND ke.timestamp >= NOW() - INTERVAL '$2 hours' ${serviceCondition}
        GROUP BY weapon
        ORDER BY kill_count DESC
        LIMIT 5
      `, params);

      const embed = new EmbedBuilder()
        .setColor(0xff4444)
        .setTitle(`💀 Kill Feed - Last ${hours} Hours`)
        .setTimestamp();

      // Statistics
      const stats = statsResult.rows[0];
      if (stats && stats.total_kills > 0) {
        embed.addFields({
          name: '📊 Combat Statistics',
          value: `**Total Kills:** ${stats.total_kills}\n**Unique Killers:** ${stats.unique_killers}\n**Unique Victims:** ${stats.unique_victims}\n**Weapons Used:** ${stats.unique_weapons}`,
          inline: false
        });

        // Top weapons
        if (weaponsResult.rows.length > 0) {
          const weaponsList = weaponsResult.rows
            .map((row, index) => `${index + 1}. ${row.weapon} (${row.kill_count} kills)`)
            .join('\n');
          embed.addFields({
            name: '🔫 Most Used Weapons',
            value: weaponsList,
            inline: true
          });
        }

        // Recent kills
        if (killsResult.rows.length > 0) {
          const killsList = killsResult.rows
            .map(kill => {
              const location = kill.location_x !== 0 || kill.location_y !== 0 
                ? ` at (${Math.round(kill.location_x)}, ${Math.round(kill.location_y)})`
                : '';
              return `• **${kill.killer_name}** killed **${kill.victim_name}** with ${kill.weapon}${location} - <t:${Math.floor(new Date(kill.timestamp).getTime() / 1000)}:R>`;
            })
            .join('\n');

          // Split into multiple fields if too long
          const maxLength = 1024;
          if (killsList.length > maxLength) {
            const firstPart = killsList.substring(0, killsList.lastIndexOf('\n', maxLength));
            const remaining = killsList.substring(firstPart.length + 1);
            
            embed.addFields([
              {
                name: '🔥 Recent Kills',
                value: firstPart,
                inline: false
              },
              {
                name: '📜 More Recent Kills',
                value: remaining.length > maxLength 
                  ? remaining.substring(0, remaining.lastIndexOf('\n', maxLength)) + '\n...'
                  : remaining,
                inline: false
              }
            ]);
          } else {
            embed.addFields({
              name: '🔥 Recent Kills',
              value: killsList,
              inline: false
            });
          }
        }
      } else {
        embed.addFields({
          name: '📊 Combat Statistics',
          value: `No kills recorded in the last ${hours} hours.`,
          inline: false
        });
      }

      await interaction.followUp({ embeds: [embed] });
    } catch (error) {
      logger.error('Error in kill-feed command:', error);
      await interaction.followUp({
        content: '❌ An error occurred while fetching the kill feed.',
        ephemeral: true
      });
    }
  },
};

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const PermissionManager = require('../modules/permissions');
const logger = require('../config/logger.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('moderate')
    .setDescription('Moderation actions for server members')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(subcommand =>
      subcommand
        .setName('kick')
        .setDescription('Kick a user from the server')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to kick')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for kick')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ban')
        .setDescription('Ban a user from the server')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to ban')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for ban')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('unban')
        .setDescription('Unban a user from the server')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to unban')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for unban')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('mute')
        .setDescription('Timeout a user')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to mute')
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('duration')
            .setDescription('Duration (e.g., 10m, 1h, 2d)')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for mute')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    try {
      switch (subcommand) {
        case 'kick':
          await handleKick(interaction);
          break;
        case 'ban':
          await handleBan(interaction);
          break;
        case 'unban':
          await handleUnban(interaction);
          break;
        case 'mute':
          await handleMute(interaction);
          break;
      }
    } catch (error) {
      logger.error(`Error in moderate ${subcommand}:`, error);
      const reply = {
        content: `❌ **Error**\n\n${error.message}`,
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
 * Kick a user
 */
async function handleKick(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
    return interaction.reply({ 
      content: '❌ You need Kick Members permission.', 
      ephemeral: true 
    });
  }
  
  try {
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    const member = await interaction.guild.members.fetch(user.id);
    await member.kick(reason);
    
    logger.info(`KICK: ${user.tag} kicked by ${interaction.user.tag} - Reason: ${reason}`);
    
    await interaction.reply({ 
      content: `👢 ${user.tag} has been kicked.\n**Reason:** ${reason}` 
    });
  } catch (error) {
    logger.error('Error kicking user:', error);
    await interaction.reply({ 
      content: '❌ Error kicking user. Check permissions and try again.', 
      ephemeral: true 
    });
  }
}

/**
 * Ban a user
 */
async function handleBan(interaction) {
  if (!PermissionManager.hasMinimumRole(interaction.member, 'MODERATOR')) {
    return interaction.reply({ 
      content: PermissionManager.createErrorMessage('MODERATOR'), 
      ephemeral: true 
    });
  }

  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  try {
    await interaction.guild.members.ban(user.id, { reason });
    
    logger.info(`BAN: ${user.tag} banned by ${interaction.user.tag} - Reason: ${reason}`);
    
    await interaction.reply({
      content: `🚫 **${user.tag}** has been banned.\n**Reason:** ${reason}`,
      ephemeral: false
    });
  } catch (error) {
    logger.error('Ban error:', error);
    await interaction.reply({
      content: '❌ Failed to ban user. Check permissions and try again.',
      ephemeral: true
    });
  }
}

/**
 * Unban a user
 */
async function handleUnban(interaction) {
  if (!PermissionManager.hasMinimumRole(interaction.member, 'MODERATOR')) {
    return interaction.reply({ 
      content: PermissionManager.createErrorMessage('MODERATOR'), 
      ephemeral: true 
    });
  }

  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'No reason provided';

  try {
    await interaction.guild.members.unban(user.id, reason);
    
    logger.info(`UNBAN: ${user.tag} unbanned by ${interaction.user.tag} - Reason: ${reason}`);
    
    await interaction.reply({
      content: `✅ **${user.tag}** has been unbanned.\n**Reason:** ${reason}`,
      ephemeral: false
    });
  } catch (error) {
    logger.error('Unban error:', error);
    await interaction.reply({
      content: '❌ Failed to unban user. They may not be banned or check permissions.',
      ephemeral: true
    });
  }
}

/**
 * Mute (timeout) a user
 */
async function handleMute(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
    return interaction.reply({ 
      content: '❌ You need Moderate Members permission.', 
      ephemeral: true 
    });
  }
  
  try {
    const user = interaction.options.getUser('user');
    const duration = interaction.options.getString('duration') || '10m';
    const reason = interaction.options.getString('reason') || 'No reason provided';
    
    const member = await interaction.guild.members.fetch(user.id);
    
    const timeMatch = duration.match(/^(\d+)([mhd])$/);
    if (!timeMatch) {
      return interaction.reply({ 
        content: '❌ Invalid duration format. Use: 10m, 1h, 2d', 
        ephemeral: true 
      });
    }
    
    const [, amount, unit] = timeMatch;
    const multiplier = { m: 60000, h: 3600000, d: 86400000 };
    const muteUntil = new Date(Date.now() + parseInt(amount) * multiplier[unit]);
    
    await member.timeout(muteUntil.getTime() - Date.now(), reason);
    
    logger.info(`MUTE: ${user.tag} muted by ${interaction.user.tag} until ${muteUntil.toISOString()} - Reason: ${reason}`);
    
    await interaction.reply({ 
      content: `🔇 ${user.tag} has been muted until ${muteUntil.toLocaleString()}.\n**Reason:** ${reason}` 
    });
  } catch (error) {
    logger.error('Error muting user:', error);
    await interaction.reply({ 
      content: '❌ Error muting user. Check permissions and try again.', 
      ephemeral: true 
    });
  }
}

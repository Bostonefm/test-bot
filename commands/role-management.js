const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const logger = require('../modules/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role-management')
    .setDescription('Manage user roles (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(subcommand =>
      subcommand
        .setName('assign')
        .setDescription('Assign a role to a user')
        .addUserOption(option =>
          option.setName('user').setDescription('User to assign role to').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('role').setDescription('Role name to assign').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a role from a user')
        .addUserOption(option =>
          option.setName('user').setDescription('User to remove role from').setRequired(true)
        )
        .addStringOption(option =>
          option.setName('role').setDescription('Role name to remove').setRequired(true)
        )
    ),

  async execute(interaction) {
    // Check admin permissions
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
      return interaction.reply({
        content: '❌ You need Administrator permissions to manage roles.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const subcommand = interaction.options.getSubcommand();
    const targetUser = interaction.options.getUser('user');
    const roleName = interaction.options.getString('role');

    try {
      const member = interaction.guild.members.cache.get(targetUser.id);
      if (!member) {
        return interaction.editReply({
          content: '❌ User not found in this server.',
        });
      }

      const role = interaction.guild.roles.cache.find(r => r.name === roleName);
      if (!role) {
        return interaction.editReply({
          content: `❌ Role "${roleName}" not found.`,
        });
      }

      // Prevent managing higher roles than the admin
      if (role.position >= interaction.member.roles.highest.position) {
        return interaction.editReply({
          content: '❌ You cannot manage roles higher than or equal to your highest role.',
        });
      }

      if (subcommand === 'assign') {
        if (member.roles.cache.has(role.id)) {
          return interaction.editReply({
            content: `❌ <@${targetUser.id}> already has the **${roleName}** role.`,
          });
        }

        await member.roles.add(role);
        await interaction.editReply({
          content: `✅ Successfully assigned **${roleName}** role to <@${targetUser.id}>.`,
        });

        logger.info(`Admin ${interaction.user.tag} assigned ${roleName} role to ${targetUser.tag}`);
      } else if (subcommand === 'remove') {
        if (!member.roles.cache.has(role.id)) {
          return interaction.editReply({
            content: `❌ <@${targetUser.id}> doesn't have the **${roleName}** role.`,
          });
        }

        await member.roles.remove(role);
        await interaction.editReply({
          content: `✅ Successfully removed **${roleName}** role from <@${targetUser.id}>.`,
        });

        logger.info(
          `Admin ${interaction.user.tag} removed ${roleName} role from ${targetUser.tag}`
        );
      }
    } catch (error) {
      logger.error('Role management error:', error);
      await interaction.editReply({
        content: '❌ Failed to manage role. Please check bot permissions.',
      });
    }
  },
};

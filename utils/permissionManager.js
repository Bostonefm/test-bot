const { PermissionsBitField, ChannelType } = require('discord.js');

/**
 * Update permissions for a channel or category
 */
async function updateChannelPermissions(channel, categoryConfig, guild, resetAll) {
  // Reset permissions if requested
  if (resetAll) {
    await channel.permissionOverwrites.set([]);
  }

  const permissionOverwrites = [];
  const permissions = categoryConfig.permissions || {};

  // Start with @everyone permissions
  if (permissions['@everyone'] && permissions['@everyone'].length > 0) {
    permissionOverwrites.push({
      id: guild.roles.everyone.id,
      allow: permissions['@everyone']
        .map(p => PermissionsBitField.Flags[p])
        .filter(p => p !== undefined),
      deny: [],
    });
  } else {
    // Default deny view for security (when @everyone is undefined or empty array)
    permissionOverwrites.push({
      id: guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel],
    });
  }

  // Apply role-specific permissions
  for (const [roleName, perms] of Object.entries(permissions)) {
    if (roleName === '@everyone') continue;

    const role = guild.roles.cache.find(r => r.name === roleName);
    if (role) {
      permissionOverwrites.push({
        id: role.id,
        allow: perms.map(p => PermissionsBitField.Flags[p]).filter(p => p !== undefined),
        deny: [],
      });
    }
  }

  // Apply special permissions for specific channel types
  if (channel.type === ChannelType.GuildText) {
    await applySpecialChannelPermissions(channel, guild, permissionOverwrites);
  }

  // Set the permissions
  await channel.permissionOverwrites.set(permissionOverwrites);
}

/**
 * Apply special permissions for specific channel types (read-only, etc.)
 */
async function applySpecialChannelPermissions(channel, guild, permissionOverwrites) {
  const channelName = channel.name;
  
  // ALL info channels and bot invite channels must be read-only (no SendMessages for anyone except staff)
  const readOnlyChannels = [
    // Welcome & Orientation
    'start-here', 'announcements', 'faq-docs',
    // Verification (BOTH channels must be read-only)
    'verify-linked-roles', 'verification-help',
    // Support & Operations (info only)
    'grizzly-status', 'ticket-logs', 'open-a-ticket',
    // Grizzly Bot Resources (ALL info channels read-only)
    'grizzly-bot-invite', 'bot-release-notes', 'integration-guides', 'patreon-feedback',
    // Website Bot Resources
    'website-bot-invite', 'assistant-bot-invite',
    // Legacy channels
    'welcome', 'rules', 'about-the-bots', 'how-to-subscribe'
  ];

  if (readOnlyChannels.includes(channelName)) {
    // Deny SendMessages for ALL roles (everyone, Bronze, Silver, Gold, Partner)
    for (const overwrite of permissionOverwrites) {
      // Add SendMessages to deny list for all overwrites
      overwrite.deny = [
        ...(overwrite.deny || []),
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.AddReactions,
      ];
    }

    // Explicitly allow staff roles to send messages
    const staffRoles = ['Support Staff', 'Developer'];
    for (const staffRoleName of staffRoles) {
      const staffRole = guild.roles.cache.find(r => r.name === staffRoleName);
      if (staffRole) {
        let staffOverwrite = permissionOverwrites.find(p => p.id === staffRole.id);
        if (!staffOverwrite) {
          staffOverwrite = { id: staffRole.id, allow: [], deny: [] };
          permissionOverwrites.push(staffOverwrite);
        }
        // Remove SendMessages from deny if it exists
        staffOverwrite.deny = (staffOverwrite.deny || []).filter(
          p => p !== PermissionsBitField.Flags.SendMessages && p !== PermissionsBitField.Flags.AddReactions
        );
        // Add to allow
        staffOverwrite.allow = [
          ...(staffOverwrite.allow || []),
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageMessages,
          PermissionsBitField.Flags.EmbedLinks,
          PermissionsBitField.Flags.AttachFiles,
          PermissionsBitField.Flags.AddReactions,
        ];
      }
    }
  }
}

module.exports = {
  updateChannelPermissions,
  applySpecialChannelPermissions
};

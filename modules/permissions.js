const { PermissionFlagsBits } = require('discord.js');

/**
 * Simplified permission utility for role-based access control
 */

const ROLE_HIERARCHY = {
  ADMIN: ['Admin', 'Owner', 'Administrator'],
  MODERATOR: ['Admin', 'Owner', 'Administrator', 'Moderator', 'Mod'],
  STAFF: ['Admin', 'Owner', 'Administrator', 'Moderator', 'Mod', 'Staff'],
  MEMBER: ['Admin', 'Owner', 'Administrator', 'Moderator', 'Mod', 'Staff', 'Member', '@everyone']
};

const DISCORD_PERMISSIONS = {
  ADMIN: ['ADMINISTRATOR'],
  MODERATOR: ['MANAGE_ROLES', 'MANAGE_CHANNELS', 'KICK_MEMBERS', 'BAN_MEMBERS', 'MANAGE_MESSAGES'],
  MEMBER: ['SEND_MESSAGES', 'READ_MESSAGE_HISTORY']
};

class PermissionManager {
  /**
   * Check if user has required role level
   */
  static hasRole(member, requiredLevel) {
    const allowedRoles = ROLE_HIERARCHY[requiredLevel.toUpperCase()];
    if (!allowedRoles) return false;

    return member.roles.cache.some(role => 
      allowedRoles.includes(role.name)
    ) || allowedRoles.includes('@everyone');
  }

  /**
   * Check if user has required Discord permission
   */
  static hasPermission(member, permission) {
    return member.permissions.has(permission);
  }

  /**
   * Check if user has either role or permission
   */
  static hasAccess(member, requiredRole, fallbackPermission = null) {
    return this.hasRole(member, requiredRole) || 
           (fallbackPermission && this.hasPermission(member, fallbackPermission));
  }

  /**
   * Get user's highest role level
   */
  static getUserLevel(member) {
    for (const [level, roles] of Object.entries(ROLE_HIERARCHY)) {
      if (member.roles.cache.some(role => roles.includes(role.name))) {
        return level;
      }
    }
    return 'MEMBER'; // Default to member instead of 'NONE'
  }

  /**
   * Create permission error message
   */
  static createErrorMessage(requiredLevel) {
    return `❌ You need **${requiredLevel}** permissions to use this command.`;
  }

  /**
   * Quick check if user is admin
   */
  static isAdmin(member) {
    if (!member) return false;

    // Check if user has administrator permission
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return true;
    }

    // Check for specific admin roles
    const adminRoles = ['Admin', 'Administrator', 'Owner', 'Moderator'];
    return member.roles.cache.some(role => 
      adminRoles.includes(role.name) || 
      role.permissions.has(PermissionFlagsBits.Administrator)
    );
  }

  /**
   * Quick check if user is moderator or higher
   */
  static isModerator(member) {
    if (!member) return false;

    // Admins are also moderators
    if (this.isAdmin(member)) return true;

    // Check for moderator permissions
    if (member.permissions.has(PermissionFlagsBits.ModerateMembers) ||
        member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return true;
    }

    // Check for moderator roles
    const modRoles = ['Moderator', 'Staff', 'Support'];
    return member.roles.cache.some(role => modRoles.includes(role.name));
  }

  static async checkGuildPermissions(guild, userId) {
    try {
      const member = await guild.members.fetch(userId);
      return {
        isAdmin: this.isAdmin(member),
        isModerator: this.isModerator(member),
        member: member
      };
    } catch (error) {
      return {
        isAdmin: false,
        isModerator: false,
        member: null
      };
    }
  }
}

module.exports = PermissionManager;

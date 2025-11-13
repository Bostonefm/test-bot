class TierManager {
  constructor(pool, logger) {
    this.pool = pool;
    this.logger = logger;
    // Map database tier names to Discord role names (with medal emojis)
    this.tierRoles = {
      Bronze: '🥉Bronze',
      Silver: '🥈Silver',
      Gold: '🥇Gold',
      Partner: 'Partner',
    };
  }

  async initialize() {
    try {
      // Test database connection and ensure required tables exist
      await this.pool.query('SELECT 1');
      this.logger.info('Tier manager database connection verified');
      return true;
    } catch (error) {
      this.logger.error(`Tier manager initialization failed: ${error.message}`);
      throw error;
    }
  }

  async getUserTier(discordId) {
    try {
      const result = await this.pool.query(
        'SELECT subscription_tier, active FROM patreon_subscriptions WHERE discord_id = $1',
        [discordId]
      );

      if (result.rows.length === 0) {
        return { tier: 'None', active: false };
      }

      const subscription = result.rows[0];
      return {
        tier: subscription.subscription_tier,
        active: subscription.active,
      };
    } catch (error) {
      this.logger.error('Error checking user tier:', error);
      return { tier: 'None', active: false };
    }
  }

  async syncUserRoles(guildId, discordId) {
    try {
      const guild = this.client.guilds.cache.get(guildId);
      if (!guild) {
        return false;
      }

      const member = guild.members.cache.get(discordId);
      if (!member) {
        return false;
      }

      const userTier = await this.getUserTier(discordId);

      // Remove all tier roles first
      for (const roleName of Object.values(this.tierRoles)) {
        const role = guild.roles.cache.find(r => r.name === roleName);
        if (role && member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
        }
      }

      // Add appropriate tier role
      if (userTier.active && userTier.tier !== 'None') {
        const targetRole = guild.roles.cache.find(r => r.name === userTier.tier);
        if (targetRole) {
          await member.roles.add(targetRole);
          this.logger.info(`Added ${userTier.tier} role to ${member.user.tag}`);
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error syncing user roles:', error);
      return false;
    }
  }

  async checkTierPermission(discordId, requiredTier) {
    const tierHierarchy = {
      None: 0,
      Bronze: 1,
      Silver: 2,
      Gold: 3,
      Partner: 4,
    };

    const userTier = await this.getUserTier(discordId);

    if (!userTier.active) {
      return false;
    }

    const userTierLevel = tierHierarchy[userTier.tier] || 0;
    const requiredTierLevel = tierHierarchy[requiredTier] || 0;

    return userTierLevel >= requiredTierLevel;
  }

  async getTierFeatures(tier) {
    const features = {
      None: {
        bot_access: false,
        kill_feeds: false,
        player_tracking: false,
        economy: false,
        website_listing: false,
        featured_listing: false,
      },
      Bronze: {
        bot_access: true,
        kill_feeds: true,
        player_tracking: true,
        economy: true,
        website_listing: false,
        featured_listing: false,
      },
      Silver: {
        bot_access: true,
        kill_feeds: true,
        player_tracking: true,
        economy: true,
        website_listing: true,
        featured_listing: false,
      },
      Gold: {
        bot_access: true,
        kill_feeds: true,
        player_tracking: true,
        economy: true,
        website_listing: true,
        featured_listing: true,
      },
      Partner: {
        bot_access: true,
        kill_feeds: true,
        player_tracking: true,
        economy: true,
        website_listing: true,
        featured_listing: true,
        exclusive_features: true,
        priority_support: true,
      },
    };

    return features[tier] || features['None'];
  }

  async syncAllGuildRoles(guildId) {
    try {
      const result = await this.pool.query(
        'SELECT discord_id FROM patreon_subscriptions WHERE active = true'
      );

      let syncedCount = 0;
      for (const row of result.rows) {
        const success = await this.syncUserRoles(guildId, row.discord_id);
        if (success) {
          syncedCount++;
        }

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.logger.info(`Synced roles for ${syncedCount} users in guild ${guildId}`);
      return syncedCount;
    } catch (error) {
      this.logger.error('Error syncing all guild roles:', error);
      return 0;
    }
  }
}

module.exports = TierManager;

const { db } = require('../modules/db.js');
const logger = require('../config/logger.js');

/**
 * Check if a user has an active Patreon subscription
 * @param {string} discordId - Discord user ID
 * @param {string} requiredTier - Minimum tier required ('Bronze', 'Silver', 'Gold', 'Partner')
 * @returns {Promise<{allowed: boolean, tier: string, message: string}>}
 */
async function checkSubscription(discordId, requiredTier = 'Bronze') {
  try {
    // Query database for active subscription
    const result = await db.query(
      'SELECT subscription_tier, active FROM patreon_subscriptions WHERE discord_id = $1',
      [discordId]
    );

    // No subscription found
    if (result.rows.length === 0) {
      return {
        allowed: false,
        tier: 'None',
        message: '🔒 **Subscription Required**\n\nGrizzly Bot requires an active Patreon subscription to use.\n\n**Subscribe to get started:**\n→ https://patreon.com/grizzlygaming\n\n**Available Tiers:**\n• **Bronze** ($6/mo) - Full bot access + 1 server\n• **Silver** ($10/mo) - Bronze + website posting\n• **Gold** ($15/mo) - Silver + 2 servers + Gold listing + early beta + priority support\n\n**After subscribing:**\n1. Verify via Discord Linked Roles in Grizzly Command Central\n2. Return here and try the command again'
      };
    }

    const subscription = result.rows[0];

    // Subscription inactive
    if (!subscription.active) {
      return {
        allowed: false,
        tier: subscription.subscription_tier,
        message: '❌ **Subscription Inactive**\n\nYour Patreon subscription is inactive or expired.\n\n**Reactivate your subscription:**\n→ https://patreon.com/grizzlygaming\n\nOnce reactivated, verify again in Grizzly Command Central.'
      };
    }

    // Check tier hierarchy
    const tierHierarchy = {
      'None': 0,
      'Bronze': 1,
      'Silver': 2,
      'Gold': 3,
      'Partner': 4
    };

    const userTierLevel = tierHierarchy[subscription.subscription_tier] || 0;
    const requiredTierLevel = tierHierarchy[requiredTier] || 0;

    // Tier insufficient
    if (userTierLevel < requiredTierLevel) {
      return {
        allowed: false,
        tier: subscription.subscription_tier,
        message: `⚠️ **Tier Upgrade Required**\n\nThis feature requires **${requiredTier}** tier or higher.\n\n**Your current tier:** ${subscription.subscription_tier}\n\n**Upgrade on Patreon:**\n→ https://patreon.com/grizzlygaming`
      };
    }

    // All checks passed
    return {
      allowed: true,
      tier: subscription.subscription_tier,
      message: `✅ Subscription verified: ${subscription.subscription_tier} tier`
    };

  } catch (error) {
    logger.error('Subscription check error:', error);
    return {
      allowed: false,
      tier: 'Error',
      message: '❌ **Verification Error**\n\nCould not verify subscription status. Please try again or contact support.'
    };
  }
}

/**
 * Check if a guild is authorized (has an active subscriber as owner)
 * @param {string} guildId - Discord guild ID
 * @param {string} ownerId - Discord user ID of guild owner
 * @returns {Promise<{allowed: boolean, message: string}>}
 */
async function checkGuildSubscription(guildId, ownerId) {
  try {
    // First check if owner has active subscription
    const ownerCheck = await checkSubscription(ownerId, 'Bronze');
    
    if (!ownerCheck.allowed) {
      return {
        allowed: false,
        message: `🔒 **Server Owner Subscription Required**\n\nThe server owner must have an active Patreon subscription to use Grizzly Bot.\n\n**Server Owner:** <@${ownerId}>\n**Required:** Bronze tier or higher\n\n**Subscribe here:**\n→ https://patreon.com/grizzlygaming\n\n**After subscribing:**\n1. Go to Grizzly Command Central\n2. Verify via Discord Linked Roles\n3. Return here and run setup again`
      };
    }

    // Check if guild is already registered
    const guildResult = await db.query(
      'SELECT * FROM guild_subscriptions WHERE guild_id = $1 AND active = true',
      [guildId]
    );

    // Guild already registered
    if (guildResult.rows.length > 0) {
      return {
        allowed: true,
        message: '✅ Guild subscription verified'
      };
    }

    // Register new guild
    await db.query(
      `INSERT INTO guild_subscriptions (guild_id, owner_id, subscription_tier, active, created_at)
       VALUES ($1, $2, $3, true, NOW())
       ON CONFLICT (guild_id) DO UPDATE SET 
         owner_id = $2, 
         subscription_tier = $3, 
         active = true, 
         updated_at = NOW()`,
      [guildId, ownerId, ownerCheck.tier]
    );

    logger.info(`Registered guild ${guildId} with ${ownerCheck.tier} subscription`);

    return {
      allowed: true,
      message: `✅ Guild registered with ${ownerCheck.tier} subscription`
    };

  } catch (error) {
    logger.error('Guild subscription check error:', error);
    return {
      allowed: false,
      message: '❌ Could not verify guild subscription. Please try again.'
    };
  }
}

module.exports = {
  checkSubscription,
  checkGuildSubscription
};

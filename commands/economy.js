const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { dbManager } = require('../modules/db');
const logger = require('../modules/logger');
const { safeDeferReply } = require('../utils/interactionHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('economy')
    .setDescription('Economy system commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('balance')
        .setDescription("Check your or another user's balance")
        .addUserOption(option =>
          option.setName('user').setDescription('User to check balance for').setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('daily').setDescription('Claim your daily reward')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('transfer')
        .setDescription('Transfer coins to another user')
        .addUserOption(option =>
          option.setName('recipient').setDescription('User to transfer coins to').setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('Amount to transfer')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('leaderboard').setDescription('View the economy leaderboard')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('transactions')
        .setDescription('View your recent transactions')
        .addIntegerOption(option =>
          option
            .setName('limit')
            .setDescription('Number of transactions to show (max 10)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(10)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const isPublic = subcommand === 'leaderboard';

    console.log(`🔍 [ECONOMY EXECUTE START] replied:${interaction.replied} deferred:${interaction.deferred}`);

    try {
      switch (subcommand) {
        case 'balance':
          console.log(`🔍 [BEFORE HANDLEBALANCE] replied:${interaction.replied} deferred:${interaction.deferred}`);
          await handleBalance(interaction, userId, guildId, isPublic);
          console.log(`🔍 [AFTER HANDLEBALANCE] replied:${interaction.replied} deferred:${interaction.deferred}`);
          break;
        case 'daily':
          await handleDaily(interaction, userId, guildId, isPublic);
          break;
        case 'transfer':
          await handleTransfer(interaction, userId, guildId, isPublic);
          break;
        case 'leaderboard':
          await handleLeaderboard(interaction, guildId, isPublic);
          break;
        case 'transactions':
          await handleTransactions(interaction, userId, guildId, isPublic);
          break;
        default:
          await interaction.reply({
            content: '❌ Unknown economy command.',
            flags: MessageFlags.Ephemeral,
          });
      }
    } catch (error) {
      // Log ALL errors for debugging
      console.log('🚨 ECONOMY ERROR CAUGHT:', error.code, error.message, 'replied:', interaction.replied, 'deferred:', interaction.deferred);
      
      // Ignore Discord.js race conditions (10062 = Unknown interaction, 40060 = Already acknowledged)
      if (error.code === 10062 || error.code === 40060) {
        return;
      }
      
      logger.error('Economy command error:', error);
      
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An error occurred.',
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (replyError) {
        if (replyError.code !== 10062 && replyError.code !== 40060) {
          logger.error('Failed to send error response:', replyError);
        }
      }
    }
  },
};

async function ensureEconomyAccount(userId, guildId) {
  await dbManager.query(
    `INSERT INTO economy_accounts (discord_id, guild_id, balance, created_at)
     VALUES ($1, $2, 0, NOW())
     ON CONFLICT (discord_id, guild_id) DO NOTHING`,
    [userId, guildId]
  );
}

async function getEconomySettings(guildId) {
  let result = await dbManager.query('SELECT * FROM economy_settings WHERE guild_id = $1', [guildId]);

  if (result.rows.length === 0) {
    // Create default settings
    await dbManager.query(`INSERT INTO economy_settings (guild_id) VALUES ($1)`, [guildId]);

    result = await dbManager.query('SELECT * FROM economy_settings WHERE guild_id = $1', [guildId]);
  }

  return result.rows[0];
}

async function addTransaction(userId, guildId, amount, type, description, metadata = null) {
  await dbManager.query(
    `INSERT INTO economy_transactions (discord_id, guild_id, amount, transaction_type, description, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, guildId, amount, type, description, JSON.stringify(metadata)]
  );
}

async function handleBalance(interaction, userId, guildId, isPublic) {
  // DEFER IMMEDIATELY to prevent 3-second timeout
  await interaction.deferReply({ flags: isPublic ? undefined : MessageFlags.Ephemeral });
  
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const targetId = targetUser.id;

  await ensureEconomyAccount(targetId, guildId);
  const settings = await getEconomySettings(guildId);

  const result = await dbManager.query(
    'SELECT balance, total_earned, total_spent FROM economy_accounts WHERE discord_id = $1 AND guild_id = $2',
    [targetId, guildId]
  );

  const account = result.rows[0];
  const isOwnBalance = targetId === userId;

  const embed = new EmbedBuilder()
    .setTitle(
      `💰 ${isOwnBalance ? 'Your' : `${targetUser.username}'s`} ${settings.currency_name} Balance`
    )
    .setColor('#00ff00')
    .addFields(
      {
        name: '💵 Current Balance',
        value: `${account.balance.toLocaleString()} ${settings.currency_symbol}`,
        inline: true,
      },
      {
        name: '📈 Total Earned',
        value: `${account.total_earned.toLocaleString()} ${settings.currency_symbol}`,
        inline: true,
      },
      {
        name: '📉 Total Spent',
        value: `${account.total_spent.toLocaleString()} ${settings.currency_symbol}`,
        inline: true,
      }
    )
    .setTimestamp();

  if (isOwnBalance) {
    embed.setFooter({ text: 'Use /economy daily to claim your daily reward!' });
  }

  await interaction.editReply({ 
    embeds: [embed]
  });
}

async function handleDaily(interaction, userId, guildId, isPublic) {
  await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral });
  
  await ensureEconomyAccount(userId, guildId);
  const settings = await getEconomySettings(guildId);

  const result = await dbManager.query(
    'SELECT last_daily FROM economy_accounts WHERE discord_id = $1 AND guild_id = $2',
    [userId, guildId]
  );

  const account = result.rows[0];
  const now = new Date();
  const lastDaily = account.last_daily ? new Date(account.last_daily) : null;

  // Check if 24 hours have passed since last daily
  if (lastDaily) {
    const timeDiff = now - lastDaily;
    const hoursLeft = 24 - Math.floor(timeDiff / (1000 * 60 * 60));

    if (hoursLeft > 0) {
      return interaction.editReply({
        content: `⏰ You've already claimed your daily reward! Come back in **${hoursLeft} hours**.`
      });
    }
  }

  // Award daily reward
  await dbManager.query(
    `UPDATE economy_accounts 
     SET balance = balance + $1, total_earned = total_earned + $1, last_daily = NOW(), updated_at = NOW()
     WHERE discord_id = $2 AND guild_id = $3`,
    [settings.daily_reward, userId, guildId]
  );

  await addTransaction(userId, guildId, settings.daily_reward, 'daily', 'Daily reward claimed');

  const embed = new EmbedBuilder()
    .setTitle('🎁 Daily Reward Claimed!')
    .setDescription(`You received **${settings.daily_reward} ${settings.currency_symbol}**!`)
    .setColor('#ffff00')
    .setFooter({ text: 'Come back tomorrow for another reward!' })
    .setTimestamp();

  await interaction.editReply({ 
    embeds: [embed]
  });
}

async function handleTransfer(interaction, userId, guildId, isPublic) {
  await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral });
  
  const recipient = interaction.options.getUser('recipient');
  const amount = interaction.options.getInteger('amount');

  if (recipient.id === userId) {
    return interaction.editReply({
      content: '❌ You cannot transfer coins to yourself!'
    });
  }

  if (recipient.bot) {
    return interaction.editReply({
      content: '❌ You cannot transfer coins to bots!'
    });
  }

  await ensureEconomyAccount(userId, guildId);
  await ensureEconomyAccount(recipient.id, guildId);
  const settings = await getEconomySettings(guildId);

  if (amount > settings.max_transfer) {
    return interaction.editReply({
      content: `❌ Maximum transfer amount is **${settings.max_transfer} ${settings.currency_symbol}**!`
    });
  }

  const senderResult = await dbManager.query(
    'SELECT balance FROM economy_accounts WHERE discord_id = $1 AND guild_id = $2',
    [userId, guildId]
  );

  const senderBalance = senderResult.rows[0].balance;

  if (amount > senderBalance) {
    return interaction.editReply({
      content: `❌ Insufficient balance! You have **${senderBalance} ${settings.currency_symbol}**.`
    });
  }

  // Perform transfer
  await dbManager.query('BEGIN');
  try {
    // Subtract from sender
    await dbManager.query(
      `UPDATE economy_accounts 
       SET balance = balance - $1, total_spent = total_spent + $1, updated_at = NOW()
       WHERE discord_id = $2 AND guild_id = $3`,
      [amount, userId, guildId]
    );

    // Add to recipient
    await dbManager.query(
      `UPDATE economy_accounts 
       SET balance = balance + $1, total_earned = total_earned + $1, updated_at = NOW()
       WHERE discord_id = $2 AND guild_id = $3`,
      [amount, recipient.id, guildId]
    );

    // Record transactions
    await addTransaction(
      userId,
      guildId,
      -amount,
      'transfer_out',
      `Transfer to ${recipient.username}`,
      { recipient_id: recipient.id }
    );

    await addTransaction(
      recipient.id,
      guildId,
      amount,
      'transfer_in',
      `Transfer from ${interaction.user.username}`,
      { sender_id: userId }
    );

    await dbManager.query('COMMIT');

    const embed = new EmbedBuilder()
      .setTitle('💸 Transfer Successful!')
      .setDescription(`You transferred **${amount} ${settings.currency_symbol}** to ${recipient}`)
      .setColor('#00ff00')
      .setTimestamp();

    await interaction.editReply({ 
      embeds: [embed]
    });

    // Notify recipient
    try {
      await recipient.send(
        `💰 You received **${amount} ${settings.currency_symbol}** from **${interaction.user.username}** in **${interaction.guild.name}**!`
      );
    } catch (dmError) {
      logger.warn(`Could not send transfer notification to ${recipient.tag}`);
    }
  } catch (error) {
    await dbManager.query('ROLLBACK');
    throw error;
  }
}

async function handleLeaderboard(interaction, guildId, isPublic) {
  await safeDeferReply(interaction, { flags: isPublic ? undefined : MessageFlags.Ephemeral });
  
  const settings = await getEconomySettings(guildId);

  const result = await dbManager.query(
    `SELECT discord_id, balance, total_earned 
     FROM economy_accounts 
     WHERE guild_id = $1 AND balance > 0
     ORDER BY balance DESC 
     LIMIT 10`,
    [guildId]
  );

  if (result.rows.length === 0) {
    return interaction.editReply({
      content: '📊 No one has any Grizzly Coins yet! Use `/economy daily` to get started.'
    });
  }

  const embed = new EmbedBuilder()
    .setTitle(`🏆 ${settings.currency_name} Leaderboard`)
    .setColor('#ffd700')
    .setTimestamp();

  let description = '';
  for (let i = 0; i < result.rows.length; i++) {
    const account = result.rows[i];
    const user = interaction.guild.members.cache.get(account.discord_id);
    const username = user ? user.displayName : 'Unknown User';

    const rank = i + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;

    description += `${medal} **${username}** - ${account.balance.toLocaleString()} ${settings.currency_symbol}\n`;
  }

  embed.setDescription(description);
  await interaction.editReply({ embeds: [embed] });
}

async function handleTransactions(interaction, userId, guildId, isPublic) {
  await safeDeferReply(interaction, { flags: MessageFlags.Ephemeral });
  
  const limit = interaction.options.getInteger('limit') || 5;
  const settings = await getEconomySettings(guildId);

  const result = await dbManager.query(
    `SELECT amount, transaction_type, description, created_at 
     FROM economy_transactions 
     WHERE discord_id = $1 AND guild_id = $2
     ORDER BY created_at DESC 
     LIMIT $3`,
    [userId, guildId, limit]
  );

  if (result.rows.length === 0) {
    return interaction.editReply({
      content: '📜 You have no transaction history yet!'
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('📜 Your Recent Transactions')
    .setColor('#0099ff')
    .setTimestamp();

  let description = '';
  for (const transaction of result.rows) {
    const emoji = transaction.amount > 0 ? '💵' : '💸';
    const amountStr =
      transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount.toString();
    const date = new Date(transaction.created_at).toLocaleDateString();

    description += `${emoji} **${amountStr} ${settings.currency_symbol}** - ${transaction.description} *(${date})*\n`;
  }

  embed.setDescription(description);
  await interaction.editReply({ 
    embeds: [embed]
  });
}

const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');

/**
 * Create and configure the Discord client instance
 */
function createClient() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });

  // Initialize command collection
  client.commands = new Collection();

  // Initialize managers (will be populated in ready event)
  client.nitradoPollingMonitor = null;
  client.tierManager = null;
  client.guildPrivacy = null;

  return client;
}

module.exports = { createClient };

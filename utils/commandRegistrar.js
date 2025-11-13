const { REST, Routes } = require('discord.js');

async function registerCommands({ clientId, token, commands, devGuildId }) {
  const rest = new REST({ version: '10' }).setToken(token);

  // Register to multiple guilds for instant updates
  const guildIds = [
    process.env.GRIZZLY_COMMAND_GUILD_ID,
    '1428086849456312431'
  ].filter(Boolean);
  
  if (guildIds.length > 0) {
    // Register to all specified guilds
    for (const guildId of guildIds) {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    }
    
    // Clear global commands to avoid conflicts
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    
    return { scope: 'guild', guildId: guildIds.join(', ') };
  } else {
    // Fallback to global if no guild IDs
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    return { scope: 'global' };
  }
}

module.exports = { registerCommands };

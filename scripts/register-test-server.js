const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function registerToTestServer() {
  const rest = new REST({ version: '10' }).setToken(process.env.GRIZZLY_BOT_TOKEN);
  
  // Load all commands
  const commands = [];
  const commandsPath = path.join(__dirname, '../commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  
  console.log(`Found ${commandFiles.length} command files`);
  
  for (const file of commandFiles) {
    try {
      const command = require(path.join(commandsPath, file));
      if (command.data) {
        commands.push(command.data.toJSON());
      }
    } catch (error) {
      console.warn(`Skipped ${file}: ${error.message}`);
    }
  }
  
  console.log(`Loaded ${commands.length} valid commands`);
  
  // Register to test server
  const testServerId = '1428086849456312431';
  console.log(`Registering to test server ${testServerId}...`);
  
  await rest.put(
    Routes.applicationGuildCommands(process.env.GRIZZLY_BOT_CLIENT_ID, testServerId),
    { body: commands }
  );
  
  console.log(`✅ Successfully registered ${commands.length} commands to test server!`);
  console.log('\nCommands should now appear in your Discord server.');
  console.log('If they don\'t show up immediately, try:');
  console.log('1. Restart Discord (Ctrl+R)');
  console.log('2. Wait 10-30 seconds');
  console.log('3. Type / in any channel');
}

registerToTestServer().catch(console.error);

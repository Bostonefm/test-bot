const fs = require('fs');
const path = require('path');
const logger = require('../config/logger.js');

/**
 * Load all commands from the commands directory
 * @param {Client} client - Discord client instance
 * @returns {Array} Array of command data for registration
 */
function loadCommands(client) {
  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      commands.push(command.data.toJSON());
      logger.info(`Loaded command: ${command.data.name}`);
    } else {
      logger.warn(`Command at ${filePath} is missing required "data" or "execute" property.`);
    }
  }

  return commands;
}

module.exports = { loadCommands };

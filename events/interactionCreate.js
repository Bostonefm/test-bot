// ==============================================
// events/interactionCreate.js
// Unified Interaction Handler
// ==============================================
const { handleCommand } = require('../interactions/commands.js');
const { handleButton } = require('../interactions/buttons.js');
const logger = require('../utils/logger.js').tag('interactionCreate');

module.exports = (client) => {
  client.on('interactionCreate', async (interaction) => {
    const startedAt = Date.now();

    try {
      // ─────────────────────────────────────────────
      // Slash Command Interactions
      // ─────────────────────────────────────────────
      if (interaction.isChatInputCommand()) {
        const { commandName, user, guild } = interaction;
        logger.info(`⚡ Executing /${commandName}`, {
          user: user?.tag,
          guild: guild?.name,
          guildId: guild?.id,
        });

        try {
          const execStart = Date.now();
          await handleCommand(interaction, client);
          const duration = Date.now() - execStart;

          logger.info(`✅ /${commandName} completed in ${duration}ms`, {
            user: user?.tag,
            guild: guild?.name,
          });
        } catch (cmdErr) {
          logger.error(`❌ Error executing /${interaction.commandName}: ${cmdErr.message}`, {
            stack: cmdErr.stack,
          });

          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ An unexpected error occurred while running this command.',
              ephemeral: true,
            }).catch(() => {});
          }
        }
        return;
      }

      // ─────────────────────────────────────────────
      // Button Interactions
      // ─────────────────────────────────────────────
      if (interaction.isButton()) {
        logger.debug(`🖱️ Button pressed: ${interaction.customId}`, {
          user: interaction.user?.tag,
          guild: interaction.guild?.name,
        });

        try {
          await handleButton(interaction);
          const duration = Date.now() - startedAt;
          logger.debug(`✅ Button ${interaction.customId} handled in ${duration}ms`);
        } catch (btnErr) {
          logger.error(`❌ Button handler error: ${btnErr.message}`, { stack: btnErr.stack });

          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '⚠️ Something went wrong handling that button.',
              ephemeral: true,
            }).catch(() => {});
          }
        }
      }

      // ─────────────────────────────────────────────
      // Future Interactions (SelectMenus, Modals, etc.)
      // ─────────────────────────────────────────────
      // Example structure for easy expansion:
      // if (interaction.isModalSubmit()) { ... }

    } catch (err) {
      // Global safety net — logs *any* unhandled interaction error
      logger.error('💥 Unhandled interaction error:', { error: err.message, stack: err.stack });

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ An unexpected error occurred. Please try again.',
            ephemeral: true,
          });
        }
      } catch {
        // ignore — user likely closed the interaction
      }
    }
  });
};

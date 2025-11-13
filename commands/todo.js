const { SlashCommandBuilder } = require('discord.js');
const db = require('../modules/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('todo')
    .setDescription('Manage your todo list')
    .addStringOption(option =>
      option.setName('action')
        .setDescription('Action to perform')
        .setRequired(true)
        .addChoices(
          { name: 'Add Item', value: 'add' },
          { name: 'List Items', value: 'list' },
          { name: 'Complete Item', value: 'complete' }
        ))
    .addStringOption(option =>
      option.setName('item')
        .setDescription('Todo item (for add action)')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('id')
        .setDescription('Todo ID (for complete action)')
        .setRequired(false)),

  async execute(interaction) {
    try {
      const action = interaction.options.getString('action');
      const item = interaction.options.getString('item');
      const id = interaction.options.getInteger('id');
      
      switch (action) {
        case 'add':
          if (!item) {
            return interaction.reply({ content: '❌ Please provide a todo item.', ephemeral: true });
          }
          
          const result = await db.query(
            'INSERT INTO tickets (type, category, title, created_by, status) VALUES ($1, $2, $3, $4, $5) RETURNING ticket_id',
            ['todo', 'personal', item, interaction.user.id, 'todo']
          );
          
          await interaction.reply({ 
            content: `✅ Todo added! (ID: ${result.rows[0].ticket_id})`, 
            ephemeral: true 
          });
          break;
          
        case 'list':
          const todos = await db.query(
            'SELECT * FROM tickets WHERE created_by = $1 AND type = $2 AND status = $3 ORDER BY created_at DESC',
            [interaction.user.id, 'todo', 'todo']
          );
          
          if (todos.rows.length === 0) {
            return interaction.reply({ content: '📝 Your todo list is empty!', ephemeral: true });
          }
          
          const todoList = todos.rows.map((todo, index) => 
            `${index + 1}. **[${todo.ticket_id}]** ${todo.title}`
          ).join('\n');
          
          await interaction.reply({ 
            content: `📝 **Your Todos:**\n${todoList}`, 
            ephemeral: true 
          });
          break;
          
        case 'complete':
          if (!id) {
            return interaction.reply({ content: '❌ Please provide a todo ID.', ephemeral: true });
          }
          
          const updated = await db.query(
            'UPDATE tickets SET status = $1, resolved_at = NOW() WHERE ticket_id = $2 AND created_by = $3 AND type = $4',
            ['completed', id, interaction.user.id, 'todo']
          );
          
          if (updated.rowCount === 0) {
            return interaction.reply({ content: '❌ Todo not found.', ephemeral: true });
          }
          
          await interaction.reply({ 
            content: `✅ Todo #${id} completed!`, 
            ephemeral: true 
          });
          break;
      }
    } catch (error) {
      console.error('Error managing todo:', error);
      await interaction.reply({ content: 'Error managing todo.', ephemeral: true });
    }
  }
};

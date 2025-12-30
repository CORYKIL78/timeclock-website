/**
 * /say Command
 * Send a message as the bot to any channel
 * Admin only
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const config = require('../config');

const ADMIN_ROLE_ID = config.ADMIN_ROLE_ID;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Send a message as the bot')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the message to')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Check admin permission
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true
            });
        }

        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message');

        try {
            await interaction.deferReply({ ephemeral: true });

            // Send the message to the specified channel
            await channel.send(message);

            await interaction.editReply({
                content: `✅ Message sent to ${channel}`,
                ephemeral: true
            });

        } catch (error) {
            console.error('Error sending message:', error);
            await interaction.editReply({
                content: '❌ Failed to send message. Make sure the bot has permission to send messages in that channel.',
                ephemeral: true
            });
        }
    }
};

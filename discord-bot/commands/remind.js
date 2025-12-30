/**
 * /remind Command
 * Send reminder DMs to users
 * Admin only
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config');

const ADMIN_ROLE_ID = config.ADMIN_ROLE_ID;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Send reminders to users')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to send reminder to')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Reminder message')
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

        const user = interaction.options.getUser('user');
        const message = interaction.options.getString('message');

        try {
            await interaction.deferReply({ ephemeral: true });

            // Create reminder embed
            const reminderEmbed = new EmbedBuilder()
                .setTitle('📢 Reminder')
                .setDescription(message)
                .setColor(0xFFA500)
                .setFooter({ text: `From: ${interaction.user.username}` })
                .setTimestamp();

            // Send DM to user
            try {
                await user.send({ embeds: [reminderEmbed] });
                
                await interaction.editReply({
                    content: `✅ Reminder sent to ${user.username}`,
                    ephemeral: true
                });
            } catch (dmError) {
                console.error('Failed to send DM:', dmError);
                await interaction.editReply({
                    content: `❌ Could not send DM to ${user.username}. They may have DMs disabled.`,
                    ephemeral: true
                });
            }

        } catch (error) {
            console.error('Error sending reminder:', error);
            await interaction.editReply({
                content: '❌ Failed to send reminder.',
                ephemeral: true
            });
        }
    }
};

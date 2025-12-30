/**
 * /log Command - Log attendance for multiple users
 * Connects to Staff Portal attendance tracking system
 * Admin only
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config');

const ADMIN_ROLE_ID = config.ADMIN_ROLE_ID;
const BACKEND_URL = config.BACKEND_URL;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('Log attendance for multiple users')
        .addUserOption(option =>
            option.setName('user1')
                .setDescription('First user (required)')
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('user2')
                .setDescription('Second user (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user3')
                .setDescription('Third user (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user4')
                .setDescription('Fourth user (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user5')
                .setDescription('Fifth user (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user6')
                .setDescription('Sixth user (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user7')
                .setDescription('Seventh user (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user8')
                .setDescription('Eighth user (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user9')
                .setDescription('Ninth user (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('user10')
                .setDescription('Tenth user (optional)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('event-name')
                .setDescription('Event name or description (optional)')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Check admin permission
        if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true
            });
        }

        const eventName = interaction.options.getString('event-name') || 'General Attendance';

        try {
            await interaction.deferReply({ ephemeral: true });

            // Collect all selected users
            const users = [];
            const userIds = [];
            for (let i = 1; i <= 10; i++) {
                const user = interaction.options.getUser(`user${i}`);
                if (user) {
                    users.push(user);
                    userIds.push(user.id);
                }
            }

            if (users.length === 0) {
                return await interaction.editReply({
                    content: '❌ No users selected.',
                    ephemeral: true
                });
            }

            // Send attendance log to backend (Staff Portal)
            const response = await fetch(`${BACKEND_URL}/api/attendance/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userIds: userIds,
                    eventName: eventName,
                    loggedBy: interaction.user.id,
                    loggedAt: new Date().toISOString()
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to log attendance');
            }

            // Success embed
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Attendance Logged')
                .setDescription(`Successfully logged attendance for **${users.length}** user(s).`)
                .addFields(
                    { name: '📋 Event', value: eventName, inline: false },
                    { name: '👥 Users', value: users.map(u => `<@${u.id}>`).join('\n'), inline: false }
                )
                .setColor(0x00FF00)
                .setFooter({ text: `Logged by ${interaction.user.username}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            // Send DM notifications to each user
            for (const user of users) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('✅ Attendance Logged')
                        .setDescription(`Your attendance has been logged for **${eventName}**.`)
                        .setColor(0x5865F2)
                        .setTimestamp();

                    await user.send({ embeds: [dmEmbed] });
                } catch (error) {
                    console.error(`Failed to DM user ${user.id}:`, error);
                }
            }

        } catch (error) {
            console.error('Error logging attendance:', error);
            await interaction.editReply({
                content: `❌ Failed to log attendance: ${error.message}`,
                ephemeral: true
            });
        }
    }
};

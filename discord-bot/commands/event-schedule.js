/**
 * /event-schedule Command
 * Schedule new company events with attendees
 * Connects to Staff Portal events system - creates events that appear in employee calendars
 * Admin only
 */

const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('../config');

const ADMIN_ROLE_ID = config.ADMIN_ROLE_ID;
const BACKEND_URL = config.BACKEND_URL;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('event-schedule')
        .setDescription('Schedule a new company event')
        .addUserOption(option =>
            option.setName('attendee1')
                .setDescription('First attendee (required)')
                .setRequired(true)
        )
        .addUserOption(option =>
            option.setName('attendee2')
                .setDescription('Second attendee (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('attendee3')
                .setDescription('Third attendee (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('attendee4')
                .setDescription('Fourth attendee (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('attendee5')
                .setDescription('Fifth attendee (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('attendee6')
                .setDescription('Sixth attendee (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('attendee7')
                .setDescription('Seventh attendee (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('attendee8')
                .setDescription('Eighth attendee (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('attendee9')
                .setDescription('Ninth attendee (optional)')
                .setRequired(false)
        )
        .addUserOption(option =>
            option.setName('attendee10')
                .setDescription('Tenth attendee (optional)')
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

        // Collect all selected attendees
        const attendees = [];
        for (let i = 1; i <= 10; i++) {
            const user = interaction.options.getUser(`attendee${i}`);
            if (user) {
                attendees.push({
                    id: user.id,
                    username: user.username
                });
            }
        }

        // Show modal for event details
        const modal = new ModalBuilder()
            .setCustomId(`event_modal_${attendees.map(a => a.id).join(',')}`)
            .setTitle('Schedule Company Event');

        const titleInput = new TextInputBuilder()
            .setCustomId('event_title')
            .setLabel('Event Title')
            .setPlaceholder('e.g., Team Meeting')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const descriptionInput = new TextInputBuilder()
            .setCustomId('event_description')
            .setLabel('Event Description')
            .setPlaceholder('Enter event details...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const dateInput = new TextInputBuilder()
            .setCustomId('event_date')
            .setLabel('Event Date (YYYY-MM-DD)')
            .setPlaceholder('e.g., 2025-12-31')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const timeInput = new TextInputBuilder()
            .setCustomId('event_time')
            .setLabel('Event Time (HH:MM)')
            .setPlaceholder('e.g., 14:00 or 2:00 PM')
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(descriptionInput),
            new ActionRowBuilder().addComponents(dateInput),
            new ActionRowBuilder().addComponents(timeInput)
        );

        await interaction.showModal(modal);
    },

    handleInteraction: async function(interaction) {
        if (!interaction.isModalSubmit()) return;
        if (!interaction.customId.startsWith('event_modal_')) return;

        try {
            await interaction.deferReply({ ephemeral: true });

            // Extract attendee IDs from customId
            const attendeeIds = interaction.customId.replace('event_modal_', '').split(',');

            const title = interaction.fields.getTextInputValue('event_title');
            const description = interaction.fields.getTextInputValue('event_description');
            const date = interaction.fields.getTextInputValue('event_date');
            const time = interaction.fields.getTextInputValue('event_time') || 'All Day';

            // Validate date format
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                return await interaction.editReply({
                    content: '❌ Invalid date format. Please use YYYY-MM-DD format (e.g., 2025-12-31).'
                });
            }

            // Send event to backend
            const response = await fetch(`${BACKEND_URL}/api/events/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title,
                    description: description,
                    date: date,
                    time: time,
                    attendees: attendeeIds,
                    createdBy: interaction.user.id,
                    createdAt: new Date().toISOString()
                })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to create event');
            }

            // Success embed
            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Event Scheduled')
                .setDescription(`**${title}** has been successfully scheduled!`)
                .addFields(
                    { name: '📅 Date', value: date, inline: true },
                    { name: '⏰ Time', value: time, inline: true },
                    { name: '📝 Description', value: description, inline: false },
                    { name: '👥 Attendees', value: `${attendeeIds.length} user(s): ${attendeeIds.map(id => `<@${id}>`).join(', ')}`, inline: false }
                )
                .setColor(0x00FF00)
                .setFooter({ text: `Created by ${interaction.user.username}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });

            // Send notification to attendees
            for (const userId of attendeeIds) {
                try {
                    const user = await interaction.client.users.fetch(userId);
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('📅 New Event Scheduled')
                        .setDescription(`You've been invited to **${title}**`)
                        .addFields(
                            { name: '📅 Date', value: date, inline: true },
                            { name: '⏰ Time', value: time, inline: true },
                            { name: '📝 Details', value: description, inline: false }
                        )
                        .setColor(0x5865F2)
                        .setTimestamp();

                    await user.send({ embeds: [dmEmbed] });
                } catch (error) {
                    console.error(`Failed to DM user ${userId}:`, error);
                }
            }

        } catch (error) {
            console.error('Error creating event:', error);
            await interaction.editReply({
                content: `❌ Failed to schedule event: ${error.message}`
            });
        }
    }
};

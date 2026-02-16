/**
 * /account Command
 * View staff portal account information, absences, and calendar
 * Restricted to staff members with an account
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

const BACKEND_URL = config.BACKEND_URL;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('account')
        .setDescription('View your staff portal account information')
        .addStringOption(option =>
            option.setName('option')
                .setDescription('Choose what to view')
                .setRequired(true)
                .addChoices(
                    { name: 'Information', value: 'information' },
                    { name: 'Absences', value: 'absences' },
                    { name: 'Calendar', value: 'calendar' }
                )
        ),

    async execute(interaction) {
        return await handleAccountCommand(interaction);
    },

    handleInteraction: async function(interaction) {
        if (!interaction.isButton()) return;
        // No button interactions for this command currently
    }
};

async function handleAccountCommand(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const option = interaction.options.getString('option');
    const userId = interaction.user.id;

    try {
        // Fetch user profile from backend
        const profileResponse = await fetch(`${BACKEND_URL}/api/user/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId: userId })
        });

        if (!profileResponse.ok) {
            return await interaction.editReply({
                content: '❌ You do not have an account. This is a mandatory requirement. Please sign up now at https://portal.cirkledevelopment.co.uk',
                ephemeral: true
            });
        }

        const profile = await profileResponse.json();

        if (option === 'information') {
            await showAccountInformation(interaction, profile);
        } else if (option === 'absences') {
            await showAbsences(interaction, userId, profile);
        } else if (option === 'calendar') {
            await showCalendar(interaction, userId, profile);
        }

    } catch (error) {
        console.error('Error in /account command:', error);
        await interaction.editReply({
            content: '❌ An error occurred while fetching your account information.',
            ephemeral: true
        });
    }
}

async function showAccountInformation(interaction, profile) {
    try {
        // Create account info embed with banner
        const embed = new EmbedBuilder()
            .setTitle('Staff Portal Account')
            .setDescription('Here\'s your account information')
            .setColor('#667eea')
            .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
            .addFields(
                { name: 'Name', value: profile.name || 'Not set', inline: true },
                { name: 'Staff ID', value: profile.staffId || 'Not set', inline: true },
                { name: 'Department', value: profile.department || 'Not set', inline: true },
                { name: 'Email', value: profile.email || 'Not set', inline: false }
            )
            .setImage('https://via.placeholder.com/1200x300?text=Staff+Portal');

        await interaction.editReply({
            embeds: [embed],
            ephemeral: true
        });

    } catch (error) {
        console.error('Error showing account information:', error);
        throw error;
    }
}

async function showAbsences(interaction, userId, profile) {
    try {
        // Fetch absences from backend
        const absencesResponse = await fetch(`${BACKEND_URL}/api/user/absences/${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const absences = await absencesResponse.json() || [];

        if (!Array.isArray(absences) || absences.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('Your Absences')
                .setDescription('You have no current absences')
                .setColor('#667eea')
                .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }));

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Submit Absence')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://portal.cirkledevelopment.co.uk')
                );

            return await interaction.editReply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });
        }

        // Filter current absences (not expired)
        const now = new Date();
        const currentAbsences = absences.filter(a => {
            const endDate = new Date(a.endDate);
            return endDate >= now;
        });

        const embed = new EmbedBuilder()
            .setTitle('Your Absences')
            .setColor('#667eea')
            .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }));

        if (currentAbsences.length === 0) {
            embed.setDescription('You have no current absences');
        } else {
            currentAbsences.forEach(absence => {
                const status = absence.status === 'approved' ? '✅ Approved' : '⏳ Pending';
                embed.addFields({
                    name: `${absence.type} - ${status}`,
                    value: `**From:** ${absence.startDate}\n**To:** ${absence.endDate}\n**Reason:** ${absence.reason || 'N/A'}`,
                    inline: false
                });
            });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('Submit Absence')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://portal.cirkledevelopment.co.uk')
            );

        await interaction.editReply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });

    } catch (error) {
        console.error('Error showing absences:', error);
        throw error;
    }
}

async function showCalendar(interaction, userId, profile) {
    try {
        // Fetch calendar events from backend
        const eventsResponse = await fetch(`${BACKEND_URL}/api/user/calendar/${userId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        let events = [];
        if (eventsResponse.ok) {
            events = await eventsResponse.json() || [];
        }

        if (!Array.isArray(events)) {
            events = [];
        }

        // Filter upcoming events (not expired)
        const now = new Date();
        const upcomingEvents = events.filter(e => {
            const eventDate = new Date(e.date || e.startDate);
            return eventDate >= now;
        }).sort((a, b) => new Date(a.date || a.startDate) - new Date(b.date || b.startDate));

        const embed = new EmbedBuilder()
            .setTitle('Your Calendar Events')
            .setColor('#667eea')
            .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }));

        if (upcomingEvents.length === 0) {
            embed.setDescription('You have no upcoming calendar events');
        } else {
            upcomingEvents.forEach(event => {
                const eventDate = event.date || event.startDate;
                embed.addFields({
                    name: event.title,
                    value: `**Date:** ${eventDate}\n**Created by:** ${event.createdBy || 'Unknown'}`,
                    inline: false
                });
            });
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('View Full Calendar')
                    .setStyle(ButtonStyle.Link)
                    .setURL('https://portal.cirkledevelopment.co.uk')
            );

        await interaction.editReply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });

    } catch (error) {
        console.error('Error showing calendar:', error);
        throw error;
    }
}

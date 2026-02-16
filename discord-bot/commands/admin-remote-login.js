/**
 * /admin-remote-login Command
 * Admin remote OC Portal for managing absences and staff lookup
 * Admins can log in with PIN and access remote management features
 * STAFF LOCKED - Only accessible to admins with correct PIN
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../config');

const BACKEND_URL = config.BACKEND_URL;
const ADMIN_ROLE_ID = '1315346851616002158';
const STAFF_SERVER_ADMIN_ROLE_ID = '1473065368061870315';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin-remote-login')
        .setDescription('Admin remote OC Portal - Enter your PIN to access')
        .addStringOption(option =>
            option.setName('pin')
                .setDescription('Your admin PIN')
                .setRequired(true)
        ),

    async execute(interaction) {
        return await handleAdminRemoteLogin(interaction);
    },

    handleInteraction: async function(interaction) {
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'admin_remote_menu') {
                await handleRemoteMenuSelection(interaction);
            }
        } else if (interaction.isButton()) {
            if (interaction.customId === 'absence_form_btn') {
                await showAbsenceForm(interaction);
            } else if (interaction.customId === 'staff_lookup_btn') {
                await showStaffLookupForm(interaction);
            }
        }
    }
};

async function handleAdminRemoteLogin(interaction) {
        // Check if user has admin role in either server
        const mainServerAdmin = interaction.member?.roles.cache.has(ADMIN_ROLE_ID);
        const staffServerAdmin = interaction.guild?.id === '1460025375655723283' && interaction.member?.roles.cache.has(STAFF_SERVER_ADMIN_ROLE_ID);

        if (!mainServerAdmin && !staffServerAdmin) {
            return await interaction.reply({
                content: '❌ This command is restricted to administrators only.',
                ephemeral: true
            });
        }

        const pin = interaction.options.getString('pin');
        
        // Verify PIN against user's Discord ID
        // We'll use a backend endpoint to verify the PIN
        try {
            const verifyResponse = await fetch(`${BACKEND_URL}/api/admin/verify-pin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    discordId: interaction.user.id,
                    pin: pin
                })
            });

            const verifyResult = await verifyResponse.json();

            if (!verifyResult.valid) {
                return await interaction.reply({
                    content: '❌ Invalid PIN. Access denied.',
                    ephemeral: true
                });
            }
        } catch (error) {
            console.error('PIN verification error:', error);
            return await interaction.reply({
                content: '❌ An error occurred while verifying your PIN.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Create main menu embed
            const embed = new EmbedBuilder()
                .setTitle('🔒 Remote OC Portal')
                .setDescription(`Welcome, ${interaction.user.username}!\n\nWhat would you like to do today?`)
                .setColor('#667eea')
                .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }));

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('admin_remote_menu')
                        .setPlaceholder('Select an option...')
                        .addOptions(
                            {
                                label: 'Absence Management',
                                description: 'Place a user on manual absence',
                                value: 'absence_management',
                                emoji: '📭'
                            },
                            {
                                label: 'Staff Lookup',
                                description: 'Look up a staff member\'s profile',
                                value: 'staff_lookup',
                                emoji: '🔍'
                            }
                        )
                );

            await interaction.editReply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in /admin-remote-login command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while accessing the portal.',
                ephemeral: true
            });
        }
    }

// Handle menu selection
async function handleRemoteMenuSelection(interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId === 'admin_remote_menu') {
        const selected = interaction.values[0];

        if (selected === 'absence_management') {
            await showAbsenceForm(interaction);
        } else if (selected === 'staff_lookup') {
            await showStaffLookupForm(interaction);
        }
    }
}

async function showAbsenceForm(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('Absence Management')
        .setDescription('You can place a user on a manual absence remotely!\n\nPlease gather the following information:')
        .setColor('#667eea')
        .addFields(
            { name: 'Required Information', value: '• Staff ID (e.g., OC217413)\n• Start Date (YYYY-MM-DD)\n• End Date (YYYY-MM-DD)\n• Absence Type\n• Extra Comment (optional)' }
        );

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('absence_form_modal_btn')
                .setLabel('Fill Out Form')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('absence_cancel_btn')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

    if (!interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
    }
    
    await interaction.editReply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}

async function showStaffLookupForm(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('Staff Lookup')
        .setDescription('Look up a staff member by their Staff ID\n\nPlease provide the Staff ID of the staff member you want to lookup (e.g., OC217413)')
        .setColor('#667eea');

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('staff_lookup_modal_btn')
                .setLabel('Lookup Staff Member')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('staff_lookup_cancel_btn')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger)
        );

    if (!interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
    }

    await interaction.editReply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}

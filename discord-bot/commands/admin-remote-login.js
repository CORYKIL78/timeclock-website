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
            if (interaction.customId === 'absence_form_modal_btn') {
                await showAbsenceInputModal(interaction);
            } else if (interaction.customId === 'staff_lookup_modal_btn') {
                await showStaffLookupModal(interaction);
            } else if (interaction.customId === 'absence_cancel_btn' || interaction.customId === 'staff_lookup_cancel_btn') {
                await interaction.deferUpdate();
                await interaction.editReply({
                    content: '❌ Operation cancelled',
                    embeds: [],
                    components: []
                });
            }
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'absence_input_modal') {
                await handleAbsenceSubmit(interaction);
            } else if (interaction.customId === 'staff_lookup_input_modal') {
                await handleStaffLookupSubmit(interaction);
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
        .setTitle('📭 Absence Management')
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

async function showAbsenceInputModal(interaction) {
    try {
        const modal = new ModalBuilder()
            .setCustomId('absence_input_modal')
            .setTitle('Absence Management Form')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('absence_staff_id')
                        .setLabel('Staff ID')
                        .setPlaceholder('e.g., OC217413')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('absence_start_date')
                        .setLabel('Start Date')
                        .setPlaceholder('YYYY-MM-DD')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('absence_end_date')
                        .setLabel('End Date')
                        .setPlaceholder('YYYY-MM-DD')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('absence_type')
                        .setLabel('Absence Type')
                        .setPlaceholder('e.g., Sick Leave, Holiday')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('absence_comment')
                        .setLabel('Extra Comment (Optional)')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false)
                )
            );

        await interaction.showModal(modal);
    } catch (error) {
        console.error('Error showing absence modal:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Error opening form. Please try again.',
                ephemeral: true
            });
        }
    }
}

async function showStaffLookupForm(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('🔍 Staff Lookup')
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

async function showStaffLookupModal(interaction) {
    try {
        const modal = new ModalBuilder()
            .setCustomId('staff_lookup_input_modal')
            .setTitle('Staff Lookup')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('staff_id_input')
                        .setLabel('Staff ID')
                        .setPlaceholder('e.g., OC217413')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                )
            );

        await interaction.showModal(modal);
    } catch (error) {
        console.error('Error showing staff lookup modal:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Error opening lookup form. Please try again.',
                ephemeral: true
            });
        }
    }
}

async function handleAbsenceSubmit(interaction) {
    try {
        const staffId = interaction.fields.getTextInputValue('absence_staff_id');
        const startDate = interaction.fields.getTextInputValue('absence_start_date');
        const endDate = interaction.fields.getTextInputValue('absence_end_date');
        const absenceType = interaction.fields.getTextInputValue('absence_type');
        const comment = interaction.fields.getTextInputValue('absence_comment') || '';

        // Validate dates
        if (isNaN(Date.parse(startDate)) || isNaN(Date.parse(endDate))) {
            return await interaction.reply({
                content: '❌ Invalid date format. Use YYYY-MM-DD',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        // Submit to backend
        const response = await fetch(`${BACKEND_URL}/api/admin/absence/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                staffId,
                startDate,
                endDate,
                absenceType,
                comment,
                adminId: interaction.user.id,
                adminName: interaction.user.username
            })
        });

        if (response.ok) {
            await interaction.editReply({
                content: `✅ Absence submitted successfully for ${staffId}!`,
                ephemeral: true
            });
        } else {
            const error = await response.text();
            await interaction.editReply({
                content: `❌ Failed to submit absence: ${error || response.statusText}`,
                ephemeral: true
            });
        }
    } catch (error) {
        console.error('Error submitting absence:', error);
        await interaction.reply({
            content: '❌ An error occurred while submitting the absence.',
            ephemeral: true
        });
    }
}

async function handleStaffLookupSubmit(interaction) {
    try {
        const staffId = interaction.fields.getTextInputValue('staff_id_input');

        await interaction.deferReply({ ephemeral: true });

        // Fetch staff profile from backend
        const response = await fetch(`${BACKEND_URL}/api/staff/lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ staffId })
        });

        if (!response.ok) {
            return await interaction.editReply({
                content: `❌ Staff member with ID ${staffId} not found.`,
                ephemeral: true
            });
        }

        const staff = await response.json();

        const embed = new EmbedBuilder()
            .setTitle(`Staff Profile: ${staff.name || 'Unknown'}`)
            .setColor('#667eea')
            .addFields(
                { name: '👤 Name', value: staff.name || 'Not set', inline: true },
                { name: '🆔 Staff ID', value: staff.staffId || staffId, inline: true },
                { name: '🏢 Department', value: staff.department || 'Not set', inline: true },
                { name: '📧 Email', value: staff.email || 'Not set', inline: true },
                { name: '📊 Status', value: staff.status || 'Active', inline: true },
                { name: 'ℹ️ Info', value: staff.info || 'No additional info', inline: false }
            )
            .setFooter({ text: 'Staff Portal Lookup' })
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
            ephemeral: true
        });
    } catch (error) {
        console.error('Error looking up staff:', error);
        await interaction.editReply({
            content: '❌ An error occurred while looking up the staff member.',
            ephemeral: true
        });
    }
}

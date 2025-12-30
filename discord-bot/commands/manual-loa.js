/**
 * /manual-loa Command - Leave of Absence Management
 * 
 * Flow:
 * 1. User runs /manual-loa → Shows dropdown of ongoing LOAs
 * 2. Select an LOA → Shows details with "Extend" or "Void" buttons
 * 3. Extend → Modal to extend the LOA
 * 4. Void → Confirms and voids the LOA
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../config');

const BACKEND_URL = config.BACKEND_URL;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manual-loa')
        .setDescription('Manage ongoing Leave of Absence requests'),

    async execute(interaction) {
        // Check admin permissions
        if (!interaction.member.roles.cache.has(config.ADMIN_ROLE_ID)) {
            return await interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        }

        try {
            await interaction.deferReply({ ephemeral: true });

            // Fetch ongoing LOAs from backend
            const response = await fetch(`${BACKEND_URL}/api/absence/ongoing`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            const loas = data.absences || [];

            if (loas.length === 0) {
                return await interaction.editReply({ content: '📋 No ongoing Leave of Absence requests found.', ephemeral: true });
            }

            // Create select menu
            const options = loas.map(loa => ({
                label: `${loa.username} - ${loa.reason}`,
                description: `${loa.startDate} to ${loa.endDate}`,
                value: loa.id
            }));

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_loa')
                .setPlaceholder('Select an LOA to manage')
                .addOptions(options.slice(0, 25)); // Discord limit

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('📋 Ongoing Leave of Absence Requests')
                .setDescription(`There are **${loas.length}** ongoing LOA(s). Select one below to extend or void.`)
                .setColor(0x5865F2)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed], components: [row], ephemeral: true });

        } catch (error) {
            console.error('Error fetching LOAs:', error);
            await interaction.editReply({ content: '❌ Failed to load LOA requests.', ephemeral: true });
        }
    },

    handleInteraction: async function(interaction) {
        if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return;

        const customId = interaction.customId;

        // Select LOA from dropdown
        if (customId === 'select_loa') {
            const loaId = interaction.values[0];
            await showLOADetails(interaction, loaId);
        }
        // Extend LOA button
        else if (customId.startsWith('loa_extend_')) {
            const loaId = customId.split('_')[2];
            await showExtendModal(interaction, loaId);
        }
        // Void LOA button
        else if (customId.startsWith('loa_void_')) {
            const loaId = customId.split('_')[2];
            await handleVoidLOA(interaction, loaId);
        }
        // Extend modal submission
        else if (customId === 'extend_loa_modal') {
            await handleExtendSubmission(interaction);
        }
    }
};

/**
 * Show LOA details with extend/void options
 */
async function showLOADetails(interaction, loaId) {
    try {
        await interaction.deferUpdate();

        // Fetch LOA details
        const response = await fetch(`${BACKEND_URL}/api/absence/${loaId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const loa = await response.json();

        const detailsEmbed = new EmbedBuilder()
            .setTitle('📋 Leave of Absence Details')
            .addFields(
                { name: '👤 Employee', value: `<@${loa.userId}> (${loa.username})`, inline: true },
                { name: '📅 Start Date', value: loa.startDate, inline: true },
                { name: '📅 End Date', value: loa.endDate, inline: true },
                { name: '📝 Reason', value: loa.reason, inline: false },
                { name: '🆔 LOA ID', value: loa.id, inline: true },
                { name: '📍 Source', value: loa.source || 'Manual', inline: true }
            )
            .setColor(0xFFAA00)
            .setTimestamp();

        const actionButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`loa_extend_${loaId}`)
                    .setLabel('Extend LOA')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📅'),
                new ButtonBuilder()
                    .setCustomId(`loa_void_${loaId}`)
                    .setLabel('Void LOA')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );

        await interaction.editReply({ embeds: [detailsEmbed], components: [actionButtons] });

    } catch (error) {
        console.error('Error showing LOA details:', error);
        await interaction.editReply({ content: '❌ Failed to load LOA details.' });
    }
}

/**
 * Show extend LOA modal
 */
async function showExtendModal(interaction, loaId) {
    const modal = new ModalBuilder()
        .setCustomId('extend_loa_modal')
        .setTitle('Extend Leave of Absence');

    const loaIdInput = new TextInputBuilder()
        .setCustomId('extend_loa_id')
        .setLabel('LOA ID (Do not change)')
        .setValue(loaId)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const newEndDateInput = new TextInputBuilder()
        .setCustomId('extend_new_end_date')
        .setLabel('New End Date')
        .setPlaceholder('YYYY-MM-DD')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const reasonInput = new TextInputBuilder()
        .setCustomId('extend_reason')
        .setLabel('Reason for Extension')
        .setPlaceholder('Enter reason for extending LOA...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(loaIdInput),
        new ActionRowBuilder().addComponents(newEndDateInput),
        new ActionRowBuilder().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
}

/**
 * Handle extend LOA submission
 */
async function handleExtendSubmission(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const loaId = interaction.fields.getTextInputValue('extend_loa_id');
        const newEndDate = interaction.fields.getTextInputValue('extend_new_end_date');
        const reason = interaction.fields.getTextInputValue('extend_reason') || 'No reason provided';

        // Update LOA in backend
        const response = await fetch(`${BACKEND_URL}/api/absence/${loaId}/extend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                newEndDate: newEndDate,
                reason: reason,
                extendedBy: interaction.user.id,
                extendedAt: new Date().toISOString()
            })
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to extend LOA');
        }

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ LOA Extended')
            .setDescription(`Leave of Absence has been successfully extended.`)
            .addFields(
                { name: '🆔 LOA ID', value: loaId, inline: true },
                { name: '📅 New End Date', value: newEndDate, inline: true },
                { name: '📝 Reason', value: reason, inline: false }
            )
            .setColor(0x00FF00)
            .setFooter({ text: `Extended by ${interaction.user.username}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
        console.error('Error extending LOA:', error);
        await interaction.editReply({ content: `❌ Failed to extend LOA: ${error.message}` });
    }
}

/**
 * Handle void LOA
 */
async function handleVoidLOA(interaction, loaId) {
    try {
        await interaction.deferUpdate();

        // Void LOA in backend
        const response = await fetch(`${BACKEND_URL}/api/absence/${loaId}/void`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                voidedBy: interaction.user.id,
                voidedAt: new Date().toISOString()
            })
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to void LOA');
        }

        const successEmbed = new EmbedBuilder()
            .setTitle('✅ LOA Voided')
            .setDescription(`Leave of Absence has been voided and removed from the system.`)
            .addFields(
                { name: '🆔 LOA ID', value: loaId, inline: true },
                { name: '👨‍💼 Voided By', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setColor(0xFF0000)
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed], components: [] });

    } catch (error) {
        console.error('Error voiding LOA:', error);
        await interaction.followUp({ content: `❌ Failed to void LOA: ${error.message}`, ephemeral: true });
    }
}

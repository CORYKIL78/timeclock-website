const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const config = require('../config');

const STAFF_ALLOWED_ROLES = [
    '1473071750630604870',
    '1473071807845109931',
    '1473299166439542866',
    '1473071789688094832'
];

const MAIN_ALLOWED_ROLES = [
    '1315042030220611646',
    '1366109362862428252',
    '1315042030346571837',
    '1315042030942031975'
];

const ALL_ALLOWED_ROLES = [...new Set([...STAFF_ALLOWED_ROLES, ...MAIN_ALLOWED_ROLES])];
const BACKEND_URL = config.BACKEND_URL;
const INTERVAL_CHANNEL_ID = '1473737970463932711';
const DISCIPLINARY_CHANNEL_ID = '1473738019960918260';

function hasDeptHeadRole(interaction) {
    return interaction.member?.roles?.cache?.some(role => ALL_ALLOWED_ROLES.includes(role.id));
}

function safeEphemeralReply(interaction, payload) {
    if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ ...payload, ephemeral: true }).catch(() => null);
    }
    return interaction.reply({ ...payload, ephemeral: true }).catch(() => null);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dept-head-management')
        .setDescription('Department head management actions'),

    async execute(interaction) {
        if (!hasDeptHeadRole(interaction)) {
            return interaction.reply({
                content: 'Access denied cus youve no roles.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('Department Head Management')
            .setDescription(`Welcome, ${interaction.user.username}. What would you like to do today?`)
            .setColor('#8b5cf6');

        const menu = new StringSelectMenuBuilder()
            .setCustomId('dhm_select_action')
            .setPlaceholder('Choose an option...')
            .addOptions([
                { label: 'Option A - View Analytics', value: 'analytics', description: 'Lookup full staff profile + analytics' },
                { label: 'Option B - Submit Department Interval Stats', value: 'interval', description: 'Submit interval document link' },
                { label: 'Option C - Record a disciplinary report', value: 'report', description: 'Submit monthly/commendation/behavioural/other report' },
                { label: 'Option D - Disciplinary Submit', value: 'strike', description: 'Submit formal/verbal strike' }
            ]);

        const row = new ActionRowBuilder().addComponents(menu);

        return interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    },

    async handleInteraction(interaction) {
        if (interaction.isStringSelectMenu() && interaction.customId !== 'dhm_select_action') return;
        if (interaction.isModalSubmit() && !interaction.customId.startsWith('dhm_modal_')) return;
        if (interaction.isButton() && !interaction.customId.startsWith('dhm_cf:')) return;

        if (interaction.isStringSelectMenu() && interaction.customId === 'dhm_select_action') {
            if (!hasDeptHeadRole(interaction)) {
                return safeEphemeralReply(interaction, { content: 'Access denied cus youve no roles.' });
            }

            const choice = interaction.values[0];

            if (choice === 'analytics') {
                const modal = new ModalBuilder()
                    .setCustomId('dhm_modal_analytics')
                    .setTitle('View Analytics')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('staff_id')
                                .setLabel('Enter staff ID (e.g. OC061021)')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                                .setMaxLength(32)
                        )
                    );
                return interaction.showModal(modal);
            }

            if (choice === 'interval') {
                const modal = new ModalBuilder()
                    .setCustomId('dhm_modal_interval')
                    .setTitle('Submit Department Interval Stats')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('document_link')
                                .setLabel('Enter document link')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                                .setMaxLength(400)
                        )
                    );
                return interaction.showModal(modal);
            }

            if (choice === 'report') {
                const modal = new ModalBuilder()
                    .setCustomId('dhm_modal_report')
                    .setTitle('Record a disciplinary report')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('target_staff_id')
                                .setLabel('Enter ID of target staff')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                                .setMaxLength(32)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('report_type')
                                .setLabel('Report Type (Monthly/Commend/Behave/Other)')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                                .setMaxLength(64)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('report_details')
                                .setLabel('Explain the report')
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                                .setMaxLength(1000)
                        )
                    );
                return interaction.showModal(modal);
            }

            if (choice === 'strike') {
                const modal = new ModalBuilder()
                    .setCustomId('dhm_modal_strike')
                    .setTitle('Disciplinary Submit')
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('target_staff_id')
                                .setLabel('Enter ID of target staff')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                                .setMaxLength(32)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('strike_type')
                                .setLabel('Strike type (formal or verbal)')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(true)
                                .setMaxLength(32)
                        ),
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('strike_details')
                                .setLabel('Explain the strike')
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                                .setMaxLength(1000)
                        )
                    );
                return interaction.showModal(modal);
            }
        }

        if (interaction.isModalSubmit() && interaction.customId === 'dhm_modal_analytics') {
            if (!hasDeptHeadRole(interaction)) {
                return safeEphemeralReply(interaction, { content: 'Access denied cus youve no roles.' });
            }

            await interaction.deferReply({ ephemeral: true });
            const staffId = interaction.fields.getTextInputValue('staff_id').trim();

            try {
                const response = await fetch(`${BACKEND_URL}/api/admin/staff-analytics?staffId=${encodeURIComponent(staffId)}`);
                const payload = await response.json();

                if (!response.ok || !payload?.success) {
                    return interaction.editReply({ content: `Searching...\n❌ ${payload?.error || 'Staff member not found'}` });
                }

                const profile = payload.profile || {};
                const counts = payload.counts || {};

                const embed = new EmbedBuilder()
                    .setTitle('Staff Analytics')
                    .setDescription(`Searching...\n✅ Found profile for **${profile.name || 'Unknown'}**`)
                    .setColor('#22c55e')
                    .addFields(
                        { name: 'Staff ID', value: profile.staffId || staffId, inline: true },
                        { name: 'Discord ID', value: payload.userId || 'Unknown', inline: true },
                        { name: 'Department', value: profile.department || 'Unknown', inline: true },
                        { name: 'Email', value: profile.email || 'Unknown', inline: false },
                        { name: 'Absences', value: String(counts.absences || 0), inline: true },
                        { name: 'Requests', value: String(counts.requests || 0), inline: true },
                        { name: 'Clockins', value: String(counts.clockins || 0), inline: true },
                        { name: 'Events Attended', value: String(counts.eventsAttended || 0), inline: true },
                        { name: 'Events Unattended', value: String(counts.eventsUnattended || 0), inline: true },
                        { name: 'Events Unsure', value: String(counts.eventsUnsure || 0), inline: true },
                        { name: 'Events Not Answered', value: String(counts.eventsNotAnswered || 0), inline: true }
                    )
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            } catch (error) {
                return interaction.editReply({ content: `Searching...\n❌ ${error.message}` });
            }
        }

        if (interaction.isModalSubmit() && interaction.customId === 'dhm_modal_interval') {
            if (!hasDeptHeadRole(interaction)) {
                return safeEphemeralReply(interaction, { content: 'Access denied cus youve no roles.' });
            }

            const link = interaction.fields.getTextInputValue('document_link').trim();
            const embed = new EmbedBuilder()
                .setTitle('Interval Submission!')
                .setColor('#f59e0b')
                .addFields(
                    { name: 'Submitted By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                    { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
                    { name: 'Document Link', value: link, inline: false }
                )
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`dhm_cf:interval:${interaction.user.id}`)
                    .setLabel('Confirm Viewing')
                    .setStyle(ButtonStyle.Success)
            );

            const channel = await interaction.client.channels.fetch(INTERVAL_CHANNEL_ID).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                return safeEphemeralReply(interaction, { content: '❌ Could not access interval channel.' });
            }

            await channel.send({ embeds: [embed], components: [row] });
            return safeEphemeralReply(interaction, { content: 'Sent successfully.' });
        }

        if (interaction.isModalSubmit() && interaction.customId === 'dhm_modal_report') {
            if (!hasDeptHeadRole(interaction)) {
                return safeEphemeralReply(interaction, { content: 'Access denied cus youve no roles.' });
            }

            const targetStaffId = interaction.fields.getTextInputValue('target_staff_id').trim();
            const reportType = interaction.fields.getTextInputValue('report_type').trim();
            const reportDetails = interaction.fields.getTextInputValue('report_details').trim();

            const embed = new EmbedBuilder()
                .setTitle('Disciplinary Report Submission')
                .setColor('#f59e0b')
                .addFields(
                    { name: 'Submitted By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                    { name: 'Target Staff ID', value: targetStaffId, inline: true },
                    { name: 'Report Type', value: reportType, inline: true },
                    { name: 'Details', value: reportDetails, inline: false },
                    { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`dhm_cf:report:${interaction.user.id}`)
                    .setLabel('Confirm Viewing')
                    .setStyle(ButtonStyle.Success)
            );

            const channel = await interaction.client.channels.fetch(DISCIPLINARY_CHANNEL_ID).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                return safeEphemeralReply(interaction, { content: '❌ Could not access report channel.' });
            }

            await channel.send({ embeds: [embed], components: [row] });
            return safeEphemeralReply(interaction, { content: 'Sent successfully.' });
        }

        if (interaction.isModalSubmit() && interaction.customId === 'dhm_modal_strike') {
            if (!hasDeptHeadRole(interaction)) {
                return safeEphemeralReply(interaction, { content: 'Access denied cus youve no roles.' });
            }

            const targetStaffId = interaction.fields.getTextInputValue('target_staff_id').trim();
            const strikeType = interaction.fields.getTextInputValue('strike_type').trim();
            const strikeDetails = interaction.fields.getTextInputValue('strike_details').trim();

            const embed = new EmbedBuilder()
                .setTitle('Disciplinary Strike Submission')
                .setColor('#f59e0b')
                .addFields(
                    { name: 'Submitted By', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
                    { name: 'Target Staff ID', value: targetStaffId, inline: true },
                    { name: 'Strike Type', value: strikeType, inline: true },
                    { name: 'Details', value: strikeDetails, inline: false },
                    { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
                )
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`dhm_cf:strike:${interaction.user.id}`)
                    .setLabel('Confirm Viewing')
                    .setStyle(ButtonStyle.Success)
            );

            const channel = await interaction.client.channels.fetch(DISCIPLINARY_CHANNEL_ID).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                return safeEphemeralReply(interaction, { content: '❌ Could not access disciplinary channel.' });
            }

            await channel.send({ embeds: [embed], components: [row] });
            return safeEphemeralReply(interaction, { content: 'Sent successfully.' });
        }

        if (interaction.isButton() && interaction.customId.startsWith('dhm_cf:')) {
            const [, type, requesterId] = interaction.customId.split(':');
            const originalEmbed = interaction.message.embeds?.[0];
            if (!originalEmbed) {
                return safeEphemeralReply(interaction, { content: '❌ Embed not found.' });
            }

            const newEmbed = EmbedBuilder.from(originalEmbed)
                .setColor('#22c55e')
                .addFields({
                    name: 'Confirmed by user',
                    value: `${interaction.user.tag} (${interaction.user.id})`,
                    inline: false
                });

            await interaction.update({ embeds: [newEmbed], components: [] });

            if (requesterId) {
                const requester = await interaction.client.users.fetch(requesterId).catch(() => null);
                if (requester) {
                    const prettyType = type === 'interval' ? 'Interval Submission' : type === 'report' ? 'Report Submission' : 'Strike Submission';
                    await requester.send(`✅ Your ${prettyType} has been confirmed by ${interaction.user.tag}.`).catch(() => null);
                }
            }
        }
    }
};

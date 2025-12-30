/**
 * /hire Command - Employee Hire/Dismiss Management
 * 
 * Flow:
 * 1. User runs /hire → Menu with "Hire Employee" or "Dismiss Employee" buttons
 * 2. Hire → Modal for employee details, adds roles, sends welcome email
 * 3. Dismiss → Modal for employee details, removes roles, sends dismissal email
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../config');

const BACKEND_URL = config.BACKEND_URL;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hire')
        .setDescription('Hire or dismiss employees'),

    async execute(interaction) {
        // Check admin permissions
        if (!interaction.member.roles.cache.has(config.ADMIN_ROLE_ID)) {
            return await interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
        }

        const menuEmbed = new EmbedBuilder()
            .setTitle('👥 Employee Management')
            .setDescription('Select an action below:')
            .setColor(0x5865F2)
            .setTimestamp();

        const menuRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('hire_employee')
                    .setLabel('Hire Employee')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId('dismiss_employee')
                    .setLabel('Dismiss Employee')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );

        await interaction.reply({ embeds: [menuEmbed], components: [menuRow], ephemeral: true });
    },

    handleInteraction: async function(interaction) {
        if (!interaction.isButton() && !interaction.isModalSubmit()) return;

        const customId = interaction.customId;

        // Hire button
        if (customId === 'hire_employee') {
            await showHireModal(interaction);
        }
        // Dismiss button
        else if (customId === 'dismiss_employee') {
            await showDismissModal(interaction);
        }
        // Hire modal submission
        else if (customId === 'hire_modal') {
            await handleHireSubmission(interaction);
        }
        // Dismiss modal submission
        else if (customId === 'dismiss_modal') {
            await handleDismissSubmission(interaction);
        }
    }
};

/**
 * Show hire employee modal
 */
async function showHireModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('hire_modal')
        .setTitle('Hire Employee');

    const userIdInput = new TextInputBuilder()
        .setCustomId('hire_user_id')
        .setLabel('User ID')
        .setPlaceholder('Enter Discord User ID...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const emailInput = new TextInputBuilder()
        .setCustomId('hire_email')
        .setLabel('Employee Email')
        .setPlaceholder('employee@example.com')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const rolesInput = new TextInputBuilder()
        .setCustomId('hire_roles')
        .setLabel('Role IDs (comma-separated)')
        .setPlaceholder('123456789,987654321')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const positionInput = new TextInputBuilder()
        .setCustomId('hire_position')
        .setLabel('Position/Title')
        .setPlaceholder('e.g., Developer, Designer')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(userIdInput),
        new ActionRowBuilder().addComponents(emailInput),
        new ActionRowBuilder().addComponents(rolesInput),
        new ActionRowBuilder().addComponents(positionInput)
    );

    await interaction.showModal(modal);
}

/**
 * Show dismiss employee modal
 */
async function showDismissModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('dismiss_modal')
        .setTitle('Dismiss Employee');

    const userIdInput = new TextInputBuilder()
        .setCustomId('dismiss_user_id')
        .setLabel('User ID')
        .setPlaceholder('Enter Discord User ID...')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const emailInput = new TextInputBuilder()
        .setCustomId('dismiss_email')
        .setLabel('Employee Email')
        .setPlaceholder('employee@example.com')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const rolesInput = new TextInputBuilder()
        .setCustomId('dismiss_roles')
        .setLabel('Role IDs to Remove (comma-separated)')
        .setPlaceholder('123456789,987654321')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const reasonInput = new TextInputBuilder()
        .setCustomId('dismiss_reason')
        .setLabel('Dismissal Reason')
        .setPlaceholder('Enter reason for dismissal...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(userIdInput),
        new ActionRowBuilder().addComponents(emailInput),
        new ActionRowBuilder().addComponents(rolesInput),
        new ActionRowBuilder().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
}

/**
 * Handle hire submission
 */
async function handleHireSubmission(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.fields.getTextInputValue('hire_user_id');
        const email = interaction.fields.getTextInputValue('hire_email');
        const rolesInput = interaction.fields.getTextInputValue('hire_roles');
        const position = interaction.fields.getTextInputValue('hire_position');

        // Parse role IDs
        const roleIds = rolesInput.split(',').map(r => r.trim()).filter(r => r);

        // Fetch user
        const user = await interaction.client.users.fetch(userId).catch(() => null);
        if (!user) {
            return await interaction.editReply({ content: '❌ Invalid User ID. Please check and try again.' });
        }

        // Get member
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) {
            return await interaction.editReply({ content: '❌ User is not in this server.' });
        }

        // Add roles
        for (const roleId of roleIds) {
            try {
                await member.roles.add(roleId);
            } catch (error) {
                console.error(`Failed to add role ${roleId}:`, error);
            }
        }

        // Send to backend
        const response = await fetch(`${BACKEND_URL}/api/employees/hire`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                username: user.username,
                email: email,
                position: position,
                hiredBy: interaction.user.id,
                hiredAt: new Date().toISOString()
            })
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to hire employee');
        }

        // Success embed
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Employee Hired')
            .setDescription(`Successfully hired <@${userId}>!`)
            .addFields(
                { name: '👤 Employee', value: user.username, inline: true },
                { name: '📧 Email', value: email, inline: true },
                { name: '💼 Position', value: position, inline: true },
                { name: '🎭 Roles Added', value: `${roleIds.length} role(s)`, inline: true }
            )
            .setColor(0x00FF00)
            .setFooter({ text: `Hired by ${interaction.user.username}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
        console.error('Error hiring employee:', error);
        await interaction.editReply({ content: `❌ Failed to hire employee: ${error.message}` });
    }
}

/**
 * Handle dismiss submission
 */
async function handleDismissSubmission(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.fields.getTextInputValue('dismiss_user_id');
        const email = interaction.fields.getTextInputValue('dismiss_email');
        const rolesInput = interaction.fields.getTextInputValue('dismiss_roles');
        const reason = interaction.fields.getTextInputValue('dismiss_reason') || 'No reason provided';

        // Parse role IDs
        const roleIds = rolesInput.split(',').map(r => r.trim()).filter(r => r);

        // Fetch user
        const user = await interaction.client.users.fetch(userId).catch(() => null);
        if (!user) {
            return await interaction.editReply({ content: '❌ Invalid User ID. Please check and try again.' });
        }

        // Get member
        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) {
            return await interaction.editReply({ content: '❌ User is not in this server.' });
        }

        // Remove roles
        for (const roleId of roleIds) {
            try {
                await member.roles.remove(roleId);
            } catch (error) {
                console.error(`Failed to remove role ${roleId}:`, error);
            }
        }

        // Send to backend
        const response = await fetch(`${BACKEND_URL}/api/employees/dismiss`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: userId,
                username: user.username,
                email: email,
                reason: reason,
                dismissedBy: interaction.user.id,
                dismissedAt: new Date().toISOString()
            })
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || 'Failed to dismiss employee');
        }

        // Success embed
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ Employee Dismissed')
            .setDescription(`Successfully dismissed <@${userId}>.`)
            .addFields(
                { name: '👤 Employee', value: user.username, inline: true },
                { name: '📧 Email', value: email, inline: true },
                { name: '🎭 Roles Removed', value: `${roleIds.length} role(s)`, inline: true },
                { name: '📝 Reason', value: reason, inline: false }
            )
            .setColor(0xFF0000)
            .setFooter({ text: `Dismissed by ${interaction.user.username}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [successEmbed] });

    } catch (error) {
        console.error('Error dismissing employee:', error);
        await interaction.editReply({ content: `❌ Failed to dismiss employee: ${error.message}` });
    }
}

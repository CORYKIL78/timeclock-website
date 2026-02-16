/**
 * /tasktrack Command
 * Task management system for creating and assigning tasks to staff
 * Only specific roles can create tasks:
 * - 1473071750630604870
 * - 1473071789688094832
 * - 1473071807845109931
 * - 1473065415780470971
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../config');

const BACKEND_URL = config.BACKEND_URL;
const ALLOWED_ROLES = [
    '1473071750630604870',
    '1473071789688094832',
    '1473071807845109931',
    '1473065415780470971'
];

// Department to channel mapping
const DEPARTMENT_CHANNELS = {
    'Customer Relations': '1460040549980569691',
    'Finance Division': '1472963484407959623',
    'Marketing Division': '1473073336706924563',
    'Development': '1472963235744448734'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tasktrack')
        .setDescription('Create and manage tasks for your team'),

    async execute(interaction) {
        return await handleTaskTrackCommand(interaction);
    },

    handleInteraction: async function(interaction) {
        if (interaction.isButton()) {
            if (interaction.customId === 'tasktrack_submit_btn') {
                await handleTaskTrackSubmitButton(interaction);
            } else if (interaction.customId === 'task_confirm_edit_btn') {
                await handleTaskEdit(interaction);
            } else if (interaction.customId === 'task_confirm_cancel_btn') {
                await handleTaskCancel(interaction);
            } else if (interaction.customId === 'task_confirm_publish_btn') {
                await handleTaskPublish(interaction);
            }
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'tasktrack_department_select') {
                await handleDepartmentSelection(interaction);
            }
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'tasktrack_form_modal') {
                await handleTaskFormSubmit(interaction);
            }
        }
    }
};

async function handleTaskTrackCommand(interaction) {
        // Check if user has required role
        const hasRole = ALLOWED_ROLES.some(roleId => interaction.member?.roles.cache.has(roleId));

        if (!hasRole && !interaction.member?.permissions.has('ADMINISTRATOR')) {
            return await interaction.reply({
                content: '❌ You do not have permission to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const embed = new EmbedBuilder()
                .setTitle('Welcome to TaskTrack')
                .setDescription(`Hello ${interaction.user.username}!\n\nClick below to submit a new task.`)
                .setColor('#667eea')
                .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }));

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('tasktrack_submit_btn')
                        .setLabel('Submit Task')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝')
                );

            await interaction.editReply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });

        } catch (error) {
            console.error('Error in /tasktrack command:', error);
            await interaction.editReply({
                content: '❌ An error occurred while initializing TaskTrack.',
                ephemeral: true
            });
        }
    }

// Handle button interactions for task submission
async function handleTaskTrackSubmitButton(interaction) {
    // Show department selection
    const row = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('tasktrack_department_select')
                .setPlaceholder('Select a department...')
                .addOptions(
                    { label: 'Customer Relations', value: 'Customer Relations', emoji: '👥' },
                    { label: 'Development', value: 'Development', emoji: '💻' },
                    { label: 'Finance Division', value: 'Finance Division', emoji: '💰' },
                    { label: 'Marketing Division', value: 'Marketing Division', emoji: '📢' }
                )
        );

    const embed = new EmbedBuilder()
        .setTitle('Select Department')
        .setDescription('Which department should this task be assigned to?')
        .setColor('#667eea');

    if (!interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
    }

    await interaction.editReply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}

// Handle department selection
async function handleDepartmentSelection(interaction) {
    if (interaction.customId !== 'tasktrack_department_select') return;

    const department = interaction.values[0];

    // Store department in interaction for later use
    if (!interaction.client.taskTrackData) {
        interaction.client.taskTrackData = new Map();
    }
    interaction.client.taskTrackData.set(interaction.user.id, { department });

    // Show task form modal
    const modal = new ModalBuilder()
        .setCustomId('tasktrack_form_modal')
        .setTitle(`New Task - ${department}`)
        .addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('task_title_input')
                    .setLabel('Task Title')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(100)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('task_description_input')
                    .setLabel('Task Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(1000)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('task_duedate_input')
                    .setLabel('Due Date (YYYY-MM-DD)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('task_extrainfo_input')
                    .setLabel('Extra Information (Optional)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(false)
                    .setMaxLength(500)
            )
        );

    await interaction.showModal(modal);
}

// Handle task form submission
async function handleTaskFormSubmit(interaction) {
    if (interaction.customId !== 'tasktrack_form_modal') return;

    const title = interaction.fields.getTextInputValue('task_title_input');
    const description = interaction.fields.getTextInputValue('task_description_input');
    const dueDate = interaction.fields.getTextInputValue('task_duedate_input');
    const extraInfo = interaction.fields.getTextInputValue('task_extrainfo_input') || '';

    // Get stored department
    if (!interaction.client.taskTrackData) {
        interaction.client.taskTrackData = new Map();
    }
    const taskData = interaction.client.taskTrackData.get(interaction.user.id);
    const department = taskData?.department || 'Unknown';

    // Store task for confirmation
    interaction.client.taskTrackData.set(interaction.user.id, {
        department,
        title,
        description,
        dueDate,
        extraInfo,
        createdBy: interaction.user.id,
        createdByName: interaction.user.username
    });

    await interaction.deferReply({ ephemeral: true });

    // Show confirmation
    const confirmEmbed = new EmbedBuilder()
        .setTitle('Confirm Task')
        .setDescription('Is this information correct?')
        .setColor('#667eea')
        .addFields(
            { name: 'Title', value: title, inline: false },
            { name: 'Description', value: description, inline: false },
            { name: 'Due Date', value: dueDate, inline: true },
            { name: 'Department', value: department, inline: true },
            { name: 'Extra Info', value: extraInfo || 'None', inline: false }
        );

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('task_confirm_edit_btn')
                .setLabel('Edit')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('task_confirm_cancel_btn')
                .setLabel('Cancel')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('task_confirm_publish_btn')
                .setLabel('Publish')
                .setStyle(ButtonStyle.Success)
        );

    await interaction.editReply({
        embeds: [confirmEmbed],
        components: [row],
        ephemeral: true
    });
}

// Handle task edit
async function handleTaskEdit(interaction) {
    await interaction.reply({
        content: '📝 Edit functionality coming soon!',
        ephemeral: true
    });
}

// Handle task cancel
async function handleTaskCancel(interaction) {
    // Clear stored data
    if (interaction.client.taskTrackData) {
        interaction.client.taskTrackData.delete(interaction.user.id);
    }

    await interaction.update({
        content: '✅ Task creation cancelled',
        embeds: [],
        components: [],
        ephemeral: true
    });
}

async function handleTaskPublish(interaction) {
    // Get stored task data
    if (!interaction.client.taskTrackData) {
        return await interaction.reply({
            content: '❌ Task data not found. Please start over.',
            ephemeral: true
        });
    }

    const taskData = interaction.client.taskTrackData.get(interaction.user.id);
    
    if (!taskData) {
        return await interaction.reply({
            content: '❌ Task data not found. Please start over.',
            ephemeral: true
        });
    }

    await interaction.deferUpdate();

    try {
        const channelId = DEPARTMENT_CHANNELS[taskData.department];

        if (!channelId) {
            return await interaction.followUp({
                content: '❌ Department channel not found.',
                ephemeral: true
            });
        }

        const channel = await interaction.client.channels.fetch(channelId);

        if (!channel) {
            return await interaction.followUp({
                content: '❌ Could not access department channel.',
                ephemeral: true
            });
        }

        // Create thread in the channel
        const thread = await channel.threads.create({
            name: `📋 ${taskData.title}`,
            autoArchiveDuration: 10080, // 7 days
        });

        // Create task in backend
        const createTaskResponse = await fetch(`${BACKEND_URL}/api/tasks/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: taskData.title,
                description: taskData.description,
                dueDate: taskData.dueDate,
                extraInfo: taskData.extraInfo,
                department: taskData.department,
                createdBy: interaction.user.id,
                createdByName: taskData.createdByName,
                threadId: thread.id
            })
        });

        const createdTask = await createTaskResponse.json();
        const taskId = createdTask.task?.id;

        // Log task creation
        if (taskId) {
            await fetch(`${BACKEND_URL}/api/tasks/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    taskId: taskId,
                    action: 'created',
                    details: {
                        title: taskData.title,
                        department: taskData.department,
                        threadId: thread.id,
                        channelId: channelId
                    },
                    userId: interaction.user.id,
                    userName: taskData.createdByName
                })
            });
        }

        // Create task embed
        const taskEmbed = new EmbedBuilder()
            .setTitle(`📋 ${taskData.title}`)
            .setDescription(taskData.description)
            .setColor('#667eea')
            .addFields(
                { name: 'Due By', value: taskData.dueDate, inline: true },
                { name: 'Department', value: taskData.department, inline: true },
                { name: 'Extra Information', value: taskData.extraInfo || 'None', inline: false },
                { name: 'Status', value: 'Open', inline: true }
            )
            .setFooter({
                text: `Created by ${taskData.createdByName}`,
                iconURL: interaction.user.displayAvatarURL({ size: 256 })
            })
            .setTimestamp();

        const taskButtonsRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`task_claim_${thread.id}`)
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✋'),
                new ButtonBuilder()
                    .setCustomId(`task_priority_${thread.id}`)
                    .setLabel('Set Priority')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📊'),
                new ButtonBuilder()
                    .setCustomId(`task_overdue_${thread.id}`)
                    .setLabel('Mark Overdue')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⚠️'),
                new ButtonBuilder()
                    .setCustomId(`task_complete_${thread.id}`)
                    .setLabel('Complete')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

        await thread.send({
            embeds: [taskEmbed],
            components: [taskButtonsRow]
        });

        // Clear stored data
        interaction.client.taskTrackData.delete(interaction.user.id);

        // Send success message to user
        await interaction.editReply({
            content: `✅ Task published successfully to ${channel.name}!`,
            embeds: [],
            components: [],
            ephemeral: true
        });

    } catch (error) {
        console.error('Error publishing task:', error);
        await interaction.followUp({
            content: '❌ An error occurred while publishing the task.',
            ephemeral: true
        });
    }
}

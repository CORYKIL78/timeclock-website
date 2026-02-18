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
    'Marketing Division': '1472963484407959623',
    'Development': '1472963235744448734'
};

// Department to role ping mapping
const DEPARTMENT_PINGS = {
    'Finance Division': '1473065523481935992',
    'Marketing Division': '1473065523481935992',
    'Development': '1473065463486480514',
    'Customer Relations': '1473065490153869456'
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
            } else if (interaction.customId === 'tasktrack_analytics_btn') {
                await handleAnalyticsButton(interaction);
            } else if (interaction.customId === 'task_confirm_edit_btn') {
                await handleTaskEdit(interaction);
            } else if (interaction.customId === 'task_confirm_cancel_btn') {
                await handleTaskCancel(interaction);
            } else if (interaction.customId === 'task_confirm_publish_btn') {
                await handleTaskPublish(interaction);
            } else if (interaction.customId.startsWith('task_claim_')) {
                await handleTaskClaim(interaction);
            } else if (interaction.customId.startsWith('task_priority_')) {
                await handleTaskPriority(interaction);
            } else if (interaction.customId.startsWith('task_overdue_')) {
                await handleTaskOverdue(interaction);
            } else if (interaction.customId.startsWith('task_close_')) {
                await handleTaskClose(interaction);
            }
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'tasktrack_department_select') {
                await handleDepartmentSelection(interaction);
            }
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId === 'tasktrack_form_modal') {
                await handleTaskFormSubmit(interaction);
            } else if (interaction.customId === 'analytics_staffid_modal') {
                await handleAnalyticsSubmit(interaction);
            } else if (interaction.customId.startsWith('task_priority_modal_')) {
                await handleTaskPriorityModalSubmit(interaction);
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
                        .setEmoji('📝'),
                    new ButtonBuilder()
                        .setCustomId('tasktrack_analytics_btn')
                        .setLabel('Analytics')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📊')
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

    try {
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
    } catch (error) {
        console.error('Error showing modal:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: '❌ Error opening form. Please try again.',
                ephemeral: true
            });
        } else {
            await interaction.followUp({
                content: '❌ Error opening form. Please try again.',
                ephemeral: true
            });
        }
    }
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
            console.error('Department not found:', taskData.department);
            return await interaction.followUp({
                content: '❌ Department channel not found. Invalid department.',
                ephemeral: true
            });
        }

        console.log(`[TASKTRACK] Fetching channel ${channelId} for department ${taskData.department}`);
        let channel;
        try {
            channel = await interaction.client.channels.fetch(channelId);
        } catch (fetchError) {
            console.error(`[TASKTRACK] Error fetching channel ${channelId}:`, fetchError.message);
            return await interaction.followUp({
                content: `❌ Could not access department channel (${channelId}). The bot may not have permission.`,
                ephemeral: true
            });
        }

        if (!channel) {
            console.error(`[TASKTRACK] Channel is null after fetch: ${channelId}`);
            return await interaction.followUp({
                content: '❌ Could not access department channel (channel is null).',
                ephemeral: true
            });
        }

        // Create thread in forum channel
        console.log(`[TASKTRACK] Creating forum thread in channel ${channelId}`);
        let thread;
        try {
            thread = await channel.threads.create({
                name: `📋 ${taskData.title}`,
                message: {
                    content: `👋 Task created by ${taskData.createdByName}\n\n**Description:** ${taskData.description}`
                },
                autoArchiveDuration: 10080, // 7 days
            });
        } catch (threadError) {
            console.error(`[TASKTRACK] Error creating thread:`, threadError.message);
            return await interaction.followUp({
                content: `❌ Could not create thread in department channel. ${threadError.message}`,
                ephemeral: true
            });
        }

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

        if (!createTaskResponse.ok) {
            console.error('Task creation API error:', createTaskResponse.status, createTaskResponse.statusText);
            const errorText = await createTaskResponse.text();
            console.error('Error response:', errorText);
            return await interaction.followUp({
                content: `❌ Failed to create task in backend: ${createTaskResponse.status} ${createTaskResponse.statusText}`,
                ephemeral: true
            });
        }

        const createdTask = await createTaskResponse.json();
        const taskId = createdTask.task?.id;

        if (!taskId) {
            return await interaction.followUp({
                content: '❌ Task created in thread but backend did not return a task ID.',
                ephemeral: true
            });
        }

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
                    .setCustomId(`task_claim_${taskId}`)
                    .setLabel('Claim')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✋'),
                new ButtonBuilder()
                    .setCustomId(`task_priority_${taskId}`)
                    .setLabel('Set Priority')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📊'),
                new ButtonBuilder()
                    .setCustomId(`task_overdue_${taskId}`)
                    .setLabel('Mark Overdue')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('⚠️'),
                new ButtonBuilder()
                    .setCustomId(`task_close_${taskId}`)
                    .setLabel('Close')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

        // Send thread message with role ping if applicable
        const pingRoleId = DEPARTMENT_PINGS[taskData.department];
        const threadMessage = {
            embeds: [taskEmbed],
            components: [taskButtonsRow]
        };
        
        if (pingRoleId) {
            threadMessage.content = `<@&${pingRoleId}>`;
        }
        
        await thread.send(threadMessage);

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
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        await interaction.followUp({
            content: '❌ An error occurred while publishing the task. Please try again.',
            ephemeral: true
        });
    }
}

async function handleAnalyticsButton(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('analytics_staffid_modal')
        .setTitle('Staff Analytics');

    const staffIdInput = new TextInputBuilder()
        .setCustomId('analytics_staffid_input')
        .setLabel('Enter Staff ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., OC061021')
        .setRequired(true);

    const row = new ActionRowBuilder().addComponents(staffIdInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
}

async function handleAnalyticsSubmit(interaction) {
    const staffId = interaction.fields.getTextInputValue('analytics_staffid_input');

    await interaction.deferReply({ ephemeral: true });

    if (!staffId || staffId.trim().length === 0) {
        return await interaction.editReply({
            content: '❌ Staff ID cannot be empty. Please provide a valid staff ID (e.g., OC061021).',
            ephemeral: true
        });
    }

    try {
        console.log(`[TASKTRACK] Fetching analytics for staff ID: ${staffId}`);

        // 1) Resolve staff ID to Discord ID using real backend endpoint
        const usersResponse = await fetch(`${BACKEND_URL}/api/admin/users`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!usersResponse.ok) {
            console.error(`[TASKTRACK] Users fetch error: ${usersResponse.status} - ${usersResponse.statusText}`);
            return await interaction.editReply({
                content: `❌ Could not fetch user list for analytics. (${usersResponse.status})`,
                ephemeral: true
            });
        }

        const usersPayload = await usersResponse.json();
        const users = usersPayload?.users || [];
        const normalizedStaffId = staffId.trim().toUpperCase();
        const matchedUser = users.find(user => (user.staffId || '').trim().toUpperCase() === normalizedStaffId);

        if (!matchedUser) {
            return await interaction.editReply({
                content: `❌ Could not find analytics for staff ID: ${staffId}. No matching profile found.`,
                ephemeral: true
            });
        }

        // 2) Fetch tasks for this user
        const tasksResponse = await fetch(`${BACKEND_URL}/api/tasks/user/${matchedUser.discordId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!tasksResponse.ok) {
            return await interaction.editReply({
                content: `❌ Could not fetch tasks for ${staffId}. (${tasksResponse.status})`,
                ephemeral: true
            });
        }

        const tasks = await tasksResponse.json();
        const allTasks = Array.isArray(tasks) ? tasks : [];

        // 3) Build analytics from task data
        const completedTasks = allTasks.filter(task => task.status === 'completed').length;
        const inProgressTasks = allTasks.filter(task => ['open', 'in_progress', 'claimed'].includes(task.status)).length;
        const overdueTasks = allTasks.filter(task => task.status === 'overdue').length;
        const totalTasks = allTasks.length;
        const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : '0.0';

        const latestTaskDate = allTasks
            .map(task => task.updatedAt || task.completedAt || task.claimedAt || task.createdAt)
            .filter(Boolean)
            .sort((a, b) => new Date(b) - new Date(a))[0];

        const analytics = {
            name: matchedUser.name || 'N/A',
            department: matchedUser.department || 'N/A',
            position: matchedUser.baseLevel || 'N/A',
            totalTasks,
            completedTasks,
            inProgressTasks,
            overdueTasks,
            completionRate,
            avgCompletionTime: 'N/A',
            onTimeRate: 'N/A',
            lastActive: latestTaskDate ? new Date(latestTaskDate).toLocaleString('en-GB') : 'N/A',
            totalHours: 'N/A',
            avgDaily: 'N/A'
        };

        // Create analytics embed
        const analyticsEmbed = new EmbedBuilder()
            .setTitle(`📊 Staff Analytics - ${staffId}`)
            .setColor('#667eea')
            .addFields(
                {
                    name: '👤 Staff Information',
                    value: `**Name:** ${analytics.name || 'N/A'}\n**Department:** ${analytics.department || 'N/A'}\n**Position:** ${analytics.position || 'N/A'}`,
                    inline: false
                },
                {
                    name: '📋 Task Analytics',
                    value: `**Total Tasks:** ${analytics.totalTasks || 0}\n**Completed:** ${analytics.completedTasks || 0}\n**In Progress:** ${analytics.inProgressTasks || 0}\n**Overdue:** ${analytics.overdueTasks || 0}`,
                    inline: true
                },
                {
                    name: '📈 Performance',
                    value: `**Completion Rate:** ${analytics.completionRate || '0'}%\n**Avg Completion Time:** ${analytics.avgCompletionTime || 'N/A'} days\n**On-Time Rate:** ${analytics.onTimeRate || '0'}%`,
                    inline: true
                },
                {
                    name: '📅 Activity',
                    value: `**Last Active:** ${analytics.lastActive || 'N/A'}\n**Total Hours:** ${analytics.totalHours || '0'} hrs\n**Average Daily:** ${analytics.avgDaily || '0'} hrs`,
                    inline: false
                }
            )
            .setFooter({ text: `Generated for staff ID: ${staffId}` })
            .setTimestamp();

        await interaction.editReply({
            embeds: [analyticsEmbed],
            ephemeral: true
        });

    } catch (error) {
        console.error('[TASKTRACK] Error fetching analytics:', error);
        await interaction.editReply({
            content: `❌ An error occurred while fetching analytics. ${error.message}`,
            ephemeral: true
        });
    }
}

// Handle task action buttons
async function handleTaskClaim(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const taskId = interaction.customId.replace('task_claim_', '');

        const claimResponse = await fetch(`${BACKEND_URL}/api/tasks/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId,
                userId: interaction.user.id,
                userName: interaction.user.tag
            })
        });

        if (!claimResponse.ok) {
            const errorText = await claimResponse.text();
            throw new Error(`Claim failed (${claimResponse.status}): ${errorText}`);
        }

        await fetch(`${BACKEND_URL}/api/tasks/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId,
                action: 'claimed',
                details: { claimedBy: interaction.user.id, claimedByTag: interaction.user.tag },
                userId: interaction.user.id,
                userName: interaction.user.tag
            })
        }).catch(() => {});

        await interaction.channel.send(`✋ Task claimed by <@${interaction.user.id}>`);
        await updateTaskMessageEmbed(interaction, {
            status: `Claimed by ${interaction.user.tag}`
        });
        
        await interaction.editReply({
            content: `✅ Task claimed and synced to portal.`,
            ephemeral: true
        });
        
        console.log(`[TASKTRACK] User ${interaction.user.tag} claimed task ${taskId}`);
    } catch (error) {
        console.error('[TASKTRACK] Error claiming task:', error);
        await interaction.editReply({
            content: `❌ Error claiming task: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleTaskPriority(interaction) {
    try {
        const taskId = interaction.customId.replace('task_priority_', '');

        const modal = new ModalBuilder()
            .setCustomId(`task_priority_modal_${taskId}`)
            .setTitle('Set Task Priority')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('task_priority_input')
                        .setLabel('Priority (low, medium, high, critical)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setPlaceholder('e.g. high')
                        .setMaxLength(10)
                )
            );

        await interaction.showModal(modal);
    } catch (error) {
        console.error('[TASKTRACK] Error setting priority:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: `❌ Error setting priority: ${error.message}`,
                ephemeral: true
            });
            return;
        }
        await interaction.editReply({
            content: `❌ Error setting priority: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleTaskOverdue(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const taskId = interaction.customId.replace('task_overdue_', '');

        const statusResponse = await fetch(`${BACKEND_URL}/api/tasks/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId,
                status: 'overdue',
                userId: interaction.user.id,
                userName: interaction.user.tag
            })
        });

        if (!statusResponse.ok) {
            const errorText = await statusResponse.text();
            throw new Error(`Overdue update failed (${statusResponse.status}): ${errorText}`);
        }

        await fetch(`${BACKEND_URL}/api/tasks/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId,
                action: 'overdue',
                details: { markedBy: interaction.user.id },
                userId: interaction.user.id,
                userName: interaction.user.tag
            })
        }).catch(() => {});

        await interaction.channel.send(`⚠️ Task marked overdue by <@${interaction.user.id}>`);
        await updateTaskMessageEmbed(interaction, {
            status: 'Overdue'
        });
        
        await interaction.editReply({
            content: `⚠️ Task marked as overdue and synced.`,
            ephemeral: true
        });
        
        console.log(`[TASKTRACK] User ${interaction.user.tag} marked task ${taskId} as overdue`);
    } catch (error) {
        console.error('[TASKTRACK] Error marking overdue:', error);
        await interaction.editReply({
            content: `❌ Error marking as overdue: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleTaskClose(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const taskId = interaction.customId.replace('task_close_', '');

        const statusResponse = await fetch(`${BACKEND_URL}/api/tasks/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId,
                status: 'closed',
                userId: interaction.user.id,
                userName: interaction.user.tag
            })
        });

        if (!statusResponse.ok) {
            const errorText = await statusResponse.text();
            throw new Error(`Close failed (${statusResponse.status}): ${errorText}`);
        }

        await fetch(`${BACKEND_URL}/api/tasks/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId,
                action: 'closed',
                details: { closedBy: interaction.user.id },
                userId: interaction.user.id,
                userName: interaction.user.tag
            })
        }).catch(() => {});

        await interaction.channel.send(`✅ Task closed by <@${interaction.user.id}>`);
        await updateTaskMessageEmbed(interaction, {
            status: `Closed by ${interaction.user.tag}`
        });

        await interaction.channel.setArchived(true);
        
        await interaction.editReply({
            content: `✅ Task thread closed and archived.`,
            ephemeral: true
        });
        
        console.log(`[TASKTRACK] User ${interaction.user.tag} closed task ${taskId}`);
    } catch (error) {
        console.error('[TASKTRACK] Error closing task:', error);
        await interaction.editReply({
            content: `❌ Error closing task: ${error.message}`,
            ephemeral: true
        });
    }
}

async function handleTaskPriorityModalSubmit(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const taskId = interaction.customId.replace('task_priority_modal_', '');
        const rawPriority = interaction.fields.getTextInputValue('task_priority_input') || '';
        const normalizedPriority = rawPriority.trim().toLowerCase();
        const allowed = ['low', 'medium', 'high', 'critical'];

        if (!allowed.includes(normalizedPriority)) {
            return await interaction.editReply({
                content: '❌ Invalid priority. Use one of: low, medium, high, critical.',
                ephemeral: true
            });
        }

        const priorityResponse = await fetch(`${BACKEND_URL}/api/tasks/priority`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId,
                priority: normalizedPriority,
                userId: interaction.user.id,
                userName: interaction.user.tag
            })
        });

        if (!priorityResponse.ok) {
            const errorText = await priorityResponse.text();
            throw new Error(`Priority update failed (${priorityResponse.status}): ${errorText}`);
        }

        await fetch(`${BACKEND_URL}/api/tasks/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                taskId,
                action: 'priority_set',
                details: { priority: normalizedPriority },
                userId: interaction.user.id,
                userName: interaction.user.tag
            })
        }).catch(() => {});

        const priorityLabel = `${normalizedPriority.charAt(0).toUpperCase()}${normalizedPriority.slice(1)}`;
        await interaction.channel.send(`📊 Priority set to **${priorityLabel}** by <@${interaction.user.id}>`);

        await interaction.editReply({
            content: `✅ Priority set to ${priorityLabel}.`,
            ephemeral: true
        });
    } catch (error) {
        console.error('[TASKTRACK] Error submitting priority modal:', error);
        await interaction.editReply({
            content: `❌ Error setting priority: ${error.message}`,
            ephemeral: true
        });
    }
}

async function updateTaskMessageEmbed(interaction, updates = {}) {
    try {
        const message = interaction.message;
        const firstEmbed = message?.embeds?.[0];
        if (!firstEmbed) return;

        const nextEmbed = EmbedBuilder.from(firstEmbed);
        const fields = [...(firstEmbed.fields || [])];

        const statusFieldIndex = fields.findIndex(f => f.name === 'Status');
        if (statusFieldIndex >= 0 && updates.status) {
            fields[statusFieldIndex] = { ...fields[statusFieldIndex], value: updates.status };
        }

        const priorityFieldIndex = fields.findIndex(f => f.name === 'Priority');
        if (updates.priority) {
            if (priorityFieldIndex >= 0) {
                fields[priorityFieldIndex] = { ...fields[priorityFieldIndex], value: updates.priority };
            } else {
                fields.push({ name: 'Priority', value: updates.priority, inline: true });
            }
        }

        nextEmbed.setFields(fields);
        await message.edit({ embeds: [nextEmbed] });
    } catch (error) {
        console.error('[TASKTRACK] Failed to update task embed:', error.message);
    }
}

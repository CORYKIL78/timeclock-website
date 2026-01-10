/**
 * /calendar Command
 * View all scheduled events and calendar
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('calendar')
        .setDescription('View all scheduled events and activities'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const embed = new EmbedBuilder()
                .setColor('#3b82f6')
                .setTitle('📅 Calendar & Scheduled Events')
                .setDescription('View all your scheduled events in the Staff Portal at: https://portal.cirkledevelopment.co.uk')
                .addFields(
                    {
                        name: '📍 How to use Calendar',
                        value: `1. Open the Staff Portal
2. Click **Calendar** in the sidebar
3. Click any date to see scheduled events
4. Click **+ Add Event** to schedule new items
5. Events are color-coded in blue`,
                        inline: false
                    },
                    {
                        name: '🔔 Event Types',
                        value: `• **Absences** - Scheduled time off
• **Payslips** - Salary reviews
• **Disciplinaries** - Important notices
• **Reports** - Team reports
• **Custom Events** - Any other scheduled items`,
                        inline: false
                    },
                    {
                        name: '💡 Tips',
                        value: `• Blue highlighted dates have events
• Hover over events to see details
• You\'ll receive notifications when events are added
• Sync events across all your devices`,
                        inline: false
                    }
                )
                .setFooter({
                    text: 'Calendar syncs in real-time across all devices',
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Calendar command error:', error);
            await interaction.editReply({
                content: '❌ An error occurred while fetching the calendar.',
                ephemeral: true
            });
        }
    }
};

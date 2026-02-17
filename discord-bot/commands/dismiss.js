/**
 * /dismiss Command
 * Dismiss a staff member and send dismissal email
 * Removes all roles, kicks from staff server, sends dismissal email, and DMs the user
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

const BACKEND_URL = config.BACKEND_URL;
const MAIN_SERVER_ID = '1310656642672627752'; // Main server
const STAFF_SERVER_ID = '1460025375655723283'; // Staff server
const DISMISSAL_LOG_CHANNEL = '1473377571482894478'; // Hiring log channel (for dismissals too)

// All role IDs to remove (from /hire MAIN_SERVER_ROLES)
const ALL_ROLES_TO_REMOVE = [
    '1315042036105220156',
    '1315042036969242704',
    '1315346851616002158',
    '1433453982453338122',
    '1315042032766554163',
    '1315323804528017498'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dismiss')
        .setDescription('Dismiss a staff member and revoke access')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Select the user to dismiss')
                .setRequired(true)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('user');

        await interaction.deferReply({ ephemeral: true });

        try {
            // Get main server
            let mainServer;
            try {
                mainServer = await interaction.client.guilds.fetch(MAIN_SERVER_ID);
            } catch (guildError) {
                console.error('Error fetching main server:', guildError);
                return await interaction.editReply({
                    content: `❌ Error: Could not access main server.`
                });
            }

            // Get member from main server
            let member;
            try {
                member = await mainServer.members.fetch(user.id);
            } catch (memberError) {
                console.error('Error fetching member:', memberError);
                return await interaction.editReply({
                    content: `❌ Error: Could not find user in main server.`
                });
            }

            // Get user email from backend
            let userEmail = null;
            try {
                const profileResponse = await fetch(`${BACKEND_URL}/api/user/profile?discordId=${user.id}`);
                if (profileResponse.ok) {
                    const profileData = await profileResponse.json();
                    userEmail = profileData.email;
                }
            } catch (profileError) {
                console.error('Error fetching user profile:', profileError);
            }

            if (!userEmail) {
                return await interaction.editReply({
                    content: `❌ Error: Could not find email for this user. Please ensure they have a staff portal account.`
                });
            }

            // Remove all roles from main server
            let rolesRemoved = 0;
            for (const roleId of ALL_ROLES_TO_REMOVE) {
                try {
                    if (member.roles.cache.has(roleId)) {
                        await member.roles.remove(roleId);
                        rolesRemoved++;
                    }
                } catch (roleError) {
                    console.error(`Error removing role ${roleId}:`, roleError);
                }
            }

            // Reset nickname
            try {
                await member.setNickname(null);
            } catch (nickError) {
                console.error('Error resetting nickname:', nickError);
            }

            // Kick from staff server
            let kickSuccess = false;
            try {
                const staffServer = await interaction.client.guilds.fetch(STAFF_SERVER_ID);
                const staffMember = await staffServer.members.fetch(user.id);
                await staffMember.kick('Dismissed from Cirkle Development');
                kickSuccess = true;
            } catch (kickError) {
                console.error('Error kicking from staff server:', kickError);
            }

            // Send dismissal email
            let emailSuccess = false;
            try {
                await sendDismissalEmail(userEmail, user.username, interaction.user.tag);
                emailSuccess = true;
                console.log(`[DISMISS] Dismissal email sent to ${userEmail}`);
            } catch (emailError) {
                console.error('[DISMISS] Error sending dismissal email:', emailError.message);
            }

            // Send DM to user
            let dmSuccess = false;
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('👋 Goodbye from the Cirkle Family')
                    .setColor('#ef4444')
                    .setDescription('We regret to inform you of your Dismissal from Cirkle Development.')
                    .addFields(
                        { name: '🔗 Dismissal Documents', value: 'Please see your email for a copy of your Dismissal Form. This includes the full reason of your dismissal, plus any further details.', inline: false },
                        { name: '📋 Dismissed By', value: interaction.user.tag, inline: false },
                        { name: '💖 Final Message', value: 'Thank you for being apart of the Cirkle Development Team. We wish you the best of luck in your future endeavors.\n\n- #teamcirkle 💖', inline: false }
                    )
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] });
                dmSuccess = true;
                console.log(`[DISMISS] DM sent to ${user.tag}`);
            } catch (dmError) {
                console.error('[DISMISS] Error sending DM:', dmError.message);
            }

            // Log to dismissal log channel
            try {
                const logChannel = await interaction.client.channels.fetch(DISMISSAL_LOG_CHANNEL);
                const logEmbed = new EmbedBuilder()
                    .setTitle('❌ Staff Member Dismissed')
                    .setColor('#ef4444')
                    .addFields(
                        { name: 'Dismissed By', value: interaction.user.tag, inline: true },
                        { name: 'User', value: user.tag, inline: true },
                        { name: 'User ID', value: user.id, inline: true },
                        { name: 'Email', value: userEmail, inline: true },
                        { name: 'Roles Removed', value: `${rolesRemoved} roles`, inline: true },
                        { name: 'Kicked from Staff Server', value: kickSuccess ? '✅ Yes' : '❌ No', inline: true },
                        { name: 'Email Sent', value: emailSuccess ? '✅ Yes' : '❌ No', inline: true },
                        { name: 'DM Sent', value: dmSuccess ? '✅ Yes' : '❌ No', inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            } catch (logError) {
                console.error('Error logging dismissal:', logError);
            }

            await interaction.editReply({
                content: `✅ Successfully dismissed ${user.tag}!\n- Roles removed: ${rolesRemoved}\n- Kicked from staff server: ${kickSuccess ? '✅' : '❌'}\n- Email sent: ${emailSuccess ? '✅' : '❌'}\n- DM sent: ${dmSuccess ? '✅' : '❌'}`
            });

        } catch (error) {
            console.error('Error in dismiss command:', error);
            await interaction.editReply({
                content: `❌ An error occurred: ${error.message}`
            });
        }
    }
};

async function sendDismissalEmail(recipientEmail, username, dismissedBy) {
    const emailHtml = getDismissalEmailHTML(username, dismissedBy);

    // Using Resend API
    const resendApiKey = process.env.RESEND_API_KEY_MAIN;
    if (!resendApiKey) {
        console.error('[DISMISS] ❌ RESEND_API_KEY_MAIN environment variable not set');
        throw new Error('Email service not configured (RESEND_API_KEY_MAIN missing)');
    }

    console.log(`[DISMISS] Sending dismissal email to ${recipientEmail}...`);
    
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'candidates@staff.cirkledevelopment.co.uk',
            to: recipientEmail,
            subject: 'Your Dismissal from Cirkle Development',
            html: emailHtml
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[DISMISS] Email API error (${response.status}):`, errorText);
        throw new Error(`Email API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[DISMISS] ✅ Dismissal email accepted by Resend:', result.id);
    return result;
}

function getDismissalEmailHTML(username, dismissedBy) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background-color: #ef4444;
            color: white;
            padding: 40px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
        }
        .content {
            padding: 40px 20px;
            color: #333333;
        }
        .content h2 {
            color: #ef4444;
            font-size: 20px;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        .content p {
            line-height: 1.6;
            margin: 10px 0;
        }
        .section {
            margin: 20px 0;
            padding: 15px;
            background-color: #f9fafb;
            border-left: 4px solid #ef4444;
            border-radius: 4px;
        }
        .footer {
            background-color: #f9fafb;
            padding: 20px;
            text-align: center;
            color: #666666;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
        }
        .footer a {
            color: #ef4444;
            text-decoration: none;
        }
        a {
            color: #ef4444;
            text-decoration: none;
        }
        strong {
            color: #1f2937;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>👋 Goodbye from the Cirkle Family</h1>
            <p>It's been awesome having you!</p>
        </div>

        <div class="content">
            <p>Hi ${username},</p>

            <p>We regret to inform you that you have been dismissed from the team at <strong>Cirkle Development</strong>.</p>

            <div class="section">
                <h2>📋 Your Dismissal Documents</h2>
                <p>Please see the <strong>attached PDF document</strong> sent to you via email for a copy of your formal Dismissal Form. This includes the full reason of your dismissal, plus any further details regarding your departure.</p>
            </div>

            <div class="section">
                <h2>⚖️ Common Dismissal Reasons</h2>
                <p>Most dismissals usually occur due to a breach of our Promissory Agreements. Circumstances include, <em>but are not limited to</em>:</p>
                <ul style="margin: 10px 0;">
                    <li><strong>Inactivity</strong> - Lack of engagement or participation</li>
                    <li><strong>Rule Breaks</strong> - Violation of company policies</li>
                    <li><strong>Security Risks</strong> - Compromising data or safety protocols</li>
                    <li>Other violations as outlined in your employment agreement</li>
                </ul>
            </div>

            <div class="section">
                <h2>👤 Dismissed By</h2>
                <p>This dismissal was processed by: <strong>${dismissedBy}</strong></p>
            </div>

            <div class="section">
                <h2>❓ Got Questions?</h2>
                <p>If you wish to get in contact with us to question your dismissal, you can DM the admin who processed your dismissal (${dismissedBy}).</p>
                <p>You can also speak to the department manager via <strong><a href="mailto:careers@cirkledevelopment.co.uk">careers@cirkledevelopment.co.uk</a></strong> if necessary.</p>
            </div>

            <p style="margin-top: 30px;">We wish you nothing but the very best in the future. Have an awesome rest of your day/night and hope to see you around again soon! Farewell 👋</p>

            <p style="margin-top: 20px;">Kind Regards,<br><strong>Careers Department @ Cirkle Development</strong></p>
        </div>

        <div class="footer">
            <p>&copy; Cirkle Development, 2025 | <a href="https://shop.cirkledevelopment.co.uk/">https://shop.cirkledevelopment.co.uk/</a></p>
            <p>
                <a href="https://twitter.com">Twitter</a> || 
                <a href="https://tiktok.com/@cirkledev">TikTok</a> || 
                <a href="https://discord.gg/2452XzVPZd">Discord</a> || 
                <a href="https://www.roblox.com/communities/8321615/Cirkle-Development#!/about">Roblox</a> || 
                <a href="https://instagram.com/cirkledev">Instagram</a> || 
                <a href="https://www.youtube.com/@cirkledev">YouTube</a>
            </p>
        </div>
    </div>
</body>
</html>
    `;
}

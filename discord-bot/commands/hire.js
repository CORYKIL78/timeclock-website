/**
 * /hire Command
 * Hire a new staff member and send welcome email
 * Assigns roles, sends welcome email, and logs the action
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

const BACKEND_URL = config.BACKEND_URL;
const MAIN_SERVER_ID = '1310656642672627752'; // Main server
const STAFF_SERVER_ID = '1460025375655723283'; // Staff server
const HIRING_LOG_CHANNEL = '1473377571482894478'; // Hiring log channel in staff server

// Department to roles mapping (MAIN SERVER)
const MAIN_SERVER_ROLES = {
    'Customer Relations': ['1315042036105220156', '1315042036969242704', '1315346851616002158'],
    'Finance and Marketing': ['1433453982453338122', '1315346851616002158'],
    'Development': ['1315042032766554163', '1315323804528017498', '1315346851616002158'],
    'Oversight': ['1315042036105220156', '1315042036969242704', '1315346851616002158'],
    'Corporate': ['1315042036105220156', '1315042036969242704', '1315346851616002158']
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hire')
        .setDescription('Hire a new staff member')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Select the user to hire')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('department')
                .setDescription('Select department')
                .setRequired(true)
                .addChoices(
                    { name: 'Customer Relations', value: 'Customer Relations' },
                    { name: 'Development', value: 'Development' },
                    { name: 'Finance and Marketing', value: 'Finance and Marketing' },
                    { name: 'Oversight and Corporate', value: 'Oversight' }
                )
        )
        .addStringOption(option =>
            option.setName('email')
                .setDescription('Email address for the welcome email')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('fullname')
                .setDescription('Full name of the staff member')
                .setRequired(true)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('user');
        const department = interaction.options.getString('department');
        const email = interaction.options.getString('email');
        const fullName = interaction.options.getString('fullname');

        await interaction.deferReply({ ephemeral: true });

        try {
            // Get main server
            let mainServer;
            try {
                mainServer = await interaction.client.guilds.fetch(MAIN_SERVER_ID);
            } catch (guildError) {
                console.error('Error fetching main server:', guildError);
                return await interaction.editReply({
                    content: `❌ Error: Could not access main server. Please check bot permissions.`
                });
            }

            let member;
            try {
                member = await mainServer.members.fetch(user.id);
            } catch (memberError) {
                console.error('Error fetching member:', memberError);
                return await interaction.editReply({
                    content: `❌ Error: Could not find user in main server.`
                });
            }

            // Assign roles in main server
            const rolesToAdd = MAIN_SERVER_ROLES[department] || [];
            for (const roleId of rolesToAdd) {
                try {
                    await member.roles.add(roleId);
                } catch (roleError) {
                    console.error(`Error adding role ${roleId}:`, roleError);
                }
            }

            // Change nickname
            try {
                await member.setNickname(fullName);
            } catch (nickError) {
                console.error('Error setting nickname:', nickError);
            }

            // Send welcome email
            let emailSuccess = false;
            try {
                await sendWelcomeEmail(email, fullName, department);
                emailSuccess = true;
                console.log(`[HIRE] Email sent successfully to ${email}`);
            } catch (emailError) {
                console.error('[HIRE] Error sending email:', emailError.message);
            }

            // Send welcome DM
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('👋 Welcome to the team!')
                    .setColor('#10b981')
                    .setDescription(`Hey ${fullName}! You have been successfully hired to Cirkle Development. However, you must complete a few steps before fully gaining access to everything. Please see below:`)
                    .addFields(
                        { name: '💻 Join the Staff Server', value: 'You must be in the Staff Server. You can join by using this link: https://discord.gg/HDrpVmTRxC\n**⚠️ DO NOT SHARE THIS WITH ANYONE**', inline: false },
                        { name: '🔗 Sign the Promissory Agreement', value: 'You must sign the Promissory Agreement by navigating to https://redirects.cirkledevelopment.co.uk/pa/sign', inline: false },
                        { name: '📱 Create a Portal Account', value: 'You must have a Portal account. Sign up to Cirkles custom made staff portal at https://portal.cirkledevelopment.co.uk', inline: false },
                        { name: '✅ Final Step', value: 'Once all of these steps are done, hit the Verify button in the Staff Server! You can also check your email for a little welcome letter.', inline: false }
                    )
                    .setFooter({ text: 'We look forward to having you!' })
                    .setTimestamp();

                await user.send({ embeds: [dmEmbed] });
                console.log(`[HIRE] Welcome DM sent to ${user.tag}`);
            } catch (dmError) {
                console.error('[HIRE] Error sending welcome DM:', dmError.message);
            }

            // Log to hiring log channel
            try {
                const logChannel = await interaction.client.channels.fetch(HIRING_LOG_CHANNEL);
                const logEmbed = new EmbedBuilder()
                    .setTitle('✅ New Staff Hired')
                    .setColor('#10b981')
                    .addFields(
                        { name: 'Hired By', value: interaction.user.tag, inline: true },
                        { name: 'User', value: user.tag, inline: true },
                        { name: 'Full Name', value: fullName, inline: true },
                        { name: 'Department', value: department, inline: true },
                        { name: 'Email', value: email, inline: true },
                        { name: 'Email Sent', value: emailSuccess ? '✅ Yes' : '❌ No', inline: true },
                        { name: 'Roles Assigned', value: rolesToAdd.length > 0 ? '✅ Yes' : '❌ No', inline: true },
                        { name: 'Nickname Set', value: fullName, inline: false }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed] });
            } catch (logError) {
                console.error('Error logging hire:', logError);
            }

            await interaction.editReply({
                content: `✅ Successfully hired ${user.tag}!\n- Roles assigned: ${rolesToAdd.length}\n- Email sent: ${emailSuccess ? '✅' : '❌'}\n- Nickname set to: ${fullName}`
            });

        } catch (error) {
            console.error('Error in hire command:', error);
            await interaction.editReply({
                content: `❌ An error occurred: ${error.message}`
            });
        }
    }
};

async function sendWelcomeEmail(recipientEmail, fullName, department) {
    const emailHtml = getWelcomeEmailHTML(fullName, department);

    // Using Mailersend API
    const mailersendApiKey = process.env.MAILERSEND_API_KEY;
    if (!mailersendApiKey) {
        console.error('[HIRE] ❌ MAILERSEND_API_KEY environment variable not set');
        throw new Error('Email service not configured (MAILERSEND_API_KEY missing)');
    }

    console.log(`[HIRE] Sending welcome email to ${recipientEmail}...`);
    
    const response = await fetch('https://api.mailersend.com/v1/email', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${mailersendApiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: {
                email: 'careers@cirkledevelopment.co.uk',
                name: 'Careers Department'
            },
            to: [
                {
                    email: recipientEmail,
                    name: fullName
                }
            ],
            subject: 'Welcome to the Cirkle Development Staff Team!',
            html: emailHtml
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HIRE] Email API error (${response.status}):`, errorText);
        throw new Error(`Email API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('[HIRE] ✅ Email sent successfully:', result.message_id);
    return result;
}

function getWelcomeEmailHTML(fullName, department) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Cirkle Development</title>
    <style>
        body { font-family: Arial, helvetica, sans-serif; background-color: #f5f5f5; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background-color: #667eea; padding: 30px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { padding: 30px; color: #333; line-height: 1.6; }
        .section { margin-bottom: 25px; }
        .section h2 { color: #667eea; font-size: 18px; margin-top: 0; }
        .section p { margin: 10px 0; }
        a { color: #667eea; text-decoration: none; }
        a:hover { text-decoration: underline; }
        .footer { background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; }
        .footer a { color: #667eea; }
        .button { display: inline-block; background-color: #667eea; color: white; padding: 12px 24px; border-radius: 5px; margin: 20px 0; }
        ul { margin: 15px 0; padding-left: 20px; }
        li { margin: 8px 0; }
        .highlight { background-color: #f9f9f9; border-left: 4px solid #667eea; padding: 15px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Welcome to the Staff Team! 👋</h1>
        </div>

        <div class="content">
            <p>Hello ${fullName}!</p>

            <p>We would like to welcome you to Cirkle Development's Staff Team! We are excited to work alongside you and we hope you are too! Here is some important information you need to know...</p>

            <div class="section">
                <h2>📋 Read the Promissory Agreement</h2>
                <p>Please ensure you have read the entire promissory agreement. If you think you have forgotten to read part of it, you can visit <a href="https://redirects.cirkledevelopment.co.uk/staff/pa">https://redirects.cirkledevelopment.co.uk/staff/pa</a> and read it fully from there.</p>
                <p>Please also acknowledge the server guidelines and Discord/Roblox TOS. You will be provided a link to sign. Please check your DM's now.</p>
            </div>

            <div class="section">
                <h2>📧 Email Communications</h2>
                <p>We sometimes use emails to send important messages to our Staff Team. The email this is being sent to (${recipientEmail}) will be the email used to receive emails from us.</p>
                <p>These emails are usually sent by any of the administrators or marked as "Careers Department" or "Administration Team". Any emails sent with the domain ending <strong>cirkledevelopment.co.uk</strong> are legitimate. Please ignore any others.</p>
            </div>

            <div class="section">
                <h2>🎁 Staff Discount</h2>
                <p>When purchasing products, you have a <strong>40% off discount</strong>. This coupon can be used as many times as you want on our <a href="https://shop.cirkledevelopment.co.uk">online store</a>. If you wish to use this discount for a Roblox purchase, just DM Sam Caster.</p>
            </div>

            <div class="section">
                <h2>🔐 Staff Portal</h2>
                <p>You have a Staff Portal. This is where you can log absences, clock in and out, view your recurring payslips, disciplinaries, profile and more.</p>
                <p>To access this, go to <a href="https://portal.cirkledevelopment.co.uk">https://portal.cirkledevelopment.co.uk</a>. You have to authenticate with Discord. Don't worry, this only accesses your display name and your profile picture.</p>
                <p><strong>This is a mandatory requirement.</strong></p>
            </div>

            <div class="section">
                <h2>📊 TaskTrack - Task Management</h2>
                <p>Cirkle Development has officially withdrawn from the use of ClickUp and created our very own Task Management System, <strong>TaskTrack</strong>. With TaskTrack, you can keep up with your recurring tasks, staff analytics and more!</p>
                <p>To use TaskTrack, head to Portal and go to TaskTrack section. View the channel "Task-Claiming" and click the big button "Claim". Once you have claimed a task, you will be DMed and prompted to look at your Staff Portal. You can publish updates and see more info there. Further questions can be asked by contacting your Department Head.</p>
            </div>

            <div class="highlight">
                <h2>📞 We are here to help!</h2>
                <p>Don't hesitate to ask us for help when you need to! We are always here. You must follow the COC (Chain of Command) when asking questions:</p>
                <ol>
                    <li>Start with your Colleagues</li>
                    <li>Then a Department Head</li>
                    <li>Then move up with the Administrator Ladder</li>
                </ol>
            </div>

            <p style="text-align: center; margin-top: 40px;">And that's all for now! Make sure to join our Roblox group so we can role you! And be sure to check around the server everyday.</p>

            <p style="text-align: center; margin-top: 30px;">We hope you enjoy your time on the team at Cirkle Development. Cya soon! 👋</p>

            <p style="text-align: center; margin-top: 20px;">
                <strong>Kind Regards,</strong><br>
                <strong>Careers Department @ Cirkle Development</strong>
            </p>
        </div>

        <div class="footer">
            <p style="margin: 0 0 10px 0;">© Cirkle Development, 2025</p>
            <p style="margin: 0 0 10px 0;">
                <a href="https://discord.gg/2452XzVPZd">Discord</a> | 
                <a href="https://www.roblox.com/communities/8321615/Cirkle-Development">Roblox</a> | 
                <a href="https://instagram.com/cirkledev">Instagram</a> | 
                <a href="https://www.youtube.com/@cirkledev">YouTube</a> | 
                <a href="https://shop.cirkledevelopment.co.uk">Shop</a>
            </p>
            <p style="margin: 0;">For questions, contact your Department Head</p>
        </div>
    </div>
</body>
</html>`;
}

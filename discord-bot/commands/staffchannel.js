/**
 * /staffchannel Command
 * Staff server verification system
 * Sends verification embed to designated channel and manages staff verification
 */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../config');

const BACKEND_URL = config.BACKEND_URL;
const STAFF_SERVER_ID = '1460025375655723283';
const VERIFICATION_CHANNEL = '1472637575083724863';

// Department to roles mapping
const DEPARTMENT_ROLES = {
    'Customer Relations': ['1473300232296206550', '1473065490153869456'],
    'Finance Division': ['1473065523481935992'],
    'Marketing Division': ['1473065523481935992'],
    'Development': ['1473300204357681316', '1473065463486480514'],
    'Oversight and Corporate': ['1473300232296206550', '1473065490153869456']
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('staffchannel')
        .setDescription('Send staff server verification embed to the verification channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Check if user is admin
        if (!interaction.member?.permissions.has('ADMINISTRATOR')) {
            return await interaction.reply({
                content: '❌ Only administrators can use this command.',
                ephemeral: true
            });
        }

        // Check if command is being run in the staff server
        if (interaction.guildId !== STAFF_SERVER_ID) {
            return await interaction.reply({
                content: '❌ This command can only be used in the Staff Server.',
                ephemeral: true
            });
        }

        try {
            // Get the verification channel
            const channel = await interaction.client.channels.fetch(VERIFICATION_CHANNEL);
            if (!channel) {
                return await interaction.reply({
                    content: '❌ Verification channel not found.',
                    ephemeral: true
                });
            }

            // Create verification embed
            const embed = new EmbedBuilder()
                .setTitle('<:logo:1473364226738229422> Welcome to the Staff Server! 👋')
                .setDescription(`**Greetings!** Welcome to the Cirkle Family.\nBefore you are fully a recognisable staff, we ask that you verify by using the above verification. This gives you the role you require and allows you to fully immerse yourself into the Staff Server. If you have questions on this, please contact your application manager (the person whom accepted your application. You can find their user on the letter in your DM's).

🤔 **What gets verified?**
We have our very own Staff Portal and Database that can keep important user information during your time at Cirkle Development. When you press **✅ Verify** it looks for your Staff Portal account, then your Staff ID. If you get verified successfully, you get a success message and DM.`)
                .setColor('#10b981') // Green color
                .setImage('https://media.discordapp.net/attachments/1315278404009988107/1433584166447874221/cirkledevtest.png?ex=6995950b&is=6994438b&hm=047bf700e3b41554ac1ab9fc89cfa7467115ce8c7a7ab786e494405bfdf38561&=&format=webp&quality=lossless');

            // Create verify button
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('staff_verify_btn')
                        .setLabel('✅ Verify')
                        .setStyle(ButtonStyle.Success)
                );

            // Send the embed to the verification channel
            await channel.send({
                embeds: [embed],
                components: [row]
            });

            await interaction.reply({
                content: '✅ Verification embed sent to the verification channel!',
                ephemeral: true
            });

        } catch (error) {
            console.error('Error sending verification embed:', error);
            await interaction.reply({
                content: '❌ An error occurred while sending the verification embed.',
                ephemeral: true
            });
        }
    },

    handleInteraction: async function(interaction) {
        if (interaction.isButton()) {
            if (interaction.customId === 'staff_verify_btn') {
                await handleStaffVerification(interaction);
            } else if (interaction.customId === 'verify_yes_btn') {
                await handleVerifyYes(interaction);
            } else if (interaction.customId === 'verify_no_btn') {
                await handleVerifyNo(interaction);
            }
        }
    }
};

async function handleStaffVerification(interaction) {
    await interaction.reply({
        content: '🔍 Searching...',
        ephemeral: true
    });

    try {
        // Fetch user profile from backend
        const profileResponse = await fetch(`${BACKEND_URL}/api/user/profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ discordId: interaction.user.id })
        });

        if (!profileResponse.ok) {
            return await interaction.editReply({
                content: '❌ Unfortunately, I could not find your account. Please seek a member of Corporate for assistance.'
            });
        }

        const profile = await profileResponse.json();

        // Create confirmation embed
        const confirmEmbed = new EmbedBuilder()
            .setTitle('✅ Account Found! Is this you?')
            .setColor('#667eea')
            .addFields(
                { name: 'Name', value: profile.name || 'Not set', inline: true },
                { name: 'Staff ID', value: profile.staffId || 'Not set', inline: true },
                { name: 'Department', value: profile.department || 'Not set', inline: false },
                { name: 'Email', value: profile.email || 'Not set', inline: false }
            )
            .setTimestamp();

        // Store profile data temporarily for later use
        if (!interaction.client.staffVerificationData) {
            interaction.client.staffVerificationData = new Map();
        }
        interaction.client.staffVerificationData.set(interaction.user.id, profile);

        // Create yes/no buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_yes_btn')
                    .setLabel('Yes')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('verify_no_btn')
                    .setLabel('No')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.editReply({
            embeds: [confirmEmbed],
            components: [row]
        });

    } catch (error) {
        console.error('Error verifying staff:', error);
        await interaction.editReply({
            content: '❌ An error occurred during verification. Please try again.'
        });
    }
}

async function handleVerifyYes(interaction) {
    await interaction.deferUpdate();

    try {
        // Get stored profile data
        if (!interaction.client.staffVerificationData) {
            return await interaction.editReply({
                content: '❌ Session expired. Please verify again.',
                components: []
            });
        }

        const profile = interaction.client.staffVerificationData.get(interaction.user.id);
        if (!profile) {
            return await interaction.editReply({
                content: '❌ Session expired. Please verify again.',
                components: []
            });
        }

        // Get roles to assign based on department
        const rolesToAdd = DEPARTMENT_ROLES[profile.department] || [];
        
        console.log(`[VERIFICATION] User: ${interaction.user.tag}, Department: ${profile.department}, Roles to add:`, rolesToAdd);

        // Get the guild and member
        const guild = await interaction.client.guilds.fetch(STAFF_SERVER_ID);
        const member = await guild.members.fetch(interaction.user.id);

        // Assign roles
        let rolesAssigned = 0;
        for (const roleId of rolesToAdd) {
            try {
                await member.roles.add(roleId);
                rolesAssigned++;
                console.log(`[VERIFICATION] Successfully added role ${roleId} to ${interaction.user.tag}`);
            } catch (roleError) {
                console.error(`[VERIFICATION] Error adding role ${roleId} to ${interaction.user.tag}:`, roleError);
            }
        }
        
        console.log(`[VERIFICATION] Assigned ${rolesAssigned}/${rolesToAdd.length} roles to ${interaction.user.tag}`);

        // Send success message in channel
        const successEmbed = new EmbedBuilder()
            .setTitle('✅ You have been verified!')
            .setColor('#10b981')
            .setDescription(`Welcome to the Staff Server, ${interaction.user.username}!\n\nDepartment: ${profile.department}\nRoles Assigned: ${rolesAssigned}/${rolesToAdd.length}`)
            .setTimestamp();

        await interaction.editReply({
            embeds: [successEmbed],
            components: []
        });

        // Send welcome DM
        const dmEmbed = new EmbedBuilder()
            .setTitle('👋 Welcome to the Cirkle Family, ' + interaction.user.username + '!')
            .setColor('#667eea')
            .setDescription(`We are so glad that you can join us. Make sure you take a look around the server and get familiar with your new workspace!

**📝 Some things to remember...**
- Be respectful at all times.
- Grammar and a Professional Manner is required at all times, inside the server, in the main server and outside if company related.
  * Exceptions include in the universal Staff Communal channel, the main lounge in the main server, and also the MyCirkle Lounge and CTBE chat (if applicable). In your department chat is also an exception.
- Leaking, Distributing, Copying and/or Stealing- anything in the Staff Server is prohibited and will result in an immediate dismissal.
- You must abide by the [server rules](https://discord.com/channels/1460025375655723283/1460025818305794048) and [promissory agreement](https://docs.google.com/document/d/1n3Ts6TAATMqS0rk1dyj5D-YK5PU6KHZ5mUojBdSD-RU/edit?usp=sharing)

And most importantly, have fun! Make sure you get on good terms with your colleagues. Because, lets face it, bad terms = a negative working environment.

Thank you for joining us! Any further questions should be directed to your department head, which you can find in the information channel of your department category.`)
            .setTimestamp();

        try {
            await interaction.user.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            console.error('Error sending DM:', dmError);
        }

        // Clean up stored data
        interaction.client.staffVerificationData.delete(interaction.user.id);

    } catch (error) {
        console.error('Error in verify yes handler:', error);
        await interaction.editReply({
            content: '❌ An error occurred during verification. Please contact Corporate for assistance.',
            components: []
        });
    }
}

async function handleVerifyNo(interaction) {
    await interaction.deferUpdate();

    // Clear stored data
    if (interaction.client.staffVerificationData) {
        interaction.client.staffVerificationData.delete(interaction.user.id);
    }

    const notYouEmbed = new EmbedBuilder()
        .setTitle('❌ Account Mismatch')
        .setColor('#ef4444')
        .setDescription('Unfortunately, I could not find your account. Please seek a member of Corporate for assistance.')
        .setTimestamp();

    await interaction.editReply({
        embeds: [notYouEmbed],
        components: []
    });
}

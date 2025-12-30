const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const db = require('../database');

// In-memory cache (with MongoDB fallback)
const quotes = new Map();
let quoteCounter = 1;
let dbConnected = false;

// Initialize - load from database if available
async function initializeQuotes() {
    try {
        const allQuotes = await db.getAllQuotes();
        allQuotes.forEach(quote => {
            quotes.set(quote.id, quote);
        });
        quoteCounter = await db.getQuoteCounter();
        dbConnected = true;
        console.log(`[DEV-TOOLBOX] Loaded ${quotes.size} quotes from MongoDB`);
    } catch (error) {
        console.log('[DEV-TOOLBOX] Using in-memory storage only');
        dbConnected = false;
    }
}

// Save quote (to both cache and database)
async function saveQuote(quote) {
    quotes.set(quote.id, quote);
    if (dbConnected) {
        await db.saveQuote(quote);
    }
}

// Initialize on module load
initializeQuotes().catch(console.error);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dev-toolbox')
        .setDescription('Commission quote management system'),

    async execute(interaction) {
        await showMainMenu(interaction);
    },

    handleInteraction: async function(interaction) {
        if (!interaction.isButton() && !interaction.isModalSubmit() && !interaction.isStringSelectMenu()) return;

        const customId = interaction.customId;
        console.log('[DEV-TOOLBOX] handleInteraction called with customId:', customId);

        // Main menu select
        if (customId === 'main_menu_select') {
            console.log('[DEV-TOOLBOX] Main menu select triggered');
            const selected = interaction.values[0];
            if (selected === 'quote_send') {
                await showSendQuoteModal(interaction);
            } else if (selected === 'quote_active') {
                await showActiveQuotes(interaction);
            }
        }
        else if (customId === 'send_quote_modal') {
            console.log('[DEV-TOOLBOX] Send quote modal submitted');
            await handleSendQuoteModal(interaction);
        }
        else if (customId === 'select_active_quote') {
            console.log('[DEV-TOOLBOX] Active quote selected');
            const quoteId = interaction.values[0];
            await showQuoteDetails(interaction, quoteId);
        }
        else if (customId.startsWith('quote_accept_')) {
            console.log('[DEV-TOOLBOX] Accept quote button clicked');
            const quoteId = customId.replace('quote_accept_', '');
            console.log('[DEV-TOOLBOX] Extracted quoteId:', quoteId);
            console.log('[DEV-TOOLBOX] All quotes in storage:', Array.from(quotes.keys()));
            console.log('[DEV-TOOLBOX] Quote exists?', quotes.has(quoteId));
            await handleAcceptQuote(interaction, quoteId);
        }
        else if (customId.startsWith('quote_reject_')) {
            console.log('[DEV-TOOLBOX] Reject quote button clicked');
            const quoteId = customId.replace('quote_reject_', '');
            console.log('[DEV-TOOLBOX] Extracted quoteId:', quoteId);
            await handleRejectQuote(interaction, quoteId);
        }
        // Claim quote
        else if (customId.startsWith('quote_claim_')) {
            const quoteId = customId.replace('quote_claim_', '');
            await handleClaimQuote(interaction, quoteId);
        }
        // Send payment info
        else if (customId.startsWith('quote_payment_')) {
            const quoteId = customId.replace('quote_payment_', '');
            await sendPaymentInfo(interaction, quoteId);
        }
        // Payment methods
        else if (customId.startsWith('pay_revolut_')) {
            const quoteId = customId.replace('pay_revolut_', '');
            await handleRevolutPayment(interaction, quoteId);
        }
        else if (customId.startsWith('pay_paypal_')) {
            const quoteId = customId.replace('pay_paypal_', '');
            await handlePayPalPayment(interaction, quoteId);
        }
        else if (customId.startsWith('pay_robux_')) {
            const quoteId = customId.replace('pay_robux_', '');
            await handleRobuxPayment(interaction, quoteId);
        }
        // Payment paid confirmation
        else if (customId.startsWith('payment_paid_')) {
            const quoteId = customId.replace('payment_paid_', '');
            await handlePaymentPaid(interaction, quoteId);
        }
        // Mark complete
        else if (customId.startsWith('quote_complete_')) {
            const quoteId = customId.replace('quote_complete_', '');
            await markAsComplete(interaction, quoteId);
        }
        // Send invoice (admin only)
        else if (customId.startsWith('send_invoice_')) {
            const quoteId = customId.replace('send_invoice_', '');
            await showInvoiceModal(interaction, quoteId);
        }
        else if (customId.startsWith('invoice_modal_')) {
            await handleInvoiceSubmit(interaction);
        }
        // Back to menu
        else if (customId === 'back_to_menu') {
            await interaction.deferUpdate();
            await showMainMenu(interaction);
        }
        // Back to quotes
        else if (customId === 'back_to_quotes') {
            await interaction.deferUpdate();
            await showActiveQuotes(interaction);
        }
    }
};

async function showMainMenu(interaction) {
    const menuEmbed = new EmbedBuilder()
        .setTitle('🛠️ Dev Toolbox - Quote Management')
        .setDescription('Select an option below to manage commission quotes.')
        .setColor(0x5865F2)
        .setTimestamp();

    const menuRow = new ActionRowBuilder()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('main_menu_select')
                .setPlaceholder('Choose an action...')
                .addOptions(
                    {
                        label: 'Send Quote',
                        description: 'Create and send a new commission quote',
                        value: 'quote_send',
                        emoji: '📋'
                    },
                    {
                        label: 'View Quotes',
                        description: 'View all quotes',
                        value: 'quote_active',
                        emoji: '📊'
                    }
                )
        );

    // Check if it's initial reply or update
    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [menuEmbed], components: [menuRow], ephemeral: true });
    } else {
        await interaction.reply({ embeds: [menuEmbed], components: [menuRow], ephemeral: true });
    }
}

async function showSendQuoteModal(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('send_quote_modal')
        .setTitle('Send Commission Quote');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('quote_user_id')
                .setLabel('User ID')
                .setPlaceholder('Enter Discord User ID...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('quote_price')
                .setLabel('Price')
                .setPlaceholder('Please specify if this is in EUR or Robux (e.g., 150 EUR)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('quote_timeframe')
                .setLabel('Timeframe (days)')
                .setPlaceholder('e.g., 7')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('quote_comment')
                .setLabel('Details')
                .setPlaceholder('Enter commission details...')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
        )
    );

    await interaction.showModal(modal);
}

async function handleSendQuoteModal(interaction) {
    try {
        await interaction.deferReply();

        const userId = interaction.fields.getTextInputValue('quote_user_id');
        const price = interaction.fields.getTextInputValue('quote_price');
        const timeframe = interaction.fields.getTextInputValue('quote_timeframe');
        const comment = interaction.fields.getTextInputValue('quote_comment');

        const user = await interaction.client.users.fetch(userId).catch(() => null);
        if (!user) {
            return await interaction.editReply({ content: '❌ Invalid User ID.' });
        }

        const quoteId = `quote_${Date.now()}`;
        const quoteNumber = quoteCounter++;
        
        const quoteData = {
            id: quoteId,
            quoteNumber: quoteNumber,
            userId: userId,
            username: user.username,
            price: parseFloat(price),
            timeframe: parseInt(timeframe),
            details: comment,
            status: 'pending',
            sentBy: interaction.user.id,
            sentAt: new Date().toISOString()
        };
        
        quotes.set(quoteId, quoteData);
        await saveQuote(quoteData); // Persist to database

        const quoteEmbed = new EmbedBuilder()
            .setTitle(`📋 Commission Quote #${quoteNumber}`)
            .setDescription(`<@${userId}>, here is your quote!`)
            .addFields(
                { name: '💰 Price', value: price, inline: true },
                { name: '⏱️ Timeframe', value: `${timeframe} days`, inline: true },
                { name: '📝 Details', value: comment }
            )
            .setColor(0xFFAA00)
            .setTimestamp();

        const quoteButtons = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`quote_accept_${quoteId}`)
                    .setLabel('Accept')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`quote_reject_${quoteId}`)
                    .setLabel('Reject')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.editReply({ content: `<@${userId}>`, embeds: [quoteEmbed], components: [quoteButtons] });

        // Send log to quote logs channel
        const QUOTE_LOGS_CHANNEL_ID = '1444033226287874240';
        const logsChannel = await interaction.client.channels.fetch(QUOTE_LOGS_CHANNEL_ID).catch(() => null);
        if (logsChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle(`📋 New Quote Sent - #${quoteNumber}`)
                .addFields(
                    { name: '👤 Customer', value: `<@${userId}> (${user.username})`, inline: true },
                    { name: '💰 Price', value: price, inline: true },
                    { name: '⏱️ Timeframe', value: `${timeframe} days`, inline: true },
                    { name: '📤 Sent By', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '🆔 Quote ID', value: quoteId, inline: true },
                    { name: '📝 Details', value: comment, inline: false }
                )
                .setColor(0xFFAA00)
                .setTimestamp();
            await logsChannel.send({ embeds: [logEmbed] });
        }

    } catch (error) {
        console.error('Error sending quote:', error);
        await interaction.editReply({ content: '❌ Failed to send quote.' });
    }
}

async function showActiveQuotes(interaction) {
    try {
        await interaction.deferUpdate();

        const allQuotes = Array.from(quotes.values());

        if (allQuotes.length === 0) {
            const noQuotesEmbed = new EmbedBuilder()
                .setTitle('📋 No Quotes')
                .setDescription('No quotes yet. Create one!')
                .setColor(0xFF0000);
            return await interaction.editReply({ embeds: [noQuotesEmbed], components: [] });
        }

        const options = allQuotes.map(quote => ({
            label: `#${quote.quoteNumber} - ${quote.username}`,
            description: `${quote.status} | €${quote.price}`,
            value: quote.id
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_active_quote')
            .setPlaceholder('Select a quote')
            .addOptions(options.slice(0, 25));

        const row1 = new ActionRowBuilder().addComponents(selectMenu);
        
        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_menu')
                    .setLabel('Back to Menu')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('◀️')
            );

        const embed = new EmbedBuilder()
            .setTitle('📊 All Quotes')
            .setDescription(`**${allQuotes.length}** total quotes`)
            .setColor(0x5865F2);

        await interaction.editReply({ embeds: [embed], components: [row1, row2] });

    } catch (error) {
        console.error('Error:', error);
        await interaction.editReply({ content: '❌ Error loading quotes' });
    }
}

async function showQuoteDetails(interaction, quoteId) {
    try {
        await interaction.deferUpdate();

        const quote = quotes.get(quoteId);
        if (!quote) {
            return await interaction.editReply({ content: '❌ Quote not found' });
        }

        const embed = new EmbedBuilder()
            .setTitle(`📋 Quote #${quote.quoteNumber}`)
            .addFields(
                { name: '👤 Customer', value: `<@${quote.userId}>`, inline: true },
                { name: '💰 Price', value: `€${quote.price}`, inline: true },
                { name: '⏱️ Timeframe', value: `${quote.timeframe} days`, inline: true },
                { name: '📊 Status', value: quote.status, inline: true },
                { name: '📝 Details', value: quote.details }
            )
            .setColor(0x5865F2);

        // Add claimed by if claimed
        if (quote.claimedBy) {
            embed.addFields({ name: '👨‍💻 Claimed By', value: `<@${quote.claimedBy}>`, inline: true });
        }
        if (quote.paymentMethod) {
            embed.addFields({ name: '💳 Payment Method', value: quote.paymentMethod, inline: true });
        }

        const row1 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`quote_claim_${quoteId}`)
                    .setLabel('Claim Quote')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🔖')
                    .setDisabled(!!quote.claimedBy),
                new ButtonBuilder()
                    .setCustomId(`quote_payment_${quoteId}`)
                    .setLabel('Send Payment Info')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💳'),
                new ButtonBuilder()
                    .setCustomId(`quote_complete_${quoteId}`)
                    .setLabel('Mark Complete')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
                    .setDisabled(quote.status === 'completed')
            );

        const row2 = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_quotes')
                    .setLabel('Back to Quotes')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('◀️')
            );

        await interaction.editReply({ embeds: [embed], components: [row1, row2] });

    } catch (error) {
        console.error('Error:', error);
    }
}

async function handleAcceptQuote(interaction, quoteId) {
    console.log('[DEV-TOOLBOX] handleAcceptQuote called with quoteId:', quoteId);
    await interaction.deferUpdate();
    const quote = quotes.get(quoteId);
    console.log('[DEV-TOOLBOX] Quote retrieved:', quote ? 'FOUND' : 'NOT FOUND');
    if (!quote) {
        return await interaction.editReply({ content: '❌ Quote not found', components: [] });
    }
    
    quote.status = 'accepted';
    quote.acceptedBy = interaction.user.id;
    quote.acceptedAt = new Date().toISOString();
    saveQuotes(); // Persist to disk
    
    const embed = new EmbedBuilder()
        .setTitle(`📋 Commission Quote #${quote.quoteNumber}`)
        .setDescription(`<@${quote.userId}>, your quote has been accepted!`)
        .addFields(
            { name: '💰 Price', value: quote.price.toString(), inline: true },
            { name: '⏱️ Timeframe', value: `${quote.timeframe} days`, inline: true },
            { name: '📊 Status', value: '✅ Accepted', inline: true },
            { name: '📝 Details', value: quote.details }
        )
        .setColor(0x00FF00)
        .setTimestamp();
    
    await interaction.editReply({ embeds: [embed], components: [] });
}

async function handleRejectQuote(interaction, quoteId) {
    await interaction.deferUpdate();
    const quote = quotes.get(quoteId);
    if (!quote) {
        return await interaction.editReply({ content: '❌ Quote not found', components: [] });
    }
    
    quote.status = 'rejected';
    quote.rejectedBy = interaction.user.id;
    quote.rejectedAt = new Date().toISOString();
    saveQuotes(); // Persist to disk
    
    const embed = new EmbedBuilder()
        .setTitle(`📋 Commission Quote #${quote.quoteNumber}`)
        .setDescription(`<@${quote.userId}>, your quote has been rejected.`)
        .addFields(
            { name: '💰 Price', value: quote.price.toString(), inline: true },
            { name: '⏱️ Timeframe', value: `${quote.timeframe} days`, inline: true },
            { name: '📊 Status', value: '❌ Rejected', inline: true },
            { name: '📝 Details', value: quote.details }
        )
        .setColor(0xFF0000)
        .setTimestamp();
    
    await interaction.editReply({ embeds: [embed], components: [] });
}

async function handleClaimQuote(interaction, quoteId) {
    await interaction.deferUpdate();
    const quote = quotes.get(quoteId);
    if (!quote) {
        return await interaction.editReply({ content: '❌ Quote not found', components: [] });
    }
    
    quote.claimedBy = interaction.user.id;
    quote.claimedAt = new Date().toISOString();
    saveQuotes(); // Persist to disk
    
    const embed = new EmbedBuilder()
        .setTitle(`📋 Quote #${quote.quoteNumber}`)
        .setDescription(`✅ Quote claimed by <@${interaction.user.id}>!`)
        .addFields(
            { name: '👤 Customer', value: `<@${quote.userId}>`, inline: true },
            { name: '💰 Price', value: `€${quote.price}`, inline: true },
            { name: '⏱️ Timeframe', value: `${quote.timeframe} days`, inline: true },
            { name: '📊 Status', value: quote.status, inline: true },
            { name: '👨‍💻 Claimed By', value: `<@${quote.claimedBy}>`, inline: true },
            { name: '📝 Details', value: quote.details }
        )
        .setColor(0x5865F2);

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`quote_payment_${quoteId}`)
                .setLabel('Send Payment Info')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('💳'),
            new ButtonBuilder()
                .setCustomId(`quote_complete_${quoteId}`)
                .setLabel('Mark Complete')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function sendPaymentInfo(interaction, quoteId) {
    await interaction.deferReply();
    
    const quote = quotes.get(quoteId);
    if (!quote) return;

    const embed = new EmbedBuilder()
        .setTitle('💳 Payment Information')
        .setDescription(`<@${quote.userId}>, here are the payment options for **Quote #${quote.quoteNumber}**`)
        .addFields(
            { name: '👨‍💻 Developer', value: quote.claimedBy ? `<@${quote.claimedBy}>` : 'Not claimed', inline: true },
            { name: '💰 Amount', value: `€${quote.price}`, inline: true },
            { name: '⏱️ Timeframe', value: `${quote.timeframe} days`, inline: true }
        )
        .setColor(0x00D9FF)
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`pay_revolut_${quoteId}`)
                .setLabel('Revolut')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔵'),
            new ButtonBuilder()
                .setCustomId(`pay_paypal_${quoteId}`)
                .setLabel('PayPal')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('💙'),
            new ButtonBuilder()
                .setCustomId(`pay_robux_${quoteId}`)
                .setLabel('Robux')
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎮')
        );

    await interaction.channel.send({ content: `<@${quote.userId}>`, embeds: [embed], components: [row] });
    await interaction.deleteReply();
}

async function handleRevolutPayment(interaction, quoteId) {
    await interaction.deferUpdate();
    
    const quote = quotes.get(quoteId);
    if (quote) {
        quote.paymentMethod = 'Revolut';
        saveQuotes(); // Persist to disk
    }

    const embed = new EmbedBuilder()
        .setTitle('🔵 Revolut Payment')
        .setDescription(`**Quote #${quote.quoteNumber}** - €${quote.price}\n\nClick the button below to open Revolut and send the payment.\nOnce paid, click "I Have Paid".`)
        .addFields(
            { name: '👨‍💻 Developer', value: quote.claimedBy ? `<@${quote.claimedBy}>` : 'Not claimed', inline: true },
            { name: '💰 Amount', value: `€${quote.price}`, inline: true }
        )
        .setColor(0x0075EB)
        .setTimestamp();

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setLabel('Open Revolut')
                .setStyle(ButtonStyle.Link)
                .setURL('https://revolut.me/corykil78')
                .setEmoji('🔵')
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`payment_paid_${quoteId}`)
                .setLabel('I Have Paid')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

    await interaction.editReply({ embeds: [embed], components: [row1, row2] });
}

async function handlePayPalPayment(interaction, quoteId) {
    await interaction.deferUpdate();
    
    const quote = quotes.get(quoteId);
    if (quote) {
        quote.paymentMethod = 'PayPal';
        saveQuotes(); // Persist to disk
    }

    const embed = new EmbedBuilder()
        .setTitle('💙 PayPal Payment')
        .setDescription(`**Quote #${quote.quoteNumber}** - €${quote.price}\n\nClick the button below to open PayPal and send the payment.\nOnce paid, click "I Have Paid".`)
        .addFields(
            { name: '👨‍💻 Developer', value: quote.claimedBy ? `<@${quote.claimedBy}>` : 'Not claimed', inline: true },
            { name: '💰 Amount', value: `€${quote.price}`, inline: true }
        )
        .setColor(0x00457C)
        .setTimestamp();

    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setLabel('Open PayPal')
                .setStyle(ButtonStyle.Link)
                .setURL('https://paypal.me/cirkledev')
                .setEmoji('💙')
        );

    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`payment_paid_${quoteId}`)
                .setLabel('I Have Paid')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

    await interaction.editReply({ embeds: [embed], components: [row1, row2] });
}

async function handleRobuxPayment(interaction, quoteId) {
    await interaction.deferUpdate();
    
    const quote = quotes.get(quoteId);
    if (quote) {
        quote.paymentMethod = 'Robux';
        saveQuotes(); // Persist to disk
    }

    const robuxAmount = Math.ceil(quote.price * 350); // 1 EUR = ~350 Robux

    const embed = new EmbedBuilder()
        .setTitle('🎮 Robux Payment')
        .setDescription(`**Quote #${quote.quoteNumber}** - €${quote.price} (≈ R$${robuxAmount})\n\nContact the developer below to arrange Robux payment.\n\nOnce paid, click the button below.`)
        .addFields(
            { name: '👨‍💻 Developer', value: quote.claimedBy ? `<@${quote.claimedBy}>` : 'Not claimed', inline: true },
            { name: '💰 Amount', value: `€${quote.price} (≈ R$${robuxAmount})`, inline: true }
        )
        .setColor(0xFF0000)
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`payment_paid_${quoteId}`)
                .setLabel('I Have Paid')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅')
        );

    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handlePaymentPaid(interaction, quoteId) {
    await interaction.deferUpdate();
    
    const quote = quotes.get(quoteId);
    if (!quote) {
        return await interaction.editReply({ content: '❌ Quote not found', components: [] });
    }
    
    quote.paid = true;
    quote.paidAt = new Date().toISOString();
    quote.paidBy = interaction.user.id;
    quote.status = 'processing';
    saveQuotes(); // Persist to disk

    const embed = new EmbedBuilder()
        .setTitle('✅ Payment Received')
        .setDescription(`Payment confirmed for Quote #${quote.quoteNumber}!\n\n**Payment Method:** ${quote.paymentMethod}\n**Paid By:** <@${quote.paidBy}>\n\nThe developer will now begin work on your commission.`)
        .addFields(
            { name: '👤 Customer', value: `<@${quote.userId}>`, inline: true },
            { name: '💰 Amount', value: `€${quote.price}`, inline: true },
            { name: '📊 Status', value: '🔄 Processing', inline: true }
        )
        .setColor(0x00FF00)
        .setTimestamp();

    // Add invoice button for admins
    const ADMIN_ROLE_ID = '1315041666851274822';
    const components = [];
    
    if (interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
        const adminRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`send_invoice_${quoteId}`)
                    .setLabel('Send Invoice')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('📄')
            );
        components.push(adminRow);
    }

    await interaction.editReply({ embeds: [embed], components });
}

async function markAsComplete(interaction, quoteId) {
    await interaction.deferUpdate();
    
    const quote = quotes.get(quoteId);
    if (!quote) {
        return await interaction.editReply({ content: '❌ Quote not found', components: [] });
    }
    
    quote.status = 'completed';
    quote.completedAt = new Date().toISOString();
    quote.completedBy = interaction.user.id;
    saveQuotes(); // Persist to disk

    const embed = new EmbedBuilder()
        .setTitle('✅ Quote Completed')
        .setDescription(`Quote #${quote.quoteNumber} has been marked as complete and closed!\n\nThank you for choosing Cirkle Development! 🎉`)
        .addFields(
            { name: '👤 Customer', value: `<@${quote.userId}>`, inline: true },
            { name: '💰 Price', value: quote.price.toString(), inline: true },
            { name: '✅ Completed By', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setColor(0x00FF00)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed], components: [] });
}

async function showInvoiceModal(interaction, quoteId) {
    const quote = quotes.get(quoteId);
    if (!quote) {
        return await interaction.reply({ content: '❌ Quote not found', ephemeral: true });
    }

    // Check if user has admin role
    const ADMIN_ROLE_ID = '1315041666851274822';
    if (!interaction.member.roles.cache.has(ADMIN_ROLE_ID)) {
        return await interaction.reply({ content: '❌ Only administrators can send invoices.', ephemeral: true });
    }

    const modal = new ModalBuilder()
        .setCustomId(`invoice_modal_${quoteId}`)
        .setTitle('Send Invoice');

    modal.addComponents(
        new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('invoice_link')
                .setLabel('Google Drive Invoice Link')
                .setPlaceholder('https://drive.google.com/file/d/...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
        )
    );

    await interaction.showModal(modal);
}

async function handleInvoiceSubmit(interaction) {
    try {
        const quoteId = interaction.customId.replace('invoice_modal_', '');
        console.log('[DEV-TOOLBOX] Invoice submit - extracted quoteId:', quoteId);
        const quote = quotes.get(quoteId);
        
        if (!quote) {
            console.log('[DEV-TOOLBOX] Quote not found. All quotes:', Array.from(quotes.keys()));
            return await interaction.reply({ content: '❌ Quote not found', ephemeral: true });
        }

        await interaction.deferReply();

        const invoiceLink = interaction.fields.getTextInputValue('invoice_link');
        
        // Store invoice link
        quote.invoiceLink = invoiceLink;
        quote.invoiceSentBy = interaction.user.id;
        quote.invoiceSentAt = new Date().toISOString();
        saveQuotes(); // Persist to disk

        // Send DM to customer
        const customer = await interaction.client.users.fetch(quote.userId).catch(() => null);
        if (customer) {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle('📄 Invoice Received')
                    .setDescription(`Your invoice for **Quote #${quote.quoteNumber}** is ready!\n\n**Invoice Link:**\n${invoiceLink}\n\nPlease review the invoice. Once you've had a chance to look it over, your developer will send you the final product.\n\n✨ **Thank you for choosing Cirkle Development!** ✨\n\nWe'd love to hear your feedback! Please consider leaving a review in our <#1444033226287874240> channel.`)
                    .addFields(
                        { name: '💰 Amount', value: `€${quote.price}`, inline: true },
                        { name: '⏱️ Timeframe', value: `${quote.timeframe} days`, inline: true }
                    )
                    .setColor(0x5865F2)
                    .setTimestamp();

                await customer.send({ embeds: [dmEmbed] });
                
                // Confirmation message in channel
                const confirmEmbed = new EmbedBuilder()
                    .setTitle('✅ Invoice Successfully Sent')
                    .setDescription(`Invoice has been sent to the DMs of <@${quote.userId}>!\n\n**Quote #${quote.quoteNumber}** - €${quote.price}\n\n✨ **Thank you for choosing Cirkle Development!** ✨\n\nWe'd love to hear your feedback! Please consider leaving a review in our reviews channel.`)
                    .addFields(
                        { name: '👤 Customer', value: `<@${quote.userId}>`, inline: true },
                        { name: '💰 Amount', value: `€${quote.price}`, inline: true },
                        { name: '📄 Invoice Link', value: `[View Invoice](${invoiceLink})`, inline: false }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({ embeds: [confirmEmbed] });
                
            } catch (error) {
                console.error('Failed to send DM:', error);
                await interaction.editReply({ content: `❌ Failed to send invoice DM to <@${quote.userId}>. They may have DMs disabled.`, ephemeral: true });
            }
        } else {
            await interaction.editReply({ content: '❌ Failed to fetch customer.', ephemeral: true });
        }

    } catch (error) {
        console.error('Error handling invoice:', error);
        await interaction.editReply({ content: '❌ Failed to send invoice.', ephemeral: true });
    }
}

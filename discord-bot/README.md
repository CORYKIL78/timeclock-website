# Dev Toolbox - Commission Quote Payment System

## 📋 Overview

This is an **addon/extension** for your existing Discord bot that adds comprehensive commission quote management and payment processing features.

## ✨ Features

- **Quote Management**: View and manage all active commission quotes
- **Claim System**: Claim quotes with confirmation and channel notifications
- **Payment Processing**: Interactive payment system with multiple methods
  - Revolut payment flow
  - PayPal payment flow
  - Robux payment flow
- **Admin Controls**: Role-restricted invoice sending system
- **Real-time Updates**: Dynamic embeds that update based on user actions

## 🔧 Integration Methods

### Method 1: Add to Existing Discord Bot (Recommended)

If you have an existing Discord.js bot, integrate this as a new command:

1. **Copy the command file** to your bot's commands folder:
   ```bash
   cp discord-bot/dev-toolbox-command.js /path/to/your/bot/commands/
   ```

2. **Update your bot's command handler** to load this command:
   ```javascript
   // In your bot's main file or command loader
   const devToolboxCommand = require('./commands/dev-toolbox-command.js');
   client.commands.set(devToolboxCommand.data.name, devToolboxCommand);
   ```

3. **Add interaction handling** for buttons and modals:
   ```javascript
   client.on('interactionCreate', async interaction => {
       if (interaction.isButton() || interaction.isModalSubmit()) {
           await devToolboxCommand.handleInteraction(interaction);
       }
   });
   ```

4. **Register the slash command** with Discord:
   ```bash
   # Add to your deployment script
   node deploy-commands.js
   ```

### Method 2: Standalone Bot

If you want to run this as a separate bot:

1. **Install dependencies**:
   ```bash
   cd discord-bot
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your bot token
   ```

3. **Deploy commands**:
   ```bash
   npm run deploy
   ```

4. **Start the bot**:
   ```bash
   npm start
   ```

## 📊 Backend Setup

### Google Sheets Structure

Create a new sheet called **`CommissionQuotes`** with these columns:

| Column | Header | Description |
|--------|--------|-------------|
| A | Quote ID | Unique identifier (auto-generated) |
| B | User ID | Discord user ID of customer |
| C | Username | Discord username |
| D | Price | Price in euros (€) |
| E | Details | Commission details/description |
| F | Status | Current status (pending, claimed, paid, etc.) |
| G | Claimed By | Discord ID of developer who claimed it |
| H | Created At | Timestamp when quote was created |
| I | Payment Method | Selected payment method (Revolut/PayPal/Robux) |
| J | Paid At | Timestamp when payment was marked as paid |
| K | Invoice Sent At | Timestamp when invoice was sent |

### Backend API Endpoints

Add these endpoints to your Cloudflare Worker (`timeclock-backend.marcusray.workers.dev`):

```javascript
// In your worker's fetch handler
if (url.pathname.startsWith('/api/quotes')) {
    return await handleQuoteRequest(request, env, url.pathname);
}
```

Then copy the functions from `backend-quotes-api.js` to your worker.

## 🎯 Command Usage

### `/dev-toolbox quotes`
Lists all active commission quotes with their current status.

### `/dev-toolbox view-quote [quote-id]`
Shows detailed view of a specific quote with action buttons:
- **🎯 Claim Quote** - Claim the quote (shows confirmation)
- **❌ Reject** - Reject the quote
- **⚙️ Process** - Mark as in progress
- **✅ Complete** - Mark as completed
- **💳 Send Payment Info** - Send payment instructions to customer

## 💳 Payment Flow

1. **Developer sends payment info** → Customer receives embed with FAQ and payment options
2. **Customer selects payment method** → Embed updates with specific instructions
   - **Revolut**: Shows revolut.me/corykil78 link
   - **PayPal**: Shows paypal.me/cirkledev link
   - **Robux**: Instructions to contact director board
3. **Customer clicks "Paid"** → Thank you message with reminder to ping Marcus Ray
4. **Admin clicks "Send Invoice"** → Modal appears for invoice link
5. **Admin submits invoice** → DM sent to customer + channel notification

## 🔐 Permissions

- **Claim Quote**: Anyone can claim unclaimed quotes
- **Send Payment Info**: Anyone with access to the command
- **Send Invoice**: Requires role `1315041666851274822` (admin/director)

## 📝 Creating Quotes

Quotes can be created through:

1. **API Endpoint**:
   ```javascript
   POST /api/quotes/create
   {
       "userId": "123456789",
       "username": "Customer#1234",
       "price": 50.00,
       "details": "Website development"
   }
   ```

2. **Manual Entry** in Google Sheets

3. **Future**: Add a `/quote create` subcommand to the bot

## 🎨 Customization

### Change Payment Links
Edit these constants in [dev-toolbox-command.js](dev-toolbox-command.js):
```javascript
const REVOLUT_LINK = 'revolut.me/corykil78';
const PAYPAL_LINK = 'paypal.me/cirkledev';
```

### Change Admin Role
Edit this constant:
```javascript
const ADMIN_ROLE_ID = '1315041666851274822';
```

### Change Colors
Modify the embed colors:
```javascript
.setColor(0x5865F2) // Discord Blurple
.setColor(0x0066FF) // Revolut Blue
.setColor(0x0070BA) // PayPal Blue
.setColor(0xFF0000) // Robux Red
.setColor(0x00FF00) // Success Green
```

## 📱 Example Workflow

1. Customer requests a commission
2. Quote is created in the system
3. Developer runs `/dev-toolbox quotes` to see available quotes
4. Developer runs `/dev-toolbox view-quote QUOTE-123` to view details
5. Developer clicks **Claim Quote** → confirms → channel is notified
6. Developer works on commission...
7. Developer clicks **Send Payment Info**
8. Customer sees payment options and selects **PayPal**
9. Customer pays and clicks **Paid**
10. Admin clicks **Send Invoice** and provides invoice link
11. Customer receives DM with invoice
12. Developer sends final product

## 🔧 Troubleshooting

### Command not appearing
- Run `npm run deploy` to register commands
- Check bot has `applications.commands` scope
- Check bot is in the correct guild

### Backend errors
- Verify SPREADSHEET_ID is set in Cloudflare Worker
- Check Google Sheets API is enabled
- Verify sheet name is exactly `CommissionQuotes`

### Permission errors
- Verify admin role ID matches your server
- Check bot has required permissions in channel

## 📚 File Structure

```
discord-bot/
├── bot.js                      # Main bot file (standalone)
├── deploy-commands.js          # Command registration script
├── dev-toolbox-command.js      # Main command (THIS IS THE ADDON)
├── backend-quotes-api.js       # Backend API functions
├── package.json                # Dependencies
├── .env.example                # Environment template
└── README.md                   # This file
```

## 🚀 Quick Start (Addon to Existing Bot)

```bash
# 1. Copy the command file to your bot
cp discord-bot/dev-toolbox-command.js /your/bot/commands/

# 2. Add to your bot's command loader
# (see Method 1 above)

# 3. Add interaction handler
# (see Method 1 above)

# 4. Deploy the command
node your-deploy-script.js

# 5. Create CommissionQuotes sheet in Google Sheets

# 6. Add backend endpoints to your Cloudflare Worker

# Done! Test with /dev-toolbox quotes
```

## 📞 Support

If you need help integrating this system:
1. Check the troubleshooting section
2. Review the example workflow
3. Verify all backend endpoints are working
4. Check console logs for errors

---

**Created for:** Cirkle Development  
**Version:** 1.0.0  
**Date:** December 28, 2025

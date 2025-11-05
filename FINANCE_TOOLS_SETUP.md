# Finance Tools - Setup Guide

## Overview
The Finance Tools page allows you to track product sales and automatically calculate Robux revenue with the 30% marketplace tax deduction.

**Access the page at:** `https://portal.cirkledevelopment.co.uk/financetools.html`

---

## Features

✅ **Product Management**
- Add, edit, and delete products
- Track price in Robux
- Enter quantities sold manually

✅ **Automatic Calculations**
- Gross revenue (Price × Quantity)
- Net revenue after 30% Roblox marketplace tax
- Total sales across all products
- Real-time stats updates

✅ **Payhip Integration**
- Sync products automatically from your Payhip store
- Webhook support for automatic updates when products are created/updated
- Preserves manually entered quantities when syncing

---

## Payhip Integration Setup

### Step 1: Get Your Payhip API Key

1. Log in to your Payhip account
2. Go to **Settings** → **API**
3. Generate or copy your API key
4. Keep it secure - you'll need it for the next step

### Step 2: Add API Key to Cloudflare Worker

1. Go to your Cloudflare dashboard: https://dash.cloudflare.com
2. Navigate to **Workers & Pages**
3. Click on your worker (`timeclock-backend`)
4. Go to **Settings** → **Variables**
5. Under **Environment Variables**, click **Add variable**
6. Add:
   - **Variable name:** `PAYHIP_API_KEY`
   - **Value:** Your Payhip API key
   - Check "Encrypt" to keep it secure
7. Click **Save**

### Step 3: Set Up Payhip Webhooks (Optional but Recommended)

Webhooks allow automatic syncing when you create or update products in Payhip.

1. In Payhip, go to **Settings** → **Webhooks**
2. Add a new webhook endpoint:
   ```
   https://timeclock-backend.marcusray.workers.dev/api/finance/payhip-webhook
   ```
3. Select these events:
   - ✅ Product Created
   - ✅ Product Updated
   - ✅ Sale (optional - for future features)
4. Save the webhook

---

## How to Use

### Manual Product Entry

1. Visit `financetools.html`
2. Click **➕ Add Product**
3. Fill in:
   - Product Name (required)
   - Price in Robux (required)
   - Payhip Product ID (optional - for syncing)
   - Description (optional)
4. Click **Save Product**
5. Enter quantities sold in the table

### Sync from Payhip

1. Make sure you've set up your API key (see Step 2 above)
2. Click **🔄 Sync Products** button
3. Products from Payhip will be imported automatically
4. Price is auto-converted (USD × 80 = approximate Robux)
5. You can adjust prices after syncing if needed

### Tracking Sales

1. For each product, enter the **Quantity Sold** in the table
2. The system automatically calculates:
   - **Gross Revenue** = Price × Quantity
   - **Net Revenue** = Gross Revenue × 70% (after 30% tax)
3. Stats update in real-time at the top of the page

---

## Data Storage

- Products are stored in Google Sheets: `cirklehrFinanceProducts`
- Changes sync automatically to the backend
- Local fallback if backend is unavailable
- Quantities are preserved when syncing from Payhip

---

## Revenue Calculation Formula

```
Gross Revenue = Price × Quantity Sold
Marketplace Tax = Gross Revenue × 30%
Net Revenue = Gross Revenue - Marketplace Tax
            = Gross Revenue × 70%
```

**Example:**
- Product Price: 100 Robux
- Quantity Sold: 50 units
- Gross Revenue: 5,000 Robux
- Marketplace Tax: 1,500 Robux (30%)
- **Net Revenue: 3,500 Robux** ✅

---

## Troubleshooting

### "Sync failed" Error
- Check that your Payhip API key is correctly added to Cloudflare
- Verify the API key has the correct permissions in Payhip
- Check browser console for detailed error messages

### Products Not Showing
- Check that Google Sheets `cirklehrFinanceProducts` sheet exists
- Verify backend is deployed and accessible
- Try refreshing the page

### Webhook Not Working
- Verify webhook URL is correct in Payhip settings
- Check that the URL starts with `https://`
- Test the webhook in Payhip's webhook settings

---

## API Endpoints

- **GET** `/api/finance/products` - Fetch all products
- **POST** `/api/finance/products/save` - Save products
- **POST** `/api/finance/sync-payhip` - Sync from Payhip API
- **POST** `/api/finance/payhip-webhook` - Receive Payhip webhooks

---

## Support

If you need help:
1. Check the browser console for errors (F12)
2. Verify all setup steps are completed
3. Make sure backend is deployed and running
4. Contact your developer for advanced troubleshooting

---

**Created:** November 5, 2025  
**Version:** 1.0.0

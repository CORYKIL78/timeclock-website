/**
 * Google Apps Script for Payslips & Disciplinaries Notifications
 * 
 * INSTALLATION INSTRUCTIONS:
 * 1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1U05VEI29EWMFfjcQoQ-vGOjQZvfRQWMB7rDexMPEFZs/edit
 * 2. Go to Extensions > Apps Script
 * 3. Replace all code with this script
 * 4. Save (Ctrl+S)
 * 5. Click "Run" > "onEdit" to authorize (you'll need to grant permissions)
 * 6. Now the script will automatically trigger when column F is changed to "Submit"
 * 
 * HOW IT WORKS:
 * - When column F (Status) is changed to "Submit" in cirklehrPayslips or cirklehrStrikes sheet
 * - The script extracts the Discord ID (column A)
 * - Calls the backend notification endpoint to send a Discord DM
 * - Shows "✅ Success" in the status column if notification was sent
 * - Shows "❌ Failed" if there was an error
 */

const BACKEND_URL = 'https://timeclock-backend.marcusray.workers.dev';
const PAYSLIPS_SHEET_NAME = 'cirklehrPayslips';
const STRIKES_SHEET_NAME = 'cirklehrStrikes';

/**
 * Trigger function that runs automatically when any cell is edited
 */
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const sheetName = sheet.getName();
  const range = e.range;
  const row = range.getRow();
  const column = range.getColumn();
  
  // Only process edits to column F (column 6)
  if (column !== 6) {
    return;
  }
  
  // Only process rows 3 and onwards (skip headers in rows 1-2)
  if (row < 3) {
    return;
  }
  
  // Only process cirklehrPayslips or cirklehrStrikes sheets
  if (sheetName !== PAYSLIPS_SHEET_NAME && sheetName !== STRIKES_SHEET_NAME) {
    return;
  }
  
  const newValue = range.getValue();
  
  // Only trigger when column F is changed to "Submit" (case-insensitive)
  if (typeof newValue === 'string' && newValue.toLowerCase().trim() === 'submit') {
    Logger.log(`[DEBUG] Submit detected in ${sheetName} row ${row}`);
    
    // Get the Discord ID (column A)
    const discordId = sheet.getRange(row, 1).getValue();
    
    if (!discordId) {
      range.setValue('❌ No Discord ID');
      SpreadsheetApp.flush();
      Logger.log(`[ERROR] No Discord ID found in row ${row}`);
      return;
    }
    
    Logger.log(`[DEBUG] Discord ID: ${discordId}`);
    
    // Determine which notification endpoint to call
    const isPayslip = (sheetName === PAYSLIPS_SHEET_NAME);
    const endpoint = isPayslip ? '/api/notifications/payslip' : '/api/notifications/disciplinary';
    const type = isPayslip ? 'Payslip' : 'Disciplinary';
    
    // Prepare notification data
    const payload = {
      discordId: discordId,
      staffId: discordId // Using Discord ID as staff ID
    };
    
    // Add additional data depending on type
    if (isPayslip) {
      payload.payslipData = {
        dateAssigned: sheet.getRange(row, 2).getValue(),
        link: sheet.getRange(row, 3).getValue(),
        comment: sheet.getRange(row, 4).getValue(),
        assignedBy: sheet.getRange(row, 5).getValue()
      };
    } else {
      payload.disciplinaryData = {
        dateAssigned: sheet.getRange(row, 2).getValue(),
        strikeType: sheet.getRange(row, 3).getValue(),
        comment: sheet.getRange(row, 4).getValue(),
        assignedBy: sheet.getRange(row, 5).getValue()
      };
    }
    
    // Call the backend notification endpoint
    try {
      Logger.log(`[DEBUG] Calling ${endpoint} with payload:`, JSON.stringify(payload));
      
      const response = UrlFetchApp.fetch(BACKEND_URL + endpoint, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      Logger.log(`[DEBUG] Response code: ${responseCode}`);
      Logger.log(`[DEBUG] Response text: ${responseText}`);
      
      if (responseCode === 200) {
        const result = JSON.parse(responseText);
        if (result.success) {
          // Update status to show success
          range.setValue('✅ Success');
          SpreadsheetApp.flush();
          Logger.log(`[SUCCESS] ${type} notification sent for Discord ID ${discordId}`);
        } else {
          range.setValue('❌ Failed: ' + (result.message || 'Unknown error'));
          SpreadsheetApp.flush();
          Logger.log(`[ERROR] Failed to send notification: ${result.message}`);
        }
      } else {
        range.setValue('❌ HTTP ' + responseCode);
        SpreadsheetApp.flush();
        Logger.log(`[ERROR] HTTP ${responseCode}: ${responseText}`);
      }
    } catch (error) {
      range.setValue('❌ Error');
      SpreadsheetApp.flush();
      Logger.log(`[ERROR] Exception: ${error.toString()}`);
    }
  }
}

/**
 * Manual test function - you can run this from the Apps Script editor to test
 */
function testNotification() {
  // Test payslip notification
  const testPayload = {
    discordId: '123456789', // Replace with real Discord ID for testing
    staffId: '123456789',
    payslipData: {
      dateAssigned: '2024-01-15',
      link: 'https://example.com/payslip.pdf',
      comment: 'Test payslip',
      assignedBy: 'Test Manager'
    }
  };
  
  try {
    const response = UrlFetchApp.fetch(BACKEND_URL + '/api/notifications/payslip', {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(testPayload),
      muteHttpExceptions: true
    });
    
    Logger.log('Test response code:', response.getResponseCode());
    Logger.log('Test response text:', response.getContentText());
  } catch (error) {
    Logger.log('Test error:', error.toString());
  }
}

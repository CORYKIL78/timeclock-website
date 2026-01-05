# Profile Loading Fix

## Issue
User profiles weren't loading properly, showing "Not set" for all profile fields.

## Root Causes Identified

### 1. **CORS (Cross-Origin Resource Sharing) Issue** - MOST LIKELY
Your backend API at `https://timeclock-backend.marcusray.workers.dev` is configured to only accept requests from:
```
https://portal.cirkledevelopment.co.uk
```

**If users access the site from any other URL** (localhost, different domain, IP address, etc.), the browser will block the API requests due to CORS policy.

**Solution:**
- Always access the site via: `https://portal.cirkledevelopment.co.uk`
- OR update your backend to allow requests from additional origins

### 2. **User Not in Backend Database**
If a user's Discord ID isn't in your backend database, the API returns a 404 error and the profile shows "Not set".

**Solution:**
- Ensure users are added to your backend database/spreadsheet
- Check the browser console for "404" errors when viewing profile

### 3. **Unsafe Property Access**
The code was trying to access nested properties without checking if they exist:
```javascript
emp.profile.name // Could be undefined if profile is {}
```

**Fixed by:**
- Using optional chaining: `emp.profile?.name`
- Adding fallback logic to use Discord data if backend data isn't available

## Changes Made

### JavaScript (`script.js`)

1. **Enhanced `fetchUserProfile` function:**
   - Added detailed logging including current origin
   - Added CORS error detection
   - Added credentials: 'include' for better CORS handling
   - Better error messages for debugging

2. **Fixed `mainProfilePic` click handler:**
   - Added safe property access using optional chaining
   - Uses `currentUser.profile` as primary source
   - Falls back to `emp.profile` and then Discord data

3. **Improved `setProfileDebug` function:**
   - Now shows/hides error panel dynamically
   - Clears errors when profile loads successfully

4. **Added retry functionality:**
   - Users can manually retry loading their profile
   - Useful if network was temporarily down

5. **Enhanced `syncProfileFromSheets`:**
   - Added logging of current URL and backend URL
   - Helps diagnose CORS issues

### HTML (`index.html`)

1. **Added profile error panel:**
   - Visible alert when profile fails to load
   - Shows specific error message (CORS, 404, network, etc.)
   - Includes retry button

2. **Removed duplicate debug divs:**
   - Consolidated debugging output

## Testing Instructions

### Test 1: Check Current URL
1. Open the site
2. Look at the address bar - are you at `https://portal.cirkledevelopment.co.uk`?
3. If not, that's likely your problem - navigate to the correct URL

### Test 2: Check Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Click on your profile picture
4. Look for errors:
   - **"CORS"** or **"Failed to fetch"** = CORS issue, check your URL
   - **"404"** = User not in backend database
   - **"Network error"** = Backend might be down or firewall blocking

### Test 3: Check Network Tab
1. Open DevTools (F12)
2. Go to Network tab
3. Click on your profile picture
4. Look for the request to `timeclock-backend.marcusray.workers.dev/api/user/profile`
5. Click on it and check:
   - Status code (should be 200, might be 404 or blocked)
   - Response headers (should have `access-control-allow-origin`)

## What Users Will See Now

### Before Fix
- Profile shows "Not set" for everything
- No indication why it's not working
- No way to retry

### After Fix
- If profile fails to load: Red error panel appears with specific reason
- Users can click "Retry" button to try again
- Console has detailed logs for debugging
- Better fallback to Discord data if backend unavailable

## For Administrators

### Backend Requirements
Your backend should:
1. Return CORS headers allowing your domain:
   ```
   Access-Control-Allow-Origin: https://portal.cirkledevelopment.co.uk
   Access-Control-Allow-Credentials: true
   ```

2. Store user profiles with these fields:
   - `name`
   - `email`
   - `department`
   - `staffId`
   - `baseLevel`
   - `discordId` (key to match Discord user)

3. Return 404 with appropriate message when user not found

### Adding Users to Backend
Make sure new Discord users are added to your backend database/spreadsheet before they try to access the portal.

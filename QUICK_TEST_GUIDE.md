# Quick Test Guide - System Improvements

## 🎯 Quick Testing Checklist

### 1. Test Hire/Dismiss Emails (5 minutes)

**Hire Command Test:**
```
1. Open Discord
2. Find Employee Management bot
3. Type: /hire
4. Fill in the form:
   - user: Select a test user
   - department: Development
   - email: your-test-email@example.com
   - fullname: Test Employee
5. Submit command
6. ✅ Check email inbox for welcome message
```

**Expected Result:**
- User receives welcome email from `candidates@staff.cirkledevelopment.co.uk`
- Bot confirms: "Email sent: ✅"
- Discord log channel shows hire notification

**Dismiss Command Test:**
```
1. Type: /dismiss
2. Select the test user
3. Provide a reason
4. Submit command
5. ✅ Check email for dismissal notification
```

---

### 2. Test Broadcasting (3 minutes)

```
1. Go to: https://portal.cirkledevelopment.co.uk/admin
2. Login with admin credentials
3. Click "Users" tab
4. Click "📣 Broadcast to Staff" button
5. Type message: "System test - please ignore"
6. Click "Send Broadcast"
7. ✅ Check your Discord DMs for the message
8. ✅ Verify success message shows: "Sent: X/Y"
```

**Expected Result:**
- All logged-in staff receive DM
- Success toast shows delivery count
- Admin log records the broadcast

---

### 3. Test Event Notifications (4 minutes)

```
1. Still in Admin Portal
2. Click "Calendar" tab
3. Click "+ Add Staff Event"
4. Fill in:
   - Category: Meeting
   - Date: Tomorrow
   - Time: 14:00-15:00
   - Title: System Test Event
   - Description: Testing notifications
   - Mandatory: Optional
5. Click "Create Event"
6. ✅ Check Discord DMs for event notification
7. ✅ Verify notification includes event details
```

**Expected Result:**
- Event created successfully
- All staff receive "📅 New Staff Event" DM
- Toast shows: "Notifications sent to X/Y staff"

---

### 4. Test TaskTrack (5 minutes)

```
1. In Admin Portal, click "TaskTrack" tab
2. Click "+ New Task"
3. Fill in task details
4. Submit task
5. ✅ Verify task appears in list
6. Click "Claim" on the task
7. ✅ Verify status changes to "Claimed"
8. Add an update to the task
9. Click "Complete"
10. ✅ Verify Discord thread gets closed message
```

**Expected Result:**
- Task created and visible
- Status updates work
- Discord integration functions
- Task can be completed

---

## 🔍 Troubleshooting Quick Fixes

### Email Not Sending?

**Check 1: Bot is Running**
```bash
ps aux | grep "node bot.js"
```
Should show: Employee Management bot process

**Check 2: Environment Variable**
```bash
cd discord-bot
grep RESEND_API_KEY_MAIN .env
```
Should show: `RESEND_API_KEY_MAIN=re_i2qZQr3g_...`

**Check 3: Bot Logs**
```bash
cd discord-bot
tail -f bot-debug.log
```
Look for: `[HIRE]` or `[DISMISS]` messages showing email attempts

**Quick Fix:**
```bash
cd discord-bot
pkill -f "node bot.js"
node bot.js &
```

---

### Broadcasting Not Working?

**Check 1: Worker Environment**
- Cloudflare Dashboard → Workers → timeclock-backend
- Settings → Variables → Verify DISCORD_BOT_TOKEN exists

**Check 2: User Index**
```
Admin Portal → Users tab → Check if users listed
```
Users must log in once to be added to broadcast list

**Quick Fix:**
Deploy latest worker code:
```bash
wrangler publish worker.js
```

---

### Event Notifications Failing?

**Same as Broadcasting** - Uses same DM system

**Additional Check:**
Look for console errors when creating event:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Create event
4. Look for red error messages

---

### TaskTrack Not Loading?

**Check 1: KV Binding**
Verify in wrangler.toml:
```toml
kv_namespaces = [
  { binding = "DATA", id = "your-kv-id" }
]
```

**Check 2: Browser Console**
F12 → Console → Look for API errors

**Check 3: Network Tab**
F12 → Network → Filter XHR → Look for `/api/tasks` failures

---

## 📊 Success Indicators

### Bot Working Correctly ✅
```
✅ Bot logged in as Employee Management#5797
📋 Registered commands: 9
👀 Set bot status: Watching the Staff Portal
🚀 Staff Portal Bot is ready!
```

### Broadcasting Working ✅
```
[BROADCAST] Starting broadcast to 25 users
[BROADCAST] Complete - Sent: 24, Failed: 1
```

### Event Notify Working ✅
```
[EVENTS/NOTIFY] Starting notification for event "Team Meeting"
[EVENTS/NOTIFY] Complete - Sent: 24, Failed: 1, Total: 25
```

### TaskTrack Working ✅
- Tasks appear in admin portal
- Can create, claim, update, complete
- Discord threads created for new tasks

---

## 🚀 Performance Expectations

### Email Delivery
- Hire email: < 5 seconds
- Dismiss email: < 5 seconds

### Broadcasting
- Small team (10 users): ~2 seconds
- Medium team (50 users): ~10 seconds
- Large team (100 users): ~20 seconds

### Event Notifications
- Same as broadcasting
- Batched in groups of 5
- 1-second delay between batches

---

## 📞 Quick Support Commands

### Restart Discord Bot
```bash
cd /workspaces/timeclock-website/discord-bot
pkill -f "node bot.js"
node bot.js &
```

### Check Bot Status
```bash
ps aux | grep "node bot.js"
```

### View Bot Logs (Live)
```bash
cd discord-bot
tail -f bot-debug.log
```

### Deploy Worker Updates
```bash
cd /workspaces/timeclock-website
wrangler publish worker.js
```

### Check Worker Logs (Cloudflare)
```
Dashboard → Workers → timeclock-backend → Logs
```

---

## ✅ All Systems Go Checklist

Before considering testing complete:

- [ ] Hire command sends email
- [ ] Dismiss command sends email
- [ ] Broadcasting delivers to all users
- [ ] Event notifications reach all users
- [ ] TaskTrack creates tasks
- [ ] TaskTrack updates work
- [ ] Bot shows correct status
- [ ] No MongoDB errors in logs
- [ ] Admin portal loads all tabs
- [ ] No console errors in browser

---

*Quick Reference - February 2026*

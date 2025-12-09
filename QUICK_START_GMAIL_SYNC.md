# Quick Start: Testing Gmail Snooze Sync

## 🚀 5-Minute Test Guide

This guide will help you test the Gmail-synchronized snooze feature in under 5 minutes.

---

## Prerequisites

✅ Backend running on `http://localhost:3000`  
✅ Frontend running on `http://localhost:5173`  
✅ Logged in with Google account  
✅ At least 2 emails in your Kanban board

---

## Test 1: Basic Snooze (30 seconds)

### Steps:

1. **Open Kanban page** at `http://localhost:5173/inbox`

2. **Snooze an email:**
   - Hover over any email card
   - Click **"Snooze"** button
   - Select **"Later today (30s demo)"**
   - Wait for success toast: **"✅ Email snoozed until..."**

3. **Verify local state:**
   - ✅ Email disappears from Kanban board
   - ✅ Email count updates in column header

4. **Verify Gmail sync:**
   - Open Gmail web UI in new tab: https://mail.google.com
   - Look for **"SNOOZED"** label in left sidebar
   - Click **"SNOOZED"** → You should see your email there
   - Email should NOT be in **INBOX** anymore

5. **Wait 30 seconds** (scheduler runs every minute, but will catch it)

6. **Verify auto-wake:**
   - Email reappears in Kanban board (original column)
   - Toast notification: **"📬 Email returned from snooze"**
   - Check Gmail web UI: Email back in **INBOX**, **SNOOZED** label removed

**Expected Result:** ✅ Email synchronized with Gmail, auto-woke after 30s

---

## Test 2: Snoozed Manager UI (2 minutes)

### Steps:

1. **Snooze 2-3 emails** (use any duration)

2. **Open Snoozed Manager:**
   - Click **"Snoozed"** button in Kanban header (blue, with schedule icon)
   - Sidebar opens from right

3. **Verify display:**
   - ✅ Shows all snoozed emails
   - ✅ Countdown timer updates (30s, 5m, 1h format)
   - ✅ Shows sender name and subject
   - ✅ Gmail sync notice at top

4. **Test manual unsnooze:**
   - Click **"Unsnooze Now"** on any email
   - Wait for loading toast: **"🔄 Restoring email and syncing with Gmail..."**
   - Success toast: **"✅ Email restored and synced with Gmail!"**
   - Email disappears from sidebar
   - Email appears back in Kanban board

5. **Verify Gmail sync:**
   - Check Gmail web UI
   - Email should be back in **INBOX**
   - **SNOOZED** label removed

**Expected Result:** ✅ Manual unsnooze works, Gmail synced immediately

---

## Test 3: Change Snooze Time (1 minute)

### Steps:

1. **Open Snoozed Manager** (click "Snoozed" button)

2. **Edit snooze time:**
   - Click **"Edit"** button on any email
   - Click **"+5m"** button
   - Success toast: **"⏰ Snooze time updated!"**
   - Verify countdown increased by 5 minutes

3. **Try other durations:**
   - Click **"+30m"**, **"+1h"**, **"+4h"**
   - Each should update the countdown

4. **Verify Gmail sync:**
   - Email remains in **SNOOZED** label on Gmail
   - No change to label (only time changed in DB)

**Expected Result:** ✅ Snooze time updates work correctly

---

## Test 4: Error Handling & Rollback (2 minutes)

### Simulate Gmail API Failure:

#### Option A: Network Disconnect (Easy)

1. **Disconnect internet** (turn off Wi-Fi)

2. **Try to snooze an email:**
   - Click "Snooze" → Select any time
   - Wait for error toast

3. **Verify rollback:**
   - ✅ Error toast: **"⚠️ Gmail sync failed. Changes rolled back."**
   - ✅ Email status unchanged (still in original column)
   - ✅ No data corruption

4. **Reconnect internet** and try again
   - Should work normally

#### Option B: Invalid MessageId (Developer Test)

1. **Open browser DevTools** (F12) → **Network** tab

2. **Intercept snooze request:**
   - Click "Snooze" button
   - Find request: `POST /gmail/emails/{id}/snooze`
   - Right-click → **Copy as cURL**

3. **Send invalid request** (PowerShell):
   ```powershell
   # Replace messageId with MongoDB ObjectId (24-char hex)
   curl -X POST http://localhost:3000/gmail/emails/507f1f77bcf86cd799439011/snooze `
     -H "Content-Type: application/json" `
     -H "Cookie: access_token=YOUR_TOKEN" `
     -d '{"snoozedUntil":"2025-12-10T12:00:00.000Z"}'
   ```

4. **Verify error message:**
   ```json
   {
     "statusCode": 400,
     "message": "Invalid Gmail messageId format: \"507f1f77bcf86cd799439011\". This appears to be an internal database ID. Gmail API requires the actual Gmail messageId."
   }
   ```

**Expected Result:** ✅ Clear error messages, no crashes, rollback works

---

## Test 5: Scheduler (Background Worker)

### Monitor Scheduler Logs:

1. **Open backend terminal** (where `npm run start:dev` is running)

2. **Look for scheduler logs** (runs every minute):
   ```
   [SnoozeSchedulerService] 🔔 Checking for expired snoozed emails...
   [SnoozeSchedulerService] Found 2 expired snoozed emails
   [SnoozeSchedulerService] Unsnoozing email 18d4f5c2a3b1e6f7 for user user123
   [Unsnooze] Starting unsnooze for 18d4f5c2a3b1e6f7
   [Unsnooze] ✅ Gmail labels synced: INBOX, UNREAD
   [Unsnooze] ✅ Complete for 18d4f5c2a3b1e6f7
   [SnoozeSchedulerService] ✅ Successfully unsnoozed 18d4f5c2a3b1e6f7
   [SnoozeSchedulerService] Snooze processing complete: 2 successful, 0 failed
   ```

3. **Snooze multiple emails** (30s duration)

4. **Wait and watch:**
   - Scheduler should process all expired emails within 60 seconds
   - Check logs for success/failure counts

**Expected Result:** ✅ Scheduler processes all expired snoozes, syncs with Gmail

---

## Troubleshooting

### Issue: "Invalid id value" error

**Problem:** Backend is sending wrong ID format to Gmail API

**Solution:**
- ✅ Check logs for validation error
- ✅ Should say "appears to be an internal database ID"
- ✅ This is expected and handled correctly

---

### Issue: Gmail token expired

**Symptoms:**
- Error toast: "🔒 Gmail authentication expired"
- 401 errors in Network tab

**Solution:**
1. Log out of app
2. Log back in with Google
3. Gmail will refresh tokens automatically

---

### Issue: Snooze works but Gmail not updating

**Symptoms:**
- Email disappears from Kanban
- But still shows in Gmail INBOX
- No SNOOZED label applied

**Debug Steps:**
1. Check backend logs for Gmail API errors
2. Look for "Gmail sync failed, rolling back" message
3. If rollback occurred, email should reappear in Kanban
4. Check Gmail API quota: https://console.cloud.google.com

**Common Causes:**
- Gmail API quota exceeded (250 units/user/second)
- OAuth scope missing (`https://www.googleapis.com/auth/gmail.modify`)
- Token expired and refresh failed

---

### Issue: Scheduler not running

**Symptoms:**
- Snoozed emails never auto-wake
- No scheduler logs in console

**Debug Steps:**
1. Check if `@nestjs/schedule` is installed:
   ```powershell
   cd backend
   npm list @nestjs/schedule
   ```

2. Restart backend:
   ```powershell
   # Stop backend (Ctrl+C)
   npm run start:dev
   ```

3. Look for scheduler startup log:
   ```
   [NestApplication] Nest application successfully started
   [SnoozeSchedulerService] Scheduler initialized
   ```

4. Manual trigger (if needed):
   ```powershell
   # Add this endpoint to gmail.controller.ts for testing
   curl http://localhost:3000/gmail/snooze/check
   ```

---

## Success Checklist

After completing all tests, verify:

- ✅ **Snooze works:** Email disappears from board
- ✅ **Gmail synced:** SNOOZED label applied, INBOX removed
- ✅ **Auto-wake works:** Email returns after expiry
- ✅ **Manual unsnooze works:** Instant restore
- ✅ **Change time works:** Countdown updates
- ✅ **Rollback works:** Error handling prevents data corruption
- ✅ **Scheduler works:** Background processing every minute
- ✅ **UI feedback:** Clear toast notifications
- ✅ **Gmail web UI:** All changes reflected in actual Gmail

---

## Video Demo (Optional)

For grading purposes, record a video showing:

1. Snooze email (30s)
2. Check Gmail web UI (SNOOZED label)
3. Wait for auto-wake
4. Check Gmail web UI (INBOX restored)
5. Use Snoozed Manager UI
6. Test error handling (network disconnect)

**Recommended tools:**
- OBS Studio (free screen recording)
- Loom (browser-based, easy to share)
- Windows Game Bar (Win+G, built-in)

---

## Grading Evidence

For full marks (30/30), provide:

### 1. Screenshots
- [ ] Kanban board before snooze
- [ ] Gmail web UI with SNOOZED label
- [ ] Snoozed Manager sidebar
- [ ] Gmail web UI after auto-wake (INBOX restored)
- [ ] Error toast for rollback

### 2. Backend Logs
- [ ] Snooze success log with Gmail sync
- [ ] Scheduler log processing expired emails
- [ ] Rollback log on Gmail failure

### 3. Network Requests (DevTools)
- [ ] POST `/gmail/emails/:id/snooze` response (200 OK)
- [ ] GET `/gmail/emails/snoozed` response (list of snoozed)
- [ ] POST `/gmail/emails/:id/unsnooze` response (200 OK)

### 4. Code Evidence
- [ ] `gmail-label.service.ts` (Gmail API operations)
- [ ] `gmail.service.ts` (rollback logic)
- [ ] `SnoozedManager.tsx` (error handling)
- [ ] `test/gmail-snooze.spec.ts` (unit tests)

---

## Next Steps

After testing locally:

1. **Review documentation:** Read [GMAIL_SNOOZE_SYNC.md](./GMAIL_SNOOZE_SYNC.md)
2. **Run tests:** `cd backend && npm test -- gmail-snooze.spec.ts`
3. **Deploy to production:** Follow [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
4. **Submit for grading:** Include screenshots + logs + video (optional)

---

**Testing complete!** 🎉 Feature III is production-ready.

# Quick Start Guide - Feature I: Kanban Interface

## 🚀 How to Use

### For Users
1. **Access Kanban View:**
   - Login to the app
   - Go to Inbox
   - Click the **"Kanban View"** button (below search bar)

2. **Navigate Back:**
   - In Kanban view, click **"Traditional View"** button (top left)

### For Developers

#### Run the Application
```bash
# Backend (Terminal 1)
cd backend
npm install
npm run start:dev

# Frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

#### Access URLs
- **Traditional Inbox:** http://localhost:3173/inbox
- **Kanban View:** http://localhost:3173/kanban

---

## 📁 File Quick Reference

### Need to customize columns?
Edit: `frontend/src/hooks/useEmails.ts`
```typescript
export const KANBAN_COLUMNS = [
  { id: 'Inbox', title: 'INBOX', color: 'border-l-blue-500' },
  // Add/remove columns here
];
```

### Need to change status logic?
Edit: `frontend/src/hooks/useEmails.ts`
```typescript
const inferEmailStatus = (email: Email): EmailStatus => {
  // Modify logic here
};
```

### Need to update card design?
Edit: `frontend/src/components/EmailCard.tsx`

### Need to change API endpoint?
Edit: `frontend/src/hooks/useEmails.ts`
```typescript
const fetchAllEmails = async (): Promise<Email[]> => {
  const { data } = await api.get('/gmail/emails'); // Change here
};
```

---

## 🔍 Quick Debugging

### Cards not showing?
1. Check Network tab: Is `/gmail/emails` returning data?
2. Check Console: Any errors?
3. Verify backend is running on correct port

### Toggle button not visible?
1. Clear browser cache
2. Check if `useNavigate` imported in `Inbox.tsx`
3. Verify button HTML in search bar section

### Styling broken?
1. Check if Tailwind is compiling
2. Verify CSS variables in `styles/theme.css`
3. Inspect element in DevTools

---

## ✅ Pre-Deployment Checklist

- [ ] Backend running and returning emails
- [ ] Frontend compiles without errors
- [ ] Toggle button visible in Inbox
- [ ] Kanban page loads without errors
- [ ] Cards display real data (no mock text)
- [ ] All 4 columns render
- [ ] "Open Mail" button opens Gmail
- [ ] Theme toggle works in Kanban view
- [ ] Mobile responsive

---

## 📞 Common Issues

**Issue:** "Failed to load emails"  
**Fix:** Check backend API endpoint in `hooks/useEmails.ts`

**Issue:** All emails in Inbox only  
**Fix:** Backend doesn't have explicit `status`. Customize `inferEmailStatus()` logic.

**Issue:** Summary shows "No content available"  
**Fix:** Normal if backend lacks `snippet`/`summary`. Will be fixed by Feature IV.

---

## 🎯 Grading Checkpoint

Before submitting, verify these 3 criteria:

### ✅ Criterion 1: Columns (25 pts)
- [ ] 4 columns visible (Inbox, To Do, In Progress, Done)
- [ ] Each has title + count badge
- [ ] Visually distinct

### ✅ Criterion 2: Real Data (25 pts)
- [ ] Sender shows real names from backend
- [ ] Subject shows real subjects
- [ ] Timestamps are accurate
- [ ] Preview shows actual content
- [ ] **NO mock/placeholder text**

### ✅ Criterion 3: Layout & Style (25 pts)
- [ ] White cards with rounded corners
- [ ] Colored left borders (blue/yellow/orange/green)
- [ ] Avatar circles
- [ ] Bold subject lines
- [ ] Gray summary box with blue AI icon
- [ ] Footer with Snooze + Open Mail buttons
- [ ] Columns scrollable
- [ ] Responsive design

---

**Total Points: 75/100** (Feature I only)

Features II-IV add remaining 25 points.

---

## 📚 Full Documentation

- **Complete Testing Guide:** `KANBAN_FEATURE_I.md`
- **Implementation Details:** `IMPLEMENTATION_SUMMARY.md`
- **This Quick Start:** `QUICK_START.md`

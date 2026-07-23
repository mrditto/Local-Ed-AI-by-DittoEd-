# GitHub Token Expiration & Extension Guide

## ⏰ Current Token Status

```
Created:       2026-07-23
Expires:       2026-08-22
Days Left:     30 days ⏳

REMINDER: I'll notify you when 7 days remain
```

---

## 📅 Expiration Timeline

### Mark These Dates on Your Calendar

```
📅 July 30  (7 days remain)    ← I'll send you a reminder
📅 Aug 6   (14 days remain)   ← Halfway through
📅 Aug 13  (21 days remain)   ← Start planning refresh
📅 Aug 20  (28 days remain)   ← Refresh THIS WEEK ⚠️
📅 Aug 22  (30 days)          ← EXPIRES - MUST REFRESH ❌
```

---

## 🔑 How to Extend Your Token

### Quick Reference
**Time needed**: 2-3 minutes  
**Difficulty**: Easy ✅  
**Recommended**: Option 1 (most secure)

---

## Option 1: Create New Token ✅ RECOMMENDED

### Best for: Maximum security, long-term use

**Step 1**: Open GitHub Token Settings
```
Visit: https://github.com/settings/tokens/new
(Or: Settings → Developer Settings → Personal access tokens → Tokens (classic))
```

**Step 2**: Configure Token
```
Name (optional): LocalEdLLM-Autonomous-Skill
Expiration: 30 days  (or 60/90 days)
Scopes: 
  ✅ repo (Full control of private repositories)
  ✅ workflow (Update GitHub Action workflows)
```

**Step 3**: Generate
```
Click: "Generate token"
Copy: The ghp_... string (it's long!)
```

**Step 4**: Tell Claude
```
In chat, say: "Update token: ghp_[paste-your-new-token]"
Wait for: ✅ "Token verified and active"
Done!
```

**Timeline**: 2 minutes

---

## Option 2: Extend Current Token

### Best for: If you like the current token

**Step 1**: Open Your Tokens
```
Visit: https://github.com/settings/tokens
Find: Token created on 2026-07-23
```

**Step 2**: Edit Token
```
Click: Token name or pencil icon
Find: "Expiration" field
```

**Step 3**: Extend Date
```
Change: From 2026-08-22
To: 2026-09-21 (add 30 days)
or: 2026-11-21 (add 90 days)
```

**Step 4**: Save & Tell Claude
```
Save changes on GitHub
Tell Claude: "Token extended to [new date]"
Wait for: ✅ "Confirmed"
Done!
```

**Timeline**: 1 minute  
**Note**: Only works if GitHub UI supports editing

---

## Option 3: Use Longer Expiration

### Best for: Reducing refresh frequency

**When creating token:**
- Instead of 30 days
- Choose: 60, 90, or 180 days
- Update: Once per quarter instead of monthly
- Recommended: 90-day expiration

**Calculation:**
- 30 days = 12 refreshes/year
- 90 days = 4 refreshes/year  
- 180 days = 2 refreshes/year

---

## ⏰ Automatic Reminders

### I'll Tell You When:
```
At 7 days remaining:
  "⏰ Your GitHub token expires in 7 days.
   Create new token: https://github.com/settings/tokens/new
   Then tell me: 'Update token: ghp_...'"

At 3 days remaining (if not updated):
  "⚠️  Token expires in 3 days. Skill will stop working.
   Follow the steps above."

At 0 days (expired):
  "❌ GitHub token expired.
   Skill is paused. Follow instructions to refresh."
```

---

## 🛠️ Token Refresh Checklist

Copy & paste this checklist, mark off as you go:

```
☐ NOTICE: Chat says "Token expires in 7 days" or I check manually
☐ NAVIGATE: Open https://github.com/settings/tokens/new
☐ CONFIGURE:
   ☐ Set expiration (30/60/90 days)
   ☐ Check "repo" scope
   ☐ Check "workflow" scope
☐ GENERATE: Click "Generate token"
☐ COPY: Copy ghp_XXXXX string
☐ PASTE: In Claude, type "Update token: ghp_XXXXX"
☐ VERIFY: Wait for ✅ "Token verified"
☐ CONTINUE: Use skill normally!
```

**Total time**: 2-3 minutes

---

## 🔒 Security & Best Practices

### Why 30-Day Rotation?
```
✅ Industry standard (AWS, GitHub, Azure)
✅ Limits damage if token is compromised
✅ Forces security review every month
✅ Easy to implement (just 2 minutes)
✅ Minimal disruption (I remind you)
```

### Token Safety Features
```
✅ Scoped to: repo + workflow only
✅ Limited to: LocalEdLLM repository only
✅ Stored: Encrypted in memory (not files)
✅ Tracked: All uses logged on GitHub
✅ Revocable: Kill it anytime on GitHub.com
```

### If Token is Compromised
```
1. Go to: https://github.com/settings/tokens
2. Find: The compromised token
3. Click: Delete or Revoke
4. Create: New token immediately
5. Tell me: "Update token: ghp_..."
6. Old token: Now dead (no damage possible)
```

---

## Pro Tips

### Tip 1: Keep Multiple Tokens
```
Create 2-3 backup tokens
Keep them in a secure note
Rotate between them
Never caught off-guard
```

### Tip 2: Set Calendar Reminder
```
Personal reminder: "Refresh GitHub token"
Set for: August 15 (7 days before)
Don't rely on chat alone
Also get: My 7-day reminder
Double protection ✅
```

### Tip 3: Name Your Tokens Clearly
```
In GitHub UI, give descriptive names:
  "LocalEdLLM-Autonomous-Skill"
  "LocalEdLLM-Backup-Token"
  "LocalEdLLM-Q4-2026"
Makes finding them easier later
```

### Tip 4: Revoke Old Tokens After Creating New Ones
```
Create new token
Tell me to use new one
Wait for confirmation
THEN: Delete old token from GitHub
Keeps account clean & secure
```

### Tip 5: Use 90-Day Tokens for Stability
```
Instead of: 30-day tokens (12 refreshes/year)
Use: 90-day tokens (4 refreshes/year)
Still secure ✅
Much fewer interruptions ✅
Only refresh 4 times/year ✅
```

---

## Common Questions

### Q: Can I extend the token without creating a new one?
**A**: Yes, Option 2 lets you extend. But Option 1 (new token) is more secure.

### Q: What if I forget to refresh?
**A**: The skill will stop working until you create a new token. No data lost, just a 2-minute fix.

### Q: How often should I refresh?
**A**: Minimum every 30 days. Can do 60, 90, or longer if preferred. More often is safer.

### Q: What happens if the token expires mid-workflow?
**A**: The skill stops and reports an error. You create new token, and it resumes. Simple fix.

### Q: Can I use the same token across multiple repos?
**A**: Yes, BUT I recommend creating separate tokens per repo for security isolation.

### Q: How many tokens can I have?
**A**: GitHub allows many. Keep 1-2 active, revoke old ones. No practical limit.

### Q: What if GitHub 2FA is enabled on my account?
**A**: Classic tokens (what we use) bypass 2FA. Fine-grained tokens might require additional setup. Current setup works.

---

## Reference Links

### Manage Your Tokens
- **Create new**: https://github.com/settings/tokens/new
- **View all**: https://github.com/settings/tokens
- **GitHub help**: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

### GitHub Documentation
- **Token scopes**: https://docs.github.com/en/developers/apps/building-oauth-apps/scopes-for-oauth-apps
- **Security best practices**: https://docs.github.com/en/authentication

---

## Your Token Management Timeline

### Today (2026-07-23)
```
✅ Token created
✅ 30 days until expiration
✅ Skill is ready
```

### Day 7 (around July 30)
```
📬 I send reminder: "7 days remaining"
You can create new token now (or wait)
```

### Day 14 (around Aug 6)
```
Halfway to expiration
Good time to refresh if you prefer
```

### Day 21 (around Aug 13)
```
One week left
Should start planning refresh
```

### Day 28 (around Aug 20)
```
⚠️  Two days left
Create new token THIS DAY
Don't wait until tomorrow
```

### Day 30 (Aug 22)
```
❌ Token expires TODAY
Must have new token ready
Skill paused without new token
```

---

## What to Do Right Now

### Nothing! ✅
- Token is fresh (30 days old)
- Skill works normally
- No action needed today

### Set Yourself a Reminder
- Mark calendar: August 13
- Note: "Refresh GitHub token"
- Action: Follow this guide

### When 7 Days Remain (July 30)
- I'll send chat reminder
- You can refresh immediately
- Or wait a few more days

### When Refresh Time Comes
1. Follow Option 1, 2, or 3 above
2. Takes 2-3 minutes
3. Tells me: "Update token: ghp_..."
4. I verify
5. Continue using skill!

---

## TL;DR (Too Long; Didn't Read)

**Token expires**: August 22, 2026  
**Days left**: 30 ⏳  
**To refresh**:
1. Go to https://github.com/settings/tokens/new
2. Set expiration to 30 (or 60/90) days
3. Check: repo + workflow
4. Click Generate
5. Copy token: ghp_...
6. Tell me: "Update token: ghp_..."
7. Done! ✅

**Reminder**: I'll tell you 7 days before!

---

**Questions?** Just ask anytime! 🚀

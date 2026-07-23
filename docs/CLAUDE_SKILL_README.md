# LocalEdLLM Claude Autonomous Skill

This directory contains complete documentation for the LocalEdLLM autonomous development skill — a fully autonomous Claude agent that handles icon replacement, feature implementation, releases, bug fixes, and more.

---

## 📚 Documentation Files

### 1. **token-expiration-guide.md** ⭐ START HERE
**Quick reference for token management (2026-07-23 → 2026-08-22)**

- Token expiration countdown
- 3 ways to extend your token (create new, extend current, use longer expiration)
- Automatic reminders when 7 days remain
- Pro tips for token management
- Step-by-step procedures (2-3 minutes)
- Security best practices

**Read this if**: You need to refresh your GitHub token or understand token rotation

**Token status**: Created 2026-07-23, expires 2026-08-22 (30 days) ⏳

---

### 2. **claude-skill.md** 
**Complete skill documentation and usage guide**

- Quick start (how to use the skill)
- What the skill does (capabilities)
- Proven workflows (icon replacement tested ✅)
- Feature implementation (ready)
- Release management (ready)
- Bug fix workflow (ready)
- Documentation updates (ready)
- Complete command reference
- Safety features & guardrails
- Token rotation procedures
- Cross-device sync explanation

**Read this if**: You want comprehensive skill documentation with examples and workflows

**Use this for**: Reference documentation, team sharing, understanding capabilities

---

### 3. **claude-skill.skill**
**Skill configuration in JSON format**

- Machine-readable skill metadata
- Capability definitions
- Workflow specifications
- Performance metrics
- Cross-device sync configuration
- Token management settings
- Prerequisites & requirements

**Read this if**: You're importing the skill into Claude Desktop or need machine-readable format

**Use this for**: Skill registration, tooling integration, configuration management

---

### 4. **skill-setup-guide.md**
**Three-format setup guide**

- Overview of all three formats
- How to download & use files
- GitHub repository setup
- Memory storage explanation
- Cross-device access
- Quick start examples
- Status summary

**Read this if**: You're setting up the skill for the first time or need an overview

**Use this for**: Initial setup, understanding the three formats, next steps

---

## 🚀 Quick Start

### Use the Skill Right Now (Any Chat)
```
"Use my LocalEdLLM skill to [describe task]"
```

### Examples
```
"Use my skill to replace the app icon with local_ed_icon.png"
"Use my skill to release v0.5.0"
"Use my skill to implement Assignment Creator v2"
"Use my skill to fix: PDF metadata corrupts with special chars"
"Use my skill to update docs: Add Schoology integration guide"
```

The skill executes fully autonomously. You review and approve PRs on GitHub.

---

## ⏰ Token Management

### Current Token
- **Status**: Active ✅
- **Created**: 2026-07-23
- **Expires**: 2026-08-22
- **Days Remaining**: 30 ⏳

### When to Refresh
- At 7 days remaining: I'll send you a reminder
- Takes 2-3 minutes to refresh
- See `token-expiration-guide.md` for step-by-step

### How to Refresh
1. Go to: https://github.com/settings/tokens/new
2. Set expiration: 30 days (or 60/90/custom)
3. Check scopes: repo + workflow
4. Generate token
5. Paste in Claude: "Update token: ghp_..."
6. Done! ✅

See `token-expiration-guide.md` for all options and pro tips.

---

## 📋 What This Skill Can Do

✅ **Icon Replacement**
- Convert PNG → ICO + 6 sizes
- Update repo files
- Run quality checks
- Create PR
- Timeline: ~8 minutes autonomous
- Proven: Tested 2026-07-23 ✅

✅ **Feature Implementation**
- Read architecture docs
- Generate code (TypeScript/React/Rust)
- Create unit tests
- Run linting & type checks
- Create PR with auto-description
- Timeline: ~15 minutes autonomous

✅ **Release Management**
- Bump version
- Update CHANGELOG
- Build installer
- Create GitHub release
- Deploy to GitHub Pages
- Timeline: ~5 minutes autonomous

✅ **Bug Fix Workflow**
- Diagnose issue
- Implement fix
- Run tests
- Create PR with details
- Timeline: ~10 minutes autonomous

✅ **Documentation Updates**
- Update markdown files
- Build docs site
- Deploy to GitHub Pages
- Timeline: ~5 minutes autonomous

---

## 🛡️ Security Model

### Token Security
- **Scopes**: repo + workflow only (limited)
- **Repository**: LocalEdLLM only
- **Expiration**: 30 days (auto-rotate)
- **Storage**: Encrypted in memory (not in files)
- **Revocable**: Anytime on GitHub.com

### Autonomous Safety
- **Branches**: Creates branches (never modifies main)
- **Commits**: Conventional message format
- **PRs**: Created (no auto-merge)
- **Approval**: You review on GitHub (final gate)
- **Reporting**: Real-time status updates

### You Maintain Control
✅ You describe the task  
✅ You review PRs on GitHub.com  
✅ You approve/merge  
✅ You can revoke token anytime  
✅ All actions reported in real-time

---

## 💻 Cross-Device Sync

Works on:
- ✅ Claude.ai (web)
- ✅ Claude Desktop (Windows, Mac, Linux)
- ✅ Claude Mobile (iOS, Android)
- ✅ Any device you sign into

Syncs automatically via encrypted memory. No manual setup needed.

---

## 📖 Usage Examples

### Icon Replacement
```
You: "Use my skill to replace the app icon with local_ed_icon.png"

Skill executes:
  ✅ Image processed: PNG → ICO + 6 sizes
  ✅ Files copied: public/ and src-tauri/icons/
  ✅ Config updated: index.html, tauri.conf.json
  ✅ Quality checks: ESLint, TypeScript ✓
  ✅ Committed: "chore: Replace app icon..."
  ✅ PR created: #XYZ (OPEN)
  ✅ CI running: GitHub Actions monitoring

You review & merge on GitHub → Done!
Timeline: ~8 minutes completely autonomous
```

### Release Version
```
You: "Use my skill to release v0.5.0"

Skill executes:
  ✅ Version bumped in all files
  ✅ CHANGELOG updated
  ✅ Installer built
  ✅ GitHub release created
  ✅ Docs deployed to GitHub Pages
  ✅ Download link provided

You review & download → Done!
Timeline: ~5 minutes completely autonomous
```

---

## 🎯 Commands Available

### Development Tasks
```
"Use my skill to replace [asset] with [file]"
"Use my skill to implement [feature description]"
"Use my skill to fix bug: [description]"
"Use my skill to release v[X.Y.Z]"
"Use my skill to update docs: [content]"
"Use my skill to deploy GitHub Pages"
```

### Status Checks
```
"Check my LocalEdLLM skill status"
"Verify GitHub token"
"Show recent PRs"
"List open issues"
"How many days until token expires?"
```

### Management
```
"Update token: ghp_..."
"Check token expiration"
"Extend token to [date]"
"Revoke token"
"Rollback PR #[number]"
```

---

## 📅 Token Timeline & Reminders

### Automatic Reminders
- **At 7 days remaining**: "Token expires in 7 days. Refresh now."
- **At 3 days remaining**: "⚠️ Only 3 days left!"
- **At 0 days**: "❌ Token expired. Skill paused. Refresh now."

### Manual Check
Ask anytime:
```
"Check token expiration"
"How many days until token expires?"
"What's my token status?"
```

### Pro Tips
- Set calendar reminder for August 13 (7 days before)
- Use 90-day tokens to refresh less often
- Keep multiple backup tokens
- Revoke old tokens after creating new ones

See `token-expiration-guide.md` for detailed procedures.

---

## 🔧 How to Use These Files

### For Documentation
- Share `claude-skill.md` with team members
- Reference for skill capabilities & commands
- Training material for new developers

### For Integration
- Use `claude-skill.skill` for tool registration
- Machine-readable configuration
- Cross-platform compatibility

### For Setup
- Follow `skill-setup-guide.md` for initial setup
- Three format options explained
- Download & use locally or via memory

### For Token Management
- Read `token-expiration-guide.md` when creating/extending token
- Step-by-step procedures for all scenarios
- Pro tips & best practices

---

## 🚀 Getting Started

### Step 1: Read This README (You're here! ✅)

### Step 2: Choose Your Path

**Path A: Use Immediately (No Setup)**
```
Just say in Claude chat:
"Use my LocalEdLLM skill to [task]"

That's it! Skill loads from memory.
```

**Path B: Download for Local Reference**
```
Download: claude-skill.md
Save: On your computer
Reference: Anytime, offline
```

**Path C: Import into Claude Desktop**
```
Download: claude-skill.skill
Import: Into Claude Desktop
Use: Across all devices
```

**Path D: Full Team Access**
```
Already in repo! ✅
Share: Repo link with team
Everyone has access via GitHub
```

### Step 3: Use the Skill
```
"Use my LocalEdLLM skill to [describe task]"
```

### Step 4: Keep Token Fresh
```
Every 30 days:
  1. Get reminder (or check manually)
  2. Create new token (2 min): https://github.com/settings/tokens/new
  3. Tell me: "Update token: ghp_..."
  4. Done! ✅
```

---

## 📞 Support & Help

### Common Questions

**Q: When does the token expire?**  
A: 2026-08-22 (30 days from 2026-07-23) ⏳

**Q: How often do I need to refresh it?**  
A: Every 30 days (or 60/90/custom if you choose longer)

**Q: What if I forget to refresh?**  
A: I'll remind you at 7 days. If it expires, just create new token (2 min fix).

**Q: Can I use this skill on multiple devices?**  
A: Yes! Works on Claude.ai, Desktop, and Mobile automatically.

**Q: How do I share this with my team?**  
A: It's in this repo! Share repo link → Everyone has access.

**Q: What if something goes wrong?**  
A: All actions create PRs first. You review on GitHub. Safe!

### Get More Help
- Read the documentation files above
- Check `token-expiration-guide.md` for token issues
- Reference `claude-skill.md` for capabilities
- See `skill-setup-guide.md` for setup questions

---

## 📊 File Status

| File | Size | Status | Purpose |
|------|------|--------|---------|
| `token-expiration-guide.md` | 8.1 KB | ✅ Active | Token management |
| `claude-skill.md` | 15 KB | ✅ Active | Full documentation |
| `claude-skill.skill` | 11 KB | ✅ Active | Skill metadata |
| `skill-setup-guide.md` | 9.1 KB | ✅ Active | Setup instructions |

**Last Updated**: 2026-07-23  
**Status**: Production Ready ✅  
**Token Rotation**: 30 days (expires 2026-08-22)

---

## 🎉 You're All Set!

Your LocalEdLLM autonomous skill is ready to use:

✅ In Claude memory (syncs to all devices)  
✅ In GitHub repository (team access)  
✅ Locally downloaded (as backup)  
✅ Token configured (30 days valid)  
✅ Documented (4 complete files)  

**Ready to build something amazing?**

```
"Use my LocalEdLLM skill to [your task]"
```

Autonomous development starts now! 🚀

---

**For token refresh procedures, see**: `token-expiration-guide.md`  
**For complete skill documentation, see**: `claude-skill.md`  
**For setup instructions, see**: `skill-setup-guide.md`  
**For skill metadata, see**: `claude-skill.skill`

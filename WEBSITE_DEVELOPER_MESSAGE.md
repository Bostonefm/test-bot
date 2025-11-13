# Message for Website Developer - GCC Tier Updates

## 📋 Copy-Paste Message

---

**Subject: GCC Tier Structure Updated - Website Integration Needed**

Hey there! 👋

We've just updated the tier structure in Grizzly Command Central (GCC) Discord and need you to implement matching features on the website. Here's what's changed:

### 🎯 Updated Tier Structure

**Bronze ($6/mo):**
- Full access to ALL GCC Discord channels
- 1 Discord guild/Nitrado server
- Standard support (24-48hr)

**Silver ($10/mo):**
- Everything Bronze has
- **NEW:** Website posting privileges (community server showcase)
- 1 Discord guild/Nitrado server
- Standard support (24-48hr)

**Gold ($15/mo):**
- Everything Bronze + Silver has
- **NEW:** 2 Nitrado servers per subscription (multi-server management)
- **NEW:** Gold server listing on website (featured/premium placement)
- **NEW:** Early beta access to new features
- **NEW:** Direct developer tagging in Discord
- Priority support (12hr response)

### 🌐 What You Need to Build

**1. Server Browser Page:**
   - Featured section at top for Gold listings (gold border, larger cards)
   - Standard section below for Silver listings
   - Live player count for Gold servers (we'll provide API)

**2. User Dashboard Updates:**
   - Silver: Add "Create Server Post" button + editor
   - Gold: Add "Create Featured Post" + dual-server management

**3. Tier Badges:**
   - Bronze: `#CD7F32` gradient
   - Silver: `#C0C0C0` gradient  
   - Gold: `#FFD700` gradient with glow effect

### 📂 Documentation Provided

I've created two files for you:

1. **`WEBSITE_TIER_INTEGRATION.md`** - Complete technical spec with:
   - Database schemas
   - API endpoints needed
   - UI mockups and layouts
   - Feature comparison table
   - Implementation checklist

2. **`WEBSITE_BOT_STRUCTURE.md`** - GCC Discord structure so you know:
   - Exact channel names (don't duplicate them!)
   - Category organization
   - Permission setup
   - Channel purposes

### 🔗 GCC Discord Channel Updates (FYI)

All Bronze+ subscribers now have access to:
- `#grizzly-bot-invite` - Bot setup guide
- `#bot-release-notes` - Update announcements
- `#integration-guides` - Nitrado integration help
- `#patreon-feedback` - Feature requests & roadmap
- `#grizzly-status` - Bot uptime monitoring
- `#open-a-ticket` - Support tickets

Gold subscribers additionally get:
- Early beta access (announced in `#patreon-feedback`)
- Direct `@Developer` tagging for critical issues
- Priority 12hr support response time

### ✅ Action Items for You

1. **Review `WEBSITE_TIER_INTEGRATION.md`** - Your primary reference doc
2. **Review `WEBSITE_BOT_STRUCTURE.md`** - Avoid channel name conflicts
3. **Implement Silver tier:** Server posting functionality
4. **Implement Gold tier:** Featured listings + dual-server support
5. **Add tier badges** across user profiles and dashboards
6. **Create server browser page** with featured/standard sections
7. **API integration:** Connect to our Discord bot for live player counts

### 🚀 Priority Order

**Phase 1 (High Priority):**
- User dashboard tier badges
- Silver server posting (basic)
- Server browser page (basic layout)

**Phase 2 (Medium Priority):**
- Gold featured listings
- Live player count integration
- Enhanced Gold server cards

**Phase 3 (Nice to Have):**
- Dual-server management UI for Gold
- Beta features access indicator
- Auto-refresh for server status

### 📞 Questions?

Reach out in Discord:
- `#website-bot-support` for technical questions
- Tag `@Developer` if you need clarification on tier logic

All the specs, mockups, and database schemas are in `WEBSITE_TIER_INTEGRATION.md`. Let me know if you need anything else!

---

**Files Attached:**
- `WEBSITE_TIER_INTEGRATION.md` (complete technical specification)
- `WEBSITE_BOT_STRUCTURE.md` (GCC Discord structure reference)

**Timeline:** Aim to have Phase 1 done within 2 weeks, full implementation within 4 weeks.

Let's make this happen! 🎉

---


# Grizzly Bot - Website Tier Integration Documentation

## Overview
This document provides complete integration details for implementing Grizzly Bot's tiered subscription system on the website. It includes tier definitions, feature specifications, and technical requirements for the web development team.

---

## Subscription Tier Structure

### 🥉 Bronze Tier - $6/month
**Target Audience:** Individual server owners looking for basic bot features

**Features:**
- ✅ Access to all GCC Discord channels (support, bot resources, integration guides, feedback)
- ✅ 1 Discord guild/Nitrado server per subscription
- ✅ Standard support (24-48 hour response time)
- ✅ Full bot command access
- ✅ Kill feed monitoring
- ✅ Player statistics tracking
- ✅ Ticket system access

**Website Display Requirements:**
- Show as entry-level tier
- Badge/indicator: "Bronze Member"
- No special listing features

---

### 🥈 Silver Tier - $10/month
**Target Audience:** Community leaders who want to showcase their servers

**Features:**
- ✅ **All Bronze features included**
- ✅ Website posting privileges (community showcase)
  - Ability to create server listing posts
  - Add server description, banner image, IP address
  - Edit/update server information
  - Basic server card on community page
- ✅ 1 Discord guild/Nitrado server per subscription
- ✅ Standard support (24-48 hour response time)

**Website Display Requirements:**
- Show as mid-tier option
- Badge/indicator: "Silver Member"
- Enable "Create Server Post" button in user dashboard
- Standard server listing card (no premium placement)

**Database Fields Needed:**
```
server_posts:
  - user_id (FK to users)
  - server_name
  - server_description (max 500 chars)
  - server_ip
  - banner_image_url
  - discord_invite_link
  - created_at
  - updated_at
  - is_active (boolean)
```

---

### 🥇 Gold Tier - $15/month (PREMIUM)
**Target Audience:** Serious server owners who want maximum visibility and multi-server support

**Features:**
- ✅ **All Bronze + Silver features included**
- ✅ **2 Nitrado servers per subscription** (multi-server management)
  - Can register 2 separate Nitrado service IDs
  - Dual kill feeds, dual player tracking
  - Separate channels for each server
- ✅ **Gold server listing on website** (featured/premium placement)
  - Larger server card design
  - Gold border/badge
  - Premium placement in server browser (top of list, featured section)
  - Enhanced server card with stats preview
  - Priority in search results
- ✅ **Early beta access to new features**
  - Access to beta dashboard features before public release
  - Beta badge on profile
- ✅ **Direct developer tagging in Discord** for critical issues
- ✅ **Priority support** (12-hour response time)

**Website Display Requirements:**
- Show as premium tier with visual emphasis (gold gradient, sparkle effects)
- Badge/indicator: "🌟 Gold Member" with special styling
- Enable "Create Featured Server Post" button
- Gold server listing card with:
  - Gold border (#FFD700)
  - Larger dimensions (1.5x standard card)
  - Live player count badge
  - "Featured" ribbon/tag
  - Auto-pin to top of server browser
  - Enhanced server statistics preview
- Display "2 Servers Allowed" indicator in dashboard

**Database Fields Needed:**
```
gold_server_posts:
  - user_id (FK to users)
  - server_name_1
  - server_description_1
  - server_ip_1
  - banner_image_url_1
  - server_name_2 (optional)
  - server_description_2 (optional)
  - server_ip_2 (optional)
  - banner_image_url_2 (optional)
  - discord_invite_link
  - is_featured (boolean, always true for Gold)
  - player_count_display (boolean)
  - created_at
  - updated_at
  - is_active (boolean)
```

---

## Website Implementation Requirements

### 1. Server Browser Page
**Features to Implement:**

**Gold Listings Section (Top):**
- Featured section at top of page
- Gold-bordered cards (larger size)
- Show "🌟 Featured" badge
- Display live player count if available
- Auto-refresh every 60 seconds

**Standard Listings Section (Below):**
- Silver tier server cards
- Standard card design
- Sorted by most recent first

**Example Layout:**
```
┌─────────────────────────────────────────┐
│  🌟 FEATURED SERVERS (Gold Tier)        │
│  ┌──────────────────────────────────┐  │
│  │ 🥇 [Gold Server Name]            │  │
│  │ [Banner Image]                   │  │
│  │ Players: 45/60 🟢                │  │
│  │ [Description...]                 │  │
│  │ [Join Server] [Discord]          │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  COMMUNITY SERVERS (Silver Tier)        │
│  ┌────────────────┐ ┌────────────────┐ │
│  │ [Server Card]  │ │ [Server Card]  │ │
│  └────────────────┘ └────────────────┘ │
└─────────────────────────────────────────┘
```

### 2. User Dashboard
**Features by Tier:**

**Bronze Users:**
- View subscription status
- Manage bot settings
- Access support tickets
- View server statistics

**Silver Users:**
- All Bronze features
- "Create Server Post" button
- Server post editor:
  - Server name input
  - Description textarea (500 char limit)
  - Server IP input
  - Banner image upload
  - Discord invite link
- Edit/delete server post

**Gold Users:**
- All Bronze + Silver features
- "Create Featured Server Post" button
- Multi-server management:
  - Server 1 & Server 2 tabs
  - Separate settings for each
- Enhanced server post editor:
  - All Silver features
  - Player count toggle
  - Featured placement preview
- Beta features access badge
- Priority support indicator

### 3. Tier Badge System
**Visual Indicators:**

**Bronze Badge:**
```css
background: linear-gradient(135deg, #CD7F32, #8B4513);
border: 2px solid #CD7F32;
```

**Silver Badge:**
```css
background: linear-gradient(135deg, #C0C0C0, #808080);
border: 2px solid #C0C0C0;
```

**Gold Badge:**
```css
background: linear-gradient(135deg, #FFD700, #FFA500);
border: 2px solid #FFD700;
box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
```

### 4. API Endpoints Needed

**GET /api/server-listings**
- Returns all active server posts
- Separates Gold (featured) vs Silver (standard)
- Includes player counts for Gold servers

**POST /api/server-listings** (Silver+)
- Creates new server post
- Validates user tier
- Enforces tier-specific limits

**PUT /api/server-listings/:id** (Silver+)
- Updates existing server post
- Owner validation

**DELETE /api/server-listings/:id** (Silver+)
- Removes server post
- Owner validation

**GET /api/user/tier**
- Returns current user's subscription tier
- Returns feature access flags

---

## Discord Integration Points

### GCC (Grizzly Command Central) Channel Updates
The following channels in GCC Discord now reflect the updated tier structure:

**Bronze+ Access (All Subscribers):**
- `#grizzly-bot-invite` - Bot invitation link and setup guide
- `#bot-release-notes` - Latest updates and changelog
- `#integration-guides` - Nitrado integration, Patreon setup, troubleshooting
- `#patreon-feedback` - Feature requests, roadmap voting, community feedback
- `#grizzly-status` - Bot status and uptime monitoring
- `#open-a-ticket` - Support ticket creation (24-48hr response for Bronze/Silver)

**Gold-Exclusive Features in Discord:**
- Early beta access (posted in `#patreon-feedback`)
- Direct developer tagging (@Developer) for critical bugs
- Priority support (12-hour response time)

---

## Feature Comparison Table (For Website Display)

| Feature | Bronze ($6/mo) | Silver ($10/mo) | Gold ($15/mo) |
|---------|---------------|-----------------|---------------|
| **Discord Access** | All channels ✅ | All channels ✅ | All channels ✅ |
| **Nitrado Servers** | 1 server | 1 server | **2 servers** 🌟 |
| **Bot Commands** | Full access ✅ | Full access ✅ | Full access ✅ |
| **Support Response** | 24-48 hours | 24-48 hours | **12 hours** ⚡ |
| **Website Posting** | ❌ | ✅ Standard listing | **✅ Featured listing** 🌟 |
| **Server Showcase** | ❌ | Basic card | **Gold card + stats** 🌟 |
| **Beta Access** | ❌ | ❌ | **✅ Early access** 🌟 |
| **Developer Access** | ❌ | ❌ | **✅ Direct tagging** 🌟 |

---

## Implementation Checklist

### Phase 1: Backend (API)
- [ ] Create `server_posts` table in database
- [ ] Create `gold_server_posts` table with dual-server support
- [ ] Implement tier validation middleware
- [ ] Build server listing CRUD endpoints
- [ ] Add Patreon webhook integration for tier updates

### Phase 2: Frontend (UI)
- [ ] Create server browser page with featured/standard sections
- [ ] Build user dashboard with tier-specific features
- [ ] Implement server post creation form (Silver+)
- [ ] Implement enhanced server post form (Gold)
- [ ] Add tier badge components
- [ ] Create Gold server card component with live stats

### Phase 3: Integration
- [ ] Connect to Discord bot API for player counts
- [ ] Implement live server status checks
- [ ] Add beta feature flags for Gold users
- [ ] Build tier upgrade flow (Bronze → Silver → Gold)

### Phase 4: Testing
- [ ] Test tier-based access controls
- [ ] Verify Gold dual-server functionality
- [ ] Test featured listing display/sorting
- [ ] Validate player count refresh
- [ ] Cross-browser compatibility

---

## Technical Notes

### Player Count Integration
Gold server listings display live player counts from the Discord bot:

**API Endpoint:** `GET https://grizzlygaming-gg.com/api/server-stats/:service_id`
**Response:**
```json
{
  "service_id": "1234567",
  "server_name": "My DayZ Server",
  "player_count": 45,
  "max_players": 60,
  "status": "online",
  "last_updated": "2025-10-14T18:30:00Z"
}
```

### Tier Validation
Always validate user tier server-side before:
- Creating/editing server posts
- Enabling beta features
- Displaying Gold-exclusive UI elements
- Processing multi-server registrations

### Caching Strategy
- Cache server listings for 60 seconds (Gold)
- Cache standard listings for 5 minutes (Silver)
- Cache tier status for 15 minutes
- Invalidate on Patreon webhook events

---

## Support & Questions

For technical questions about this integration:
- Discord: #website-bot-support in GCC
- Email: dev@grizzlygaming-gg.com
- Documentation: https://grizzlygaming-gg.com/docs/api

**Last Updated:** October 14, 2025
**Document Version:** 1.0

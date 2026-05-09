# KUWAI — Session Request Log

A running log of every feature, fix, and design change requested.

---

## Design System & Branding

- **KUWAI uppercase** — brand name always `KUWAI` in all UI (reverted from lowercase experiment)
- **Dark / Light mode** — full dark/light mode support across all screens via `ThemeContext`
- **Warm social design** — pivot away from brutalist style to clean, minimal Apple-quality UI
- **Kuwait national blue** — `#0033A0` (Pantone 286C) as accent in light mode, `#4D80FF` in dark mode
- **No fontFamily** — relies on iOS SF Pro default

---

## Navigation & RTL

- **Arabic RTL support** — every screen, every element must be Arabic in Arabic mode and English in English mode
- **Arrow direction rule** — `‹` (`<`) for Arabic forward/send, `›` (`>`) for English; back buttons flip with the row direction
- **Back button RTL fix (CircleScreen)** — header `flexDirection` now flips so back button appears on the correct side in Arabic
- **Onboarding CTA arrow** — Arabic CTA was `›` (wrong), fixed to `‹`
- **Language select arrow** — Arabic card was `›`, fixed to `‹`
- **HachiScreen moment arrow** — hardcoded `→` replaced with language-aware `ar ? '‹' : '›'`

---

## Radar Screen

- **Radar redesign** — dark navy canvas (`#080C14`), blue sweep line, clean nearby card
- **Radar sweep animation** — sweep line with ghost trail, center blue dot with glow
- **Nearby card** — rounded card using theme colors, RTL support, status dot + label, Ionicons chevron
- **Profile button** — shows colored initial avatar instead of generic icon
- **Radar spinning** — fix pending (interrupted)

---

## Circle Screen (In-Circle Chat)

- **Poll button moved** — from header down to composer row, next to the live photo `◉` button
- **Poll button icon** — replaced `⊡` glyph with `bar-chart-outline` Ionicon
- **Place title centered** — header now has balancing spacer so title is always centered
- **Back button RTL** — header `flexDirection` flips in Arabic so `›` appears on the right
- **Circle slide-up animation** — circle slides up on open, messages push up from bottom
- **Messages persist** — fixed object-spread bug clobbering `$push`
- **Live photos render** — fixed live photo display in circle messages
- **Socket stability** — starts on polling, upgrades to WebSocket once stable

---

## Profile Screen

- **Remove follower/following/posts stats** — only the vault percentage remains as a metric
- **Vault % live from API** — `hachiAPI.getVault()` used directly, refreshes on focus
- **No nested tabs** — removed activity/circles tab layout, kept header + vault grid only

---

## The Treasury (Vault Grid)

- **Artifact tiles redesign** — went through multiple iterations:
  1. Brutalist monogram black squares → removed
  2. Category icons (colored circles) → removed (not unique per circle)
  3. Suggestions given: colored monogram, hashed color disc, geometric badge, emoji
  4. **Chosen: Option 3** — unique map disc with place name pin
- **Map disc implementation** — tried CartoDB tile `<Image>`, `MapView` + `overflow:hidden`, `MaskedView` + `MapView`, all had iOS clipping issues
- **Final working solution** — server fetches OSM/CartoDB tile → uploads to Cloudinary → stores `mapSnapshot` URL in Hachi model → client displays as plain `<Image>` (clips correctly with `borderRadius` + `overflow:hidden`)
- **No lock icons** — unvisited places show dimmed map, not a lock
- **Monogram fallback** — hashed color disc with 2-letter initials when no `mapSnapshot`
- **Venue circles cleanup** — delete circles without coordinates, only keep circles with valid lat/lng
- **The Avenues Mall & 360 Mall** — deleted all old circles, created these two with correct Kuwait coordinates

---

## Venue Circles (Server)

- **`mapSnapshot` field** — added to Hachi model
- **`generateMapSnapshots.js`** — script: fetches CartoDB tile → uploads to Cloudinary → stores URL
- **`cleanupVenueCircles.js`** — script: deletes venue circles with no coordinates
- **Vault API** — now returns `lat`, `lng`, `mapSnapshot`, `category` per circle
- **Vault filter** — only returns circles where `venueCoords.lat` and `venueCoords.lng` exist

---

## Flash Polls

- **Poll composer** — clean architecture, proper RTL/LTR alignment
- **Poll duration selector** — 15m / 30m / 1h options
- **Instant create + optimistic vote** — no waiting for server response
- **Vote no longer reverts** — fixed race condition on re-vote
- **Founder bypass** — polls work without location for founder account

---

## Settings Screen

- **KUWAI branding** — `kuwai · v1.1.3` version string, share messages use correct brand name
- **Delete account** — handled with loading state

---

## Notifications Screen

- **Redesign** — matches warm social design system, uses `useTheme()` instead of `useBrutColors()`
- **Unread dot** — appears on correct RTL side
- **Back nav** — `isRTL ? 'back ›' : '‹ back'` pattern

---

## i18n / Translations

- **`post.reposted`** — added in both `en.json` and `ar.json`
- **KUWAI → kuwai → KUWAI** — brand name changed to lowercase then reverted to uppercase; country name `Kuwait` stays title-case
- **All screens Arabic** — every hardcoded English string replaced with `t()` translation key

---

## Always-On Rules

- **Push after every change** — always `git push` immediately after each task
- **Never use locks in vault** — unvisited = dimmed, not locked
- **Every venue circle must have coordinates** — circles without lat/lng are deleted
- **Run `generateMapSnapshots.js`** after creating new venue circles

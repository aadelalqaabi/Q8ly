# 🇰🇼 Kuwait Now

**The Kuwait-first social network** – where Kuwaitis share, discuss, and discover everything happening in Kuwait: news, events, opinions, offers, and local life.

---

## Overview

Kuwait Now is a MERN + Expo React Native social media app built for Kuwait. It provides:
- A real-time **Kuwait Feed** with "For You" and "Following" tabs
- **Topics** – Kuwait-specific categories (Politics, Society, Traffic, Sports, etc.)
- **Spaces** – Community rooms organized by governorate or interest
- **Discover** – People, upcoming events, and offers
- **Kuwait Brief** – A twice-daily summary of what matters in Kuwait
- **Real-time Now Bar** – Live updates for breaking situations
- Full **posting** (text, photo, poll) with topic tagging
- **Likes, comments, reposts** with threaded replies
- **Notifications** via Socket.io + Expo push
- **Verified badges** for media, government, businesses, and public figures

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Mobile App | Expo React Native (iOS + Android) |
| State Management | Redux Toolkit |
| Navigation | React Navigation v6 |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Real-time | Socket.io |
| Auth | JWT |
| Media Uploads | Multer + Cloudinary |
| Deployment | Railway / Render / EAS |

---

## Project Structure

```
kuwait-now/
├── client/                 # Expo React Native app
│   ├── App.js
│   ├── app.json
│   └── src/
│       ├── components/     # Reusable UI components
│       │   ├── post/       # PostCard, CommentItem
│       │   ├── home/       # NowBar, KuwaitBriefCard
│       │   ├── profile/    # UserCard
│       │   ├── topic/      # TopicChip
│       │   └── discover/   # EventCard
│       ├── screens/        # App screens
│       │   ├── auth/       # Login, Register
│       │   ├── home/       # HomeScreen
│       │   ├── topics/     # TopicsScreen, TopicDetailScreen
│       │   ├── spaces/     # SpacesScreen, SpaceDetailScreen
│       │   ├── discover/   # DiscoverScreen, SearchScreen, EventDetailScreen
│       │   ├── profile/    # ProfileScreen, EditProfileScreen
│       │   ├── post/       # PostDetailScreen, CreatePostScreen
│       │   └── notifications/ # NotificationsScreen
│       ├── navigation/     # AppNavigator (React Navigation)
│       ├── store/          # Redux Toolkit store + slices
│       │   └── slices/     # auth, posts, topics, spaces, notifications, ui
│       ├── services/       # API (axios) + Socket.io client
│       ├── constants/      # Colors, districts, categories
│       └── utils/          # Helpers
│
└── server/                 # Node.js/Express backend
    ├── server.js           # Entry point
    ├── config/db.js        # MongoDB connection + indexes
    ├── models/             # Mongoose schemas
    │   ├── User.js
    │   ├── Post.js
    │   ├── Topic.js
    │   ├── Space.js
    │   ├── Comment.js
    │   ├── Notification.js
    │   ├── Event.js
    │   ├── Report.js
    │   └── KuwaitBrief.js
    ├── routes/             # Express routes
    ├── controllers/        # Business logic
    ├── middleware/         # Auth (JWT), validation, error handler
    ├── sockets/            # Socket.io handler
    └── utils/              # seedData.js
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or MongoDB Atlas)
- Cloudinary account (for image uploads)
- Expo CLI

### 1. Clone and install

```bash
git clone <repo-url>
cd kuwait-now

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure environment

```bash
# Server
cp server/.env.example server/.env
# Edit server/.env with your values

# Client – update API_URL in client/app.json extra config
```

### 3. Seed the database (topics + spaces)

```bash
cd server
node utils/seedData.js
```

### 4. Run development

```bash
# Terminal 1 – Start backend
cd server && npm run dev

# Terminal 2 – Start Expo
cd client && npx expo start
```

### 5. Docker Compose (optional)

```bash
# Starts MongoDB + backend server
docker-compose up -d

# Then run the Expo client separately
cd client && npx expo start
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/posts/feed` | Home feed |
| GET | `/api/posts/trending` | Trending posts |
| POST | `/api/posts` | Create post |
| POST | `/api/posts/:id/like` | Like/unlike |
| POST | `/api/posts/:id/repost` | Repost |
| GET | `/api/topics/trending` | Trending topics |
| GET | `/api/topics/:slug/posts` | Topic feed |
| POST | `/api/topics/:id/follow` | Follow/unfollow topic |
| GET | `/api/spaces` | All spaces |
| GET | `/api/spaces/:slug/feed` | Space feed |
| POST | `/api/spaces/:id/join` | Join/leave space |
| POST | `/api/users/:id/follow` | Follow/unfollow user |
| GET | `/api/notifications` | User notifications |
| GET | `/api/events` | Upcoming events |

---

## Socket.io Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `joinSpace(spaceId)` | Client→Server | Subscribe to space |
| `joinPost(postId)` | Client→Server | Subscribe to post comments |
| `newPost` | Server→Client | New post in feed |
| `newComment` | Server→Client | New comment on a post |
| `notification` | Server→Client | New notification |
| `nowBarUpdate` | Server→Client | Real-time Now Bar update |
| `typing` | Bidirectional | Typing indicator |

---

## Deployment

### Backend (Railway/Render)
```bash
# Set environment variables in dashboard
# Connect MongoDB Atlas URI
git push origin main
```

### Mobile (EAS Build)
```bash
cd client
eas build --platform all
eas submit --platform ios
eas submit --platform android
```

---

## Kuwait-Specific Features

- **Kuwait Now Bar** – Real-time strip at top of feed for live situations (sandstorms, parliament sessions, major accidents)
- **Kuwait Brief** – Twice-daily curated summary of 5–10 key items
- **6 Governorates** as Location Spaces (Al Asimah, Hawalli, Farwaniyah, Ahmadi, Jahra, Mubarak Al-Kabeer)
- **Arabic + English** topic names throughout
- **Kuwait flag color palette** (red `#C8102E`, green `#007A3D`, black `#000000`)
- **Verified badges** for Government, Media, Influencers, and Businesses

---

## MVP Checklist

- [x] Sign-up / Login (email or username)
- [x] User profiles with bio, district, stats
- [x] Home feed – For You + Following tabs
- [x] Text + photo posts with topic tagging
- [x] Topics: Politics, Society, Traffic, Events, Offers, Sports
- [x] Spaces (location + interest communities)
- [x] Likes, comments (threaded), reposts
- [x] Kuwait Brief card
- [x] Real-time Now Bar
- [x] Notifications (Socket.io + REST)
- [x] Search (users, topics, spaces)
- [x] Polls
- [x] Events with RSVP
- [x] Report & block system
- [x] Verified badges
- [x] Image uploads (Cloudinary)

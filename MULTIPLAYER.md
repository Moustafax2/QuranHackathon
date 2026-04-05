# QuranArena — Multiplayer Architecture Doc

This document explains the full multiplayer system added to QuranArena. It covers the database, real-time infrastructure, Edge Functions, frontend integration, and what's needed from the auth team to connect everything.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [File Map](#file-map)
4. [Database Schema](#database-schema)
5. [Supabase Edge Functions (Backend)](#supabase-edge-functions-backend)
6. [Real-Time Architecture](#real-time-architecture)
7. [Frontend Hooks & Pages](#frontend-hooks--pages)
8. [Game Flow (End to End)](#game-flow-end-to-end)
9. [Auth Integration Guide (For Auth Team)](#auth-integration-guide-for-auth-team)
10. [Environment Variables](#environment-variables)
11. [Deployment](#deployment)
12. [Testing](#testing)

---

## Overview

QuranArena is a multiplayer Quran competition app. Players create or join rooms, then compete in real-time to answer questions about Quran verses. The backend is entirely on **Supabase** (Postgres database + Realtime channels + Edge Functions). The frontend is **Next.js 16** deployed on **Vercel**.

Two game modes are currently implemented:
- **Multiple Choice (Next Ayah)**: A verse is shown, pick the correct next ayah from 4 options. Fastest correct answer gets a speed bonus.
- **Buzzer (Next Ayah)**: A verse is shown, first player to buzz in gets to recite the next ayah. Host confirms correctness.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind | UI and client-side logic |
| Database | Supabase Postgres | Players, rooms, games, scores, friends, mistakes |
| Real-time | Supabase Realtime (Presence + Broadcast) | Live player lists, game event sync |
| Backend Logic | Supabase Edge Functions (Deno) | Room CRUD, game logic, scoring, question generation |
| Quran Data | quran.com API v4 | Verse text, chapters, audio, translations |
| Auth | quran.foundation OAuth2 + PKCE + OIDC | User identity (handled by auth teammate) |

---

## File Map

### New Files Added

```
supabase/
├── config.toml                              # Supabase local config
├── migrations/
│   └── 001_initial_schema.sql               # Full DB schema (8 tables + RLS)
└── functions/
    ├── _shared/
    │   ├── supabase-admin.ts                # Admin client, broadcast helper, CORS
    │   └── question-generator.ts            # Generates MC questions from quran.com API
    ├── create-room/
    │   └── index.ts                         # POST: create a game room
    ├── join-room/
    │   └── index.ts                         # POST: join a room by code
    ├── start-game/
    │   └── index.ts                         # POST: generate questions & start game
    └── submit-answer/
        └── index.ts                         # POST: submit answer/buzzer, scoring, round progression

src/lib/
├── supabase/
│   ├── client.ts                            # Browser-side Supabase client
│   ├── server.ts                            # Server-side Supabase client (for Server Components)
│   └── types.ts                             # TypeScript types for all DB tables
├── hooks/
│   ├── useAuth.ts                           # Auth hook (PLACEHOLDER — needs auth wiring)
│   ├── useRoom.ts                           # Presence-based lobby hook (live player list)
│   └── useGame.ts                           # Broadcast-based game state hook
└── game/
    └── state-machine.ts                     # Game phases, event types, state reducer
```

### Modified Files

| File | What Changed |
|---|---|
| `package.json` | Added `@supabase/supabase-js`, `@supabase/ssr` |
| `tsconfig.json` | Excluded `supabase/functions` from TS (they're Deno, not Node) |
| `src/app/play/page.tsx` | Create/join rooms via Edge Functions instead of mock navigation |
| `src/app/play/[roomId]/page.tsx` | Full rewrite: real-time lobby (Presence) + live game (Broadcast) |
| `src/app/leaderboard/page.tsx` | Queries Supabase for real scores instead of mock data |

---

## Database Schema

**Supabase project**: `xokscxfcpcashywsgtil` (QuranArena)
**Region**: East US (North Virginia)

All tables have Row Level Security (RLS) enabled. The Edge Functions use the **service role key** to bypass RLS for server-side operations.

### Tables

#### `players`
Stores user profiles. Linked to quran.com accounts via `quran_foundation_uid`.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Supabase auth user ID |
| `quran_foundation_uid` | text (unique) | `sub` claim from quran.com OAuth `id_token` |
| `display_name` | text | Shown in game UI |
| `avatar_url` | text | Optional profile picture |
| `total_points` | int | Lifetime accumulated points |
| `total_wins` | int | Total games won |
| `created_at` | timestamptz | Account creation time |

#### `rooms`
Active game rooms.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `code` | char(6) (unique) | Room code players share (e.g. "A3KF9Z") |
| `host_id` | uuid (FK → players) | Who created the room |
| `game_mode` | text | `'buzzer'` or `'multiple-choice'` |
| `status` | text | `'lobby'` → `'in_progress'` → `'finished'` |
| `settings` | jsonb | `{num_rounds, surah_filter, time_per_question}` |
| `created_at` | timestamptz | |

#### `room_players`
Join table: which players are in which room, with per-game scores.

| Column | Type | Description |
|---|---|---|
| `room_id` | uuid (FK → rooms) | Composite PK |
| `player_id` | uuid (FK → players) | Composite PK |
| `score` | int | Score for this game session |
| `joined_at` | timestamptz | |

#### `games`
One record per game session (a room can host multiple games).

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `room_id` | uuid (FK → rooms) | |
| `started_at` | timestamptz | |
| `ended_at` | timestamptz | null until game finishes |
| `total_rounds` | int | Number of questions |
| `winner_id` | uuid (FK → players) | null until game finishes |

#### `game_rounds`
Pre-generated questions. All created at game start (not mid-game) to avoid API latency during play.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `game_id` | uuid (FK → games) | |
| `round_number` | int | 1-indexed |
| `prompt_verse_key` | text | e.g. "93:1" — the verse shown to players |
| `correct_verse_key` | text | e.g. "93:2" — the correct next ayah |
| `prompt_text` | text | Arabic text of the prompt verse |
| `correct_text` | text | Arabic text of the correct answer |
| `options` | jsonb | MC mode: array of `{verse_key, text}` JSON strings |
| `started_at` | timestamptz | When this round started |
| `ended_at` | timestamptz | When all players answered |

#### `round_answers`
Individual player answers for each round.

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | |
| `round_id` | uuid (FK → game_rounds) | |
| `player_id` | uuid (FK → players) | Unique per (round_id, player_id) |
| `answer_verse_key` | text | What the player picked (null for buzzer) |
| `is_correct` | boolean | |
| `server_received_at` | timestamptz | Server timestamp — used for buzzer ordering |
| `points_awarded` | int | 0 if wrong, 10-15 if correct (speed bonus) |

#### `friends`
Friend relationships between players.

| Column | Type | Description |
|---|---|---|
| `player_a` | uuid (FK → players) | Canonical order: player_a < player_b |
| `player_b` | uuid (FK → players) | |
| `status` | text | `'pending'` or `'accepted'` |
| `created_at` | timestamptz | |

#### `verse_mistakes`
Tracks which verses a player gets wrong (for study recommendations).

| Column | Type | Description |
|---|---|---|
| `player_id` | uuid (FK → players) | Composite PK |
| `verse_key` | text | e.g. "2:255" — Composite PK |
| `mistake_count` | int | Incremented each time |
| `last_mistake_at` | timestamptz | |

---

## Supabase Edge Functions (Backend)

Edge Functions run on Supabase's Deno runtime. They use the **service role key** (automatically available as `SUPABASE_SERVICE_ROLE_KEY` env var) to bypass RLS and act as the trusted server.

All functions accept POST requests with JSON bodies and return JSON responses.

### `create-room`

**Purpose**: Create a new game room.

**Request**:
```json
{
  "player_id": "uuid",
  "game_mode": "multiple-choice" | "buzzer",
  "settings": {                              // optional
    "num_rounds": 10,
    "surah_filter": [93, 94, 95] | null,     // null = short surahs (Juz 30)
    "time_per_question": 30
  }
}
```

**Response**:
```json
{ "room_id": "uuid", "code": "A3KF9Z" }
```

**Logic**: Generates a 6-character room code (A-Z, 2-9, no ambiguous chars), inserts into `rooms` + `room_players`, returns the code.

### `join-room`

**Purpose**: Join an existing room by code.

**Request**:
```json
{ "player_id": "uuid", "room_code": "A3KF9Z" }
```

**Response**:
```json
{
  "room_id": "uuid",
  "code": "A3KF9Z",
  "host_id": "uuid",
  "game_mode": "multiple-choice",
  "settings": { ... }
}
```

**Validations**: Room must exist, status must be `'lobby'`, player count < 8, handles duplicate joins gracefully.

### `start-game`

**Purpose**: Host starts the game. Generates all questions upfront.

**Request**:
```json
{ "room_id": "uuid", "player_id": "uuid" }
```

**Response**:
```json
{ "game_id": "uuid", "total_rounds": 10 }
```

**Logic**:
1. Verifies player is the host and room is in lobby
2. Calls `generateQuestions()` which fetches verses from quran.com API v4
3. For each round: picks a random verse, the next verse is the correct answer, 3 distractors from the same surah
4. Inserts `games` + `game_rounds` rows
5. Updates room status to `'in_progress'`
6. **Broadcasts `round:start`** for round 1 to all players via Realtime

### `submit-answer`

**Purpose**: Player submits an answer or buzzes in. Handles scoring, mistake tracking, round progression, and game end.

**Request**:
```json
{
  "game_id": "uuid",
  "round_id": "uuid",
  "player_id": "uuid",
  "answer_verse_key": "93:2",     // MC mode
  "is_buzzer": false              // true for buzzer mode
}
```

**Response (MC)**:
```json
{ "is_correct": true, "points_awarded": 15 }
```

**Response (Buzzer)**:
```json
{ "buzzer_winner": true }
```

**Scoring**:
- Correct answer: 10 base points + speed bonus (5 for first, 4 for second, etc.)
- Wrong answer: 0 points
- Wrong answers also insert/update `verse_mistakes` for that player + verse

**Round Progression**:
When all players have answered a round:
1. Broadcasts `round:end` with correct answer and all scores
2. Updates `room_players.score` for each player
3. If more rounds remain: broadcasts `round:start` for next round
4. If final round: broadcasts `game:end`, updates `players.total_points` and `players.total_wins`, sets room status to `'finished'`

---

## Real-Time Architecture

Supabase Realtime provides two mechanisms we use:

### Presence (Lobby)

**Channel**: `room:{room_code}` (e.g. `room:A3KF9Z`)

Used in the lobby to show who's currently in the room. Each player tracks their presence with `{player_id, display_name}`. When someone opens/closes the room page, they automatically appear/disappear from the player list.

**Hook**: `useRoom()` in `src/lib/hooks/useRoom.ts`

### Broadcast (Game Events)

**Channel**: `game:{game_id}`

Used during gameplay. The Edge Functions broadcast events to this channel. The client listens and updates the game state via a reducer.

**Events**:

| Event | Direction | Payload |
|---|---|---|
| `round:start` | Server → All | Round data: prompt verse, options, round number |
| `answer:result` | Server → All | Who answered, correct/wrong, points |
| `buzzer:winner` | Server → All | Who buzzed first |
| `round:end` | Server → All | Correct answer, all scores |
| `game:end` | Server → All | Final scores, winner |

**Hook**: `useGame()` in `src/lib/hooks/useGame.ts`

**Important**: Players do NOT broadcast directly. They send HTTP POST requests to Edge Functions, and the Edge Functions broadcast authoritative results. This prevents cheating.

---

## Frontend Hooks & Pages

### `useAuth()` — `src/lib/hooks/useAuth.ts`

**STATUS: PLACEHOLDER — Needs auth team to wire up.**

Returns `{ player, loading }`. Currently reads from Supabase auth session and looks up the `players` table. The auth team needs to connect this to the quran.com OAuth flow (see Auth Integration Guide below).

### `useRoom(roomCode, currentPlayer, hostId)` — `src/lib/hooks/useRoom.ts`

Manages Presence for the lobby. Returns `{ players, isConnected, error }`.

### `useGame(gameId, playerId)` — `src/lib/hooks/useGame.ts`

Manages Broadcast subscription for the active game. Returns `{ gameState, submitAnswer, pressBuzzer }`.

### `src/lib/game/state-machine.ts`

Defines game phases (`lobby` → `round_active` → `round_result` → `game_over`), event types, and a pure reducer function `reduceGameState()`.

### Pages

- **`/play`** — Game mode selection. Create room or join by code. Calls `create-room` / `join-room` Edge Functions.
- **`/play/[roomId]`** — The game room. Shows lobby (Presence) until host starts, then switches to the game UI (Broadcast). Handles MC options, buzzer button, score display, round results, and game over screen.
- **`/leaderboard`** — Queries `players` table for global rankings. Queries `friends` table for friends-only view.

---

## Game Flow (End to End)

```
1. Player A opens /play, selects "Multiple Choice", clicks "Create Room"
   → Calls create-room Edge Function
   → Gets room code "A3KF9Z"
   → Redirected to /play/A3KF9Z

2. Player A is in the lobby. useRoom() subscribes to Presence on channel room:A3KF9Z.
   Player A appears in the player list.

3. Player B opens /play, enters "A3KF9Z", clicks "Join"
   → Calls join-room Edge Function
   → Redirected to /play/A3KF9Z
   → Player B appears in Player A's player list (Presence)

4. Player A (host) clicks "Start Game"
   → Calls start-game Edge Function
   → Edge Function fetches 10 random verses from quran.com API
   → Generates 10 "next ayah" multiple-choice questions
   → Inserts game + rounds into database
   → Broadcasts round:start for round 1

5. Both players see the first question appear simultaneously.
   Each player picks an answer → calls submit-answer Edge Function.
   Edge Function checks correctness, calculates points, broadcasts answer:result.

6. When both players have answered:
   → Edge Function broadcasts round:end with scores
   → Edge Function broadcasts round:start for round 2
   → Repeat until round 10

7. After final round:
   → Edge Function broadcasts game:end with final scores + winner
   → Updates players.total_points and players.total_wins
   → Room status set to "finished"
   → Both players see the Game Over screen with final rankings
```

---

## Auth Integration Guide (For Auth Team)

### What's Already Done

- Supabase client is set up (`src/lib/supabase/client.ts`)
- `useAuth()` hook exists as a placeholder (`src/lib/hooks/useAuth.ts`)
- The `players` table has a `quran_foundation_uid` column for linking
- OAuth credentials are in `.env.local` (`QF_CLIENT_ID`, `QF_CLIENT_SECRET`)

### What You Need To Do

#### 1. Set up the OAuth flow

The quran.foundation uses **OAuth2 Authorization Code flow with PKCE + OIDC**.

**Endpoints** (from `.env.local`):
- OAuth: `https://prelive-oauth2.quran.foundation` (or production equivalent)
- User API: `https://prelive-apis.quran.foundation/auth/v1`

**Full flow**:
1. Generate PKCE parameters (`code_verifier`, `code_challenge`) and a random `state`
2. Redirect user to quran.foundation hosted login:
   ```
   https://prelive-oauth2.quran.foundation/authorize?
     client_id=YOUR_CLIENT_ID&
     response_type=code&
     redirect_uri=http://localhost:3000/auth/callback&
     scope=openid+offline_access+user&
     state=random_state&
     code_challenge=CHALLENGE&
     code_challenge_method=S256
   ```
3. User logs in at quran.foundation
4. Redirected back to `/auth/callback?code=AUTH_CODE&state=STATE`
5. **On your backend** (Next.js API route), exchange the code for tokens:
   ```
   POST https://prelive-oauth2.quran.foundation/oauth2/token
   Body: {
     grant_type: "authorization_code",
     code: AUTH_CODE,
     code_verifier: VERIFIER,
     redirect_uri: "http://localhost:3000/auth/callback",
     client_id: QF_CLIENT_ID,
     client_secret: QF_CLIENT_SECRET
   }
   ```
6. You get back: `access_token`, `refresh_token`, `id_token`

**Docs**: https://api-docs.quran.foundation/docs/tutorials/oidc/user-apis-quickstart

#### 2. Extract the user identity

The `id_token` is a JWT. Decode it to get the `sub` claim — this is the quran.com user ID.

```typescript
import { jwtDecode } from "jwt-decode";

const decoded = jwtDecode(id_token);
const quranFoundationUid = decoded.sub;  // e.g. "abc123"
const displayName = decoded.name || decoded.preferred_username || "Player";
```

#### 3. Create or sign in the Supabase user

You need to create a Supabase auth session for this user. Two approaches:

**Option A: Supabase Custom Token (Recommended)**

Use the Supabase admin client (server-side) to create a custom JWT and sign the user in:

```typescript
// In your /auth/callback API route (server-side)
import { createClient } from "@supabase/supabase-js";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // server-side only!
);

// Upsert the player in the players table
const { data: player } = await adminSupabase
  .from("players")
  .upsert({
    quran_foundation_uid: quranFoundationUid,
    display_name: displayName,
  }, { onConflict: "quran_foundation_uid" })
  .select()
  .single();

// Sign the user into Supabase auth
// This creates a Supabase session the client can use
const { data: authData } = await adminSupabase.auth.admin.createUser({
  email: `${quranFoundationUid}@quran.foundation`,  // synthetic email
  user_metadata: { display_name: displayName },
  email_confirm: true,
});
```

**Option B: Supabase signInWithIdToken**

If you configure Supabase to accept quran.foundation as an OIDC provider:

```typescript
const supabase = createClient(...);
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: "oidc",
  token: id_token,
});
```

This requires configuring a custom OIDC provider in the Supabase dashboard under Auth > Providers.

#### 4. Wire up the useAuth hook

The current `useAuth()` hook already reads from `supabase.auth.getUser()` and fetches the player row. Once you create Supabase auth sessions in step 3, the hook will automatically work.

The critical contract is:
- **`player.id`** must be a valid UUID in the `players` table
- **`player.display_name`** must be set (shown in game UI)
- The Supabase auth session must be active (cookies/localStorage)

#### 5. Make User API calls

To use quran.com User APIs (bookmarks, streaks — required by hackathon), pass the `access_token` from step 1:

```typescript
const response = await fetch(
  "https://prelive-apis.quran.foundation/auth/v1/bookmarks",
  {
    headers: {
      "x-auth-token": accessToken,
      "x-client-id": process.env.QF_CLIENT_ID!,
    },
  }
);
```

Available scopes: `openid`, `offline_access`, `user`, `bookmark`, `collection`, `reading_session`, `preference`, `goal`, `streak`

#### 6. Create the callback route

Create `src/app/auth/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  // 1. Verify state matches what you stored
  // 2. Exchange code for tokens (server-side)
  // 3. Decode id_token, extract sub
  // 4. Upsert player in Supabase
  // 5. Create Supabase auth session
  // 6. Redirect to /play or /

  return NextResponse.redirect(new URL("/", request.url));
}
```

#### 7. Add a login button

Add a login button/page that redirects to the quran.foundation authorization URL. The play page already shows "Sign in to create or join a room" when no user is authenticated.

### Key Points

- The `players.id` column = Supabase auth user UUID. This is used everywhere (room creation, answer submission, scoring).
- The `players.quran_foundation_uid` column = quran.com's `sub` claim. This links the two systems.
- The `useAuth()` hook auto-refreshes on auth state changes — just make sure the Supabase session is created correctly.
- Edge Functions use the **service role key** and don't check auth — they trust the `player_id` in the request body. For production, you should validate the auth token in each Edge Function. For the hackathon, this is fine.

---

## Environment Variables

### `.env.local` (committed values redacted)

```env
# Quran Foundation OAuth
QF_ENV=production
QF_CLIENT_ID=<your-client-id>
QF_CLIENT_SECRET=<your-client-secret>       # KEEP SECRET — server-side only

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xokscxfcpcashywsgtil.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Server-side only (for API routes that need admin access)
# SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard Settings > API>
```

**Note**: Edge Functions automatically have access to `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — you don't need to set these manually.

---

## Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Import repo in Vercel
3. Add environment variables in Vercel dashboard (same as `.env.local`)
4. Deploy

### Backend (Supabase)

Already deployed. The Edge Functions are live at:
- `https://xokscxfcpcashywsgtil.supabase.co/functions/v1/create-room`
- `https://xokscxfcpcashywsgtil.supabase.co/functions/v1/join-room`
- `https://xokscxfcpcashywsgtil.supabase.co/functions/v1/start-game`
- `https://xokscxfcpcashywsgtil.supabase.co/functions/v1/submit-answer`

To redeploy after changes:
```bash
npx supabase functions deploy <function-name> --no-verify-jwt
```

---

## Testing

### Quick test with curl

```bash
# 1. Insert test players (run in Supabase SQL Editor)
INSERT INTO players (id, display_name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'TestPlayer1'),
  ('22222222-2222-2222-2222-222222222222', 'TestPlayer2');

# 2. Create a room
curl -X POST "https://xokscxfcpcashywsgtil.supabase.co/functions/v1/create-room" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"player_id":"11111111-1111-1111-1111-111111111111","game_mode":"multiple-choice"}'

# 3. Join the room (use the code from step 2)
curl -X POST "https://xokscxfcpcashywsgtil.supabase.co/functions/v1/join-room" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"player_id":"22222222-2222-2222-2222-222222222222","room_code":"CODE_FROM_STEP_2"}'

# 4. Start the game (host only)
curl -X POST "https://xokscxfcpcashywsgtil.supabase.co/functions/v1/start-game" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"room_id":"ROOM_ID","player_id":"11111111-1111-1111-1111-111111111111"}'

# 5. Submit answers (get round_id from game_rounds table)
curl -X POST "https://xokscxfcpcashywsgtil.supabase.co/functions/v1/submit-answer" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"game_id":"GAME_ID","round_id":"ROUND_ID","player_id":"11111111-1111-1111-1111-111111111111","answer_verse_key":"VERSE_KEY"}'

# 6. Clean up (run in Supabase SQL Editor)
TRUNCATE round_answers, verse_mistakes, game_rounds, games, room_players, rooms, friends, players CASCADE;
```

### Already tested (April 5, 2026)

Full end-to-end test completed successfully:
- Created room with code "SNLAQX"
- 3 test players joined
- Game started with 10 rounds (questions from Surah An-Nas, etc.)
- Scoring worked: first correct answer got 15 pts (10 + 5 speed bonus), third got 13 pts
- Wrong answers tracked in verse_mistakes
- All data persisted correctly in Supabase

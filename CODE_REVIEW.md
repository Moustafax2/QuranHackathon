# QalamSpace Code Review - Full Issue Report

**Date:** 2026-04-09
**Reviewed by:** Claude (automated review of entire codebase)
**Branch:** `competitive-mode-ui-fixes`

---

## Project Overview

QalamSpace is a Quran memorization and multiplayer competition platform built with:
- **Next.js 16** (App Router) + React 19
- **Supabase** (Postgres, Edge Functions, Realtime)
- **Tailwind CSS v4**
- **FSRS / SM-2** spaced repetition algorithms
- **Quran.com API v4** for verse data, translations, and audio

### Core Features
1. **Compete** - Live multiplayer quiz rooms (multiple-choice, fill-in-blank, word-meaning, buzzer)
2. **Train** - Flashcards with spaced repetition, memorization tester, vocabulary drills
3. **Read Quran** - Full text, audio, search, bookmarks, page/surah views
4. **Leaderboard** - Global and friend rankings

### Architecture
```
Browser --> Next.js API Routes --> Supabase Edge Functions --> Supabase DB
              |                                                    ^
              |                                                    |
              +-- Supabase Realtime (Broadcast + Presence) --------+
              |
              +-- Quran.com API v4 (verses, translations, audio)
```

---

## Issues Summary

| Priority | Category | Count |
|----------|----------|-------|
| P0 (Critical) | Security / Cheating | 4 |
| P1 (High) | Security / Data Integrity | 10 |
| P2 (Medium) | Bugs / Error Handling | 15 |
| P3 (Low) | Performance / Code Quality | 14 |
| **Total** | | **43** |

---

## P0 - Critical Issues

### 1. Correct answer leaked to all clients via WebSocket
- **Files:** `supabase/functions/start-game/index.ts:140`, `src/lib/game/state-machine.ts:13-14`
- **Issue:** The `round:start` broadcast payload includes `correct_verse_key`. Any player can open browser DevTools, inspect the Realtime WebSocket messages, and see the correct answer before responding.
- **Impact:** Trivial cheating in all game modes.
- **Fix:** Remove `correct_verse_key` from the broadcast. Only send it in the `round:end` event after all players have answered.

### 2. Debug telemetry code left in production
- **File:** `src/lib/corpus/canonicalization.ts:125-145`
- **Issue:** Hardcoded `fetch('http://127.0.0.1:7928/ingest/...')` calls with debug session IDs. These fire on every canonicalization call, silently sending data to localhost.
- **Impact:** Silent network requests in production, potential data leak if port is open, noise in error logs.
- **Fix:** Delete the debug fetch blocks entirely.

### 3. Dev auth endpoint has no production guard
- **File:** `src/app/api/auth/qf/dev-login/route.ts:63-75`
- **Issue:** Creates fake sessions with hardcoded tokens (`"dev-access-token"`, `"dev-id-token"`). No `NODE_ENV === 'production'` check.
- **Impact:** If accessible in production, anyone can create an authenticated session as any dev user.
- **Fix:** Add `if (process.env.NODE_ENV === 'production') return NextResponse.json({ error: 'Not available' }, { status: 404 })` at the top.

### 4. Guest token endpoint is an abuse vector
- **File:** `src/app/api/multiplayer/guest-token/route.ts:4-20`
- **Issue:** No rate limiting, no CAPTCHA, no session binding. Anyone can call `POST /api/multiplayer/guest-token` in a loop to create unlimited guest player rows.
- **Impact:** Database pollution, potential DoS, inflated leaderboard.
- **Fix:** Add rate limiting (e.g., IP-based via Upstash or middleware). Consider tying guest tokens to a session cookie.

---

## P1 - High Priority Issues

### 5. XSS via dangerouslySetInnerHTML (3 locations)
- **Files:**
  - `src/components/quran/VerseDisplay.tsx:47` (translation text)
  - `src/app/quran/search/page.tsx:85` (search result translations)
  - `src/components/flashcard/FlashcardReview.tsx:417-430` (Hans Wehr definitions)
- **Issue:** HTML from external APIs rendered without sanitization.
- **Impact:** If Quran.com API or Hans Wehr data is compromised, arbitrary JS executes in users' browsers.
- **Fix:** Install `dompurify` and sanitize: `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(text) }}`

### 6. Race condition in score updates (non-atomic read-write)
- **File:** `supabase/functions/submit-answer/index.ts:231-247`
- **Issue:** `endRound()` reads `room_players.score`, adds points in JS, writes back. Two concurrent endRound calls cause lost updates.
- **Impact:** Incorrect final scores.
- **Fix:** Use a single SQL update: `UPDATE room_players SET score = score + $points WHERE ...`

### 7. Buzzer race condition (non-atomic check-then-insert)
- **File:** `supabase/functions/submit-answer/index.ts:45-76`
- **Issue:** "Check if already buzzed" + "insert buzz" is two separate queries. Two simultaneous buzzes from different players can both pass the check.
- **Impact:** Two players both declared buzz winner.
- **Fix:** Use a single `INSERT ... ON CONFLICT DO NOTHING RETURNING *` or a database function with row locking.

### 8. Infinite retry loop in question generation
- **File:** `supabase/functions/_shared/question-generator.ts:175`
- **Issue:** When `makeFillInBlankQuestion()` returns null, the code does `i--` to retry with no max-retry guard. If every verse in the pool is too short (e.g., very short surahs), this loops forever.
- **Impact:** Edge function hangs indefinitely, consuming resources.
- **Fix:** Add a retry counter: `if (++retries > numRounds * 3) break;`

### 9. No server-side round timer
- **Files:** `supabase/functions/submit-answer/index.ts`, room `settings.time_per_question`
- **Issue:** Room settings include `time_per_question: 30` but nothing enforces it. Round only ends when all players answer. If one player disconnects or AFK, the round hangs forever.
- **Impact:** Games get stuck indefinitely.
- **Fix:** Implement a server-side timer (e.g., Supabase pg_cron or a scheduled edge function) that auto-ends rounds after the timeout.

### 10. Service role key used in client-reachable code path
- **File:** `src/lib/qf-user/user-profile.ts:10-19`
- **Issue:** Makes direct HTTP requests using the Supabase service role key to upsert player profiles. This key bypasses all RLS.
- **Impact:** If the server is compromised, attacker gets full DB access.
- **Fix:** Use the authenticated Supabase client instead, or move this logic to an edge function.

### 11. RLS policies bypassed by edge functions
- **File:** `supabase/migrations/001_initial_schema.sql:108-142`
- **Issue:** RLS policies check `auth.uid()`, but edge functions use the service role key (which bypasses RLS). The Next.js API routes resolve player IDs from cookies/headers and pass them as parameters. Edge functions trust the `player_id` parameter without re-verification.
- **Impact:** If edge function URLs are discovered, anyone could call them directly with arbitrary `player_id`.
- **Fix:** Either validate a JWT in edge functions or add authorization middleware.

### 12. FSRS date serialization bug
- **File:** `src/app/api/flashcards/cards/route.ts:40-50`
- **Issue:** FSRS state from request bodies is stored with string dates (from JSON serialization) instead of `Date` objects. When fetched back, the FSRS scheduler expects `Date` instances.
- **Impact:** Scheduling calculations may break or produce wrong intervals.
- **Fix:** Parse date strings back to `Date` objects in the hydration layer.

### 13. Reviews endpoint has no pagination
- **File:** `src/app/api/flashcards/reviews/route.ts:5-40`
- **Issue:** GET returns ALL review logs with no `limit` or `offset`.
- **Impact:** Users with 10,000+ reviews get massive responses, causing timeouts and high memory usage.
- **Fix:** Add `limit` and `offset` query parameters, default to 100 per page.

### 14. Answer submission silently drops errors
- **File:** `src/lib/hooks/useGame.ts:149-162`
- **Issue:** `submitAnswer()` and `pressBuzzer()` fire `fetch()` without checking the response or catching errors.
- **Impact:** Players don't know their answer wasn't recorded. No retry mechanism.
- **Fix:** Check `response.ok`, show error toast on failure, optionally retry.

---

## P2 - Medium Priority Issues

### 15. Double-serialized JSON options
- **Files:** `supabase/functions/start-game/index.ts:99-101`, `src/lib/hooks/useGame.ts:97-106`
- **Issue:** Options are `JSON.stringify()`-ed before insertion into a `jsonb` column (which already serializes). Results in strings-inside-JSON that must be `JSON.parse()`-d back out.
- **Fix:** Store options as plain objects in the jsonb column.

### 16. `invokeSupabaseEdgeFunction` double-reads response body
- **File:** `src/lib/multiplayer/server.ts:25-28`
- **Issue:** The `.json()` catch tries `.text()` on the same response body. Once `.json()` is called, the body is consumed.
- **Fix:** Read body as text first, then try `JSON.parse()`.

### 17. `broadcastGameEvent` channel leak
- **File:** `supabase/functions/_shared/supabase-admin.ts:21-31`
- **Issue:** Each broadcast creates a new Supabase client, subscribes, sends, and removes the channel. `removeChannel` isn't awaited, and a new admin client is created every time.
- **Impact:** During rapid events, creates many transient connections and potential memory leaks.
- **Fix:** Reuse a single admin client per function invocation, or at minimum await cleanup.

### 18. Unvalidated route parameters
- **Files:** `src/app/quran/surah/[id]/page.tsx:12`, `src/app/quran/page-view/[pageNumber]/page.tsx:11`
- **Issue:** `parseInt(id, 10)` without bounds checking. `/quran/surah/999` makes an API call to a non-existent chapter.
- **Fix:** Validate `1 <= chapterNumber <= 114` and call `notFound()` otherwise.

### 19. Muyassar API has malformed file path
- **File:** `src/app/api/muyassar/route.ts:20-28`
- **Issue:** Path joins `"al-muyassar-fi-al-gharib.json"` twice (as both directory and filename), creating a double-nested path that likely doesn't exist.
- **Fix:** Verify and correct the file path.

### 20. Stale room state on page load
- **File:** `src/app/play/[roomId]/page.tsx:44-78`
- **Issue:** Room info fetched once on mount with no refresh. If the game starts during loading, user is stuck in lobby view.
- **Fix:** Subscribe to room status changes via Realtime or poll periodically.

### 21. No player count limit enforced server-side
- **File:** `src/app/play/[roomId]/page.tsx:192`
- **Issue:** UI shows "Players (N/8)" but `join-room` edge function has no cap.
- **Fix:** Add server-side check in `join-room` to reject when room is full.

### 22. Leaving a room doesn't clean up
- **File:** `src/app/play/page.tsx:247`
- **Issue:** "Leave" button navigates away without removing the player from the room or broadcasting a disconnect.
- **Impact:** Ghost players stay listed in lobby.
- **Fix:** Call a leave/disconnect API endpoint before navigating away.

### 23. Memorization progress is localStorage-only
- **File:** `src/lib/memorization/storage.ts:18-29`
- **Issue:** All memorization ratings stored in `localStorage` with no server sync. Unlike flashcards which sync to Supabase.
- **Impact:** Progress lost on device switch, incognito, or cleared storage.
- **Fix:** Sync to Supabase like the flashcard system does.

### 24. Missing error handling on Supabase inserts in edge functions
- **Files:** `supabase/functions/submit-answer/index.ts:86-92`, `supabase/functions/submit-answer/index.ts:120-127`
- **Issue:** Multiple `.insert()` calls don't check for errors. If insert fails, function continues and broadcasts incorrect state.
- **Fix:** Check `.error` on every Supabase operation.

### 25. No duplicate game event protection
- **File:** `src/lib/hooks/useGame.ts:125`
- **Issue:** Every broadcast event triggers `dispatch()` without deduplication. Network retries could cause double-counted scores.
- **Fix:** Add event ID tracking or idempotency checks in the reducer.

### 26. Race condition in flashcard flag toggle
- **File:** `src/app/train/flashcards/review/page.tsx:126-140`
- **Issue:** `handleFlag()` reads and writes `flaggedWords` state non-atomically. Rapid toggles lose updates.
- **Fix:** Use functional state update: `setFlaggedWords(prev => { ... })`.

### 27. Qutrub Python subprocess is fragile
- **File:** `src/lib/corpus/qutrub-integration.ts:87-95`
- **Issue:** Creates temp files in `process.cwd()` (won't work on serverless), hardcodes `python` (not `python3`), 5-second timeout silently fails.
- **Fix:** Use `os.tmpdir()`, environment variable for Python path, better error reporting.

### 28. SM-2 date deserialization may produce invalid Dates
- **File:** `src/lib/storage/flashcard-storage-supabase.ts:51-69`
- **Issue:** Reconstructs `Date` objects from localStorage without validating. If `state.due` is null/undefined, `new Date(null)` returns epoch instead of failing.
- **Fix:** Validate date strings before construction.

### 29. Unhandled promise rejection in useRoom
- **File:** `src/lib/hooks/useRoom.ts:62`
- **Issue:** `await channel.track({...})` can fail but error is not caught.
- **Impact:** Presence silently broken, player not shown in room.
- **Fix:** Wrap in try-catch, set error state on failure.

---

## P3 - Low Priority Issues

### 30. `verseTextCache` memory leak
- **File:** `src/components/flashcard/FlashcardReview.tsx:103`
- **Issue:** Module-level `Map` grows indefinitely, never cleared.
- **Fix:** Implement LRU eviction with a max size limit.

### 31. Guest player name collisions
- **File:** `src/app/api/multiplayer/guest-token/route.ts:7`
- **Issue:** `Math.floor(1000 + Math.random() * 9000)` yields only 9000 possible names. High collision probability.
- **Fix:** Use UUID-based names or append timestamp.

### 32. Guest IDs stored in sessionStorage
- **File:** `src/lib/hooks/useAuth.ts:48`
- **Issue:** Session storage clears when tab closes. Guest loses identity mid-game if tab is closed.
- **Fix:** Consider `localStorage` or a short-lived cookie for guest IDs.

### 33. No CSRF protection on POST endpoints
- **Files:** All `/api/multiplayer/*` and `/api/flashcards/*` routes
- **Issue:** No CSRF tokens or strict SameSite cookie enforcement.
- **Fix:** Add SameSite=Strict cookies and/or CSRF token validation.

### 34. No rate limiting on any API routes
- **Files:** All `/src/app/api/**` routes
- **Issue:** No protection against brute force or abuse on any endpoint.
- **Fix:** Add rate limiting middleware (e.g., Upstash `@upstash/ratelimit`).

### 35. `useRoom` re-renders on every presence sync
- **File:** `src/lib/hooks/useRoom.ts:44-58`
- **Issue:** Every presence sync creates a new array and calls `setPlayers`, triggering re-renders even if nothing changed.
- **Fix:** Deep-compare before setting state.

### 36. Unbounded verse fetching
- **File:** `src/lib/api/verses.ts:6-34`
- **Issue:** `getVersesByChapter()` fetches ALL pages sequentially. Al-Baqarah (286 verses) = 6+ API calls.
- **Fix:** Paginate on client side or implement infinite scroll.

### 37. No error boundaries for Quran pages
- **Files:** `src/app/quran/page.tsx`, `src/app/quran/surah/[id]/page.tsx`
- **Issue:** No `error.tsx` component. API failures show blank pages.
- **Fix:** Add `src/app/quran/error.tsx` with fallback UI.

### 38. Hardcoded string keys across files
- **Files:** Multiple files use `"qalamspace_guest_player"`, `"qalamspace_memorization_ratings"`, `"X-Guest-Player-Id"`
- **Fix:** Extract to `src/lib/constants.ts`.

### 39. No timeout on external API calls
- **File:** `src/app/api/memorization/question/route.ts:18-26`
- **Issue:** Fetches from Quran.com API without timeout. If API is slow, request hangs.
- **Fix:** Add `AbortController` with timeout.

### 40. Lexical DB cache has no TTL
- **File:** `src/lib/corpus/lexical-db.ts:4-14`
- **Issue:** `cachedDB` global variable cached indefinitely. DB updates require server restart.
- **Fix:** Add TTL-based cache expiration.

### 41. Hardcoded surah names in FlashcardReview
- **File:** `src/components/flashcard/FlashcardReview.tsx:71-95`
- **Issue:** 114 surah names hardcoded in component instead of importing from shared data.
- **Fix:** Import from `@/lib/data/chapters-data`.

### 42. Missing input validation on preferences API
- **File:** `src/app/api/flashcards/preferences/route.ts:33-55`
- **Issue:** No validation that `normalization_level` is a valid enum value. Client can send arbitrary strings.
- **Fix:** Validate against allowed values before saving.

### 43. Buzzer mode incomplete
- **File:** `src/app/play/page.tsx:54-62`
- **Issue:** Marked `available: false` in UI. Backend logic exists but buzzer result display and host confirmation flow are not fully wired up.
- **Impact:** Feature not usable yet.

---

## Recommendations

### Immediate (before demo/launch)
1. Remove debug telemetry code from `canonicalization.ts`
2. Add production guard to dev auth endpoint
3. Stop broadcasting `correct_verse_key` to clients
4. Add basic rate limiting to guest token endpoint

### Short-term (next sprint)
5. Sanitize all `dangerouslySetInnerHTML` usage with DOMPurify
6. Make score updates atomic in edge functions
7. Add server-side round timer
8. Fix infinite retry loop in question generation
9. Add error handling to answer submission in `useGame`
10. Fix double-serialized JSON options

### Medium-term (before production)
11. Add CSRF protection to all POST endpoints
12. Add rate limiting to all API routes
13. Implement server-side memorization progress sync
14. Add pagination to reviews endpoint
15. Add error boundaries to all route groups
16. Fix Qutrub subprocess for serverless deployment
17. Add input validation to all API routes

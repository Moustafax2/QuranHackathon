# Quran Foundation Auth Integration

## Architecture
- QuranArena now has two separate Quran Foundation integrations:
  - Content API auth in `src/lib/quran/*` using client credentials for public Quran content.
  - User auth in `src/lib/qf-user/*` using Authorization Code + PKCE + OIDC for end-user sessions and User APIs.
- The browser generates `state`, `nonce`, `code_verifier`, and `code_challenge`.
- The browser posts those values to `POST /api/auth/qf/login`.
- The server stores the login transaction in an encrypted HttpOnly cookie and returns the hosted login URL.
- Quran Foundation redirects back to `GET /api/auth/callback`.
- The callback route exchanges the code on the server, verifies the `id_token`, upserts the linked local player, and writes the encrypted session cookie.

## Environment Variables
- `QF_ENV`: `prelive` or `production`
- `QF_CLIENT_ID`: Quran Foundation OAuth client id
- `QF_CLIENT_SECRET`: Quran Foundation OAuth client secret
- `QF_SESSION_SECRET`: secret used to encrypt the local session and login transaction cookies
- `APP_URL`: base URL used for callback and post-logout redirects
- `QF_USER_API_BASE_URL`: optional override for User API base URL
- `QF_USER_SCOPES`: optional override for requested OAuth scopes
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: server-side key used for player upserts

## Login Flow
1. User opens `/login`.
2. The page generates browser-side PKCE and OIDC values.
3. `POST /api/auth/qf/login` stores the one-time login transaction in an encrypted HttpOnly cookie.
4. The user is redirected to the hosted Quran Foundation authorization page.
5. Quran Foundation redirects to `/api/auth/callback`.

Default requested scopes are `openid offline_access bookmark user`. `profile` and `email` are intentionally not requested by default because some clients appear not to be granted them.

## Callback Flow
1. `/api/auth/callback` reads `code` and `state`.
2. It validates `state` against the stored login transaction cookie.
3. It exchanges the code using the confidential-client token endpoint flow.
4. It verifies the returned `id_token` using OIDC discovery + JWKS.
5. It uses `sub` as the stable Quran Foundation identity.
6. It upserts the local `players` row and stores the local `player_id` in the session.
7. It clears the one-time login cookie and redirects into the app.

## Token Storage And Refresh
- The app session is stored in an encrypted HttpOnly cookie named `qf_session`.
- The one-time login transaction is stored in an encrypted HttpOnly cookie named `qf_login_txn`.
- Session payload includes:
  - `access_token`
  - `refresh_token`
  - `id_token`
  - `expires_at`
  - local `player_id`
  - derived user summary
- Session refresh happens server-side when the token is close to expiry.
- If refresh fails, the local session is cleared and the user must sign in again.

## Local Player Mapping
- `players.id` remains the local UUID primary key used by rooms, scores, and multiplayer.
- `players.quran_foundation_uid` stores the Quran Foundation `sub`.
- The callback flow upserts the player row using `quran_foundation_uid`.
- Additional profile fields added in migration `002_qf_user_profile_fields.sql`:
  - `qf_email`
  - `last_login_at`

## Integrated User API Endpoints
- Bookmarks are integrated through the server route `src/app/api/auth/qf/bookmarks/route.ts`.
- Server-side client lives in `src/lib/qf-user/user-api.ts`.
- Current implementation supports:
  - read user bookmarks
  - add ayah bookmark
  - delete bookmark by bookmark id
- Requests use:
  - `x-auth-token: <access_token>`
  - `x-client-id: <QF_CLIENT_ID>`

## UI Integration
- `src/lib/hooks/useAuth.ts` now reflects the Quran Foundation-backed app session.
- `src/lib/hooks/useBookmarks.ts` supports:
  - `qf` mode when signed in
  - `local` mode when signed out
- Header auth state is shown in `src/components/layout/Header.tsx`.
- Login page is `src/app/login/page.tsx`.
- Account page is `src/app/account/page.tsx`.

## Multiplayer Boundary
- Multiplayer writes now go through Next.js API routes under `src/app/api/multiplayer/*`.
- Those routes resolve `player_id` from the authenticated local session before calling Supabase Edge Functions.
- Existing Supabase Edge Functions were preserved; the browser no longer supplies arbitrary `player_id` in the normal UI flow.

## What Remains Local-Only
- The Quran content API integration remains separate and unchanged.
- Multiplayer realtime/game-state issues outside auth are still separate work:
  - non-host clients still need a durable `game_id` discovery path after game start
  - buzzer mode still needs full host-confirm/round-complete logic
- Signed-in bookmark writes depend on the current Quran Foundation bookmark endpoints and granted scopes; if those differ from the current docs, the UI will surface route errors instead of silently falling back.

## Local Development Shortcut
- A dev-only fake login helper exists at `POST /api/auth/qf/dev-login`.
- A dev-only browser UI exists at `/dev/auth`.
- It is enabled when `NODE_ENV !== production` or `ENABLE_DEV_AUTH=true`.
- You can seed a local session from an existing linked `players` row by sending:
  - `{ "playerId": "<uuid>" }`
  - or `{ "qfSub": "<quran_foundation_uid>" }`
- To inspect recent candidate players locally, call `GET /api/auth/qf/dev-login`.
- The `/dev/auth` page lists recent linked players and lets you create the local session cookie with one click.
- This creates the same app session cookie shape used by the real OAuth flow, but with placeholder tokens.
- Use it for local testing of app logic such as multiplayer and auth-gated UI. Do not use it to test real Quran Foundation User API calls that require a valid remote access token.

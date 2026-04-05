# Quran Foundation Migration

## Old Flow vs New Flow

- Old flow: the app called public-style Quran.com endpoints directly like `https://api.quran.com/api/v4/...` without OAuth2.
- New flow: server-side code now talks to the official Quran Foundation Content API at `{QF_API_BASE_URL}/content/api/v4/...` using OAuth2 client credentials and the required `x-auth-token` plus `x-client-id` headers.
- Audio is now fetched through an internal Next.js route so the browser never sees `QF_CLIENT_SECRET` or the upstream access token.

## Required Environment Variables

Copy `.env.example` to `.env.local` and set:

- `QF_ENV=prelive|production`
- `QF_CLIENT_ID=...`
- `QF_CLIENT_SECRET=...`
- `QF_AUTH_BASE_URL=...` optional override
- `QF_API_BASE_URL=...` optional override

Defaults:

- `prelive` uses `https://prelive-oauth2.quran.foundation` and `https://apis-prelive.quran.foundation`
- `production` uses `https://oauth2.quran.foundation` and `https://apis.quran.foundation`

The config rejects mixed prelive/production URL combinations.

## Token Caching

- Tokens are requested from `POST {authBaseUrl}/oauth2/token` with `grant_type=client_credentials` and `scope=content`.
- The access token is cached in memory on the server with a 60-second expiry buffer.
- There is no `refresh_token` flow.
- If a content request returns `401`, the cached token is cleared, a new token is fetched once, and the request is retried once.

## Local User State

- Bookmarks still use browser `localStorage`.
- The bookmark UI now goes through `BookmarksProvider` in `src/lib/user-state/bookmarks.tsx`, which isolates local user state from Quran content fetching.
- This makes it easier to swap the implementation to Quran Foundation User APIs later without rewriting verse/bookmark UI components.

## Future User API Integration Readiness

The app is now split into:

- Quran Foundation content integration in `src/lib/api/*` and `src/config/api.ts`
- Local user-state integration in `src/lib/user-state/bookmarks.tsx`

To add official Quran Foundation bookmark/note sync later, replace the bookmark provider implementation while keeping the existing components and hook contract.

## Features with Notes

- `chapters`, `chapter details`, `verses by chapter`, `verses by page`, and `chapter_recitations` were migrated to the authenticated Content API flow.
- Search now targets `/content/api/v4/search`. If the configured credentials/environment do not allow that endpoint, the page shows a graceful unavailable message instead of crashing.
- Quranic Arabic rendering is protected with `<meta name="google" content="notranslate">` plus `translate="no"` on Arabic Quran text containers.

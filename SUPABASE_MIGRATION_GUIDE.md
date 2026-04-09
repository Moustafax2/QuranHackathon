# Supabase Flashcard Migration Guide

## Overview

This guide explains how to deploy and test the Supabase migration for the flashcard system.

## Migration Status

✅ **Completed:**
- Created migration file: `supabase/migrations/002_flashcard_schema.sql`
- Updated TypeScript types in `src/lib/supabase/types.ts`
- Created Supabase storage layer: `src/lib/storage/flashcard-storage-supabase.ts`
- Updated all imports to use new storage layer
- Added automatic localStorage migration

## Deployment Steps

### Option 1: Via Supabase Dashboard (Recommended for Quick Testing)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/xokscxfcpcashywsgtil
   - Navigate to: SQL Editor

2. **Run the Migration**
   - Copy the contents of `supabase/migrations/002_flashcard_schema.sql`
   - Paste into the SQL Editor
   - Click "Run" to execute

3. **Verify Tables Created**
   - Navigate to: Table Editor
   - You should see 4 new tables:
     - `lexical_entries`
     - `user_flashcards`
     - `review_log`
     - `user_preferences`

### Option 2: Via Supabase CLI

1. **Login to Supabase**
   ```bash
   npx supabase login
   ```

2. **Link to Remote Project**
   ```bash
   npx supabase link --project-ref xokscxfcpcashywsgtil
   ```

3. **Push Migration**
   ```bash
   npx supabase db push
   ```

## Testing Checklist

### 1. Verify Database Schema

**In Supabase Dashboard → Table Editor:**

- [ ] `lexical_entries` table exists with correct columns
- [ ] `user_flashcards` table exists with correct columns
- [ ] `review_log` table exists with correct columns
- [ ] `user_preferences` table exists with correct columns

**Check Indexes (in SQL Editor):**
```sql
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('lexical_entries', 'user_flashcards', 'review_log', 'user_preferences')
ORDER BY tablename, indexname;
```

### 2. Test Row Level Security (RLS)

**Verify RLS is enabled:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('lexical_entries', 'user_flashcards', 'review_log', 'user_preferences');
```

All tables should show `rowsecurity = true`.

**Check RLS Policies:**
```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('lexical_entries', 'user_flashcards', 'review_log', 'user_preferences')
ORDER BY tablename, policyname;
```

### 3. Test Authentication Flow

**Prerequisites:**
- You need a valid user account in the `players` table
- The user must be authenticated via Supabase Auth

**Create a test user (if needed):**
```sql
-- Insert a test player
INSERT INTO players (id, display_name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Test User')
ON CONFLICT (id) DO NOTHING;
```

### 4. Test Application Flow

1. **Start the Development Server**
   ```bash
   npm run dev
   ```

2. **Navigate to Flashcards Hub**
   - Open: http://localhost:3000/train/flashcards
   - Check browser console for any errors

3. **Test localStorage Migration**
   - If you have existing localStorage data, it should automatically migrate
   - Check console for: "Successfully migrated data from localStorage to Supabase"
   - Verify data appears in Supabase dashboard

4. **Add Demo Cards**
   - Click "Quick Demo (5 cards)" button
   - Check browser console for errors
   - Verify cards appear in `user_flashcards` table in Supabase

5. **Start a Review Session**
   - Click "Start Review"
   - Review a card and rate it
   - Verify entry appears in `review_log` table

6. **Update Preferences**
   - Navigate to Settings
   - Change some preferences
   - Click "Save Settings"
   - Verify entry in `user_preferences` table

7. **Check Statistics**
   - Navigate to Stats page
   - Verify data loads correctly from Supabase

### 5. Test Data Isolation (RLS)

**Important:** This test requires two different authenticated users.

1. User A adds flashcards
2. User B logs in
3. User B should NOT see User A's flashcards
4. Each user should only see their own data

### 6. Test Export/Import

1. **Export Data**
   - Go to Settings
   - Click "Export Data"
   - Verify JSON file downloads

2. **Import Data**
   - Use the exported JSON
   - Call `importData()` function
   - Verify data appears in database

## Common Issues & Solutions

### Issue: "User not authenticated" error

**Solution:**
- Ensure you're logged in via Supabase Auth
- Check that `supabase.auth.getUser()` returns a valid user
- Verify the user exists in the `players` table

### Issue: RLS policy blocks query

**Symptoms:**
- Queries return empty results
- Console shows RLS policy violation

**Solution:**
- Verify `auth.uid()` matches the `user_id` in the table
- Check that RLS policies are correctly configured
- For testing, you can temporarily disable RLS:
  ```sql
  ALTER TABLE user_flashcards DISABLE ROW LEVEL SECURITY;
  ```
  (Remember to re-enable after testing!)

### Issue: Foreign key constraint violation

**Symptoms:**
- Error inserting into `user_flashcards`: "violates foreign key constraint"

**Solution:**
- Ensure the user exists in `players` table first
- Ensure `word_id` exists in `lexical_entries` table (if using FK)

### Issue: Migration already applied

**Solution:**
- Check existing migrations:
  ```sql
  SELECT * FROM supabase_migrations.schema_migrations;
  ```
- If migration exists, you can manually drop tables and re-run:
  ```sql
  DROP TABLE IF EXISTS review_log CASCADE;
  DROP TABLE IF EXISTS user_flashcards CASCADE;
  DROP TABLE IF EXISTS user_preferences CASCADE;
  DROP TABLE IF EXISTS lexical_entries CASCADE;
  ```

## Performance Testing

### Test Query Performance

**Get user flashcards (should use index):**
```sql
EXPLAIN ANALYZE
SELECT * FROM user_flashcards
WHERE user_id = '00000000-0000-0000-0000-000000000001';
```

**Get due cards (should use JSONB index):**
```sql
EXPLAIN ANALYZE
SELECT * FROM user_flashcards
WHERE user_id = '00000000-0000-0000-0000-000000000001'
AND (fsrs_state->>'due')::timestamptz <= NOW();
```

**Get review log (should use timestamp index):**
```sql
EXPLAIN ANALYZE
SELECT * FROM review_log
WHERE user_id = '00000000-0000-0000-0000-000000000001'
ORDER BY timestamp DESC
LIMIT 50;
```

All queries should show "Index Scan" rather than "Seq Scan" for good performance.

## Rollback Plan

If you need to rollback to localStorage:

1. **Revert imports in all files:**
   ```typescript
   // Change from:
   import { ... } from "@/lib/storage/flashcard-storage-supabase";
   
   // Back to:
   import { ... } from "@/lib/storage/flashcard-storage";
   ```

2. **Files to update:**
   - `src/lib/flashcard/session-manager.ts`
   - `src/lib/flashcard/intake-manager.ts`
   - `src/lib/flashcard/demo-helper.ts`
   - `src/app/train/flashcards/stats/page.tsx`
   - `src/app/train/flashcards/settings/page.tsx`
   - `src/app/train/flashcards/page.tsx`

3. **Remove migration call:**
   - In `src/app/train/flashcards/page.tsx`, remove the `migrateFromLocalStorage()` call

4. **Data is safe:**
   - localStorage data is never deleted (only marked as migrated)
   - You can continue using localStorage without data loss

## Next Steps

After successful migration:

1. **Populate Lexical Entries**
   - Create a script to load `public/data/lexical-db.json` into `lexical_entries` table
   - Or keep using JSON file for now (current approach)

2. **Add Authentication**
   - Integrate with quran.foundation OAuth (see MULTIPLAYER.md)
   - Ensure users are properly authenticated before accessing flashcards

3. **Monitor Performance**
   - Check query performance with real data
   - Add additional indexes if needed
   - Consider caching frequently accessed data

4. **Add Features**
   - Sync across devices (automatic with Supabase)
   - Collaborative learning features
   - Leaderboards and achievements

## Support

For issues or questions:
- Check Supabase logs in Dashboard → Logs
- Review browser console for client-side errors
- Check Network tab for failed API requests
- Verify environment variables are set correctly

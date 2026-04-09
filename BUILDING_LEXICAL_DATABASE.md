# Building the Lexical Database

## Problem

The flashcard system was showing only 5 words because the lexical database (`public/data/lexical-db.json`) only contains sample data for testing.

## Solution

A complete build script has been created to process Quranic morphological data and build a comprehensive lexical database.

## How to Build the Full Database

### Step 1: Install Dependencies

First, install the required dependencies (including `tsx`):

```bash
npm install
```

### Step 2: Download Morphological Data

The Quranic Arabic Corpus API is currently unavailable, so you'll need to download the morphological data file:

1. Visit https://corpus.quran.com/download
2. Enter your email address to download version 0.4
3. Save the downloaded file as: `public/data/quranic-corpus-morphology-0.4.txt`

### Step 3: Run the Build Script

To build the complete lexical database with all Quranic words:

```bash
npm run build-lexical-db:full
```

**Note:** This process will:
- Parse the morphological data file (77,429 word segments)
- Process and canonicalize thousands of unique words
- Take approximately **2-3 minutes** to complete
- Create a comprehensive database with all unique words from the Quran

### Alternative: Quick Sample Build

If you just want to regenerate the sample database (5 words):

```bash
npm run build-lexical-db
```

## What Happens During the Build

1. **Fetching**: Downloads morphological data for all 6,236 verses from corpus.quran.com
2. **Processing**: Extracts individual word segments with their linguistic information
3. **Canonicalization**: Groups words by their lemma (root form) and applies normalization rules
4. **Deduplication**: Merges duplicate entries and aggregates their examples
5. **Output**: Writes the complete database to `public/data/lexical-db.json`

## Expected Results

After building the full database, you should have:
- **Thousands of unique words** (verbs, nouns, particles)
- Each word with its canonical form, root, translations, and example locations
- Surah Al-Baqarah should show hundreds of words for new users
- All 114 surahs will have their complete vocabulary available

## Troubleshooting

### Build Fails or Times Out

If the API requests fail or timeout:
- Check your internet connection
- The Corpus API might be temporarily unavailable
- Try running the script again - it will resume from where it left off

### Database File is Too Large

The complete database will be several MB in size. This is normal and expected for the full Quran vocabulary.

## Technical Details

### Files Modified/Created

- `scripts/build-lexical-db.ts` - Main build script
- `src/lib/corpus/api-client.ts` - API client for Corpus API (already existed)
- `src/lib/corpus/canonicalization.ts` - Word normalization logic (already existed)
- `src/lib/corpus/lexical-db.ts` - Database loader (fixed to call `loadLexicalDB()`)

### Bug Fixes Applied

1. **Missing Database Load**: The `getWordsBySurah()` function was accessing an empty `cachedDB` because `loadLexicalDB()` was never called. Fixed by adding `await loadLexicalDB()` calls.
2. **Incomplete Database**: The sample database only had 5 words. Solved by creating a full build script.

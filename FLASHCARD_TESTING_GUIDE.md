# QalamSpace Flashcard System - Testing Guide

## Quick Start

The development server should already be running at: **http://localhost:3000**

If not, start it with:
```bash
npm run dev
```

## Testing Flow

### 1. Access the Flashcard Hub
Navigate to: **http://localhost:3000/train/flashcards**

**What to expect:**
- Beautiful landing page with gradient background
- "Ready to learn?" heading
- Two large action cards:
  - "Start Review" (emerald gradient) - Will show "0 cards due" initially
  - "Learn New Words" (blue gradient)
- Quick stats showing 0 total words (since you haven't added any yet)
- Empty state message

### 2. Add Words to Your Deck

Click **"Learn New Words"** or navigate to: **http://localhost:3000/train/flashcards/select**

**What to expect:**
- Grid of 20 surahs (sample data)
- Each card shows:
  - Surah number
  - Arabic name (Amiri font)
  - English name
  - Translation
  - Verse count badge
  - Makkah/Madinah icon
- Search bar at top (try searching "Fatihah" or "Cow")
- Hover effects: cards lift and glow

**Action:** Click any surah card (e.g., Al-Fatihah)

### 3. Word Intake Interface

You'll be redirected to: **http://localhost:3000/train/flashcards/intake?surah=1**

**What to expect:**
- Header with surah name
- Filter chips: All | Verbs | Nouns | Particles
- Grid of word cards showing:
  - Arabic text (large, Amiri font)
  - English translation (emerald color)
  - Type badge (color-coded)
- Each word has two buttons:
  - "✓ Known" (green outline)
  - "+ Learn" (emerald gradient)

**Action:** 
1. Click "+ Learn" on 2-3 words
2. Click "✓ Known" on 1-2 words (optional)
3. Click **"Finish Selection"** button at bottom

### 4. Review Session

Navigate to: **http://localhost:3000/train/flashcards/review**

**What to expect:**
- Immersive full-screen interface
- Progress bar at top (emerald gradient)
- Large flashcard in center showing Arabic word
- Card type badge (VERB/NOUN/PARTICLE)
- Hint: "Click or press Space to reveal"

**Actions to test:**

**Flip the card:**
- Click on the card, OR
- Press **Spacebar**

**Card flips with 3D animation (600ms)**

**Back of card shows:**
- For VERBS: Grid with ماضي / مضارع / أمر / مصدر
- For NOUNS: Singular and (plural)
- Translation in emerald color
- Root information
- Example ayah references

**Rate your knowledge:**
- Click buttons OR press keyboard shortcuts:
  - **1** = Again (red)
  - **2** = Hard (orange)
  - **3** = Good (emerald)
  - **4** = Easy (blue)

**What happens:**
- Card advances to next
- Progress bar updates
- FSRS algorithm schedules next review
- Stats panel updates (top-right on desktop)

### 5. Session Complete

After reviewing all cards:

**What to expect:**
- Celebration screen with 🎉
- "Session Complete!" heading
- Stats cards showing:
  - Cards reviewed
  - Time spent
  - Performance breakdown (Again/Hard/Good/Easy counts)
- "Continue" button (returns to hub)

### 6. View Statistics

Navigate to: **http://localhost:3000/train/flashcards/stats**

**What to expect:**
- Hero stats row:
  - Total words
  - Retention rate (percentage)
  - Total reviews
  - Study time
- Word status breakdown with progress bars:
  - New (blue)
  - Learning (emerald)
  - Mature (purple)
- Recent activity section
- Recent reviews list with color-coded ratings

### 7. Customize Settings

Navigate to: **http://localhost:3000/train/flashcards/settings**

**What to expect:**
- Card Display Settings:
  - Toggle switches for show/hide options
  - Each toggle animates smoothly
  - Emerald color when active
- Word Filtering options
- Learning Limits with sliders:
  - Daily new cards (0-50)
  - Daily review cards (0-200)
  - Session size (5-50)
- Advanced section:
  - Export Data button
  - Reset All Data (red, danger button)
- "Save Settings" button (emerald gradient)

**Action:** Try adjusting sliders and toggling switches, then click "Save Settings"

## Testing Checklist

### ✅ Core Functionality

- [ ] Navigate to flashcard hub
- [ ] Click "Learn New Words"
- [ ] Search for a surah
- [ ] Select a surah
- [ ] Mark words as "Learn" and "Known"
- [ ] Finish selection
- [ ] Start review session
- [ ] Flip card with click
- [ ] Flip card with Spacebar
- [ ] Rate card with buttons
- [ ] Rate card with keyboard (1-4)
- [ ] Complete full session
- [ ] View session summary
- [ ] Return to hub
- [ ] View statistics
- [ ] Adjust settings
- [ ] Export data

### ✅ Visual Design

- [ ] 3D flip animation is smooth
- [ ] Gradient buttons look good
- [ ] Hover effects work (scale + glow)
- [ ] Arabic text renders properly (Amiri font)
- [ ] Progress bar animates smoothly
- [ ] Color coding is consistent:
  - Red = Again
  - Orange = Hard
  - Emerald = Good
  - Blue = Easy/New
  - Purple = Review/Mature
- [ ] Cards have proper shadows and borders
- [ ] Responsive on mobile (try resizing)

### ✅ Data Persistence

- [ ] Add words, refresh page, words still there
- [ ] Complete review, check stats page
- [ ] Change settings, refresh, settings saved
- [ ] Export data (downloads JSON file)
- [ ] Reset data (clears everything)

### ✅ FSRS Scheduling

- [ ] Review a card with "Good"
- [ ] Check hub - "cards due" should be 0
- [ ] Card should be scheduled for future
- [ ] Stats show correct card states (New/Learning/Review)

## Known Limitations (Expected)

1. **Sample Data Only:** Only 5 words in lexical database (for testing)
2. **Surah Selection:** Only shows 20 surahs (sample data)
3. **No Real Corpus Data:** Using mock words until full database is built
4. **Build Errors:** Production build may fail on other pages (missing env vars) - this is OK, dev mode works fine

## Browser Console

Open browser DevTools (F12) and check console for:
- No localStorage errors
- FSRS scheduling logs
- Any React warnings

## LocalStorage Inspection

In browser DevTools > Application > Local Storage > localhost:3000

You should see:
- `qalamspace_flashcards` - Your flashcard data
- `qalamspace_reviews` - Review history
- `qalamspace_preferences` - Your settings

## Next Steps After Testing

1. **Build Full Lexical Database:**
   - Implement full Corpus API integration in `scripts/build-lexical-db.ts`
   - Fetch all 114 surahs
   - Apply canonicalization rules
   - Generate complete `public/data/lexical-db.json`

2. **Add More Features:**
   - Audio pronunciation
   - Transliteration display
   - Arabic explanations from Al-Muyassar
   - Juz selection (currently only surah)
   - Charts in stats dashboard

3. **Supabase Migration:**
   - When backend is ready, update `src/lib/storage/flashcard-storage.ts`
   - Replace localStorage calls with Supabase client
   - Add authentication
   - No other code changes needed!

## Troubleshooting

**Problem:** Cards not showing in review
- **Solution:** Make sure you added words via "Learn New Words" flow first

**Problem:** Flip animation not working
- **Solution:** Check browser console for CSS errors, try different browser

**Problem:** Settings not saving
- **Solution:** Check browser allows localStorage, check console for errors

**Problem:** Surah selection page errors
- **Solution:** This is expected if Quran API env vars not set, but sample data should work

## Report Issues

If you find bugs or have suggestions, note:
- Which page/component
- What you expected vs what happened
- Browser console errors (if any)

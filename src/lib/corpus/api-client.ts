interface CorpusSegment {
  segment: string;
  pos: string;
  root?: string;
  lemma?: string;
  translation?: string;
}

interface CorpusWord {
  position: number;
  segments: CorpusSegment[];
}

interface CorpusVerseResponse {
  chapter: number;
  verse: number;
  words: CorpusWord[];
}

export async function fetchVerseMorphology(
  surah: number,
  ayah: number
): Promise<CorpusVerseResponse | null> {
  try {
    const response = await fetch(
      `https://corpus.quran.com/java/api/verse/${surah}/${ayah}`
    );
    
    if (!response.ok) {
      console.error(`Failed to fetch verse ${surah}:${ayah} from Corpus API`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching verse ${surah}:${ayah}:`, error);
    return null;
  }
}

export async function fetchSurahMorphology(
  surah: number,
  versesCount: number
): Promise<CorpusVerseResponse[]> {
  const promises: Promise<CorpusVerseResponse | null>[] = [];
  
  for (let ayah = 1; ayah <= versesCount; ayah++) {
    promises.push(fetchVerseMorphology(surah, ayah));
  }

  const results = await Promise.all(promises);
  return results.filter((r): r is CorpusVerseResponse => r !== null);
}

export async function fetchAllQuranMorphology(): Promise<
  Map<string, CorpusVerseResponse>
> {
  const surahVerseCounts = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128,
    111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73,
    54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60,
    49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
    28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30,
    20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4,
    5, 6,
  ];

  const allVerses = new Map<string, CorpusVerseResponse>();

  for (let surah = 1; surah <= 114; surah++) {
    const versesCount = surahVerseCounts[surah - 1];
    console.log(`Fetching Surah ${surah} (${versesCount} verses)...`);
    
    const verses = await fetchSurahMorphology(surah, versesCount);
    
    verses.forEach((verse) => {
      const key = `${verse.chapter}:${verse.verse}`;
      allVerses.set(key, verse);
    });

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return allVerses;
}

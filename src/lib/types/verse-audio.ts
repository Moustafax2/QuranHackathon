export interface VerseAudioFile {
  verse_key: string; // e.g. "1:1"
  url: string;       // relative path e.g. "Alafasy/mp3/001001.mp3"
}

export interface VerseAudioFilesResponse {
  audio_files: VerseAudioFile[];
  meta: {
    reciter_name: string;
    recitation_style: string;
  };
}

export interface VerseAudioSettings {
  speed: number;        // 0.5 to 3.0, step 0.05
  startVerse: number;   // verse_number, inclusive
  endVerse: number;     // verse_number, inclusive
  timesPerVerse: number; // 1-10
  timesPerSet: number;   // 1-10
}

export interface QueueEntry {
  verseKey: string; // e.g. "1:1"
  url: string;      // absolute URL
}

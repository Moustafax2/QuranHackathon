export interface ReciterEntry {
  id: number;
  name: string;
  style: string | null;
  /** CDN path under https://verses.quran.foundation/ for verse-level audio */
  audioPath: string;
}

export const RECITERS: readonly ReciterEntry[] = [
  { id: 7,  name: "Mishari Rashid al-\`Afasy",  style: null,       audioPath: "Alafasy/mp3" },
  { id: 1,  name: "Abdul Basit Abdul Samad",    style: "Murattal", audioPath: "AbdulBaset/Murattal/mp3" },
  { id: 11, name: "Abdul Basit Abdul Samad",    style: "Mujawwad", audioPath: "AbdulBaset/Mujawwad/mp3" },
  { id: 3,  name: "Abdur-Rahman as-Sudais",     style: null,       audioPath: "Sudais/mp3" },
] as const;

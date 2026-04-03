export interface AudioFile {
  id: number;
  chapter_id: number;
  file_size: number;
  format: string;
  audio_url: string;
}

export interface AudioResponse {
  audio_file: AudioFile;
}

export interface Reciter {
  id: number;
  name: string;
  style: string | null;
}

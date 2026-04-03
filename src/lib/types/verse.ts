export interface Translation {
  id: number;
  resource_id: number;
  text: string;
}

export interface Word {
  id: number;
  position: number;
  text_uthmani: string;
  translation: {
    text: string;
    language_name: string;
  };
}

export interface Verse {
  id: number;
  verse_number: number;
  verse_key: string;
  hizb_number: number;
  rub_el_hizb_number: number;
  ruku_number: number;
  manzil_number: number;
  sajdah_number: number | null;
  page_number: number;
  juz_number: number;
  text_uthmani: string;
  words?: Word[];
  translations?: Translation[];
}

export interface Pagination {
  per_page: number;
  current_page: number;
  next_page: number | null;
  total_pages: number;
  total_records: number;
}

export interface VersesResponse {
  verses: Verse[];
  pagination: Pagination;
}

export interface SearchResult {
  result_type: "surah" | "juz" | "hizb" | "ayah" | "rub_el_hizb" | "search_page" | "page" | "range" | "quran_range";
  key: number | string;
  name: string;
  arabic?: string;
  isArabic?: boolean;
  isTransliteration?: boolean;
}

export interface SearchResponse {
  pagination: {
    current_page: number;
    next_page: number | null;
    per_page: number;
    total_pages: number;
    total_records: number;
  };
  result: {
    navigation: SearchResult[];
    verses: SearchResult[];
  };
}

export interface SearchResult {
  verse_key: string;
  verse_id: number;
  text: string;
  highlighted: string | null;
  translations: {
    text: string;
    resource_id: number;
    name: string;
    language_name: string;
  }[];
}

export interface SearchResponse {
  search: {
    query: string;
    total_results: number;
    current_page: number;
    total_pages: number;
    results: SearchResult[];
  };
}

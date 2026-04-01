import { apiGet } from "./client";
import type { SearchResponse } from "@/lib/types";

export async function searchQuran(
  query: string,
  page = 1
): Promise<SearchResponse> {
  return apiGet<SearchResponse>("/search", {
    q: query,
    size: 20,
    page,
    language: "en",
  });
}

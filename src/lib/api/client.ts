import { getBaseUrl } from "@/config/api";

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number>
): Promise<T> {
  const baseUrl = getBaseUrl();
  const url = new URL(`${baseUrl}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  }

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

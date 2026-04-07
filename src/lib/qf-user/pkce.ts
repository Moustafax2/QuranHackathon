const encoder = new TextEncoder();

function toBase64Url(buffer: ArrayBuffer): string {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createRandomString(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes.buffer);
}

export async function createPkceChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(codeVerifier));
  return toBase64Url(digest);
}

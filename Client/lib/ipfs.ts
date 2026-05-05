/**
 * Pinata IPFS integration for certificate uploads.
 *
 * Required env (Client/.env.local):
 *   NEXT_PUBLIC_PINATA_API_KEY    — Pinata API Key
 *   NEXT_PUBLIC_PINATA_API_SECRET  — Pinata Secret API Key
 *
 * Optional:
 *   NEXT_PUBLIC_PINATA_GROUP_ID — Pinata group id to organize uploads
 *
 * Returns the IPFS CID (e.g. "Qm...") to store on-chain as certificate hash.
 */

const PINATA_UPLOAD_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

function getPinataKeys(): { apiKey: string; secretKey: string } {
  const apiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY ?? "";
  const secretKey = process.env.NEXT_PUBLIC_PINATA_API_SECRET ?? "";
  return { apiKey: apiKey.trim(), secretKey: secretKey.trim() };
}

export function getIpfsUrl(cid: string): string {
  const clean = (cid || "").trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  if (/^ipfs:\/\//i.test(clean)) {
    return PINATA_GATEWAY + clean.replace(/^ipfs:\/\//i, "");
  }
  return PINATA_GATEWAY + clean;
}

/** Fetch text content from IPFS. Used internally; CID is never exposed in UI. */
export async function fetchIpfsContent(cid: string): Promise<string> {
  const url = getIpfsUrl(cid);
  if (!url) return "";
  try {
    const res = await fetch(url);
    if (!res.ok) return "";
    return res.text();
  } catch {
    return "";
  }
}

/** True if Pinata API key and secret are set. */
export function isPinataConfigured(): boolean {
  const { apiKey, secretKey } = getPinataKeys();
  return Boolean(apiKey && secretKey);
}

/**
 * Upload a file to IPFS via Pinata (legacy pinFileToIPFS API with API key + secret).
 */
export async function uploadToIpfs(file: File): Promise<string> {
  const { apiKey, secretKey } = getPinataKeys();
  if (!apiKey || !secretKey) {
    throw new Error(
      "Pinata not configured. Add NEXT_PUBLIC_PINATA_API_KEY and NEXT_PUBLIC_PINATA_API_SECRET to .env.local"
    );
  }

  const form = new FormData();
  form.append("file", file);

  const metadata = JSON.stringify({ name: file.name });
  form.append("pinataMetadata", metadata);

  const options = JSON.stringify({ cidVersion: 0 });
  form.append("pinataOptions", options);

  const res = await fetch(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: {
      pinata_api_key: apiKey,
      pinata_secret_api_key: secretKey,
    },
    body: form,
  });

  const text = await res.text();
  if (!res.ok) {
    let message = `Pinata upload failed (${res.status})`;
    try {
      const json = JSON.parse(text) as { error?: string; message?: string };
      message = json.error ?? json.message ?? message;
    } catch {
      if (text) message += `: ${text.slice(0, 200)}`;
    }
    throw new Error(message);
  }

  let data: { IpfsHash?: string };
  try {
    data = JSON.parse(text) as { IpfsHash?: string };
  } catch {
    throw new Error("Invalid Pinata response");
  }

  const cid = data.IpfsHash ?? null;
  if (!cid || typeof cid !== "string") {
    throw new Error("Pinata did not return an IPFS hash");
  }
  return cid;
}

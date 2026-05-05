import { getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import { client, contract as factoryContract } from "@/lib/thirdweb";
import { getMiningAddress } from "@/lib/onchain/mining";

export type CertificateRecord = {
  batchId: bigint;
  certificateHash: string;
  issuedAt: bigint;
  issuedBy: string;
  calorificValue: bigint;
};

export type RejectionRecord = {
  batchId: bigint;
  reasonHash: string;
  rejectedAt: bigint;
  rejectedBy: string;
};

function decodeCert(raw: unknown): CertificateRecord | null {
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : null;
  const batchId = (arr ? arr[0] : (raw as any).batchId) as bigint | undefined;
  const certificateHash = (arr ? arr[1] : (raw as any).certificateHash) as string | undefined;
  const issuedAt = (arr ? arr[2] : (raw as any).issuedAt) as bigint | undefined;
  const issuedBy = (arr ? arr[3] : (raw as any).issuedBy) as string | undefined;
  const calorificValue = (arr ? arr[4] : (raw as any).calorificValue) as bigint | undefined;
  if (
    typeof batchId !== "bigint" ||
    typeof certificateHash !== "string" ||
    typeof issuedAt !== "bigint" ||
    typeof issuedBy !== "string" ||
    typeof calorificValue !== "bigint"
  ) {
    return null;
  }
  return { batchId, certificateHash, issuedAt, issuedBy, calorificValue };
}

export async function getCertificationAddress(): Promise<string | null> {
  const addr = (await readContract({
    contract: factoryContract,
    method: "function certification() view returns (address)",
    params: [],
  })) as string;
  if (!addr || addr === "0x0000000000000000000000000000000000000000") return null;
  return addr;
}

function decodeRejection(raw: unknown): RejectionRecord | null {
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : null;
  const batchId = (arr ? arr[0] : (raw as any).batchId) as bigint | undefined;
  const reasonHash = (arr ? arr[1] : (raw as any).reasonHash) as string | undefined;
  const rejectedAt = (arr ? arr[2] : (raw as any).rejectedAt) as bigint | undefined;
  const rejectedBy = (arr ? arr[3] : (raw as any).rejectedBy) as string | undefined;
  if (
    typeof batchId !== "bigint" ||
    typeof reasonHash !== "string" ||
    typeof rejectedAt !== "bigint" ||
    typeof rejectedBy !== "string"
  ) {
    return null;
  }
  return { batchId, reasonHash, rejectedAt, rejectedBy };
}

export async function fetchAllCertificates(): Promise<CertificateRecord[]> {
  const miningAddress = await getMiningAddress();
  if (!miningAddress) return [];
  const certAddress = await getCertificationAddress();
  if (!certAddress) return [];

  const mining = getContract({ client, chain: sepolia, address: miningAddress });
  const total = (await readContract({
    contract: mining,
    method: "function batchCounter() view returns (uint256)",
    params: [],
  })) as bigint;
  if (total === 0n) return [];

  const certification = getContract({ client, chain: sepolia, address: certAddress });
  const limit = Number(total > 250n ? 250n : total);
  const ids = Array.from({ length: limit }, (_, i) => BigInt(i + 1));
  const raw = await Promise.all(
    ids.map((id) =>
      readContract({
        contract: certification,
        method: "function certificates(uint256) view returns (uint256,string,uint256,address,uint256)",
        params: [id],
      })
    )
  );
  const certs = raw.map(decodeCert).filter((c): c is CertificateRecord => c !== null && c.issuedAt !== 0n);
  return certs;
}

export async function fetchAllRejections(): Promise<RejectionRecord[]> {
  try {
    const miningAddress = await getMiningAddress();
    if (!miningAddress) return [];
    const certAddress = await getCertificationAddress();
    if (!certAddress) return [];

    const mining = getContract({ client, chain: sepolia, address: miningAddress });
    const total = (await readContract({
      contract: mining,
      method: "function batchCounter() view returns (uint256)",
      params: [],
    })) as bigint;
    if (total === 0n) return [];

    const certification = getContract({ client, chain: sepolia, address: certAddress });
    const limit = Number(total > 250n ? 250n : total);
    const ids = Array.from({ length: limit }, (_, i) => BigInt(i + 1));
    const raw = await Promise.all(
      ids.map((id) =>
        readContract({
          contract: certification,
          method:
            "function rejections(uint256) view returns (uint256,string,uint256,address)",
          params: [id],
        }),
      ),
    );
    const rejs = raw
      .map(decodeRejection)
      .filter((r): r is RejectionRecord => r !== null && r.rejectedAt !== 0n);
    return rejs;
  } catch {
    // Backwards-compatible: older deployed contracts don't have rejections()
    return [];
  }
}

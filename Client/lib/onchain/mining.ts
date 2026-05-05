import { getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import { client, contract as factoryContract } from "@/lib/thirdweb";

export type BatchStatus =
  | "Created"
  | "Certified"
  | "TransportRequested"
  | "InTransit"
  | "Delivered"
  | "Consumed"
  | "Disputed"
  | "Rejected"
  | "Received";

export type MiningBatch = {
  id: bigint;
  miner: string;
  location: string;
  grade: string;
  quantity: bigint;
  timestamp: bigint;
  status: BatchStatus;
};

export const STATUS_LABELS: BatchStatus[] = [
  "Created",            // 0
  "Certified",          // 1
  "TransportRequested", // 2
  "InTransit",          // 3
  "Delivered",          // 4
  "Consumed",           // 5
  "Disputed",           // 6
  "Rejected",            // 7
  "Received",            // 8
];

function toLower(addr: string) {
  return (addr || "").toLowerCase();
}

function decodeBatch(raw: any): MiningBatch | null {
  if (!raw) return null;

  // thirdweb may return either:
  // - an array/tuple: [id, miner, location, destination, grade, quantity, timestamp, status]
  // - an object with named properties
  const arr = Array.isArray(raw) ? raw : null;

  const id = (arr ? arr[0] : raw.id) as bigint | undefined;
  const miner = (arr ? arr[1] : raw.miner) as string | undefined;
  const location = (arr ? arr[2] : raw.location) as string | undefined;
  const grade = (arr ? arr[3] : raw.grade) as string | undefined;
  const quantity = (arr ? arr[4] : raw.quantity) as bigint | undefined;
  const timestamp = (arr ? arr[5] : raw.timestamp) as bigint | undefined;
  const statusRaw = (arr ? arr[6] : raw.status) as
    | bigint
    | number
    | undefined;

  if (
    typeof miner !== "string" ||
    typeof location !== "string" ||
    typeof grade !== "string" ||
    typeof id !== "bigint" ||
    typeof quantity !== "bigint" ||
    typeof timestamp !== "bigint"
  ) {
    return null;
  }

  const statusIndex =
    typeof statusRaw === "bigint" ? Number(statusRaw) : Number(statusRaw ?? 0);

  return {
    id,
    miner,
    location,
    grade,
    quantity,
    timestamp,
    status: STATUS_LABELS[statusIndex] ?? "Created",
  };
}

export async function getMiningAddress(): Promise<string | null> {
  const addr = (await readContract({
    contract: factoryContract,
    method: "function mining() view returns (address)",
    params: [],
  })) as string;

  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    return null;
  }
  return addr;
}

export async function getMiningContract(miningAddress?: string | null) {
  const addr = miningAddress ?? (await getMiningAddress());
  if (!addr) return null;
  return getContract({ client, chain: sepolia, address: addr });
}

export async function fetchMiningBatches(opts?: {
  limit?: number;
  minerAddress?: string;
}): Promise<{ miningAddress: string | null; batches: MiningBatch[] }> {
  const limit = Math.max(1, Math.min(opts?.limit ?? 100, 250));
  const miningAddress = await getMiningAddress();
  if (!miningAddress) return { miningAddress: null, batches: [] };

  const mining = await getMiningContract(miningAddress);
  if (!mining) return { miningAddress: null, batches: [] };

  const total = (await readContract({
    contract: mining,
    method: "function batchCounter() view returns (uint256)",
    params: [],
  })) as bigint;

  if (total === 0n) return { miningAddress, batches: [] };

  const maxToFetch = total > BigInt(limit) ? BigInt(limit) : total;
  const start = total - maxToFetch + 1n; // fetch the MOST RECENT batches

  const ids = Array.from({ length: Number(maxToFetch) }, (_, i) => start + BigInt(i));

  const raw = await Promise.all(
    ids.map((id) =>
      readContract({
        contract: mining,
        // use unnamed returns to reliably decode as tuple/array
        method:
          "function batches(uint256) view returns (uint256,address,string,string,uint256,uint256,uint8)",
        params: [id],
      }),
    ),
  );

  const decoded = raw.map(decodeBatch).filter(Boolean) as MiningBatch[];

  const minerAddress = opts?.minerAddress ? toLower(opts.minerAddress) : "";
  const batches = minerAddress
    ? decoded.filter((b) => toLower(b.miner) === minerAddress)
    : decoded;

  return { miningAddress, batches };
}


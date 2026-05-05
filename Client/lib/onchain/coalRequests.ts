import { getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import { client } from "@/lib/thirdweb";
import { getMiningAddress } from "./mining";

export type CoalRequestRecord = {
  id: bigint;
  batchId: bigint;
  consumer: string;
  destination: string;
  grade: string;
  consumerType: number; // 0 = POWER_PLANT, 1 = MANUFACTURING_UNIT
  assignedTransporter: string;
  expectedDeliveryAt: bigint;
  accepted: boolean;
  cancelled: boolean;
  createdAt: bigint;
};

function decodeCoalRequest(raw: any): CoalRequestRecord | null {
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : null;

  const id = (arr ? arr[0] : raw.id) as bigint | undefined;
  const batchId = (arr ? arr[1] : raw.batchId) as bigint | undefined;
  const consumer = (arr ? arr[2] : raw.consumer) as string | undefined;
  const destination = (arr ? arr[3] : raw.destination) as string | undefined;
  const grade = (arr ? arr[4] : raw.grade) as string | undefined;
  const consumerTypeRaw = (arr ? arr[5] : raw.consumerType) as number | bigint | undefined;
  const assignedTransporter = (arr ? arr[6] : raw.assignedTransporter) as string | undefined;
  const expectedDeliveryAt = (arr ? arr[7] : raw.expectedDeliveryAt) as bigint | undefined;
  const accepted = (arr ? arr[8] : raw.accepted) as boolean | undefined;
  const cancelled = (arr ? arr[9] : raw.cancelled) as boolean | undefined;
  const createdAt = (arr ? arr[10] : raw.createdAt) as bigint | undefined;

  if (
    typeof id !== "bigint" ||
    typeof batchId !== "bigint" ||
    typeof consumer !== "string" ||
    typeof destination !== "string" ||
    typeof grade !== "string" ||
    typeof assignedTransporter !== "string" ||
    typeof expectedDeliveryAt !== "bigint" ||
    typeof accepted !== "boolean" ||
    typeof cancelled !== "boolean" ||
    typeof createdAt !== "bigint"
  ) {
    return null;
  }

  const consumerType = typeof consumerTypeRaw === "bigint" ? Number(consumerTypeRaw) : Number(consumerTypeRaw ?? 0);

  return {
    id,
    batchId,
    consumer,
    destination,
    grade,
    consumerType,
    assignedTransporter,
    expectedDeliveryAt,
    accepted,
    cancelled,
    createdAt,
  };
}

export async function fetchCoalRequests(): Promise<CoalRequestRecord[]> {
  const miningAddress = await getMiningAddress();
  if (!miningAddress) return [];

  const mining = getContract({ client, chain: sepolia, address: miningAddress });
  const total = (await readContract({
    contract: mining,
    method: "function coalRequestCounter() view returns (uint256)",
    params: [],
  })) as bigint;

  if (total === 0n) return [];

  const ids = Array.from({ length: Number(total) }, (_, i) => BigInt(i + 1));
  const raw = await Promise.all(
    ids.map((id) =>
      readContract({
        contract: mining,
        // use unnamed returns to reliably decode as tuple/array
        method:
          "function coalRequests(uint256) view returns (uint256,uint256,address,string,string,uint8,address,uint256,bool,bool,uint256)",
        params: [id],
      })
    )
  );

  return raw.map(decodeCoalRequest).filter(Boolean) as CoalRequestRecord[];
}

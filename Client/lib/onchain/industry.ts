import { getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import { client, contract as factoryContract } from "@/lib/thirdweb";
import { getIndustryAddress } from "@/lib/onchain/analytics";

export type ConsumptionRecord = {
  batchId: bigint;
  consumer: string;
  startTimestamp: bigint;
  endTimestamp: bigint;
  createdAt: bigint;
  quantityBurned: bigint;
  calorificValue: bigint;
  claimedGeneration: bigint;
};

function decodeConsumptionRecord(raw: any): ConsumptionRecord | null {
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : null;

  const batchId = (arr ? arr[0] : raw.batchId) as bigint | undefined;
  const consumer = (arr ? arr[1] : raw.consumer) as string | undefined;
  const startTimestamp = (arr ? arr[2] : raw.startTimestamp) as bigint | undefined;
  const endTimestamp = (arr ? arr[3] : raw.endTimestamp) as bigint | undefined;
  const createdAt = (arr ? arr[4] : raw.createdAt) as bigint | undefined;
  const quantityBurned = (arr ? arr[5] : raw.quantityBurned) as bigint | undefined;
  const calorificValue = (arr ? arr[6] : raw.calorificValue) as bigint | undefined;
  const claimedGeneration = (arr ? arr[7] : raw.claimedGeneration) as bigint | undefined;

  if (
    typeof batchId !== "bigint" ||
    typeof consumer !== "string" ||
    typeof startTimestamp !== "bigint" ||
    typeof endTimestamp !== "bigint" ||
    typeof createdAt !== "bigint" ||
    typeof quantityBurned !== "bigint" ||
    typeof calorificValue !== "bigint" ||
    typeof claimedGeneration !== "bigint"
  ) {
    return null;
  }

  return {
    batchId,
    consumer,
    startTimestamp,
    endTimestamp,
    createdAt,
    quantityBurned,
    calorificValue,
    claimedGeneration,
  };
}

export async function fetchConsumptionRecord(batchId: bigint): Promise<ConsumptionRecord | null> {
  const industryAddr = await getIndustryAddress();
  if (!industryAddr) return null;

  const industry = getContract({ client, chain: sepolia, address: industryAddr });
  try {
    const raw = await readContract({
      contract: industry,
      method: "function consumptionRecords(uint256) view returns (uint256,address,uint256,uint256,uint256,uint256,uint256,uint256)",
      params: [batchId],
    });
    const record = decodeConsumptionRecord(raw);
    return record && record.createdAt !== 0n ? record : null;
  } catch (err) {
    console.error("fetchConsumptionRecord failed", err);
    return null;
  }
}

export async function fetchAllConsumptionRecords(batchIds: bigint[]): Promise<ConsumptionRecord[]> {
  const records = await Promise.all(batchIds.map(id => fetchConsumptionRecord(id)));
  return records.filter((r): r is ConsumptionRecord => r !== null);
}

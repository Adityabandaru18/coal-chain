import { getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import { client } from "@/lib/thirdweb";
import { getMiningAddress } from "./mining";

export type DeliveryDisputeRecord = {
  id: bigint;
  batchId: bigint;
  transporter: string;
  consumer: string;
  raisedAt: bigint;
  reasonHash: string;
  resolved: boolean;
  resolutionNote: string;
};

function decodeDispute(raw: any): DeliveryDisputeRecord | null {
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : null;

  const id = (arr ? arr[0] : raw.id) as bigint | undefined;
  const batchId = (arr ? arr[1] : raw.batchId) as bigint | undefined;
  const transporter = (arr ? arr[2] : raw.transporter) as string | undefined;
  const consumer = (arr ? arr[3] : raw.consumer) as string | undefined;
  const raisedAt = (arr ? arr[4] : raw.raisedAt) as bigint | undefined;
  const reasonHash = (arr ? arr[5] : raw.reasonHash) as string | undefined;
  const resolved = (arr ? arr[6] : raw.resolved) as boolean | undefined;
  const resolutionNote = (arr ? arr[7] : raw.resolutionNote) as string | undefined;

  if (
    typeof id !== "bigint" ||
    typeof batchId !== "bigint" ||
    typeof transporter !== "string" ||
    typeof consumer !== "string" ||
    typeof raisedAt !== "bigint" ||
    typeof reasonHash !== "string" ||
    typeof resolved !== "boolean" ||
    typeof resolutionNote !== "string"
  ) {
    return null;
  }

  return {
    id,
    batchId,
    transporter,
    consumer,
    raisedAt,
    reasonHash,
    resolved,
    resolutionNote,
  };
}

export async function fetchDeliveryDisputes(): Promise<DeliveryDisputeRecord[]> {
  const miningAddress = await getMiningAddress();
  if (!miningAddress) return [];

  const mining = getContract({ client, chain: sepolia, address: miningAddress });
  const total = (await readContract({
    contract: mining,
    method: "function disputeCounter() view returns (uint256)",
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
          "function disputes(uint256) view returns (uint256,uint256,address,address,uint256,string,bool,string)",
        params: [id],
      })
    )
  );

  return raw.map(decodeDispute).filter(Boolean) as DeliveryDisputeRecord[];
}

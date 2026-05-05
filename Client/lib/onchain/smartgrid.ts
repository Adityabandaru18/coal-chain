import { getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import { client, contract as factoryContract } from "@/lib/thirdweb";

export type GridRecordData = {
  batchId: string; // bytes32 hex string
  powerPlant: string;
  quantityConsumed: bigint;
  caloricValue: bigint;
  expectedOutputKWh: bigint;
  actualGeneratedKWh: bigint;
  gridLoadServedKWh: bigint;
  efficiencyRatio: bigint;
  recordedAt: bigint;
  discrepancyFlagged: boolean;
};

function decodeGridRecord(raw: any): GridRecordData | null {
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : null;

  const batchId = (arr ? arr[0] : raw.batchId) as string | undefined;
  const powerPlant = (arr ? arr[1] : raw.powerPlant) as string | undefined;
  const quantityConsumed = (arr ? arr[2] : raw.quantityConsumed) as bigint | undefined;
  const caloricValue = (arr ? arr[3] : raw.caloricValue) as bigint | undefined;
  const expectedOutputKWh = (arr ? arr[4] : raw.expectedOutputKWh) as bigint | undefined;
  const actualGeneratedKWh = (arr ? arr[5] : raw.actualGeneratedKWh) as bigint | undefined;
  const gridLoadServedKWh = (arr ? arr[6] : raw.gridLoadServedKWh) as bigint | undefined;
  const efficiencyRatio = (arr ? arr[7] : raw.efficiencyRatio) as bigint | undefined;
  const recordedAt = (arr ? arr[8] : raw.recordedAt) as bigint | undefined;
  const discrepancyFlagged = (arr ? arr[9] : raw.discrepancyFlagged) as boolean | undefined;

  if (
    typeof batchId !== "string" ||
    typeof powerPlant !== "string" ||
    typeof quantityConsumed !== "bigint" ||
    typeof caloricValue !== "bigint" ||
    typeof expectedOutputKWh !== "bigint" ||
    typeof actualGeneratedKWh !== "bigint" ||
    typeof gridLoadServedKWh !== "bigint" ||
    typeof efficiencyRatio !== "bigint" ||
    typeof recordedAt !== "bigint" ||
    typeof discrepancyFlagged !== "boolean"
  ) {
    return null;
  }

  return {
    batchId,
    powerPlant,
    quantityConsumed,
    caloricValue,
    expectedOutputKWh,
    actualGeneratedKWh,
    gridLoadServedKWh,
    efficiencyRatio,
    recordedAt,
    discrepancyFlagged,
  };
}

export async function getSmartGridAddress(): Promise<string | null> {
  const addr = (await readContract({
    contract: factoryContract,
    method: "function smartgrid() view returns (address)",
    params: [],
  })) as string;

  if (!addr || addr === "0x0000000000000000000000000000000000000000") {
    return null;
  }
  return addr;
}

export async function fetchGridRecords(batchIdsAsBytes32: string[]): Promise<GridRecordData[]> {
  const smartgridAddr = await getSmartGridAddress();
  if (!smartgridAddr || batchIdsAsBytes32.length === 0) return [];

  const smartgrid = getContract({ client, chain: sepolia, address: smartgridAddr });
  
  const raw = await Promise.all(
    batchIdsAsBytes32.map((batchIdHex) =>
      readContract({
        contract: smartgrid,
        method:
          "function gridRecords(bytes32) view returns (bytes32,address,uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)",
        params: [batchIdHex as `0x${string}`],
      })
    )
  );

  return raw.map(decodeGridRecord).filter((r) => r !== null && r.recordedAt !== 0n) as GridRecordData[];
}

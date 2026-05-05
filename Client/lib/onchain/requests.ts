import { readContract } from "thirdweb";
import { contract as factoryContract } from "@/lib/thirdweb";
import type { RoleKey } from "@/lib/roles";

const ROLE_TO_INDEX: Record<RoleKey, number> = {
  owner: -1,
  miner: 0,
  certification: 1,
  transporter: 2,
  industry: 3,
  smartgrid: 4,
};

const INDEX_TO_ROLE: RoleKey[] = ["miner", "certification", "transporter", "industry", "smartgrid"];

export type RoleRequestRecord = {
  index: number;
  wallet: string;
  role: RoleKey;
  requestedAt: bigint;
  pending: boolean;
  consumerType?: number;
};

function decodeRequest(
  raw: unknown,
  index: number
): RoleRequestRecord | null {
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : null;
  const wallet = (arr ? arr[0] : (raw as any).wallet) as string | undefined;
  const roleRaw = (arr ? arr[1] : (raw as any).role) as number | bigint | undefined;
  const requestedAt = (arr ? arr[2] : (raw as any).requestedAt) as bigint | undefined;
  const pending = (arr ? arr[3] : (raw as any).pending) as boolean | undefined;
  const consumerTypeRaw = (arr ? arr[4] : (raw as any).consumerType) as bigint | number | undefined;
  if (
    typeof wallet !== "string" ||
    typeof requestedAt !== "bigint" ||
    typeof pending !== "boolean"
  ) {
    return null;
  }
  const roleIndex = typeof roleRaw === "bigint" ? Number(roleRaw) : Number(roleRaw ?? 0);
  const role = INDEX_TO_ROLE[roleIndex] ?? "miner";
  const consumerType =
    typeof consumerTypeRaw === "bigint" || typeof consumerTypeRaw === "number"
      ? Number(consumerTypeRaw)
      : undefined;
  return { index, wallet, role, requestedAt, pending, consumerType };
}

export async function fetchAllRoleRequests(): Promise<RoleRequestRecord[]> {
  const total = (await readContract({
    contract: factoryContract,
    method: "function getRoleRequestCount() view returns (uint256)",
    params: [],
  })) as bigint;

  if (total === 0n) return [];

  const raw = await Promise.all(
    Array.from({ length: Number(total) }, (_, i) =>
      readContract({
        contract: factoryContract,
        method:
          "function roleRequests(uint256) view returns (address,uint8,uint256,bool,uint8)",
        params: [BigInt(i)],
      })
    )
  );

  return raw
    .map((r, i) => decodeRequest(r, i))
    .filter(Boolean) as RoleRequestRecord[];
}

export async function fetchPendingRoleRequests(): Promise<RoleRequestRecord[]> {
  const all = await fetchAllRoleRequests();
  return all.filter((r) => r.pending);
}

/** Maps RoleKey to contract's uint8 role (for requestRole). Owner cannot request. */
export function roleToRequestIndex(role: RoleKey): number {
  return ROLE_TO_INDEX[role];
}

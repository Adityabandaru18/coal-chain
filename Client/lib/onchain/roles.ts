import { getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import { client, contract as factoryContract } from "@/lib/thirdweb";
import type { RoleKey } from "@/lib/roles";

export async function isWalletAuthorizedForRole(
  wallet: string,
  role: RoleKey
): Promise<boolean> {
  if (!wallet) return false;

  const addr = wallet.toLowerCase();

  if (role === "owner") {
    const owner = (await readContract({
      contract: factoryContract,
      method: "function owner() view returns (address)",
      params: [],
    })) as string;
    return owner?.toLowerCase() === addr;
  }

  const [mining, certification, transport, industry, smartgrid] = (
    await Promise.all([
      readContract({
        contract: factoryContract,
        method: "function mining() view returns (address)",
        params: [],
      }),
      readContract({
        contract: factoryContract,
        method: "function certification() view returns (address)",
        params: [],
      }),
      readContract({
        contract: factoryContract,
        method: "function transport() view returns (address)",
        params: [],
      }),
      readContract({
        contract: factoryContract,
        method: "function industry() view returns (address)",
        params: [],
      }),
      readContract({
        contract: factoryContract,
        method: "function smartgrid() view returns (address)",
        params: [],
      }),
    ])
  ) as string[];

  if (role === "miner" && mining && mining !== "0x0000000000000000000000000000000000000000") {
    const ok = (await readContract({
      contract: getContract({ client, chain: sepolia, address: mining }),
      method: "function authorizedMiners(address) view returns (bool)",
      params: [wallet],
    })) as boolean;
    return !!ok;
  }

  if (role === "certification" && certification && certification !== "0x0000000000000000000000000000000000000000") {
    const ok = (await readContract({
      contract: getContract({ client, chain: sepolia, address: certification }),
      method: "function authorizedOfficers(address) view returns (bool)",
      params: [wallet],
    })) as boolean;
    return !!ok;
  }

  if (role === "transporter" && mining && mining !== "0x0000000000000000000000000000000000000000") {
    const ok = (await readContract({
      contract: getContract({ client, chain: sepolia, address: mining }),
      method: "function authorizedTransporters(address) view returns (bool)",
      params: [wallet],
    })) as boolean;
    return !!ok;
  }

  if (role === "industry" && industry && industry !== "0x0000000000000000000000000000000000000000") {
    const ok = (await readContract({
      contract: getContract({ client, chain: sepolia, address: industry }),
      method: "function authorizedIndustry(address) view returns (bool)",
      params: [wallet],
    })) as boolean;
    return !!ok;
  }

  if (role === "smartgrid" && smartgrid && smartgrid !== "0x0000000000000000000000000000000000000000") {
    const ok = (await readContract({
      contract: getContract({ client, chain: sepolia, address: smartgrid }),
      method: "function authorizedGrids(address) view returns (bool)",
      params: [wallet],
    })) as boolean;
    return !!ok;
  }

  return false;
}

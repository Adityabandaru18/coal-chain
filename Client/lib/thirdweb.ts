import { createThirdwebClient, getContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";

// Public client for the browser (safe to expose in frontend)
export const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "",
});

// CoalSupplyChainFactory contract instance
export const contract = getContract({
  client,
  chain: sepolia,
  address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "",
});


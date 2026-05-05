"use client"

import { ThirdwebProvider, useAutoConnect } from "thirdweb/react";
import { sepolia } from "thirdweb/chains";
import { client } from "@/lib/thirdweb";
import { wallets } from "@/lib/wallets";

function AutoConnectOnce() {
  useAutoConnect({
    client,
    wallets,
    chain: sepolia,
    timeout: 15000,
  });
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThirdwebProvider>
      <AutoConnectOnce />
      {children}
    </ThirdwebProvider>
  );
}


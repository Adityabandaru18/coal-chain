import { getContract, readContract } from "thirdweb";
import { sepolia } from "thirdweb/chains";
import { client, contract as factoryContract } from "@/lib/thirdweb";

export type MiningAnalytics = {
  batchCounter: bigint;
  totalQuantity: bigint;
  minerCount: bigint;
  authorizedMinerCount: bigint;
  authorizedTransporterCount: bigint;
  countCreated: bigint;
  countCertified: bigint;
  countTransportRequested: bigint;
  countInTransit: bigint;
  countDelivered: bigint;
  countConsumed: bigint;
  countDisputed: bigint;
  countRejected: bigint;
  countReceived: bigint;
};

export type MinerAnalytics = {
  totalQuantity: bigint;
  batchCount: bigint;
  countCreated: bigint;
  countCertified: bigint;
  countTransportRequested: bigint;
  countInTransit: bigint;
  countDelivered: bigint;
  countConsumed: bigint;
  countDisputed: bigint;
  countRejected: bigint;
  countReceived: bigint;
};

export type TransportAnalytics = {
  certifiedCount: bigint;
  activeTransportCount: bigint;
  completedTransportCount: bigint;
};

export type CertificationAnalytics = {
  totalCertificates: bigint;
  totalRejections: bigint;
  officerCertCount: bigint;
  officerRejectCount: bigint;
  authorizedOfficerCount: bigint;
};

export type CertificationAnalyticsForAdmin = {
  authorizedOfficerCount: bigint;
  totalCertificates: bigint;
  totalRejections: bigint;
  pendingCertifications: bigint;
};

export type TransportAnalyticsForAdmin = {
  authorizedTransporterCount: bigint;
  certifiedCount: bigint;
  inTransitCount: bigint;
  deliveredCount: bigint;
};

export type IndustryAnalyticsForAdmin = {
  authorizedIndustryCount: bigint;
  deliveredQuantity: bigint;
  deliveredCount: bigint;
  consumedCount: bigint;
};

export type SmartGridAnalyticsForAdmin = {
  authorizedGridCount: bigint;
};

export type IndustryAnalytics = {
  deliveredQuantity: bigint;
  deliveredCount: bigint;
  consumedCount: bigint;
};

export async function fetchMiningAnalytics(
  miningAddress: string,
): Promise<MiningAnalytics | null> {
  const mining = getContract({
    client,
    chain: sepolia,
    address: miningAddress,
  });
  try {
    const [batchCounter, totalQuantity, minerCount, c0, c1, c2, c3, c4, c5, c6, c7, c8] =
      await Promise.all([
        readContract({
          contract: mining,
          method: "function batchCounter() view returns (uint256)",
          params: [],
        }),
        readContract({
          contract: mining,
          method: "function totalQuantity() view returns (uint256)",
          params: [],
        }),
        readContract({
          contract: mining,
          method: "function minerCount() view returns (uint256)",
          params: [],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [0],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [1],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [2],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [3],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [4],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [5],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [6],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [7],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [8],
        }),
      ]);
    let authorizedMinerCount = minerCount as bigint;
    let authorizedTransporterCount = BigInt(0);
    try {
      authorizedMinerCount = (await readContract({
        contract: mining,
        method: "function authorizedMinerCount() view returns (uint256)",
        params: [],
      })) as bigint;
    } catch {}
    try {
      authorizedTransporterCount = (await readContract({
        contract: mining,
        method: "function authorizedTransporterCount() view returns (uint256)",
        params: [],
      })) as bigint;
    } catch {}
    return {
      batchCounter: batchCounter as bigint,
      totalQuantity: totalQuantity as bigint,
      minerCount: minerCount as bigint,
      authorizedMinerCount,
      authorizedTransporterCount,
      countCreated: c0 as bigint,
      countCertified: c1 as bigint,
      countTransportRequested: c2 as bigint,
      countInTransit: c3 as bigint,
      countDelivered: c4 as bigint,
      countConsumed: c5 as bigint,
      countDisputed: c6 as bigint,
      countRejected: c7 as bigint,
      countReceived: c8 as bigint,
    };
  } catch {
    return null;
  }
}

export async function fetchMinerAnalytics(
  miningAddress: string,
  minerWallet: string,
): Promise<MinerAnalytics | null> {
  const mining = getContract({
    client,
    chain: sepolia,
    address: miningAddress,
  });
  try {
    const [totalQuantity, c0, c1, c2, c3, c4, c5, c6, c7, c8] = await Promise.all([
      readContract({
        contract: mining,
        method: "function minerTotalQuantity(address) view returns (uint256)",
        params: [minerWallet],
      }),
      readContract({
        contract: mining,
        method:
          "function minerStatusCount(address,uint8) view returns (uint256)",
        params: [minerWallet, 0],
      }),
      readContract({
        contract: mining,
        method:
          "function minerStatusCount(address,uint8) view returns (uint256)",
        params: [minerWallet, 1],
      }),
      readContract({
        contract: mining,
        method:
          "function minerStatusCount(address,uint8) view returns (uint256)",
        params: [minerWallet, 2],
      }),
      readContract({
        contract: mining,
        method:
          "function minerStatusCount(address,uint8) view returns (uint256)",
        params: [minerWallet, 3],
      }),
      readContract({
        contract: mining,
        method:
          "function minerStatusCount(address,uint8) view returns (uint256)",
        params: [minerWallet, 4],
      }),
      readContract({
        contract: mining,
        method:
          "function minerStatusCount(address,uint8) view returns (uint256)",
        params: [minerWallet, 5],
      }),
      readContract({
        contract: mining,
        method:
          "function minerStatusCount(address,uint8) view returns (uint256)",
        params: [minerWallet, 6],
      }),
      readContract({
        contract: mining,
        method:
          "function minerStatusCount(address,uint8) view returns (uint256)",
        params: [minerWallet, 7],
      }),
      readContract({
        contract: mining,
        method:
          "function minerStatusCount(address,uint8) view returns (uint256)",
        params: [minerWallet, 8],
      }),
    ]);
    const total =
      (c0 as bigint) +
      (c1 as bigint) +
      (c2 as bigint) +
      (c3 as bigint) +
      (c4 as bigint) +
      (c5 as bigint) +
      (c6 as bigint) +
      (c7 as bigint) +
      (c8 as bigint);
    return {
      totalQuantity: totalQuantity as bigint,
      batchCount: total,
      countCreated: c0 as bigint,
      countCertified: c1 as bigint,
      countTransportRequested: c2 as bigint,
      countInTransit: c3 as bigint,
      countDelivered: c4 as bigint,
      countConsumed: c5 as bigint,
      countDisputed: c6 as bigint,
      countRejected: c7 as bigint,
      countReceived: c8 as bigint,
    };
  } catch {
    return null;
  }
}

export async function fetchTransportAnalytics(
  miningAddress: string,
  transporterWallet: string,
): Promise<TransportAnalytics | null> {
  const mining = getContract({
    client,
    chain: sepolia,
    address: miningAddress,
  });
  try {
    const [countCertified, activeTransportCount, completedTransportCount] =
      await Promise.all([
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [1],
        }),
        readContract({
          contract: mining,
          method:
            "function activeTransportCount(address) view returns (uint256)",
          params: [transporterWallet],
        }),
        readContract({
          contract: mining,
          method:
            "function completedTransportCount(address) view returns (uint256)",
          params: [transporterWallet],
        }),
      ]);
    return {
      certifiedCount: countCertified as bigint,
      activeTransportCount: activeTransportCount as bigint,
      completedTransportCount: completedTransportCount as bigint,
    };
  } catch {
    return null;
  }
}

export async function fetchCertificationAnalytics(
  certAddress: string,
  officerWallet: string,
): Promise<CertificationAnalytics | null> {
  const cert = getContract({ client, chain: sepolia, address: certAddress });
  try {
    const [
      totalCertificates,
      totalRejections,
      officerCertCount,
      officerRejectCount,
    ] = await Promise.all([
      readContract({
        contract: cert,
        method: "function totalCertificates() view returns (uint256)",
        params: [],
      }),
      readContract({
        contract: cert,
        method: "function totalRejections() view returns (uint256)",
        params: [],
      }),
      readContract({
        contract: cert,
        method: "function officerCertCount(address) view returns (uint256)",
        params: [officerWallet],
      }),
      readContract({
        contract: cert,
        method: "function officerRejectCount(address) view returns (uint256)",
        params: [officerWallet],
      }),
    ]);
    let authorizedOfficerCount = BigInt(0);
    try {
      authorizedOfficerCount = (await readContract({
        contract: cert,
        method: "function authorizedOfficerCount() view returns (uint256)",
        params: [],
      })) as bigint;
    } catch {}
    return {
      totalCertificates: totalCertificates as bigint,
      totalRejections: totalRejections as bigint,
      officerCertCount: officerCertCount as bigint,
      officerRejectCount: officerRejectCount as bigint,
      authorizedOfficerCount,
    };
  } catch {
    return null;
  }
}

export async function getMiningAddress(): Promise<string | null> {
  const addr = (await readContract({
    contract: factoryContract,
    method: "function mining() view returns (address)",
    params: [],
  })) as string;
  if (!addr || addr === "0x0000000000000000000000000000000000000000")
    return null;
  return addr;
}

export async function getCertificationAddress(): Promise<string | null> {
  const addr = (await readContract({
    contract: factoryContract,
    method: "function certification() view returns (address)",
    params: [],
  })) as string;
  if (!addr || addr === "0x0000000000000000000000000000000000000000")
    return null;
  return addr;
}

export async function getIndustryAddress(): Promise<string | null> {
  const addr = (await readContract({
    contract: factoryContract,
    method: "function industry() view returns (address)",
    params: [],
  })) as string;
  if (!addr || addr === "0x0000000000000000000000000000000000000000")
    return null;
  return addr;
}

export async function getSmartGridAddress(): Promise<string | null> {
  const addr = (await readContract({
    contract: factoryContract,
    method: "function smartgrid() view returns (address)",
    params: [],
  })) as string;
  if (!addr || addr === "0x0000000000000000000000000000000000000000")
    return null;
  return addr;
}

export async function fetchCertificationAnalyticsForAdmin(): Promise<CertificationAnalyticsForAdmin | null> {
  const [miningAddr, certAddr] = await Promise.all([
    getMiningAddress(),
    getCertificationAddress(),
  ]);
  if (!miningAddr || !certAddr) return null;
  const cert = getContract({ client, chain: sepolia, address: certAddr });
  const mining = getContract({ client, chain: sepolia, address: miningAddr });
  try {
    const [totalCertificates, totalRejections, countCreated] =
      await Promise.all([
        readContract({
          contract: cert,
          method: "function totalCertificates() view returns (uint256)",
          params: [],
        }),
        readContract({
          contract: cert,
          method: "function totalRejections() view returns (uint256)",
          params: [],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [0],
        }),
      ]);
    let authorizedOfficerCount = BigInt(0);
    try {
      authorizedOfficerCount = (await readContract({
        contract: cert,
        method: "function authorizedOfficerCount() view returns (uint256)",
        params: [],
      })) as bigint;
    } catch {}
    return {
      authorizedOfficerCount,
      totalCertificates: totalCertificates as bigint,
      totalRejections: totalRejections as bigint,
      pendingCertifications: countCreated as bigint,
    };
  } catch {
    return null;
  }
}

export async function fetchTransportAnalyticsForAdmin(): Promise<TransportAnalyticsForAdmin | null> {
  const miningAddr = await getMiningAddress();
  if (!miningAddr) return null;
  const mining = getContract({ client, chain: sepolia, address: miningAddr });
  try {
    const [certifiedCount, inTransitCount, deliveredCount] =
      await Promise.all([
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [1],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [3],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [4],
        }),
      ]);
    let authorizedTransporterCount = BigInt(0);
    try {
      authorizedTransporterCount = (await readContract({
        contract: mining,
        method: "function authorizedTransporterCount() view returns (uint256)",
        params: [],
      })) as bigint;
    } catch {}
    return {
      authorizedTransporterCount,
      certifiedCount: certifiedCount as bigint,
      inTransitCount: inTransitCount as bigint,
      deliveredCount: deliveredCount as bigint,
    };
  } catch {
    return null;
  }
}

export async function fetchIndustryAnalyticsForAdmin(): Promise<IndustryAnalyticsForAdmin | null> {
  const [miningAddr, industryAddr] = await Promise.all([
    getMiningAddress(),
    getIndustryAddress(),
  ]);
  if (!miningAddr || !industryAddr) return null;
  const mining = getContract({ client, chain: sepolia, address: miningAddr });
  const industry = getContract({ client, chain: sepolia, address: industryAddr });
  try {
    const [deliveredQuantity, deliveredCount, consumedCount] =
      await Promise.all([
        readContract({
          contract: mining,
          method: "function deliveredQuantity() view returns (uint256)",
          params: [],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [4],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [5],
        }),
      ]);
    let authorizedIndustryCount = BigInt(0);
    try {
      authorizedIndustryCount = (await readContract({
        contract: industry,
        method: "function authorizedIndustryCount() view returns (uint256)",
        params: [],
      })) as bigint;
    } catch {}
    return {
      authorizedIndustryCount,
      deliveredQuantity: deliveredQuantity as bigint,
      deliveredCount: deliveredCount as bigint,
      consumedCount: consumedCount as bigint,
    };
  } catch {
    return null;
  }
}

export async function fetchSmartGridAnalyticsForAdmin(): Promise<SmartGridAnalyticsForAdmin | null> {
  const smartgridAddr = await getSmartGridAddress();
  if (!smartgridAddr) return null;
  const smartgrid = getContract({ client, chain: sepolia, address: smartgridAddr });
  try {
    const authorizedGridCount = (await readContract({
      contract: smartgrid,
      method: "function authorizedGridCount() view returns (uint256)",
      params: [],
    })) as bigint;
    return { authorizedGridCount: authorizedGridCount ?? BigInt(0) };
  } catch {
    return { authorizedGridCount: BigInt(0) };
  }
}

export async function fetchIndustryAnalytics(
  miningAddress: string,
): Promise<IndustryAnalytics | null> {
  const mining = getContract({
    client,
    chain: sepolia,
    address: miningAddress,
  });
  try {
      const [deliveredQuantity, count4, count5, count8] =
      await Promise.all([
        readContract({
          contract: mining,
          method: "function deliveredQuantity() view returns (uint256)",
          params: [],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [4],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [5],
        }),
        readContract({
          contract: mining,
          method: "function statusCount(uint8) view returns (uint256)",
          params: [8],
        }),
      ]);
    return {
      deliveredQuantity: deliveredQuantity as bigint,
      deliveredCount: (count4 as bigint) + (count8 as bigint),
      consumedCount: count5 as bigint,
    };
  } catch {
    return null;
  }
}

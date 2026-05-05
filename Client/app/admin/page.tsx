"use client";

import { useEffect, useState } from "react";
import { RoleShell } from "@/components/role-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RoleKey, getRoleLabel } from "@/lib/roles";
import { contract } from "@/lib/thirdweb";
import { prepareContractCall, readContract } from "thirdweb";
import { useSendTransaction } from "thirdweb/react";
import { useActiveAccount } from "thirdweb/react";
import { fetchMiningBatches, type MiningBatch } from "@/lib/onchain/mining";
import {
  fetchAllCertificates,
  fetchAllRejections,
  type CertificateRecord,
  type RejectionRecord,
} from "@/lib/onchain/certification";
import {
  fetchPendingRoleRequests,
  type RoleRequestRecord,
} from "@/lib/onchain/requests";
import {
  fetchMiningAnalytics,
  fetchCertificationAnalyticsForAdmin,
  fetchTransportAnalyticsForAdmin,
  fetchIndustryAnalyticsForAdmin,
  fetchSmartGridAnalyticsForAdmin,
  getMiningAddress,
} from "@/lib/onchain/analytics";
import { fetchDeliveryDisputes, type DeliveryDisputeRecord } from "@/lib/onchain/disputes";
import { fetchCoalRequests, type CoalRequestRecord } from "@/lib/onchain/coalRequests";
import { fetchGridRecords, type GridRecordData } from "@/lib/onchain/smartgrid";
import { getIpfsUrl, fetchIpfsContent } from "@/lib/ipfs";
import {
  Users,
  Package,
  Clock,
  CheckCircle,
  Truck,
  Factory,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ENTITY_ORDER: RoleKey[] = [
  "miner",
  "certification",
  "transporter",
  "industry",
  "smartgrid",
];

function batchIdToBytes32(id: bigint | number | string) {
  let hex = BigInt(id).toString(16);
  return '0x' + hex.padStart(64, '0');
}

export default function AdminPage() {
  const [error, setError] = useState<string | null>(null);
  const { mutate: sendTransaction, isPending } = useSendTransaction();
  const [activeEntity, setActiveEntity] = useState<
    "miner" | "certification" | "transporter" | "industry" | "smartgrid" | "alerts"
  >("miner");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    miner: true,
    certification: true,
    batches: true,
    audit: true,
    rejections: true,
  });
  const [pendingRequests, setPendingRequests] = useState<RoleRequestRecord[]>(
    [],
  );

  const [batches, setBatches] = useState<MiningBatch[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [rejections, setRejections] = useState<RejectionRecord[]>([]);
  const [minerStats, setMinerStats] = useState<{
    authorizedMiners: number;
    totalBatches: number;
    pendingCertifications: number;
    certifiedBatches: number;
    totalQuantity: number;
  } | null>(null);
  const [certStats, setCertStats] = useState<{
    authorizedOfficers: number;
    totalCertificates: number;
    totalRejections: number;
    pendingCertifications: number;
  } | null>(null);
  const [transportStats, setTransportStats] = useState<{
    authorizedTransporters: number;
    certifiedCount: number;
    inTransitCount: number;
    deliveredCount: number;
  } | null>(null);
  const [industryStats, setIndustryStats] = useState<{
    authorizedIndustries: number;
    deliveredQuantity: number;
    deliveredCount: number;
    consumedCount: number;
  } | null>(null);
  const [smartGridStats, setSmartGridStats] = useState<{
    authorizedGrids: number;
  } | null>(null);
  const [disputes, setDisputes] = useState<DeliveryDisputeRecord[]>([]);
  const [coalRequests, setCoalRequests] = useState<CoalRequestRecord[]>([]);
  const [gridRecords, setGridRecords] = useState<GridRecordData[]>([]);
  const [resolveData, setResolveData] = useState<{ id: bigint; note: string } | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<
    Record<string, string>
  >({});
  const [certPreviewOpen, setCertPreviewOpen] = useState(false);
  const [certPreviewCid, setCertPreviewCid] = useState("");
  const [contractOwner, setContractOwner] = useState<string | null>(null);
  const [miningDeployed, setMiningDeployed] = useState<boolean | null>(null);
  const account = useActiveAccount();

  useEffect(() => {
    let cancelled = false;
    async function loadOwnerAndDeploy() {
      try {
        const [owner, miningAddr] = await Promise.all([
          readContract({
            contract,
            method: "function owner() view returns (address)",
            params: [],
          }) as Promise<string>,
          readContract({
            contract,
            method: "function mining() view returns (address)",
            params: [],
          }) as Promise<string>,
        ]);
        if (!cancelled) {
          setContractOwner(owner?.toLowerCase() ?? null);
          setMiningDeployed(
            Boolean(
              miningAddr &&
              miningAddr !== "0x0000000000000000000000000000000000000000",
            ),
          );
        }
      } catch {
        if (!cancelled) setContractOwner(null);
      }
    }
    loadOwnerAndDeploy();
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [
          batchRes,
          certs,
          requests,
          miningAnalytics,
          certAnalytics,
          transportAnalytics,
          industryAnalytics,
          smartGridAnalytics,
          allDisputesData,
          allReqs,
        ] = await Promise.all([
          fetchMiningBatches({ limit: 250 }),
          fetchAllCertificates(),
          fetchPendingRoleRequests(),
          getMiningAddress().then((a) =>
            a ? fetchMiningAnalytics(a) : null,
          ),
          fetchCertificationAnalyticsForAdmin(),
          fetchTransportAnalyticsForAdmin(),
          fetchIndustryAnalyticsForAdmin(),
          fetchSmartGridAnalyticsForAdmin(),
          fetchDeliveryDisputes(),
          fetchCoalRequests(),
        ]);
        const rejs = await fetchAllRejections();
        if (cancelled) return;
        const allBatches = batchRes.batches;
        
        const consumedOrDeliveredIds = allBatches
          .filter(b => b.status === "Consumed" || b.status === "Delivered")
          .map(b => batchIdToBytes32(b.id));
        const gridRecs = await fetchGridRecords(consumedOrDeliveredIds);
        
        setDisputes(allDisputesData || []);
        setGridRecords(gridRecs);
        setCoalRequests(allReqs || []);

        setBatches(allBatches);
        setCertificates(certs);
        setRejections(rejs);
        setPendingRequests(requests);
        if (miningAnalytics) {
          setMinerStats({
            authorizedMiners: Number(miningAnalytics.authorizedMinerCount),
            totalBatches: Number(miningAnalytics.batchCounter),
            pendingCertifications: Number(miningAnalytics.countCreated),
            certifiedBatches: Number(miningAnalytics.countCertified),
            totalQuantity: Number(miningAnalytics.totalQuantity),
          });
        } else {
          setMinerStats({
            authorizedMiners: new Set(allBatches.map((b) => b.miner.toLowerCase())).size,
            totalBatches: allBatches.length,
            pendingCertifications: allBatches.filter((b) => b.status === "Created").length,
            certifiedBatches: allBatches.filter((b) => b.status === "Certified").length,
            totalQuantity: allBatches.reduce((s, b) => s + Number(b.quantity), 0),
          });
        }
        if (certAnalytics) {
          setCertStats({
            authorizedOfficers: Number(certAnalytics.authorizedOfficerCount),
            totalCertificates: Number(certAnalytics.totalCertificates),
            totalRejections: Number(certAnalytics.totalRejections),
            pendingCertifications: Number(certAnalytics.pendingCertifications),
          });
        } else setCertStats(null);
        if (transportAnalytics) {
          setTransportStats({
            authorizedTransporters: Number(transportAnalytics.authorizedTransporterCount),
            certifiedCount: Number(transportAnalytics.certifiedCount),
            inTransitCount: Number(transportAnalytics.inTransitCount),
            deliveredCount: Number(transportAnalytics.deliveredCount),
          });
        } else setTransportStats(null);
        if (industryAnalytics) {
          setIndustryStats({
            authorizedIndustries: Number(industryAnalytics.authorizedIndustryCount),
            deliveredQuantity: Number(industryAnalytics.deliveredQuantity),
            deliveredCount: Number(industryAnalytics.deliveredCount),
            consumedCount: Number(industryAnalytics.consumedCount),
          });
        } else setIndustryStats(null);
        if (smartGridAnalytics) {
          setSmartGridStats({
            authorizedGrids: Number(smartGridAnalytics.authorizedGridCount),
          });
        } else setSmartGridStats(null);
      } catch (e) {
        if (!cancelled) console.error("Admin chain load failed", e);
      }
    }
    load();
    const t = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchReasons() {
      const results = await Promise.all(
        rejections.map(async (r) => {
          const key = `${r.batchId}-${r.rejectedAt}`;
          const text = await fetchIpfsContent(r.reasonHash);
          return { key, text: text || "—" };
        }),
      );
      if (!cancelled) {
        setRejectionReasons((prev) => {
          const next = { ...prev };
          for (const { key, text } of results) next[key] = text;
          return next;
        });
      }
    }
    fetchReasons();
    return () => {
      cancelled = true;
    };
  }, [rejections]);

  const handleAccept = (index: number) => {
    setError(null);
    const tx = prepareContractCall({
      contract,
      method: "function approveRequest(uint256 index)",
      params: [BigInt(index)],
    });
    sendTransaction(tx, {
      onSuccess: () => {},
      onError: (err) => {
        console.error("Approve tx failed", err);
        const msg = (err?.message ?? String(err)).trim();
        if (
          msg.toLowerCase().includes("rejected") ||
          msg.toLowerCase().includes("denied")
        ) {
          setError("Transaction was rejected in your wallet.");
        } else if (
          msg.includes("execution reverted") ||
          msg.includes("reverted")
        ) {
          setError(
            "Transaction reverted on-chain. Check: (1) Your wallet matches the contract owner, (2) deployAll was called, (3) The role request is still pending.",
          );
        } else {
          setError(msg || "Transaction failed.");
        }
      },
    });
  };

  const handleReject = (index: number) => {
    setError(null);
    const tx = prepareContractCall({
      contract,
      method: "function rejectRequest(uint256 index)",
      params: [BigInt(index)],
    });
    sendTransaction(tx, {
      onSuccess: () => {},
      onError: (err) => {
        console.error("Reject tx failed", err);
        const msg = (err?.message ?? String(err)).trim();
        if (
          msg.toLowerCase().includes("rejected") ||
          msg.toLowerCase().includes("denied")
        ) {
          setError("Transaction was rejected in your wallet.");
        } else if (
          msg.includes("execution reverted") ||
          msg.includes("reverted")
        ) {
          setError(
            "Transaction reverted on-chain. Check: (1) Your wallet matches the contract owner, (2) deployAll was called, (3) The role request is still pending.",
          );
        } else {
          setError(msg || "Transaction failed.");
        }
      },
    });
  };

  const handleResolveDispute = () => {
    if (!resolveData) return;
    setError(null);
    const tx = prepareContractCall({
      contract,
      method: "function resolveDispute(uint256,string)",
      params: [resolveData.id, resolveData.note],
    });
    sendTransaction(tx, {
      onSuccess: () => {
        setResolveData(null);
      },
      onError: (err) => {
        console.error("Resolve failed", err);
        setError("Failed to resolve dispute. Ensure you are the owner.");
      },
    });
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sortedBatches = [...batches].sort((a, b) =>
    Number(b.timestamp - a.timestamp),
  );
  const sortedCerts = [...certificates].sort((a, b) =>
    Number(b.issuedAt - a.issuedAt),
  );
  const sortedRejections = [...rejections].sort((a, b) =>
    Number(b.rejectedAt - a.rejectedAt),
  );
  const batchById = new Map(sortedBatches.map((b) => [b.id.toString(), b]));
  const requestByBatchId = new Map(coalRequests.map((r) => [r.batchId.toString(), r]));

  // Entity-specific filtered data
  const minerBatches = sortedBatches.filter(b => 
    ['Created', 'Certified', 'Rejected'].includes(b.status)
  );
  const transportBatches = sortedBatches.filter(b => 
    ['Certified', 'InTransit', 'Delivered', 'Disputed'].includes(b.status)
  );
  const industryBatches = sortedBatches.filter(b => 
    ['Delivered', 'Received', 'Consumed'].includes(b.status)
  );
  const smartGridBatches = sortedBatches.filter(b => 
    b.status === 'Consumed' && gridRecords.some(gr => gr.batchId === batchIdToBytes32(b.id))
  );

  const displayBatches = 
    activeEntity === 'miner' ? minerBatches :
    activeEntity === 'transporter' ? transportBatches :
    activeEntity === 'industry' ? industryBatches :
    activeEntity === 'smartgrid' ? smartGridBatches :
    [];

  return (
    <RoleShell roleKey="owner" title="Admin / Governance Dashboard">
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Approve or reject role requests. All data below is read from the
          blockchain.
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Entity tabs */}
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-background p-1 text-sm">
          {[
            "miner",
            "certification",
            "transporter",
            "industry",
            "smartgrid",
            "alerts",
          ].map((key) => {
            const label =
              key === "miner"
                ? "Miner"
                : key === "certification"
                  ? "Certification"
                  : key === "transporter"
                    ? "Transport"
                    : key === "industry"
                      ? "Industry"
                      : key === "smartgrid"
                        ? "Smart Grid"
                        : "Disputes & Flags";
            const active = activeEntity === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveEntity(key as any)}
                className={`px-3 py-1.5 rounded-md border text-xs sm:text-sm transition ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground/70 border-transparent hover:bg-muted"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Entity-specific Analytics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeEntity === "miner" && (
            minerStats &&
            [
              { label: "Authorized Miners", value: minerStats.authorizedMiners, icon: Users },
              { label: "Total Batches", value: minerStats.totalBatches, icon: Package },
              { label: "Pending Certifications", value: minerStats.pendingCertifications, icon: Clock },
              { label: "Certified Batches", value: minerStats.certifiedBatches, icon: CheckCircle },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="p-4 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                  </div>
                  <Icon className="w-10 h-10 text-primary/70" />
                </div>
              </Card>
            )))}
          {activeEntity === "certification" && (
            certStats &&
            [
              { label: "Authorized Officers", value: certStats.authorizedOfficers, icon: Users },
              { label: "Total Certificates", value: certStats.totalCertificates, icon: CheckCircle },
              { label: "Total Rejections", value: certStats.totalRejections, icon: Clock },
              { label: "Pending Certifications", value: certStats.pendingCertifications, icon: Clock },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="p-4 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                  </div>
                  <Icon className="w-10 h-10 text-primary/70" />
                </div>
              </Card>
            )))}
          {activeEntity === "transporter" && (
            transportStats &&
            [
              { label: "Authorized Transporters", value: transportStats.authorizedTransporters, icon: Truck },
              { label: "Certified (Ready)", value: transportStats.certifiedCount, icon: CheckCircle },
              { label: "In Transit", value: transportStats.inTransitCount, icon: Truck },
              { label: "Delivered", value: transportStats.deliveredCount, icon: Package },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="p-4 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                  </div>
                  <Icon className="w-10 h-10 text-primary/70" />
                </div>
              </Card>
            )))}
          {activeEntity === "industry" && (
            industryStats &&
            [
              { label: "Authorized Industries", value: industryStats.authorizedIndustries, icon: Factory },
              { label: "Delivered Quantity (tons)", value: industryStats.deliveredQuantity, icon: Package },
              { label: "Delivered Batches", value: industryStats.deliveredCount, icon: Package },
              { label: "Consumed Batches", value: industryStats.consumedCount, icon: CheckCircle },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="p-4 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                  </div>
                  <Icon className="w-10 h-10 text-primary/70" />
                </div>
              </Card>
            )))}
          {activeEntity === "smartgrid" && (
            smartGridStats &&
            [
              { label: "Authorized Grids", value: smartGridStats.authorizedGrids, icon: Zap },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="p-4 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                  </div>
                  <Icon className="w-10 h-10 text-primary/70" />
                </div>
              </Card>
            )))}
          {!minerStats && !certStats && !transportStats && !industryStats && !smartGridStats && (
            <Card className="p-4 border border-border col-span-full">
              <p className="text-sm text-muted-foreground">Loading analytics…</p>
            </Card>
          )}
        </div>

        {/* Role Request Tables - from blockchain, show for active entity */}
        {ENTITY_ORDER.filter((role) => role === activeEntity).map((role) => {
          const roleRequests = pendingRequests.filter((r) => r.role === role);
          const open = openSections[role] ?? true;
          return (
            <Card key={role} className="p-4 border border-border">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleSection(role)}
              >
                <div>
                  <h2 className="text-lg font-semibold">
                    {getRoleLabel(role)} Requests
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-foreground/70">
                    <span>Pending: {roleRequests.length}</span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {open ? "Hide" : "Show"}
                </span>
              </div>
              {open && (
                <div className="mt-4">
                  {roleRequests.length === 0 ? (
                    <p className="text-sm text-foreground/70">
                      No pending requests.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-border">
                          <tr className="text-foreground/70">
                            <th className="text-left py-2 px-3 font-medium">
                              Wallet Address
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Requested At
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {roleRequests.map((req) => (
                            <tr
                              key={`${req.index}-${req.wallet}`}
                              className="border-b border-border/50"
                            >
                              <td className="py-2 px-3 font-mono">{`${req.wallet.slice(0, 6)}...${req.wallet.slice(-4)}`}</td>
                              <td className="py-2 px-3 text-foreground/70">
                                {new Date(
                                  Number(req.requestedAt) * 1000,
                                ).toLocaleString()}
                              </td>
                              <td className="py-2 px-3 flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={isPending}
                                  onClick={() => handleAccept(req.index)}
                                >
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isPending}
                                  onClick={() => handleReject(req.index)}
                                >
                                  Reject
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {/* Entity-specific history */}
        {activeEntity !== "certification" && activeEntity !== "alerts" && (
          <Card className="p-4 border border-border">
            <div
              className="flex items-center justify-between cursor-pointer select-none"
              onClick={() => toggleSection("batches")}
            >
              <h2 className="text-lg font-semibold">
                {activeEntity === "miner"
                  ? "Mining Operations History"
                  : activeEntity === "transporter"
                    ? "Logistics & Transport History"
                    : activeEntity === "industry"
                      ? "Industry Receipt & Consumption"
                      : "Power Plant Grid Analytics"}
              </h2>
              <span className="text-xs text-muted-foreground">
                {openSections.batches ? "Hide" : "Show"}
              </span>
            </div>
            {openSections.batches && (
              <div className="mt-4 overflow-x-auto">
                {displayBatches.length === 0 ? (
                  <p className="text-sm text-foreground/70">
                    No relevant batches found for this section.
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr className="text-foreground/70">
                        <th className="text-left py-2 px-3 font-medium">Batch ID</th>
                        {activeEntity === "miner" && (
                          <>
                            <th className="text-left py-2 px-3 font-medium">Miner</th>
                            <th className="text-left py-2 px-3 font-medium">Location</th>
                            <th className="text-left py-2 px-3 font-medium">Grade</th>
                          </>
                        )}
                        {(activeEntity === "transporter" || activeEntity === "industry") && (
                          <>
                            <th className="text-left py-2 px-3 font-medium">Source</th>
                            <th className="text-left py-2 px-3 font-medium">Grade</th>
                          </>
                        )}
                        {activeEntity === "transporter" && (
                          <th className="text-left py-2 px-3 font-medium">Transporter</th>
                        )}
                        {activeEntity === "industry" && (
                          <th className="text-left py-2 px-3 font-medium">Grade</th>
                        )}
                        {activeEntity === "smartgrid" && (
                          <>
                            <th className="text-left py-2 px-3 font-medium">Power Plant</th>
                            <th className="text-left py-2 px-3 font-medium">Efficiency</th>
                          </>
                        )}
                        <th className="text-left py-2 px-3 font-medium">Quantity</th>
                        <th className="text-left py-2 px-3 font-medium">Status</th>
                        <th className="text-left py-2 px-3 font-medium">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayBatches.map((b) => {
                        const req = requestByBatchId.get(b.id.toString());
                        const gridRec = gridRecords.find(gr => gr.batchId === batchIdToBytes32(b.id));
                        return (
                          <tr key={String(b.id)} className="border-b border-border/50">
                            <td className="py-2 px-3 font-mono">{String(b.id)}</td>
                            {activeEntity === "miner" && (
                              <>
                                <td className="py-2 px-3 font-mono">{`${b.miner.slice(0, 6)}...${b.miner.slice(-4)}`}</td>
                                <td className="py-2 px-3">{b.location}</td>
                                <td className="py-2 px-3">{b.grade}</td>
                              </>
                            )}
                            {(activeEntity === "transporter" || activeEntity === "industry") && (
                              <>
                                <td className="py-2 px-3">{b.location}</td>
                                <td className="py-2 px-3">{b.grade}</td>
                              </>
                            )}
                            {activeEntity === "transporter" && (
                              <td className="py-2 px-3 font-mono">
                                {req?.assignedTransporter && req.assignedTransporter !== "0x0000000000000000000000000000000000000000"
                                  ? `${req.assignedTransporter.slice(0, 6)}...${req.assignedTransporter.slice(-4)}`
                                  : "Unassigned"}
                              </td>
                            )}
                            {activeEntity === "industry" && (
                              <td className="py-2 px-3">{b.grade}</td>
                            )}
                            {activeEntity === "smartgrid" && (
                              <>
                                <td className="py-2 px-3 font-mono">
                                  {req?.consumer ? `${req.consumer.slice(0, 6)}...${req.consumer.slice(-4)}` : "—"}
                                </td>
                                <td className="py-2 px-3">
                                  {gridRec ? (
                                    <span className={gridRec.discrepancyFlagged ? "text-red-500" : "text-green-500"}>
                                      {Number(gridRec.efficiencyRatio)}%
                                    </span>
                                  ) : "—"}
                                </td>
                              </>
                            )}
                            <td className="py-2 px-3">{Number(b.quantity)} tons</td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                b.status === 'Consumed' ? 'bg-blue-500/10 text-blue-500' :
                                b.status === 'Delivered' || b.status === 'Received' ? 'bg-green-500/10 text-green-500' :
                                b.status === 'Rejected' ? 'bg-red-500/10 text-red-500' :
                                'bg-primary/10 text-primary'
                              }`}>
                                {b.status}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-foreground/70">
                              {new Date(Number(b.timestamp) * 1000).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </Card>
        )}

        {activeEntity === "certification" && (
          <>
            <Card className="p-4 border border-border">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleSection("audit")}
              >
                <h2 className="text-lg font-semibold">Certification Audit</h2>
                <span className="text-xs text-muted-foreground">
                  {openSections.audit ? "Hide" : "Show"}
                </span>
              </div>
              {openSections.audit && (
                <div className="mt-4 overflow-x-auto">
                  {sortedCerts.length === 0 ? (
                    <p className="text-sm text-foreground/70">
                      No certificates on-chain.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="border-b border-border">
                        <tr className="text-foreground/70">
                          <th className="text-left py-2 px-3 font-medium">
                            Batch ID
                          </th>
                          <th className="text-left py-2 px-3 font-medium">
                            Location
                          </th>
                          
                          <th className="text-left py-2 px-3 font-medium">
                            Grade
                          </th>
                          <th className="text-left py-2 px-3 font-medium">
                            Quantity (tons)
                          </th>
                          <th className="text-left py-2 px-3 font-medium">
                            Batch Status
                          </th>
                          <th className="text-left py-2 px-3 font-medium">
                            Officer Wallet
                          </th>
                          <th className="text-left py-2 px-3 font-medium">
                            Certificate
                          </th>
                          <th className="text-left py-2 px-3 font-medium">
                            Timestamp
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCerts.map((c) => {
                          const batch = batchById.get(c.batchId.toString());
                          return (
                            <tr
                              key={`${c.batchId}-${c.issuedAt}`}
                              className="border-b border-border/50"
                            >
                              <td className="py-2 px-3 font-mono">
                                {String(c.batchId)}
                              </td>
                              <td className="py-2 px-3">
                                {batch?.location ?? "—"}
                              </td>
            
                              <td className="py-2 px-3">
                                {batch?.grade ?? "—"}
                              </td>
                              <td className="py-2 px-3">
                                {batch ? Number(batch.quantity) : "—"}
                              </td>
                              <td className="py-2 px-3">
                                {batch ? (
                                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                    {batch.status}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono">
                                {`${c.issuedBy.slice(0, 6)}...${c.issuedBy.slice(-4)}`}
                              </td>
                              <td className="py-2 px-3">
                                {c.certificateHash?.trim() ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setCertPreviewCid(c.certificateHash);
                                      setCertPreviewOpen(true);
                                    }}
                                  >
                                    View
                                  </Button>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="py-2 px-3 text-foreground/70">
                                {new Date(
                                  Number(c.issuedAt) * 1000,
                                ).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-4 border border-border">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => toggleSection("rejections")}
              >
                <h2 className="text-lg font-semibold">Rejection Audit</h2>
                <span className="text-xs text-muted-foreground">
                  {openSections.rejections ? "Hide" : "Show"}
                </span>
              </div>
              {openSections.rejections && (
                <div className="mt-4 overflow-x-auto">
                  {sortedRejections.length === 0 ? (
                    <p className="text-sm text-foreground/70">
                      No rejections on-chain.
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="border-b border-border">
                        <tr className="text-foreground/70">
                          <th className="text-left py-2 px-3 font-medium">
                            Batch ID
                          </th>
                          <th className="text-left py-2 px-3 font-medium">
                            Officer Wallet
                          </th>
                          <th className="text-left py-2 px-3 font-medium">
                            Rejection Reason
                          </th>
                          <th className="text-left py-2 px-3 font-medium">
                            Timestamp
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedRejections.map((r) => (
                          <tr
                            key={`${r.batchId}-${r.rejectedAt}`}
                            className="border-b border-border/50"
                          >
                            <td className="py-2 px-3 font-mono">
                              {String(r.batchId)}
                            </td>
                            <td className="py-2 px-3 font-mono">
                              {`${r.rejectedBy.slice(0, 6)}...${r.rejectedBy.slice(-4)}`}
                            </td>
                            <td
                              className="py-2 px-3 max-w-xs truncate text-foreground/80"
                              title={
                                rejectionReasons[`${r.batchId}-${r.rejectedAt}`]
                              }
                            >
                              {rejectionReasons[
                                `${r.batchId}-${r.rejectedAt}`
                              ] ?? "…"}
                            </td>
                            <td className="py-2 px-3 text-foreground/70">
                              {new Date(
                                Number(r.rejectedAt) * 1000,
                              ).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </Card>
          </>
        )}

        {/* Disputes and Flags Section */}
        {activeEntity === "alerts" && (
          <div className="space-y-6">
            <Card className="p-4 border border-border">
              <h2 className="text-lg font-semibold mb-4">Delivery Disputes</h2>
              {disputes.length === 0 ? (
                <p className="text-sm text-foreground/70">No disputes recorded.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr className="text-foreground/70">
                        <th className="text-left py-2 px-3 font-medium">Dispute ID</th>
                        <th className="text-left py-2 px-3 font-medium">Batch ID</th>
                        <th className="text-left py-2 px-3 font-medium">Transporter</th>
                        <th className="text-left py-2 px-3 font-medium">Consumer</th>
                        <th className="text-left py-2 px-3 font-medium">Status</th>
                        <th className="text-left py-2 px-3 font-medium">Note</th>
                        <th className="text-left py-2 px-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disputes.map((d) => (
                        <tr key={d.id.toString()} className="border-b border-border/50">
                          <td className="py-2 px-3 font-mono">{d.id.toString()}</td>
                          <td className="py-2 px-3 font-mono">{d.batchId.toString()}</td>
                          <td className="py-2 px-3 font-mono">{`${d.transporter.slice(0, 6)}...${d.transporter.slice(-4)}`}</td>
                          <td className="py-2 px-3 font-mono">{`${d.consumer.slice(0, 6)}...${d.consumer.slice(-4)}`}</td>
                          <td className="py-2 px-3">
                            {d.resolved ? (
                              <span className="text-green-500 bg-green-500/10 px-2 py-1 rounded-full text-xs font-medium">Resolved</span>
                            ) : (
                              <span className="text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded-full text-xs font-medium">Pending</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-foreground/70 truncate max-w-xs">{d.resolutionNote || "—"}</td>
                          <td className="py-2 px-3">
                            {!d.resolved && (
                              <Button
                                size="sm"
                                disabled={isPending}
                                onClick={() => setResolveData({ id: d.id, note: "" })}
                              >
                                Resolve
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="p-4 border border-border">
              <h2 className="text-lg font-semibold mb-4">Grid Discrepancy Flags</h2>
              {gridRecords.filter(r => r.discrepancyFlagged).length === 0 ? (
                <p className="text-sm text-foreground/70">No discrepancies flagged.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border">
                      <tr className="text-foreground/70">
                        <th className="text-left py-2 px-3 font-medium">Batch (bytes32)</th>
                        <th className="text-left py-2 px-3 font-medium">Power Plant</th>
                        <th className="text-left py-2 px-3 font-medium">Efficiency</th>
                        <th className="text-left py-2 px-3 font-medium">Recorded At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gridRecords.filter(r => r.discrepancyFlagged).map((r) => (
                        <tr key={r.batchId} className="border-b border-border/50">
                          <td className="py-2 px-3 font-mono">{`${r.batchId.slice(0, 10)}...${r.batchId.slice(-6)}`}</td>
                          <td className="py-2 px-3 font-mono">{`${r.powerPlant.slice(0, 6)}...${r.powerPlant.slice(-4)}`}</td>
                          <td className="py-2 px-3 text-red-500 font-medium">{Number(r.efficiencyRatio)}%</td>
                          <td className="py-2 px-3 text-foreground/70">
                            {new Date(Number(r.recordedAt) * 1000).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      <Dialog open={!!resolveData} onOpenChange={(open) => !open && setResolveData(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Dispute</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-foreground/70">
              Provide a resolution note. This will be recorded on-chain permanently.
            </p>
            <input
              type="text"
              placeholder="e.g. Refund issued / Data corrected"
              className="w-full flex h-10 rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={resolveData?.note ?? ""}
              onChange={(e) => setResolveData(prev => prev ? { ...prev, note: e.target.value } : null)}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setResolveData(null)}>Cancel</Button>
              <Button disabled={isPending} onClick={handleResolveDispute}>Submit Resolution</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={certPreviewOpen} onOpenChange={setCertPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Certificate</DialogTitle>
          </DialogHeader>
          {certPreviewCid ? (
            <iframe
              title="Certificate"
              src={getIpfsUrl(certPreviewCid)}
              className="w-full h-[70vh] rounded border border-border"
            />
          ) : (
            <p className="text-sm text-foreground/70">
              Certificate not available.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </RoleShell>
  );
}

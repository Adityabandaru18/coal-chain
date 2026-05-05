'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RoleShell } from '@/components/role-shell'
import { Building2, TrendingUp, CheckCircle, Search, Factory, X } from 'lucide-react'
import { getContract, prepareContractCall, readContract } from 'thirdweb'
import { useActiveAccount, useSendTransaction } from 'thirdweb/react'
import { sepolia } from 'thirdweb/chains'
import { client, contract as factoryContract } from '@/lib/thirdweb'
import { fetchMiningBatches, type MiningBatch } from '@/lib/onchain/mining'
import { fetchAllCertificates, type CertificateRecord } from '@/lib/onchain/certification'
import { fetchIndustryAnalytics } from '@/lib/onchain/analytics'
import { fetchCoalRequests, type CoalRequestRecord } from '@/lib/onchain/coalRequests'
import { fetchPendingRoleRequests } from '@/lib/onchain/requests'
import { getIpfsUrl } from '@/lib/ipfs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function IndustryDashboard() {
  const account = useActiveAccount()
  const { mutate: sendTransaction, isPending: txPending } = useSendTransaction()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [miningAddress, setMiningAddress] = useState<string | null>(null)
  const [industryAddress, setIndustryAddress] = useState<string | null>(null)

  const [batches, setBatches] = useState<MiningBatch[]>([])
  const [requests, setRequests] = useState<CoalRequestRecord[]>([])
  const [consumerType, setConsumerType] = useState<number | null>(null) // 0 = POWER, 1 = MFG
  const [industryAnalytics, setIndustryAnalytics] = useState<Awaited<ReturnType<typeof fetchIndustryAnalytics>>>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const [filterLocation, setFilterLocation] = useState('')
  const [filterGrade, setFilterGrade] = useState('')
  const [filterMinQty, setFilterMinQty] = useState('')
  const [filterMaxQty, setFilterMaxQty] = useState('')
  const [certificates, setCertificates] = useState<CertificateRecord[]>([])

  // Modal states
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState<bigint | null>(null)
  const [reqDestination, setReqDestination] = useState('')

  const [consumeModalOpen, setConsumeModalOpen] = useState(false)
  const [consumeBatchId, setConsumeBatchId] = useState<bigint | null>(null)
  const [powerGen, setPowerGen] = useState('')
  const [qtyBurned, setQtyBurned] = useState('')
  const [prefilledCalorific, setPrefilledCalorific] = useState('')

  const [certPreviewOpen, setCertPreviewOpen] = useState(false)
  const [certPreviewCid, setCertPreviewCid] = useState('')

  const [pendingTxBatchIds, setPendingTxBatchIds] = useState<Set<string>>(new Set())
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const clearFilters = () => {
    setFilterLocation('')
    setFilterGrade('')
    setFilterMinQty('')
    setFilterMaxQty('')
  }

  useEffect(() => {
    let cancelled = false

    async function load(isBackgroundRefresh: boolean) {
      if (!account) {
        setBatches([])
        setError(null)
        setLoading(false)
        return
      }

      if (!isBackgroundRefresh) setLoading(true)
      setError(null)
      try {
        const [mining, industry] = (await Promise.all([
          readContract({
            contract: factoryContract,
            method: 'function mining() view returns (address)',
            params: [],
          }),
          readContract({
            contract: factoryContract,
            method: 'function industry() view returns (address)',
            params: [],
          }),
        ])) as [string, string]

        if (!mining || mining === '0x0000000000000000000000000000000000000000') {
          if (!cancelled) {
            setMiningAddress(null)
            setIndustryAddress(null)
            setBatches([])
            setLoading(false)
          }
          return
        }

        if (!industry || industry === '0x0000000000000000000000000000000000000000') {
          if (!cancelled) {
            setMiningAddress(mining)
            setIndustryAddress(null)
            setBatches([])
            setLoading(false)
          }
          return
        }

        const [{ batches }, certs, allReqs, roles] = await Promise.all([
          fetchMiningBatches({ limit: 250 }),
          fetchAllCertificates(),
          fetchCoalRequests(),
          fetchPendingRoleRequests()
        ])
        const analytics = mining ? await fetchIndustryAnalytics(mining) : null

          if (!cancelled) {
            setMiningAddress(mining)
            setIndustryAddress(industry)
            setBatches(batches)
            setCertificates(certs)
            setIndustryAnalytics(analytics)
            
            const myReqs = allReqs.filter(r => r.consumer.toLowerCase() === account.address.toLowerCase())
            setRequests(myReqs)

            // Read consumer type directly from contract for the current user
            try {
              const cType = await readContract({
                contract: getContract({ client, chain: sepolia, address: industry }),
                method: "function getConsumerType(address) view returns (uint8)",
                params: [account.address],
              });
              setConsumerType(Number(cType));
            } catch (err) {
              console.error("Failed to fetch consumer type", err);
              // Default to Manufacturing (1) if read fails for some reason
              setConsumerType(1);
            }

            setLoading(false)
          }
      } catch (e) {
        console.error('Failed to load industry data', e)
        if (!cancelled) {
          setError('Failed to load batches from the blockchain.')
          setBatches([])
          setLoading(false)
        }
      }
    }

    load(false)
    const poll = window.setInterval(() => load(true), 15000)

    return () => {
      cancelled = true
      window.clearInterval(poll)
    }
  }, [account, reloadNonce])

  const delivered = useMemo(() => batches.filter((b) => b.status === 'Delivered'), [batches])
  const consumed = useMemo(() => batches.filter((b) => b.status === 'Consumed'), [batches])

  const certifiedBatches = useMemo(() => batches.filter(b => b.status === 'Certified'), [batches])

  const filteredCertifiedBatches = useMemo(() => {
    let result = certifiedBatches

    if (filterLocation.trim()) {
      const loc = filterLocation.toLowerCase()
      result = result.filter(b => b.location.toLowerCase().includes(loc))
    }

    if (filterGrade.trim()) {
      const grade = filterGrade.toLowerCase()
      result = result.filter(b => b.grade.toLowerCase().includes(grade))
    }

    if (filterMinQty.trim()) {
      const min = Number(filterMinQty)
      if (!isNaN(min)) {
        result = result.filter(b => Number(b.quantity) >= min)
      }
    }

    if (filterMaxQty.trim()) {
      const max = Number(filterMaxQty)
      if (!isNaN(max)) {
        result = result.filter(b => Number(b.quantity) <= max)
      }
    }

    return result
  }, [certifiedBatches, filterLocation, filterGrade, filterMinQty, filterMaxQty])

  const filteredDeliveredBatches = useMemo(() => {
    // Current delivered filtering (legacy search term removed, keeping it simple or using same filters if logical)
    return delivered
  }, [delivered])

  const certByBatchId = useMemo(() => {
    const m = new Map<string, CertificateRecord>()
    certificates.forEach((c) => m.set(c.batchId.toString(), c))
    return m
  }, [certificates])

  const selectedConsumeBatch = useMemo(
    () => (consumeBatchId ? batches.find((b) => b.id === consumeBatchId) ?? null : null),
    [batches, consumeBatchId],
  )

  const handlePurchaseRequest = () => {
    if (!miningAddress || !selectedBatchId) return
    if (!reqDestination) {
      setError('Please fill all fields')
      return;
    }
    setError(null)
    const mining = getContract({ client, chain: sepolia, address: miningAddress })

    const tx = prepareContractCall({
      contract: mining,
      method: 'function createCoalRequest(uint256 batchId,string destination,uint8 consumerType)',
      params: [selectedBatchId, reqDestination, consumerType ?? 1],
    })

    sendTransaction(tx, {
      onSuccess: () => {
        setReqDestination('')
        setRequestModalOpen(false)
        setReloadNonce((n) => n + 1)
      },
      onError: (err) => {
        console.error('createCoalRequest failed', err)
        setError('Transaction failed. Ensure quantity is available and wallet is authorized.')
      },
    })
  }

  const handleConfirmDelivery = (batchId: bigint) => {
    if (!industryAddress || !miningAddress) {
      setError('System addresses missing. Please wait for the dashboard to load.')
      return
    }
    const bIdStr = batchId.toString()
    setError(null)
    setSuccessMessage(null)
    setPendingTxBatchIds(prev => new Set(prev).add(bIdStr))
    
    const industry = getContract({ client, chain: sepolia, address: industryAddress })
    const tx = prepareContractCall({
      contract: industry,
      method: 'function confirmDelivery(address miningAddress, uint256 batchId)',
      params: [miningAddress, batchId],
    })
    sendTransaction(tx, {
      onSuccess: () => {
        setReloadNonce(n => n + 1)
        setPendingTxBatchIds(prev => {
          const next = new Set(prev)
          next.delete(bIdStr)
          return next
        })
        setSuccessMessage(`Delivery for Batch #${bIdStr} confirmed successfully!`)
      },
      onError: (err) => {
        console.error('confirmDelivery failed', err)
        setError('Failed to confirm delivery. Check your wallet or permissions.')
        setPendingTxBatchIds(prev => {
          const next = new Set(prev)
          next.delete(bIdStr)
          return next
        })
      }
    })
  }

  const handleReportDispute = (batchId: bigint, transporter: string) => {
    if (!industryAddress || !miningAddress) {
       setError('System addresses missing.')
       return
    }
    const bIdStr = batchId.toString()
    setError(null)
    setPendingTxBatchIds(prev => new Set(prev).add(bIdStr))

    const industry = getContract({ client, chain: sepolia, address: industryAddress })
    const tx = prepareContractCall({
      contract: industry,
      method: 'function reportNonDelivery(address miningAddress, uint256 batchId, address transporter, string reasonHash)',
      params: [miningAddress, batchId, transporter, "Non-delivery reported by consumer"],
    })
    sendTransaction(tx, {
      onSuccess: () => {
        setReloadNonce(n => n + 1)
        setPendingTxBatchIds(prev => {
          const next = new Set(prev)
          next.delete(bIdStr)
          return next
        })
      },
      onError: (err) => {
        console.error('reportNonDelivery failed', err)
        setError('Failed to raise dispute.')
        setPendingTxBatchIds(prev => {
          const next = new Set(prev)
          next.delete(bIdStr)
          return next
        })
      }
    })
  }

  const handleConsume = () => {
    if (!miningAddress || !industryAddress || !consumeBatchId) return
    
    const powerNum = Number(powerGen)
    const qtyBurnedNum = Number(qtyBurned)
    const calorificNum = Number(prefilledCalorific)
    
    if (consumerType === 0) {
      if (!Number.isFinite(qtyBurnedNum) || qtyBurnedNum <= 0) {
        setError('Quantity burned must be a positive number.')
        return
      }
      if (!Number.isFinite(calorificNum) || calorificNum <= 0) {
        setError('Calorific value missing from certificate. Please contact CA.')
        return
      }
      if (!Number.isFinite(powerNum) || powerNum <= 0) {
        setError('Power generated must be a positive number for Power Plants.')
        return
      }
    }

    setError(null)
    const industry = getContract({ client, chain: sepolia, address: industryAddress })
    
    const tx = prepareContractCall({
      contract: industry,
      method: 'function consumeBatch(address miningAddress,uint256 batchId,uint256 startTimestamp,uint256 endTimestamp,uint256 quantityBurned,uint256 calorificValue,uint256 claimedGeneration)',
      params: [
        miningAddress, 
        consumeBatchId, 
        BigInt(Math.floor(Date.now() / 1000) - 3600), 
        BigInt(Math.floor(Date.now() / 1000)),
        BigInt(Math.floor(qtyBurnedNum)),
        BigInt(Math.floor(calorificNum)),
        BigInt(Math.floor(powerNum))
      ],
    })

    sendTransaction(tx, {
      onSuccess: () => {
        setPowerGen('')
        setQtyBurned('')
        setPrefilledCalorific('')
        setConsumeModalOpen(false)
        setReloadNonce((n) => n + 1)
      },
      onError: (err) => {
        console.error('consumeBatch failed', err)
        setError('Transaction failed. Ensure this wallet is an authorized industry consumer.')
      },
    })
  }

  const totalInventory = industryAnalytics
    ? Number(industryAnalytics.deliveredQuantity)
    : delivered.reduce((sum, b) => sum + Number(b.quantity), 0)
  const deliveredCount = industryAnalytics
    ? Number(industryAnalytics.deliveredCount)
    : delivered.length
  const consumedCount = industryAnalytics
    ? Number(industryAnalytics.consumedCount)
    : consumed.length

  return (
    <RoleShell roleKey="industry" title="">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              {consumerType === 0 ? 'Power Plant Operations' : 'Manufacturing Unit Inventory'}
            </h2>
            <p className="text-foreground/70 mt-2">
              Request coal from certified batches, track orders, and manage inventory.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
        {successMessage && <p className="text-sm text-green-500 mb-4">{successMessage}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 font-medium">Delivered Batches</p>
                <p className="text-2xl font-bold text-foreground mt-2">{deliveredCount}</p>
                <p className="text-xs text-foreground/70 mt-1">Ready to consume</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          {consumerType === 0 && (
            <Card className="p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground/70 font-medium">Consumed</p>
                  <p className="text-2xl font-bold text-foreground mt-2">{consumedCount}</p>
                  <p className="text-xs text-foreground/70 mt-1">On-chain status</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </Card>
          )}

          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 font-medium">Network</p>
                <p className="text-2xl font-bold text-foreground mt-2">Sepolia</p>
                <p className="text-xs text-foreground/70 mt-1">Live chain data</p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Factory className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="available" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="available">Available Batches</TabsTrigger>
            <TabsTrigger value="orders">My Orders (Requests)</TabsTrigger>
          </TabsList>

        <TabsContent value="available">
        {/* Batch Inventory Table */}
        <Card className="p-6 border border-border">
          <div className="space-y-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-foreground">Certified Batches from Miners</h3>
              {(filterLocation || filterGrade || filterMinQty || filterMaxQty) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearFilters}
                  className="text-foreground/50 hover:text-foreground h-8 px-2"
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
                <Input
                  placeholder="Filter by location..."
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="relative">
                <Factory className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/50" />
                <Input
                  placeholder="Filter by grade..."
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Min tons"
                  value={filterMinQty}
                  onChange={(e) => setFilterMinQty(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Max tons"
                  value={filterMaxQty}
                  onChange={(e) => setFilterMaxQty(e.target.value)}
                />
              </div>
            </div>
          </div>
          {certifiedBatches.length === 0 ? (
            <p className="text-sm text-foreground/70">No certified batches found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-foreground/70">
                    <th className="text-left py-3 px-4 font-medium">Batch ID</th>
                    <th className="text-left py-3 px-4 font-medium">Miner</th>
                    <th className="text-left py-3 px-4 font-medium">Location</th>
                    <th className="text-left py-3 px-4 font-medium">Grade</th>
                    <th className="text-left py-3 px-4 font-medium">Qty (tons)</th>
                    <th className="text-left py-3 px-4 font-medium">Certificate</th>
                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCertifiedBatches.map((batch) => {
                    const idStr = batch.id.toString()
                    const disabled = txPending || !miningAddress || !industryAddress
                    const cert = certByBatchId.get(batch.id.toString())
                    return (
                      <tr
                        key={idStr}
                        className="border-b border-border/50 hover:bg-secondary/50 transition"
                      >
                        <td className="py-3 px-4 font-medium text-foreground">{idStr}</td>
                        <td className="py-3 px-4 text-foreground/70 font-mono">
                          {`${batch.miner.slice(0, 6)}...${batch.miner.slice(-4)}`}
                        </td>
                        <td className="py-3 px-4 text-foreground/70">{batch.location}</td>
                        <td className="py-3 px-4 text-foreground/70">{batch.grade}</td>
                        <td className="py-3 px-4 text-foreground/70">
                          {Number(batch.quantity)}
                        </td>
                        <td className="py-3 px-4">
                          {cert ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-primary hover:text-primary-foreground h-8"
                              onClick={() => {
                                setCertPreviewCid(cert.certificateHash)
                                setCertPreviewOpen(true)
                              }}
                            >
                              View
                            </Button>
                          ) : (
                            <span className="text-xs text-foreground/50">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            size="sm"
                            disabled={disabled}
                            onClick={() => {
                              setSelectedBatchId(batch.id)
                              setRequestModalOpen(true)
                            }}
                          >
                            Request Coal
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card className="p-6 border border-border">
            <h3 className="text-lg font-semibold text-foreground mb-4">My Orders</h3>
            {requests.length === 0 ? (
              <p className="text-sm text-foreground/70">No orders found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr className="text-foreground/70">
                      <th className="text-left py-3 px-4 font-medium">BatchID</th>
                      <th className="text-left py-3 px-4 font-medium">Source</th>
                      <th className="text-left py-3 px-4 font-medium">Destination</th>
                      <th className="text-left py-3 px-4 font-medium">Grade</th>
                      <th className="text-left py-3 px-4 font-medium">Quantity</th>
                      <th className="text-left py-3 px-4 font-medium">ETA</th>
                      <th className="text-left py-3 px-4 font-medium">Status</th>
                      <th className="text-left py-3 px-4 font-medium">Certificate</th>
                      <th className="text-left py-3 px-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests
                     .slice()
                     .sort((a,b) => Number(b.createdAt - a.createdAt))
                     .map(r => {
                      const b = batches.find(bx => bx.id === r.batchId)
                      const bStatus = b?.status ?? 'Unknown'
                      return (
                        <tr key={r.id.toString()} className="border-b border-border/50 hover:bg-secondary/50">
                          <td className="py-3 px-4 text-foreground">{r.batchId.toString()}</td>
                          <td className="py-3 px-4 text-foreground/70">{b ? b.location : '—'}</td>
                          <td className="py-3 px-4 text-foreground/70">{r.destination}</td>
                          <td className="py-3 px-4 text-foreground/70">{r.grade || b?.grade || '—'}</td>
                          <td className="py-3 px-4 text-foreground/70">{Number(b?.quantity ?? BigInt(0))} tons</td>
                          <td className="py-3 px-4 text-foreground/70">{r.expectedDeliveryAt !== BigInt(0) ? new Date(Number(r.expectedDeliveryAt)*1000).toLocaleString() : 'Pending'}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              {r.cancelled ? 'Cancelled' : bStatus}
                            </span>
                          </td>
                        <td className="py-3 px-4">
                          {certByBatchId.get(r.batchId.toString())?.certificateHash?.trim() ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-primary hover:text-primary-foreground h-8"
                              onClick={() => {
                                setCertPreviewCid(certByBatchId.get(r.batchId.toString())!.certificateHash)
                                setCertPreviewOpen(true)
                              }}
                            >
                              View
                            </Button>
                          ) : (
                            <span className="text-xs text-foreground/50">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                             {bStatus === 'Delivered' ? (
                               <div className="flex gap-2">
                                 <Button 
                                   size="sm" 
                                   disabled={pendingTxBatchIds.has(r.batchId.toString())}
                                   onClick={() => handleConfirmDelivery(r.batchId)}
                                 >
                                   {pendingTxBatchIds.has(r.batchId.toString()) ? 'Processing...' : 'Confirm Receipt'}
                                 </Button>
                                 <Button 
                                   size="sm" 
                                   variant="destructive" 
                                   disabled={pendingTxBatchIds.has(r.batchId.toString())}
                                   onClick={() => handleReportDispute(r.batchId, r.assignedTransporter)}
                                 >
                                   Report Non-Delivery
                                 </Button>
                               </div>
                             ) : bStatus === 'Received' && consumerType === 0 ? (
                               <Button 
                                 size="sm"
                                 className="bg-green-600 hover:bg-green-700"
                                 onClick={() => {
                                   setConsumeBatchId(r.batchId)
                                   setConsumeModalOpen(true)
                                 }}
                               >
                                 Log Consumption
                               </Button>
                             ) : (
                               (bStatus === 'Received' || bStatus === 'Consumed') && (
                                 <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-500/10 px-2 py-1 rounded-full">
                                   <CheckCircle className="w-3 h-3" />
                                   {bStatus === 'Consumed' ? 'Consumed' : 'Received'}
                                 </span>
                               )
                             )}
                             {(bStatus === 'InTransit' || bStatus === 'Certified' || bStatus === 'TransportRequested') && (
                               <span className="text-xs text-foreground/50">Awaiting Delivery</span>
                             )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          
          {consumerType === 0 && (
            <Card className="p-6 border border-border mt-8">
              <h3 className="text-lg font-semibold text-foreground mb-4">Inventory Consumption</h3>
              <p className="text-sm text-foreground/70 mb-4">You must confirm receipt of a batch before you can log its consumption.</p>
              <Button onClick={() => {
                  setConsumeBatchId(null)
                  setQtyBurned('')
                  setPrefilledCalorific('')
                  setPowerGen('')
                  setConsumeModalOpen(true)
              }}>Open Consumption Log</Button>
            </Card>
          )}
        </TabsContent>
        </Tabs>
      </div>

      {/* Coal Request Modal */}
      <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Coal</DialogTitle>
            <DialogDescription>
              Submit an order for coal from this certified batch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-1">Destination Location</label>
              <Input
                value={reqDestination}
                onChange={(e) => setReqDestination(e.target.value)}
                placeholder="Factory / Plant Address"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRequestModalOpen(false)}>Cancel</Button>
            <Button disabled={txPending} onClick={handlePurchaseRequest}>Submit Request</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Consumption Modal */}
      <Dialog
        open={consumeModalOpen}
        onOpenChange={(open) => {
          setConsumeModalOpen(open)
          if (!open) {
            setConsumeBatchId(null)
            setQtyBurned('')
            setPrefilledCalorific('')
            setPowerGen('')
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Batch Consumption</DialogTitle>
            <DialogDescription>
              Record the quantity of coal burned and the electricity generated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 flex items-center gap-2">
                1. Select Batch
              </label>
              <Select
                value={consumeBatchId ? consumeBatchId.toString() : undefined}
                onValueChange={(v) => {
                const bId = BigInt(v)
                setConsumeBatchId(bId)
                const batch = batches.find(b => b.id === bId)
                const cert = certificates.find(c => c.batchId === bId)
                if (batch) setQtyBurned(batch.quantity.toString())
                if (cert) setPrefilledCalorific(cert.calorificValue.toString())
              }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a received batch" />
                </SelectTrigger>
                <SelectContent>
                  {requests.filter(r => {
                      const b = batches.find(bx => bx.id === r.batchId)
                      return b && b.status === 'Received'
                    }).map(r => (
                    <SelectItem key={r.batchId.toString()} value={r.batchId.toString()}>Batch #{r.batchId.toString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedConsumeBatch && (
              <>
                <div className="p-3 bg-secondary/50 rounded-lg border border-border space-y-2">
                  <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider">Batch Preview</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span className="text-foreground/70">Grade:</span>
                    <span className="font-medium">{selectedConsumeBatch.grade}</span>
                    <span className="text-foreground/70">Total Qty:</span>
                    <span className="font-medium">{selectedConsumeBatch.quantity.toString()} tons</span>
                    <span className="text-foreground/70">Source Mine:</span>
                    <span className="font-medium truncate">{selectedConsumeBatch.location}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Qty Burned (tons)</label>
                    <Input
                      type="number"
                      value={qtyBurned}
                      onChange={(e) => setQtyBurned(e.target.value)}
                      placeholder="e.g. 50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Calorific Value</label>
                    <div className="relative">
                      <Input
                        value={prefilledCalorific}
                        readOnly
                        className="bg-secondary/30 cursor-not-allowed pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary bg-primary/10 px-1 rounded">CA</span>
                    </div>
                    <p className="text-[10px] text-foreground/50 mt-1">From on-chain certificate</p>
                  </div>
                </div>

                {consumerType === 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Electricity Generated (kWh)</label>
                    <Input
                      type="number"
                      value={powerGen}
                      onChange={(e) => setPowerGen(e.target.value)}
                      placeholder="As reported by plant meters"
                    />
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConsumeModalOpen(false)}>Cancel</Button>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white" 
              disabled={txPending || !consumeBatchId} 
              onClick={handleConsume}
            >
              Log Consumption
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Certificate Preview Modal */}
      <Dialog open={certPreviewOpen} onOpenChange={setCertPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Certificate</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {certPreviewCid ? (
              <iframe
                title="Certificate"
                src={getIpfsUrl(certPreviewCid)}
                className="w-full h-[70vh] rounded border border-border"
              />
            ) : (
              <p className="text-sm text-foreground/70 text-center py-20">Certificate not available.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </RoleShell>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RoleShell } from '@/components/role-shell'
import { Zap, TrendingUp, AlertCircle, Battery } from 'lucide-react'
import { getContract, prepareContractCall, readContract } from 'thirdweb'
import { useActiveAccount, useSendTransaction } from 'thirdweb/react'
import { sepolia } from 'thirdweb/chains'
import { client, contract as factoryContract } from '@/lib/thirdweb'
import { fetchMiningBatches, STATUS_LABELS, type MiningBatch } from '@/lib/onchain/mining'
import { fetchAllCertificates, type CertificateRecord } from '@/lib/onchain/certification'
import { fetchCoalRequests, type CoalRequestRecord } from '@/lib/onchain/coalRequests'
import { fetchGridRecords, type GridRecordData } from '@/lib/onchain/smartgrid'
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
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts'
import { fetchConsumptionRecord, type ConsumptionRecord } from '@/lib/onchain/industry'

function batchIdToBytes32(id: bigint | number | string) {
  let hex = BigInt(id).toString(16);
  return '0x' + hex.padStart(64, '0');
}

function bytes32ToBatchIdString(batchIdHex: string) {
  try {
    return BigInt(batchIdHex).toString()
  } catch {
    return batchIdHex
  }
}

function shortAddress(addr?: string) {
  if (!addr) return '—'
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function calculateExpectedKWh(quantityTons: bigint, calorificKcalPerKg: bigint) {
  // Physics-based UI model: tons -> kg, then kcal to kWh.
  return (quantityTons * 1000n * calorificKcalPerKg) / 860n
}

function calculateEfficiencyPercent(actualKWh: bigint, expectedKWh: bigint) {
  if (expectedKWh <= 0n) return 0
  return Number((actualKWh * 100n) / expectedKWh)
}

function calculateClaimAccuracyPercent(actualKWh: bigint, claimedKWh: bigint) {
  if (claimedKWh <= 0n) return null
  return Number((actualKWh * 100n) / claimedKWh)
}

export default function SmartGridDashboard() {
  const account = useActiveAccount()
  const { mutate: sendTransaction, isPending: txPending } = useSendTransaction()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batches, setBatches] = useState<MiningBatch[]>([])
  const [smartgridAddress, setSmartgridAddress] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [certificates, setCertificates] = useState<CertificateRecord[]>([])
  const [requests, setRequests] = useState<CoalRequestRecord[]>([])
  const [gridRecords, setGridRecords] = useState<GridRecordData[]>([])

  // Modal States
  const [recordModalOpen, setRecordModalOpen] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState<bigint | null>(null)
  const [powerPlantAddr, setPowerPlantAddr] = useState<string>('')
  const [qtyConsumed, setQtyConsumed] = useState<bigint>(BigInt(0))
  
  const [consumptionRecords, setConsumptionRecords] = useState<Map<string, ConsumptionRecord>>(new Map())

  const [caloricValue, setCaloricValue] = useState('')
  const [actualGenerated, setActualGenerated] = useState('')
  const [gridLoad, setGridLoad] = useState('')
  const [plantClaimedGen, setPlantClaimedGen] = useState<bigint>(BigInt(0))

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
        const [smartgrid, certs] = (await Promise.all([
          readContract({
            contract: factoryContract,
            method: 'function smartgrid() view returns (address)',
            params: [],
          }),
          fetchAllCertificates(),
        ])) as [string, CertificateRecord[]]

        if (!smartgrid || smartgrid === '0x0000000000000000000000000000000000000000') {
          if (!cancelled) {
            setSmartgridAddress(null)
            setBatches([])
            setLoading(false)
          }
          return
        }

        const [{ batches }, allCerts, allReqs] = await Promise.all([
          fetchMiningBatches({ limit: 250 }),
          fetchAllCertificates(),
          fetchCoalRequests(),
        ])

        const plantReqs = allReqs.filter(r => r.consumerType === 0)
        const plantBatchIds = new Set(plantReqs.map(r => r.batchId.toString()))
        const filteredBatches = batches.filter(b => plantBatchIds.has(b.id.toString()))
        
        // Find batch IDs that have been consumed by a power plant for grid records
        const consumedByPlant = filteredBatches.filter(b => b.status === 'Consumed')
        const bytes32Ids = consumedByPlant.map(b => batchIdToBytes32(b.id))
        
        const [records, cRecords] = await Promise.all([
          fetchGridRecords(bytes32Ids),
          Promise.all(consumedByPlant.map(b => fetchConsumptionRecord(b.id)))
        ])

        const consumptionMap = new Map<string, ConsumptionRecord>()
        cRecords.forEach(r => {
           if (r) consumptionMap.set(r.batchId.toString(), r)
        })

        if (!cancelled) {
          setSmartgridAddress(smartgrid)
          setBatches(filteredBatches)
          setCertificates(allCerts)
          setRequests(allReqs)
          setGridRecords(records)
          setConsumptionRecords(consumptionMap)
          setLoading(false)
        }
      } catch (e) {
        console.error('Failed to load smartgrid data', e)
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

  const pendingRecords = useMemo(() => {
    const plantReqs = requests.filter(r => r.consumerType === 0)
    
    return batches.filter(b => {
      if (b.status !== 'Consumed') return false
      const req = plantReqs.find(r => r.batchId === b.id)
      if (!req) return false
      const hasRecord = gridRecords.some(gr => gr.batchId === batchIdToBytes32(b.id))
      return !hasRecord
    }).map(b => {
      const req = plantReqs.find(r => r.batchId === b.id)!
      return { batch: b, req }
    })
  }, [batches, requests, gridRecords])

  const alertsCount = useMemo(() => gridRecords.filter((s) => s.discrepancyFlagged).length, [gridRecords])

  const requestByBatchId = useMemo(() => {
    const m = new Map<string, CoalRequestRecord>()
    requests.forEach((r) => m.set(r.batchId.toString(), r))
    return m
  }, [requests])

  const batchById = useMemo(() => {
    const m = new Map<string, MiningBatch>()
    batches.forEach((b) => m.set(b.id.toString(), b))
    return m
  }, [batches])

  const certByBatchId = useMemo(() => {
    const m = new Map<string, CertificateRecord>()
    certificates.forEach((c) => m.set(c.batchId.toString(), c))
    return m
  }, [certificates])

  const avgUiEfficiency = useMemo(() => {
    if (!gridRecords.length) return 0
    const total = gridRecords.reduce((sum, r) => {
      const expected = calculateExpectedKWh(r.quantityConsumed, r.caloricValue)
      return sum + calculateEfficiencyPercent(r.actualGeneratedKWh, expected)
    }, 0)
    return total / gridRecords.length
  }, [gridRecords])

  const handleAddGridRecord = () => {
    if (!smartgridAddress || !selectedBatchId || !powerPlantAddr || !qtyConsumed) return
    if (!caloricValue || !actualGenerated || !gridLoad) {
      setError('Please fill in all grid metrics.')
      return
    }

    const caloricNum = Number(caloricValue)
    const generatedNum = Number(actualGenerated)
    const gridLoadNum = Number(gridLoad)

    if (!Number.isFinite(caloricNum) || caloricNum <= 0) {
      setError('Caloric value must be a positive number.')
      return
    }
    if (!Number.isFinite(generatedNum) || generatedNum <= 0) {
      setError('Actual generated kWh must be a positive number.')
      return
    }
    if (!Number.isFinite(gridLoadNum) || gridLoadNum <= 0) {
      setError('Grid load kWh must be a positive number.')
      return
    }

    setError(null)
    const smartgrid = getContract({ client, chain: sepolia, address: smartgridAddress })
    const tx = prepareContractCall({
      contract: smartgrid,
      method: "function addGridRecord(bytes32,address,uint256,uint256,uint256,uint256)",
      params: [
        batchIdToBytes32(selectedBatchId) as `0x${string}`,
        powerPlantAddr,
        qtyConsumed,
        BigInt(Math.floor(caloricNum)),
        BigInt(Math.floor(generatedNum)),
        BigInt(Math.floor(gridLoadNum)),
      ],
    })
    sendTransaction(tx, {
      onSuccess: () => {
        setReloadNonce((n) => n + 1)
        setRecordModalOpen(false)
        setCaloricValue('')
        setActualGenerated('')
        setGridLoad('')
      },
      onError: (err) => {
        console.error('addGridRecord failed', err)
        setError('Transaction failed. Ensure you are an authorized Smart Grid operator.')
      },
    })
  }

  return (
    <RoleShell roleKey="smartgrid" title="Smart Grid Operations">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-foreground/70 mt-2">
              Network-wide monitoring derived from real on-chain batch lifecycle states.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mb-4 font-medium p-3 bg-red-500/10 rounded-lg">{error}</p>}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 font-medium tracking-tight">Verification Backlog</p>
                <p className="text-2xl font-bold text-foreground mt-2">{pendingRecords.length}</p>
                <p className="text-[10px] text-foreground/50 mt-1 uppercase font-bold">Awaiting grid data</p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 font-medium tracking-tight">Verified Power</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {(gridRecords.reduce((sum, r) => sum + Number(r.actualGeneratedKWh), 0) / 1000).toFixed(1)} MWh
                </p>
                <p className="text-[10px] text-foreground/50 mt-1 uppercase font-bold">Confirmed generation</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Battery className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 font-medium tracking-tight">Avg Efficiency</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {avgUiEfficiency.toFixed(1)}%
                </p>
                <p className="text-[10px] text-foreground/50 mt-1 uppercase font-bold">Verified output ratio</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 font-medium tracking-tight">Active Alerts</p>
                <p className="text-2xl font-bold text-foreground mt-2">{alertsCount}</p>
                <p className="text-[10px] text-foreground/50 mt-1 uppercase font-bold">Suspect efficiency</p>
              </div>
              <div className="w-12 h-12 bg-red-500/10 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="bg-secondary/30 p-1">
            <TabsTrigger value="pending">Pending Verification ({pendingRecords.length})</TabsTrigger>
            <TabsTrigger value="analytics">Operational Analytics</TabsTrigger>
            <TabsTrigger value="history">Audit History</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card className="border border-border">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-foreground/50 uppercase bg-secondary/30 border-b border-border">
                    <tr>
                      <th className="px-6 py-4">Batch ID</th>
                      <th className="px-6 py-4">Source</th>
                      <th className="px-6 py-4">Destination</th>
                      <th className="px-6 py-4">Grade</th>
                      <th className="px-6 py-4">Power Plant</th>
                      <th className="px-6 py-4">Qty Burned</th>
                      <th className="px-6 py-4">Calorific</th>
                      <th className="px-6 py-4">Plant Claim (kWh)</th>
                      <th className="px-6 py-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pendingRecords.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-12 text-center text-foreground/40 italic">
                          No batches currently awaiting grid verification.
                        </td>
                      </tr>
                    ) : (
                      pendingRecords.map(({ batch, req }) => {
                        const consumption = consumptionRecords.get(batch.id.toString())
                        const cert = certByBatchId.get(batch.id.toString())
                        return (
                          <tr key={batch.id.toString()} className="hover:bg-secondary/20 transition-colors group">
                            <td className="px-6 py-4 font-mono font-medium text-primary">#{batch.id.toString()}</td>
                            <td className="px-6 py-4">{batch.location}</td>
                            <td className="px-6 py-4">{req.destination || '—'}</td>
                            <td className="px-6 py-4">{batch.grade}</td>
                            <td className="px-6 py-4">
                              <div className="font-medium truncate max-w-[150px]">{shortAddress(req.consumer)}</div>
                              <div className="text-[10px] text-foreground/50">Industry Consumer</div>
                            </td>
                            <td className="px-6 py-4 font-medium">
                               {consumption?.quantityBurned.toString() ?? batch.quantity.toString()} tons
                            </td>
                            <td className="px-6 py-4 font-medium">
                              {(consumption?.calorificValue ?? cert?.calorificValue)?.toString() ?? '—'} kcal/kg
                            </td>
                            <td className="px-6 py-4">
                               <span className="bg-primary/5 text-primary px-2 py-1 rounded border border-primary/10 font-bold">
                                 {consumption?.claimedGeneration.toString() ?? '...'} kWh
                               </span>
                            </td>
                            <td className="px-6 py-4">
                              <Button 
                                size="sm" 
                                className="bg-primary text-white hover:bg-primary/90 shadow-sm"
                                onClick={() => {
                                  setSelectedBatchId(batch.id)
                                  setPowerPlantAddr(req.consumer)
                                  setQtyConsumed(consumption?.quantityBurned ?? batch.quantity)
                                  setCaloricValue(consumption?.calorificValue.toString() ?? '')
                                  setPlantClaimedGen(consumption?.claimedGeneration ?? BigInt(0))
                                  setRecordModalOpen(true)
                                }}
                              >
                                Verify Grid Data
                              </Button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 p-6 border border-border">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold tracking-tight">Thermal Efficiency Spectrum</h3>
                  <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-foreground/50">
                     <div className="w-3 h-3 bg-green-500/20 rounded-full border border-green-500/40" />
                     Optimal Range (32-42%)
                  </div>
                </div>
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={gridRecords.map(r => ({
                      id: r.batchId.slice(0, 8),
                      efficiency: calculateEfficiencyPercent(
                        r.actualGeneratedKWh,
                        calculateExpectedKWh(r.quantityConsumed, r.caloricValue),
                      ),
                      timestamp: Number(r.recordedAt)
                    })).sort((a,b) => a.timestamp - b.timestamp)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsla(var(--border), 0.5)" />
                      <XAxis dataKey="id" stroke="hsl(var(--foreground)/0.4)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--foreground)/0.4)" fontSize={11} domain={[0, 100]} unit="%" tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        itemStyle={{ color: 'hsl(var(--primary))' }}
                      />
                      <ReferenceArea y1={32} y2={42} fill="rgba(34, 197, 94, 0.08)" label={{ position: 'right', value: 'TARGET', fill: '#22c55e', fontSize: 10, fontWeight: 'bold' }} />
                      <Line 
                        type="monotone" 
                        dataKey="efficiency" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3} 
                        dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                        activeDot={{ r: 7 }}
                        name="Grid Efficiency (%)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 p-3 bg-secondary/30 rounded border border-border/50">
                  <p className="text-xs text-foreground/60 flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <strong>System Note:</strong> Verified energy transformation is recorded on-chain. Discrepancies below <strong>30%</strong> are automatically flagged.
                  </p>
                </div>
              </Card>

              <Card className="p-6 border border-border flex flex-col items-center justify-center text-center bg-primary/2">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 ring-2 ring-primary/5">
                  <Battery className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">Network Health</h3>
                <p className="text-sm text-foreground/60 mt-2 mb-8 leading-relaxed">
                  Real-time synchronization between thermal output and verified grid injection.
                </p>
                <div className="space-y-4 w-full px-2">
                   <div className="flex justify-between text-xs py-3 border-b border-border/50">
                      <span className="text-foreground/50 uppercase font-bold tracking-wider">Total Batches Verified</span>
                      <span className="font-bold text-foreground">{gridRecords.length}</span>
                   </div>
                   <div className="flex justify-between text-xs py-3 border-b border-border/50">
                      <span className="text-foreground/50 uppercase font-bold tracking-wider">Verified MWh</span>
                      <span className="font-bold text-foreground">{(gridRecords.reduce((sum, r) => sum + Number(r.actualGeneratedKWh), 0) / 1000).toFixed(1)}</span>
                   </div>
                   <div className="flex justify-between text-xs py-3">
                      <span className="text-foreground/50 uppercase font-bold tracking-wider">Grid Stability Index</span>
                      <span className="font-bold text-green-600">STABLE</span>
                   </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Card className="border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] text-sm text-left">
                  <thead className="text-xs text-foreground/50 uppercase bg-secondary/30 border-b border-border">
                    <tr>
                      <th className="px-6 py-4 whitespace-nowrap">Batch</th>
                      <th className="px-6 py-4 whitespace-nowrap">Source</th>
                      <th className="px-6 py-4 whitespace-nowrap">Destination</th>
                      <th className="px-6 py-4 whitespace-nowrap">Certificate</th>
                      <th className="px-6 py-4 whitespace-nowrap">Plant Claim</th>
                      <th className="px-6 py-4 whitespace-nowrap">Grid Verified</th>
                      <th className="px-6 py-4 whitespace-nowrap">Thermal Eff.</th>
                      <th className="px-6 py-4 whitespace-nowrap">Claim Accuracy</th>
                      <th className="px-6 py-4 whitespace-nowrap">Result</th>
                      <th className="px-6 py-4 whitespace-nowrap">Date Verified</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {gridRecords.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-6 py-12 text-center text-foreground/40 italic">
                          No historical grid records found.
                        </td>
                      </tr>
                    ) : (
                      gridRecords.map(r => {
                        const batchId = bytes32ToBatchIdString(r.batchId)
                        const req = requestByBatchId.get(batchId)
                        const batch = batchById.get(batchId)
                        const cert = certByBatchId.get(batchId)
                        const consumption = consumptionRecords.get(batchId)
                        const claim = consumption?.claimedGeneration ?? 0n
                        const expectedKWh = calculateExpectedKWh(r.quantityConsumed, r.caloricValue)
                        const uiEfficiency = calculateEfficiencyPercent(r.actualGeneratedKWh, expectedKWh)
                        const claimAccuracy = calculateClaimAccuracyPercent(r.actualGeneratedKWh, claim)
                        const discrepancy = uiEfficiency < 30
                        return (
                        <tr key={r.batchId} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-primary">#{batchId}</div>
                            <div className="text-[10px] text-foreground/50 font-mono">{shortAddress(r.powerPlant)}</div>
                          </td>
                          <td className="px-6 py-4">{batch?.location ?? '—'}</td>
                          <td className="px-6 py-4">{req?.destination ?? '—'}</td>
                          <td className="px-6 py-4">
                            {cert?.certificateHash?.trim() ? (
                              <a
                                href={getIpfsUrl(cert.certificateHash)}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline-offset-2 hover:underline"
                              >
                                View
                              </a>
                            ) : (
                              <span className="text-foreground/50">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-medium whitespace-nowrap">{claim.toString()} kWh</td>
                          <td className="px-6 py-4 font-bold whitespace-nowrap">{r.actualGeneratedKWh.toString()} kWh</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold">{uiEfficiency}%</div>
                            <div className="w-16 h-1 bg-secondary rounded overflow-hidden">
                              <div 
                                className={`h-full ${discrepancy ? 'bg-red-500' : 'bg-green-500'}`} 
                                style={{ width: `${Math.max(0, Math.min(100, uiEfficiency))}%` }}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {claimAccuracy === null ? (
                              <span className="text-foreground/50">—</span>
                            ) : (
                              <span className="font-medium">{claimAccuracy}%</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {discrepancy ? (
                              <span className="px-2 py-1 rounded text-[10px] uppercase font-bold bg-red-500/10 text-red-600 border border-red-500/20"> flagged </span>
                            ) : (
                              <span className="px-2 py-1 rounded text-[10px] uppercase font-bold bg-green-500/10 text-green-600 border border-green-500/20"> verified </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-foreground/50 text-xs whitespace-nowrap">
                             {new Date(Number(r.recordedAt)*1000).toLocaleDateString()}
                          </td>
                        </tr>
                      )})
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Verification Modal */}
      <Dialog open={recordModalOpen} onOpenChange={setRecordModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Grid Verification</DialogTitle>
            <DialogDescription>
              Submit official grid metrics for this consumed batch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-secondary/50 rounded-lg border border-border space-y-3">
               <h4 className="text-[10px] font-bold uppercase text-foreground/40 tracking-widest">Plant Reported Claims</h4>
               <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-foreground/60">Qty Burned:</span> <span className="font-bold">{qtyConsumed.toString()} tons</span>
                  <span className="text-foreground/60">Energy Content:</span> <span className="font-bold">{caloricValue} kcal/kg</span>
                  <span className="text-foreground/60">Plant Claim:</span> <span className="font-bold text-primary">{plantClaimedGen.toString()} kWh</span>
               </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Grid Verified Generation (kWh)</label>
                <Input
                  type="number"
                  value={actualGenerated}
                  onChange={(e) => setActualGenerated(e.target.value)}
                  placeholder="Official meter reading"
                  className="bg-background border-border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Avg Grid Load (kWh)</label>
                <Input
                  type="number"
                  value={gridLoad}
                  onChange={(e) => setGridLoad(e.target.value)}
                  placeholder="Local demand during interval"
                  className="bg-background border-border"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRecordModalOpen(false)}>Cancel</Button>
            <Button disabled={txPending} onClick={handleAddGridRecord} className="px-8 shadow-sm">Confirm Verification</Button>
          </div>
        </DialogContent>
      </Dialog>
    </RoleShell>
  )
}


'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RoleShell } from '@/components/role-shell'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  Pickaxe,
  TrendingUp,
  CheckCircle,
  AlertCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useActiveAccount, useSendTransaction } from 'thirdweb/react'
import { getContract, prepareContractCall, readContract } from 'thirdweb'
import { sepolia } from 'thirdweb/chains'
import { client } from '@/lib/thirdweb'
import { fetchMiningBatches, STATUS_LABELS, type MiningBatch } from '@/lib/onchain/mining'
import {
  fetchAllCertificates,
  fetchAllRejections,
  type CertificateRecord,
  type RejectionRecord,
} from '@/lib/onchain/certification'
import { fetchMinerAnalytics } from '@/lib/onchain/analytics'
import { fetchCoalRequests, type CoalRequestRecord } from '@/lib/onchain/coalRequests'
import { fetchIpfsContent, getIpfsUrl } from '@/lib/ipfs'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { fetchAllRoleRequests } from '@/lib/onchain/requests'

type TransportRecord = {
  transporter: string;
  pickupTime: bigint;
  deliveryTime: bigint;
};

function decodeTransportRecord(raw: any): TransportRecord | null {
  if (!raw) return null;
  const arr = Array.isArray(raw) ? raw : null;
  const transporter = (arr ? arr[0] : raw.transporter) as string | undefined;
  const pickupTime = (arr ? arr[1] : raw.pickupTime) as bigint | undefined;
  const deliveryTime = (arr ? arr[2] : raw.deliveryTime) as bigint | undefined;
  if (typeof transporter !== 'string' || typeof pickupTime !== 'bigint' || typeof deliveryTime !== 'bigint') {
    return null;
  }
  return { transporter, pickupTime, deliveryTime };
}

type BatchStatus = 'Created' | 'Certified' | 'InTransit' | 'Delivered' | 'Consumed' | 'Rejected'

const COLORS = ['#1E40AF', '#10b981', '#F59E0B', '#6366F1', '#EF4444']

function short(addr: string) {
  if (!addr) return '—'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function fmtTs(ts: bigint) {
  if (!ts || ts === 0n) return '—'
  return new Date(Number(ts) * 1000).toLocaleString()
}

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  B: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  C: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  D: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  E: 'bg-red-500/10 text-red-600 border-red-500/20',
}

function getGradeColor(grade: string) {
  return GRADE_COLORS[grade] || 'bg-slate-500/10 text-slate-600 border-slate-500/20'
}

export default function MiningDashboard() {
  const account = useActiveAccount()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batches, setBatches] = useState<MiningBatch[]>([])
  const [miningAddress, setMiningAddress] = useState<string | null>(null)
  const [certificates, setCertificates] = useState<CertificateRecord[]>([])
  const [rejections, setRejections] = useState<RejectionRecord[]>([])
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({})
  const [minerAnalytics, setMinerAnalytics] = useState<Awaited<ReturnType<typeof fetchMinerAnalytics>>>(null)
  const [requests, setRequests] = useState<CoalRequestRecord[]>([])
  const [transportRecords, setTransportRecords] = useState<Map<string, TransportRecord>>(new Map())
  const [transporters, setTransporters] = useState<{wallet: string}[]>([])
  const { mutate: sendTransaction, isPending: txPending } = useSendTransaction()

  const [newLocation, setNewLocation] = useState('')
  const [newGrade, setNewGrade] = useState('')
  const [newQuantity, setNewQuantity] = useState('')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [certPreviewOpen, setCertPreviewOpen] = useState(false)
  const [certPreviewCid, setCertPreviewCid] = useState('')
  const [selectedTransporters, setSelectedTransporters] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false

    async function load(isBackgroundRefresh: boolean) {
      if (!account) {
        setBatches([])
        setLoading(false)
        setError(null)
        return
      }

      if (!isBackgroundRefresh) setLoading(true)
      setError(null)

      try {
        const { miningAddress: fetchedMiningAddress, batches: fetchedBatches } = await fetchMiningBatches({
          minerAddress: account.address,
          limit: 150,
        })

        const [certs, allReqs, allRoleReqs, allRejs] = await Promise.all([
          fetchAllCertificates(),
          fetchCoalRequests(),
          fetchAllRoleRequests(),
          fetchAllRejections(),
        ])

        const acceptedReqs = allReqs.filter(r => r.accepted)
        const rawTransport = fetchedMiningAddress
          ? await Promise.all(
              acceptedReqs.map((r) =>
                readContract({
                  contract: getContract({ client, chain: sepolia, address: fetchedMiningAddress }),
                  method: 'function transportRecords(uint256) view returns (address,uint256,uint256)',
                  params: [r.id],
                }),
              ),
            )
          : []

        const nextTransportById = new Map<string, TransportRecord>()
        rawTransport
          .map(decodeTransportRecord)
          .filter((rec): rec is TransportRecord => Boolean(rec))
          .forEach((rec, i) => {
            const req = acceptedReqs[i]
            if (req) {
              nextTransportById.set(req.batchId.toString(), rec)
            }
          })

        const analytics = fetchedMiningAddress
          ? await fetchMinerAnalytics(fetchedMiningAddress, account.address)
          : null

        if (!cancelled) {
          setMiningAddress(fetchedMiningAddress)
          setBatches(fetchedBatches)
          setCertificates(certs)
          setRejections(allRejs)
          setTransportRecords(nextTransportById)
          // Only incoming requests
          setRequests(allReqs.filter((r) => {
            const minerAddr = account?.address?.toLowerCase() ?? ''
            return fetchedBatches.some(b => b.id === r.batchId && (b.miner || '').toLowerCase() === minerAddr)
          }))
          
          const transporterWallets = Array.from(new Set(allRoleReqs.filter(r => r.role === 'transporter').map(r => r.wallet)))
          setTransporters(transporterWallets.map(w => ({ wallet: w })))

          setMinerAnalytics(analytics)
          setLoading(false)
        }
      } catch (e) {
        console.error('Failed to load mining batches', e)
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

  useEffect(() => {
    let cancelled = false
    async function loadRejectionReasons() {
      const minerBatchIds = new Set(batches.map((b) => b.id.toString()))
      const relevantRejections = rejections.filter((r) => minerBatchIds.has(r.batchId.toString()))
      if (!relevantRejections.length) {
        if (!cancelled) setRejectionReasons({})
        return
      }
      const reasonPairs = await Promise.all(
        relevantRejections.map(async (r) => {
          const reasonText = await fetchIpfsContent(r.reasonHash)
          return { batchId: r.batchId.toString(), reasonText: reasonText ?? '—' }
        }),
      )
      if (cancelled) return
      const next: Record<string, string> = {}
      reasonPairs.forEach(({ batchId, reasonText }) => {
        next[batchId] = reasonText
      })
      setRejectionReasons(next)
    }
    loadRejectionReasons()
    return () => {
      cancelled = true
    }
  }, [batches, rejections])

  const totalQuantity = minerAnalytics
    ? Number(minerAnalytics.totalQuantity)
    : batches.reduce((sum, b) => sum + Number(b.quantity), 0)
  const certifiedCount = minerAnalytics
    ? Number(minerAnalytics.countCertified)
    : batches.filter((b) => b.status === 'Certified').length
  const pendingCount = minerAnalytics
    ? Number(minerAnalytics.countCreated)
    : batches.filter((b) => b.status === 'Created').length

  const statusCounts = minerAnalytics
    ? STATUS_LABELS.map((status, i) => ({
        name: status,
        value: Number(
          [
            minerAnalytics.countCreated,
            minerAnalytics.countCertified,
            minerAnalytics.countInTransit,
            minerAnalytics.countDelivered,
            minerAnalytics.countConsumed,
            minerAnalytics.countRejected,
          ][i] ?? 0n,
        ),
      })).filter((s) => s.value > 0)
    : STATUS_LABELS.map((status) => ({
        name: status,
        value: batches.filter((b) => b.status === status).length,
      })).filter((s) => s.value > 0)

  const certByBatchId = new Map<string, CertificateRecord>()
  certificates.forEach((c) => {
    certByBatchId.set(c.batchId.toString(), c)
  })

  const recentByDate = [...batches].sort((a, b) => Number(b.timestamp - a.timestamp))

  const handleCreateBatch = () => {
    if (!account) {
      setError('Please connect your wallet as an authorized miner.')
      return
    }
    if (!miningAddress) {
      setError('Mining contract is not deployed yet.')
      return
    }
    if (!newLocation || !newGrade || !newQuantity) {
      setError('Please fill in all batch fields.')
      return
    }
    const quantityNum = Number(newQuantity)
    if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
      setError('Quantity must be a positive number.')
      return
    }
    if (!Number.isInteger(quantityNum)) {
      setError('Quantity must be a whole number (no decimals).')
      return
    }

    setError(null)

    const mining = getContract({
      client,
      chain: sepolia,
      address: miningAddress,
    })

    const tx = prepareContractCall({
      contract: mining,
      method: 'function createCoalBatch(string location,string grade,uint256 quantity)',
      params: [newLocation, newGrade, BigInt(Math.floor(quantityNum))],
    })

    sendTransaction(tx, {
      onSuccess: () => {
        setNewLocation('')
        setNewGrade('')
        setNewQuantity('')
        setReloadNonce((n) => n + 1)
      },
      onError: (err) => {
        console.error('Create batch tx failed', err)
        setError('Transaction failed. Ensure this wallet is an authorized miner.')
      },
    })
  }

  return (
    <RoleShell roleKey="miner" title="Mining Operations">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-foreground/70 mt-2">
              View batches you have created on-chain and their lifecycle status.
            </p>
          </div>
        </div>

        {/* Create Batch */}
        <Card className="p-6 border border-border mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Create New Batch</h3>
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground/80 mb-1">Mine Location</label>
              <input
                type="text"
                placeholder="Mine Location"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground/80 mb-1">Coal Grade</label>
              <Select value={newGrade} onValueChange={setNewGrade}>
                <SelectTrigger className="w-full bg-background border-border">
                  <SelectValue placeholder="Select Grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Grade A</SelectItem>
                  <SelectItem value="B">Grade B</SelectItem>
                  <SelectItem value="C">Grade C</SelectItem>
                  <SelectItem value="D">Grade D</SelectItem>
                  <SelectItem value="E">Grade E</SelectItem>
                  <SelectItem value="F">Grade F</SelectItem>
                  <SelectItem value="G">Grade G</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-foreground/80 mb-1">Quantity (tons)</label>
              <input
                type="number"
                min={1}
                placeholder="e.g. 100"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm"
              />
            </div>
            <Button
              disabled={txPending}
              onClick={handleCreateBatch}
              className="shrink-0 h-[38px]"
            >
              {txPending ? 'Creating...' : 'Create Batch'}
            </Button>
          </div>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 font-medium">Total Batches</p>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {minerAnalytics ? Number(minerAnalytics.batchCount) : batches.length}
                </p>
                <p className="text-xs text-foreground/70 mt-1">On-chain for this miner</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 font-medium">Certified Batches</p>
                <p className="text-2xl font-bold text-foreground mt-2">{certifiedCount}</p>
                <p className="text-xs text-foreground/70 mt-1">Status = Certified</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 font-medium">Pending Creation</p>
                <p className="text-2xl font-bold text-foreground mt-2">{pendingCount}</p>
                <p className="text-xs text-foreground/70 mt-1">Status = Created</p>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 font-medium">Total Quantity</p>
                <p className="text-2xl font-bold text-foreground mt-2">{totalQuantity} tons</p>
                <p className="text-xs text-foreground/70 mt-1">Sum of all your batches</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Pickaxe className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Section */}
        {batches.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 mb-8">
            <Card className="p-6 border border-border lg:col-span-2">
              <h3 className="text-lg font-semibold text-foreground mb-4">Quantity by Batch</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={batches.map((b) => ({
                    id: Number(b.id),
                    quantity: Number(b.quantity),
                    grade: b.grade,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="id" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => [`${value} tons`, 'Quantity']}
                    labelFormatter={(label) => {
                      const b = batches.find(b => Number(b.id) === label)
                      return `Batch ${label}${b ? ` · Grade ${b.grade}` : ''}`
                    }}
                  />
                  <Legend />
                  <Bar dataKey="quantity" name="Quantity (tons)">
                    {batches.map((b, index) => {
                      const gradeHex: Record<string, string> = {
                        A: '#10b981', B: '#3b82f6', C: '#f59e0b',
                        D: '#f97316', E: '#ef4444',
                      }
                      const color = gradeHex[b.grade] ?? '#64748b'
                      return <Cell key={`cell-${index}`} fill={color} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

          </div>
        ) : (
          <Card className="p-6 border border-border mb-8">
            <p className="text-sm text-foreground/70">No data found.</p>
          </Card>
        )}

        {/* Tabs for different tables */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Batches</TabsTrigger>
            <TabsTrigger value="certified">Certified Inventory</TabsTrigger>
            <TabsTrigger value="requests">Consumer Requests</TabsTrigger>
          </TabsList>

        <TabsContent value="all">
          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Miner&apos;s Batches</h3>
            </div>
          {loading ? (
            <p className="text-sm text-foreground/70">Loading from blockchain...</p>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : batches.length === 0 ? (
            <p className="text-sm text-foreground/70">No data found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-foreground/70">
                    <th className="text-left py-3 px-4 font-medium">Batch ID</th>
                    <th className="text-left py-3 px-4 font-medium">Location</th>
                    <th className="text-left py-3 px-4 font-medium">Grade</th>
                    <th className="text-left py-3 px-4 font-medium">Quantity</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Transporter</th>
                    <th className="text-left py-3 px-4 font-medium">Pickup</th>
                    <th className="text-left py-3 px-4 font-medium">Delivery</th>
                    <th className="text-left py-3 px-4 font-medium">Certificate</th>
                    <th className="text-left py-3 px-4 font-medium">Rejection Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {recentByDate.map((batch) => (
                    <tr
                      key={Number(batch.id)}
                      className="border-b border-border/50 hover:bg-secondary/50 transition"
                    >
                      <td className="py-3 px-4 font-medium text-foreground">
                        {String(batch.id)}
                      </td>
                      <td className="py-3 px-4 text-foreground/70">{batch.location}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getGradeColor(batch.grade)}`}>
                          Grade {batch.grade}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-foreground/70">
                        {Number(batch.quantity)} tons
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                          {batch.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-foreground/70 font-mono text-[10px]">
                        {transportRecords.get(batch.id.toString()) ? short(transportRecords.get(batch.id.toString())!.transporter) : '—'}
                      </td>
                      <td className="py-3 px-4 text-foreground/70 text-[10px]">
                        {transportRecords.get(batch.id.toString()) ? fmtTs(transportRecords.get(batch.id.toString())!.pickupTime) : '—'}
                      </td>
                      <td className="py-3 px-4 text-foreground/70 text-[10px]">
                        {transportRecords.get(batch.id.toString()) ? fmtTs(transportRecords.get(batch.id.toString())!.deliveryTime) : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {certByBatchId.get(batch.id.toString())?.certificateHash?.trim() ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCertPreviewCid(certByBatchId.get(batch.id.toString())!.certificateHash)
                              setCertPreviewOpen(true)
                            }}
                          >
                            View
                          </Button>
                        ) : (
                          <span className="text-xs text-foreground/50">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-foreground/70 max-w-xs">
                        {batch.status === 'Rejected' ? (
                          <span title={rejectionReasons[batch.id.toString()] ?? 'Reason unavailable'}>
                            {rejectionReasons[batch.id.toString()] ?? 'Loading...'}
                          </span>
                        ) : (
                          <span className="text-xs text-foreground/50">—</span>
                        )}
                      </td>
                     
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </TabsContent>

        <TabsContent value="certified">
          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Certified Inventory by Grade</h3>
              <p className="text-sm text-foreground/70">Only batches with Status = Certified</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-foreground/70">
                    <th className="text-left py-3 px-4 font-medium">Grade</th>
                    <th className="text-left py-3 px-4 font-medium">Batches Count</th>
                    <th className="text-left py-3 px-4 font-medium">Total Quantity Available (tons)</th>
                  </tr>
                </thead>
                <tbody>
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(grade => {
                    const gradeBatches = batches.filter(b => (b.status === 'Certified' || b.status === 'TransportRequested') && b.grade === grade)
                    if (gradeBatches.length === 0) return null
                    const availableQty = gradeBatches.reduce((sum, b) => sum + Number(b.quantity), 0)
                    return (
                      <tr key={grade} className="border-b border-border/50 hover:bg-secondary/50">
                        <td className="py-3 px-4 font-bold text-foreground">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getGradeColor(grade)}`}>
                            Grade {grade}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-foreground/70">{gradeBatches.length}</td>
                        <td className="py-3 px-4 text-foreground/70">{Math.max(0, availableQty)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Incoming Coal Requests</h3>
            </div>
            {requests.length === 0 ? (
              <p className="text-sm text-foreground/70">No incoming requests.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr className="text-foreground/70">
                      <th className="text-left py-3 px-4 font-medium">Batch ID</th>
                      <th className="text-left py-3 px-4 font-medium">Quantity</th>
                      <th className="text-left py-3 px-4 font-medium">Consumer</th>
                      <th className="text-left py-3 px-4 font-medium">Destination</th>
                      <th className="text-left py-3 px-4 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => {
                      const batch = batches.find(b => b.id === r.batchId);
                      const isAssigned = r.assignedTransporter !== '0x0000000000000000000000000000000000000000';
                      const isAccepted = r.accepted;
                      
                      return (
                        <tr key={r.id.toString()} className="border-b border-border/50 hover:bg-secondary/50 transition">
                          <td className="py-3 px-4 font-medium text-foreground">{r.batchId.toString()}</td>
                          <td className="py-3 px-4 text-foreground/70">{Number(batch?.quantity ?? 0n)} tons</td>
                          <td className="py-3 px-4 text-foreground/70 truncate max-w-[150px]" title={r.consumer}>{r.consumer}</td>
                          <td className="py-3 px-4 text-foreground/70">{r.destination}</td>
                          <td className="py-3 px-4">
                            {r.cancelled ? (
                              <span className="text-red-500 font-medium whitespace-nowrap">Cancelled</span>
                            ) : batch?.status === 'Consumed' ? (
                              <span className="text-green-600 font-bold text-xs uppercase tracking-wider whitespace-nowrap">Consumed</span>
                            ) : batch?.status === 'Received' ? (
                              <span className="text-emerald-600 font-bold text-xs uppercase tracking-wider whitespace-nowrap">Received by Consumer</span>
                            ) : batch?.status === 'Delivered' ? (
                              <span className="text-blue-600 font-bold text-xs uppercase tracking-wider whitespace-nowrap">Delivered</span>
                            ) : batch?.status === 'InTransit' ? (
                              <div className="flex flex-col">
                                <span className="text-blue-500 font-bold text-xs uppercase tracking-wider">In-Transit</span>
                                <span className="text-[10px] text-foreground/50">ETA: {fmtTs(r.expectedDeliveryAt)}</span>
                              </div>
                            ) : isAssigned ? (
                              <div className="flex flex-col">
                                <span className="text-amber-500 font-bold text-xs uppercase tracking-wider">Waiting Acceptance</span>
                                <span className="text-[10px] text-foreground/50" title={r.assignedTransporter}>By: {short(r.assignedTransporter)}</span>
                              </div>
                            ) : batch?.status && !['Certified', 'TransportRequested'].includes(batch.status) ? (
                              <span className="text-foreground/60 font-medium whitespace-nowrap">{batch.status}</span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Select 
                                  value={selectedTransporters[r.id.toString()] || ''} 
                                  onValueChange={(v) => setSelectedTransporters({
                                    ...selectedTransporters,
                                    [r.id.toString()]: v
                                  })}
                                >
                                  <SelectTrigger className="w-[150px] h-8 text-[11px] bg-background border-border">
                                    <SelectValue placeholder="Select Transporter" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {transporters.map(t => (
                                      <SelectItem key={t.wallet} value={t.wallet}>
                                        {short(t.wallet)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  size="sm"
                                  className="h-8 px-3 text-xs"
                                  disabled={txPending || !selectedTransporters[r.id.toString()]}
                                  onClick={() => {
                                    if (!miningAddress) return
                                    const mining = getContract({ client, chain: sepolia, address: miningAddress })
                                    const tx = prepareContractCall({
                                      contract: mining,
                                      method: 'function assignTransporter(uint256 requestId,address transporter)',
                                      params: [r.id, selectedTransporters[r.id.toString()]]
                                    })
                                    sendTransaction(tx, {
                                      onSuccess: () => setReloadNonce(n => n + 1),
                                      onError: (err) => setError(err.message)
                                    })
                                  }}
                                >
                                  Request
                                </Button>
                              </div>
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
        </TabsContent>
        </Tabs>
      </div>

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
            <p className="text-sm text-foreground/70">Certificate not available.</p>
          )}
        </DialogContent>
      </Dialog>
    </RoleShell>
  )
}

'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RoleShell } from '@/components/role-shell'
import { CheckCircle, Clock, MapPin, Truck } from 'lucide-react'
import { getContract, prepareContractCall, readContract } from 'thirdweb'
import { useActiveAccount, useSendTransaction } from 'thirdweb/react'
import { sepolia } from 'thirdweb/chains'
import { client, contract as factoryContract } from '@/lib/thirdweb'
import type { MiningBatch } from '@/lib/onchain/mining'
import { fetchAllCertificates, type CertificateRecord } from '@/lib/onchain/certification'
import { fetchTransportAnalytics } from '@/lib/onchain/analytics'
import { fetchCoalRequests, type CoalRequestRecord } from '@/lib/onchain/coalRequests'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type TransportRecord = {
  transporter: string
  pickupTime: bigint
  deliveryTime: bigint
}

function short(addr: string) {
  if (!addr) return '—'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function ipfsIoUrl(cid: string) {
  const clean = (cid || '').trim()
  if (!clean) return ''
  if (/^https?:\/\//i.test(clean)) return clean
  if (/^ipfs:\/\//i.test(clean)) return `https://ipfs.io/ipfs/${clean.replace(/^ipfs:\/\//i, '')}`
  return `https://ipfs.io/ipfs/${clean}`
}

function fmtTs(ts: bigint) {
  if (!ts || Number(ts) === 0) return '—'
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

function decodeBatch(raw: any): MiningBatch | null {
  if (!raw) return null
  const arr = Array.isArray(raw) ? raw : null
  const id = (arr ? arr[0] : raw.id) as bigint | undefined
  const miner = (arr ? arr[1] : raw.miner) as string | undefined
  const location = (arr ? arr[2] : raw.location) as string | undefined
  const grade = (arr ? arr[3] : raw.grade) as string | undefined
  const quantity = (arr ? arr[4] : raw.quantity) as bigint | undefined
  const timestamp = (arr ? arr[5] : raw.timestamp) as bigint | undefined
  const statusRaw = (arr ? arr[6] : raw.status) as bigint | number | undefined

  if (
    typeof id !== 'bigint' ||
    typeof miner !== 'string' ||
    typeof location !== 'string' ||
    typeof grade !== 'string' ||
    typeof quantity !== 'bigint' ||
    typeof timestamp !== 'bigint'
  ) {
    return null
  }

  const statusIndex = typeof statusRaw === 'bigint' ? Number(statusRaw) : Number(statusRaw ?? 0)
  const labels = ['Created', 'Certified', 'TransportRequested', 'InTransit', 'Delivered', 'Consumed', 'Rejected'] as const
  const status = labels[statusIndex] ?? 'Created'

  return { id, miner, location, grade, quantity, timestamp, status }
}

function decodeCertificate(raw: any): CertificateRecord | null {
  if (!raw) return null
  const arr = Array.isArray(raw) ? raw : null
  const batchId = (arr ? arr[0] : raw.batchId) as bigint | undefined
  const certificateHash = (arr ? arr[1] : raw.certificateHash) as string | undefined
  const issuedAt = (arr ? arr[2] : raw.issuedAt) as bigint | undefined
  const issuedBy = (arr ? arr[3] : raw.issuedBy) as string | undefined
  if (
    typeof batchId !== 'bigint' ||
    typeof certificateHash !== 'string' ||
    typeof issuedAt !== 'bigint' ||
    typeof issuedBy !== 'string'
  ) {
    return null
  }
  return { batchId, certificateHash, issuedAt, issuedBy }
}

function decodeTransportRecord(raw: any): TransportRecord | null {
  if (!raw) return null
  const arr = Array.isArray(raw) ? raw : null
  const transporter = (arr ? arr[0] : raw.transporter) as string | undefined
  const pickupTime = (arr ? arr[1] : raw.pickupTime) as bigint | undefined
  const deliveryTime = (arr ? arr[2] : raw.deliveryTime) as bigint | undefined
  if (typeof transporter !== 'string' || typeof pickupTime !== 'bigint' || typeof deliveryTime !== 'bigint') {
    return null
  }
  return { transporter, pickupTime, deliveryTime }
}

export default function TransportDashboard() {
  const account = useActiveAccount()
  const { mutate: sendTransaction, isPending: txPending } = useSendTransaction()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [miningAddress, setMiningAddress] = useState<string | null>(null)
  const [certificationAddress, setCertificationAddress] = useState<string | null>(null)

  const [batches, setBatches] = useState<MiningBatch[]>([])
  const [certById, setCertById] = useState<Map<string, CertificateRecord>>(new Map())
  const [transportById, setTransportById] = useState<Map<string, TransportRecord>>(new Map())
  const [transportAnalytics, setTransportAnalytics] = useState<Awaited<ReturnType<typeof fetchTransportAnalytics>>>(null)
  
  const [requests, setRequests] = useState<CoalRequestRecord[]>([])
  
  const [reloadNonce, setReloadNonce] = useState(0)

  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewCid, setPreviewCid] = useState<string>('')

  const [acceptModalOpen, setAcceptModalOpen] = useState(false)
  const [selectedRequestId, setSelectedRequestId] = useState<bigint | null>(null)
  const [eta, setEta] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load(isBackgroundRefresh: boolean) {
      if (!account) {
        setBatches([])
        setCertById(new Map())
        setTransportById(new Map())
        setRequests([])
        setMiningAddress(null)
        setCertificationAddress(null)
        setError(null)
        setLoading(false)
        return
      }

      if (!isBackgroundRefresh) setLoading(true)
      setError(null)
      try {
        const [mining, certification] = (await Promise.all([
          readContract({
            contract: factoryContract,
            method: 'function mining() view returns (address)',
            params: [],
          }),
          readContract({
            contract: factoryContract,
            method: 'function certification() view returns (address)',
            params: [],
          }),
        ])) as [string, string]

        if (!mining || mining === '0x0000000000000000000000000000000000000000') {
          if (!cancelled) {
            setMiningAddress(null)
            setCertificationAddress(null)
            setBatches([])
            setCertById(new Map())
            setTransportById(new Map())
            setRequests([])
            setLoading(false)
          }
          return
        }

        if (!certification || certification === '0x0000000000000000000000000000000000000000') {
          if (!cancelled) {
            setMiningAddress(mining)
            setCertificationAddress(null)
            setBatches([])
            setCertById(new Map())
            setTransportById(new Map())
            setRequests([])
            setLoading(false)
          }
          return
        }

        const miningContract = getContract({ client, chain: sepolia, address: mining })
        // certContract is not needed if we use fetchAllCertificates() from the lib

        const total = (await readContract({
          contract: miningContract,
          method: 'function batchCounter() view returns (uint256)',
          params: [],
        })) as bigint

        const ids = Number(total) === 0 ? [] : Array.from({ length: Number(total) }, (_, i) => BigInt(i + 1))

        const rawBatches = await Promise.all(
          ids.map((id) =>
            readContract({
              contract: miningContract,
              method:
                'function batches(uint256) view returns (uint256,address,string,string,uint256,uint256,uint8)',
              params: [id],
            }),
          ),
        )

        const decodedBatches = rawBatches.map(decodeBatch).filter(Boolean) as MiningBatch[]

        const allRequests = await fetchCoalRequests()
        const acceptedRequests = allRequests.filter(r => r.accepted)
        
        const [rawRecords, allCerts] = await Promise.all([
          Promise.all(
            acceptedRequests.map((r) =>
              readContract({
                contract: miningContract,
                method: 'function transportRecords(uint256) view returns (address,uint256,uint256)',
                params: [r.id],
              }),
            ),
          ),
          fetchAllCertificates(),
        ])

        const nextCertById = new Map<string, CertificateRecord>()
        for (const c of allCerts) {
          nextCertById.set(c.batchId.toString(), c)
        }

        const nextTransportById = new Map<string, TransportRecord>()
        rawRecords
          .map(decodeTransportRecord)
          .filter((rec): rec is TransportRecord => Boolean(rec))
          .forEach((rec, i) => {
            const req = acceptedRequests[i]
            if (req) {
              nextTransportById.set(req.batchId.toString(), rec)
            }
          })

        const analytics =
          mining && account?.address
            ? await fetchTransportAnalytics(mining, account.address)
            : null
            
        const accountAddr = account?.address?.toLowerCase() ?? ''
        const myRequests = accountAddr
          ? allRequests.filter(r => (r.assignedTransporter || '').toLowerCase() === accountAddr)
          : []

        if (!cancelled) {
          setMiningAddress(mining)
          setCertificationAddress(certification)
          setBatches(decodedBatches)
          setCertById(nextCertById)
          setTransportById(nextTransportById)
          setTransportAnalytics(analytics)
          setRequests(myRequests)
          setLoading(false)
        }
      } catch (e) {
        console.error('Failed to load transport data', e)
        if (!cancelled) {
          setError('Failed to load batches from the blockchain.')
          setBatches([])
          setCertById(new Map())
          setTransportById(new Map())
          setRequests([])
          setLoading(false)
        }
      }
    }

    load(false)
    const poll = window.setInterval(() => {
      load(true)
    }, 15000)

    return () => {
      cancelled = true
      window.clearInterval(poll)
    }
  }, [account, reloadNonce])

  const pendingRequests = useMemo(() => requests.filter(r => !r.accepted && !r.cancelled), [requests])
  
  const activeTransport = useMemo(() => {
    return requests.filter(r => {
      if (!r.accepted || r.cancelled) return false;
      const b = batches.find(b => b.id === r.batchId)
      return b && b.status === 'InTransit'
    })
  }, [requests, batches])

  const history = useMemo(() => {
    return requests.filter(r => {
      if (!r.accepted) return false;
      const b = batches.find(b => b.id === r.batchId)
      return b && (b.status === 'Delivered' || b.status === 'Consumed' || b.status === 'Disputed')
    })
  }, [requests, batches])

  const certifiedCount = pendingRequests.length
  const activeTransportCount = activeTransport.length
  const completedCount = history.length

  const handleAcceptSubmit = () => {
    if (!miningAddress || !selectedRequestId) return
    if (!eta) {
      setError('Please provide an expected delivery date.')
      return
    }
    setError(null)
    const mining = getContract({ client, chain: sepolia, address: miningAddress })
    const expectedTime = Math.floor(new Date(eta).getTime() / 1000)
    const now = Math.floor(Date.now() / 1000)

    if (expectedTime <= now) {
      setError('Expected delivery time must be in the future.')
      return
    }
    
    const tx = prepareContractCall({
      contract: mining,
      method: 'function acceptTransport(uint256 requestId,uint256 expectedDeliveryAt)',
      params: [selectedRequestId, BigInt(expectedTime)],
    })
    sendTransaction(tx, {
      onSuccess: () => {
        setReloadNonce((n) => n + 1)
        setAcceptModalOpen(false)
        setSelectedRequestId(null)
        setEta('')
      },
      onError: (err) => {
        console.error('acceptTransport failed', err)
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg.includes('Bad ETA') ? 'ETA must be in the future.' : 'Transaction failed. Ensure this wallet is the assigned transporter.')
      },
    })
  }

  const rejectTransport = (requestId: bigint) => {
    if (!miningAddress) return
    setError(null)
    const mining = getContract({ client, chain: sepolia, address: miningAddress })
    const tx = prepareContractCall({
      contract: mining,
      method: 'function rejectTransport(uint256 requestId)',
      params: [requestId],
    })
    sendTransaction(tx, {
      onSuccess: () => {
        setReloadNonce((n) => n + 1)
      },
      onError: (err) => {
        console.error('rejectTransport failed', err)
        setError('Transaction failed. Ensure this wallet is the assigned transporter.')
      },
    })
  }

  const markDelivered = (requestId: bigint) => {
    if (!miningAddress) return
    setError(null)
    const mining = getContract({ client, chain: sepolia, address: miningAddress })
    const tx = prepareContractCall({
      contract: mining,
      method: 'function markDeliveredFromRequest(uint256 requestId)',
      params: [requestId],
    })
    sendTransaction(tx, {
      onSuccess: () => setReloadNonce((n) => n + 1),
      onError: (err) => {
        console.error('markDelivered failed', err)
        setError('Transaction failed. Ensure you are the assigned transporter.')
      },
    })
  }

  return (
    <RoleShell roleKey="transporter" title="Transport & Logistics">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-foreground/70 mt-2">
              View certificates and take custody of certified Coal batches.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 font-medium">Certified</p>
                <p className="text-2xl font-bold text-foreground mt-2">{certifiedCount}</p>
                <p className="text-xs text-foreground/70 mt-1">Ready to ship</p>
              </div>
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 font-medium">Active Transport</p>
                <p className="text-2xl font-bold text-foreground mt-2">{activeTransportCount}</p>
                <p className="text-xs text-foreground/70 mt-1">InTransit (your custody)</p>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Truck className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground/70 font-medium">Completed</p>
                <p className="text-2xl font-bold text-foreground mt-2">{completedCount}</p>
                <p className="text-xs text-foreground/70 mt-1">Delivered (your history)</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
            </div>
          </Card>


        </div>

        {/* 1) Pending Requests */}
        <Card className="p-6 border border-border mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground text-lg">Assigned Pickup Requests</h3>
          </div>
          <p className="text-sm text-foreground/70 mb-4">
            Pending transport requests assigned to you by miners. Accept to set ETA and take custody.
          </p>

          {loading ? (
            <p className="text-sm text-foreground/70">Loading from blockchain…</p>
          ) : pendingRequests.length === 0 ? (
            <p className="text-sm text-foreground/70">No pending transport requests found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-foreground/70">
                    <th className="text-left py-3 px-4 font-medium">Batch ID</th>
                    <th className="text-left py-3 px-4 font-medium">Grade</th>
                    <th className="text-left py-3 px-4 font-medium">Source</th>
                    <th className="text-left py-3 px-4 font-medium">Destination</th>
                    <th className="text-left py-3 px-4 font-medium">Qty (tons)</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Requested At</th>
                    <th className="text-left py-3 px-4 font-medium">Certificate</th>
                    <th className="text-left py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests
                    .slice()
                    .sort((a, b) => Number(b.createdAt - a.createdAt))
                    .map((r) => {
                      const idStr = r.batchId.toString()
                      const bx = batches.find(b => b.id === r.batchId)
                      const cert = certById.get(idStr) ?? null
                      const hasCert = cert?.certificateHash?.trim() ?? ''
                      return (
                        <tr key={r.id.toString()} className="border-b border-border/50 hover:bg-secondary/50 transition">
                          <td className="py-3 px-4 font-medium text-foreground">{idStr}</td>
                          <td className="py-3 px-4">
                            {bx ? (
                              <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getGradeColor(bx.grade)}`}>
                                Grade {bx.grade}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-3 px-4 text-foreground/70">{bx?.location ?? '—'}</td>
                          <td className="py-3 px-4 text-foreground/70">{r.destination}</td>
                          <td className="py-3 px-4 text-foreground/70">{Number(bx?.quantity ?? BigInt(0))} tons</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600">
                              Awaiting Response
                            </span>
                          </td>
                          <td className="py-3 px-4 text-foreground/70 text-xs">{fmtTs(r.createdAt)}</td>
                          <td className="py-3 px-4">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!hasCert}
                              onClick={() => {
                                setPreviewCid(hasCert)
                                setPreviewOpen(true)
                              }}
                            >
                              View
                            </Button>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <Button size="sm" disabled={txPending} onClick={() => {
                                setSelectedRequestId(r.id)
                                setAcceptModalOpen(true)
                              }}>
                                Accept
                              </Button>
                              <Button size="sm" variant="destructive" disabled={txPending} onClick={() => rejectTransport(r.id)}>
                                Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* 2) Active transport */}
        <Card className="p-6 border border-border mb-8">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground text-lg">Active Transport</h3>
          </div>
          <p className="text-sm text-foreground/70 mb-4">
            Only the transporter who accepted the batch can mark it delivered.
          </p>

          {activeTransport.length === 0 ? (
            <p className="text-sm text-foreground/70">No active transports for this wallet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-foreground/70">
                    <th className="text-left py-3 px-4 font-medium">Batch ID</th>
                    <th className="text-left py-3 px-4 font-medium">Grade</th>
                    <th className="text-left py-3 px-4 font-medium">Source</th>
                    <th className="text-left py-3 px-4 font-medium">Destination</th>
                    <th className="text-left py-3 px-4 font-medium">Pickup Time</th>
                    <th className="text-left py-3 px-4 font-medium">ETA</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-left py-3 px-4 font-medium">Certificate</th>
                    <th className="text-left py-3 px-4 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTransport
                    .slice()
                    .map((r) => {
                      const idStr = r.batchId.toString()
                      const b = batches.find(b => b.id === r.batchId)
                      const rec = transportById.get(idStr)
                      const cert = certById.get(idStr)
                      const hasCert = cert?.certificateHash?.trim() ?? ''
                      
                      return (
                        <tr key={r.id.toString()} className="border-b border-border/50 hover:bg-secondary/50 transition">
                          <td className="py-3 px-4 font-medium text-foreground">{idStr}</td>
                          <td className="py-3 px-4">
                            {b ? (
                              <span className={`px-2 py-1 rounded-full text-xs font-bold border ${getGradeColor(b.grade)}`}>
                                Grade {b.grade}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-3 px-4 text-foreground/70">{b ? b.location : '—'}</td>
                          <td className="py-3 px-4 text-foreground/70">{r.destination}</td>
                          <td className="py-3 px-4 text-foreground/70">{rec ? fmtTs(rec.pickupTime) : '—'}</td>
                          <td className="py-3 px-4 text-foreground/70 text-xs">
                            {r.expectedDeliveryAt && Number(r.expectedDeliveryAt) > 0 ? fmtTs(r.expectedDeliveryAt) : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">
                              In Transit
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!hasCert}
                              onClick={() => {
                                setPreviewCid(hasCert)
                                setPreviewOpen(true)
                              }}
                            >
                              View
                            </Button>
                          </td>
                          <td className="py-3 px-4">
                            <Button
                              size="sm"
                              disabled={txPending}
                              onClick={() => markDelivered(r.id)}
                            >
                              Mark Delivered
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

        {/* 3) Transport history */}
        <Card className="p-6 border border-border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-foreground text-lg">Transport History</h3>
          </div>

          {history.length === 0 ? (
            <p className="text-sm text-foreground/70">No completed deliveries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-foreground/70">
                    <th className="text-left py-3 px-4 font-medium">BatchID</th>
                    <th className="text-left py-3 px-4 font-medium">Transporter Wallet</th>
                    <th className="text-left py-3 px-4 font-medium">Pickup Time</th>
                    <th className="text-left py-3 px-4 font-medium">Delivery Time</th>
                    <th className="text-left py-3 px-4 font-medium">Certificate</th>
                    <th className="text-left py-3 px-4 font-medium">Final Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history
                    .slice()
                    .map((r) => {
                      const idStr = r.batchId.toString()
                      const b = batches.find(b => b.id === r.batchId)
                      const rec = transportById.get(idStr)
                      const cert = certById.get(idStr)
                      const hasCert = cert?.certificateHash?.trim() ?? ''
                      return (
                        <tr key={r.id.toString()} className="border-b border-border/50 hover:bg-secondary/50 transition">
                          <td className="py-3 px-4 font-medium text-foreground">{idStr}</td>
                          <td className="py-3 px-4 text-foreground/70 font-mono">
                            {short(account?.address ?? '')}
                          </td>
                          <td className="py-3 px-4 text-foreground/70">{rec ? fmtTs(rec.pickupTime) : '—'}</td>
                          <td className="py-3 px-4 text-foreground/70">{rec ? fmtTs(rec.deliveryTime) : '—'}</td>
                          <td className="py-3 px-4">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!hasCert}
                              onClick={() => {
                                setPreviewCid(hasCert)
                                setPreviewOpen(true)
                              }}
                            >
                              View
                            </Button>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              {b ? b.status : 'Delivered'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Certificate</DialogTitle>

          </DialogHeader>
          {previewCid ? (
            <iframe
              title="Certificate"
              src={ipfsIoUrl(previewCid)}
              className="w-full h-[70vh] rounded border border-border"
            />
          ) : (
            <p className="text-sm text-foreground/70">Certificate not available.</p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={acceptModalOpen} onOpenChange={setAcceptModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Transport Request</DialogTitle>
            <DialogDescription>
              Please enter the expected delivery date and time for this request.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium text-foreground/80 mb-1">Expected Delivery Date</label>
            <Input
              type="datetime-local"
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full"
            />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setAcceptModalOpen(false)}>Cancel</Button>
            <Button disabled={txPending} onClick={handleAcceptSubmit}>
              Confirm Acceptance
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </RoleShell>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RoleShell } from '@/components/role-shell'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CheckCircle } from 'lucide-react'
import { useActiveAccount, useSendTransaction } from 'thirdweb/react'
import { getContract, readContract, prepareContractCall } from 'thirdweb'
import { sepolia } from 'thirdweb/chains'
import { client, contract as factoryContract } from '@/lib/thirdweb'
import { fetchMiningBatches, type MiningBatch } from '@/lib/onchain/mining'
import {
  fetchAllCertificates,
  fetchAllRejections,
  type CertificateRecord,
  type RejectionRecord,
} from '@/lib/onchain/certification'
import { fetchCertificationAnalytics, getCertificationAddress } from '@/lib/onchain/analytics'
import { uploadToIpfs, isPinataConfigured, fetchIpfsContent, getIpfsUrl } from '@/lib/ipfs'
import { Input } from '@/components/ui/input'

export default function CertificationDashboard() {
  const account = useActiveAccount()
  const { mutate: sendTransaction, isPending: txPending } = useSendTransaction()

  const [pendingBatches, setPendingBatches] = useState<MiningBatch[]>([])
  const [myCertificates, setMyCertificates] = useState<CertificateRecord[]>([])
  const [myRejections, setMyRejections] = useState<RejectionRecord[]>([])
  const [miningAddress, setMiningAddress] = useState<string | null>(null)
  const [certAnalytics, setCertAnalytics] = useState<Awaited<ReturnType<typeof fetchCertificationAnalytics>>>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)

  const [reviewBatch, setReviewBatch] = useState<MiningBatch | null>(null)
  const [certificateFile, setCertificateFile] = useState<File | null>(null)
  const [certificateCid, setCertificateCid] = useState<string>('')
  const [uploadingCert, setUploadingCert] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectUploading, setRejectUploading] = useState(false)
  const [certPreviewOpen, setCertPreviewOpen] = useState(false)
  const [certPreviewCid, setCertPreviewCid] = useState('')
  const [calorificValueInput, setCalorificValueInput] = useState('')
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    async function load(isBackgroundRefresh: boolean) {
      if (!account) {
        setPendingBatches([])
        setMyCertificates([])
        setError(null)
        return
      }
      setError(null)
      try {
        const [batchRes, certs] = await Promise.all([
          fetchMiningBatches({ limit: 250 }),
          fetchAllCertificates(),
        ])
        const rejs = await fetchAllRejections()
        const certAddr = await getCertificationAddress()
        const analytics =
          certAddr && account?.address
            ? await fetchCertificationAnalytics(certAddr, account.address)
            : null
        if (cancelled) return
        const created = batchRes.batches.filter((b) => b.status === 'Created')
        setMiningAddress(batchRes.miningAddress)
        setPendingBatches(created)
        const officer = account.address.toLowerCase()
        const mine = certs.filter((c) => c.issuedBy.toLowerCase() === officer)
        setMyCertificates(mine)
        const myRej = rejs.filter((r) => r.rejectedBy.toLowerCase() === officer)
        setMyRejections(myRej)
        setCertAnalytics(analytics)
      } catch (e) {
        if (!cancelled) {
          setError('Failed to load from blockchain.')
          setPendingBatches([])
          setMyCertificates([])
          setMyRejections([])
        }
      }
    }
    load(false)
    const t = setInterval(() => load(true), 6000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [account, reloadNonce])

  useEffect(() => {
    let cancelled = false
    async function fetchReasons() {
      const results = await Promise.all(
        myRejections.map(async (r) => {
          const key = `${r.batchId}-${r.rejectedAt}`
          const text = await fetchIpfsContent(r.reasonHash)
          return { key, text: text || '—' }
        }),
      )
      if (!cancelled) {
        setRejectionReasons((prev) => {
          const next = { ...prev }
          for (const { key, text } of results) next[key] = text
          return next
        })
      }
    }
    fetchReasons()
    return () => { cancelled = true }
  }, [myRejections])

  const handleReview = (batch: MiningBatch) => {
    setReviewBatch(batch)
    setCertificateFile(null)
    setCertificateCid('')
    setRejectReason('')
    setCalorificValueInput('')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setCertificateFile(file)
    setCertificateCid('')
  }

  const handleCertifyClick = async () => {
    if (!reviewBatch || !miningAddress) return
    if (!certificateFile) {
      setError('Please choose a certificate file to upload.')
      return
    }

    const calorificNum = Number(calorificValueInput)
    if (!Number.isFinite(calorificNum) || calorificNum <= 0) {
      setError('Please enter a valid positive Calorific Value (kcal/kg).')
      return
    }

    if (!isPinataConfigured()) {
      setError('Pinata is not configured. Please set NEXT_PUBLIC_PINATA_JWT in .env.local.')
      return
    }

    setError(null)
    setUploadingCert(true)
    let cid = certificateCid.trim()
    try {
      if (!cid) {
        cid = await uploadToIpfs(certificateFile)
        setCertificateCid(cid)
      }
    } catch (err) {
      setUploadingCert(false)
      setError(err instanceof Error ? err.message : 'Upload failed.')
      return
    }

    const certAddress = (await readContract({
      contract: factoryContract,
      method: 'function certification() view returns (address)',
      params: [],
    })) as string
    if (!certAddress) {
      setUploadingCert(false)
      setError('Certification contract not deployed.')
      return
    }

    const certContract = getContract({ client, chain: sepolia, address: certAddress })
    const tx = prepareContractCall({
      contract: certContract,
      method: 'function certifyBatch(address miningAddress,uint256 batchId,string certificateHash,uint256 calorificValue)',
      params: [miningAddress, reviewBatch.id, cid, BigInt(Math.floor(calorificNum))],
    })
    sendTransaction(tx, {
      onSuccess: () => {
        setUploadingCert(false)
        setReviewBatch(null)
        setCertificateFile(null)
        setCertificateCid('')
        setCalorificValueInput('')
        setReloadNonce((n) => n + 1)
      },
      onError: (err) => {
        setUploadingCert(false)
        console.error('Certify failed', err)
        setError('Transaction failed. Ensure batch is Created and you are an authorized officer.')
      },
    })
  }

  const handleReject = async () => {
    if (!reviewBatch || !miningAddress) return
    if (!rejectReason.trim()) {
      setError('Please enter a rejection reason.')
      return
    }
    setError(null)
    try {
      setRejectUploading(true)
      const reasonFile = new File([rejectReason.trim()], `rejection-${reviewBatch.id.toString()}.txt`, {
        type: 'text/plain',
      })
      const reasonCid = await uploadToIpfs(reasonFile)
      setRejectUploading(false)

      const certAddress = (await readContract({
        contract: factoryContract,
        method: 'function certification() view returns (address)',
        params: [],
      })) as string
      if (!certAddress) {
        setError('Certification contract not deployed.')
        return
      }
      const certContract = getContract({ client, chain: sepolia, address: certAddress })
      const tx = prepareContractCall({
        contract: certContract,
        method: 'function rejectBatch(address miningAddress,uint256 batchId,string reasonHash)',
        params: [miningAddress, reviewBatch.id, reasonCid],
      })
      sendTransaction(tx, {
        onSuccess: () => {
          setRejectOpen(false)
          setReviewBatch(null)
          setRejectReason('')
          setReloadNonce((n) => n + 1)
        },
        onError: (err) => {
          console.error('Reject failed', err)
          setError('Transaction failed. Ensure batch is Created and you are an authorized officer.')
        },
      })
    } catch (err) {
      setRejectUploading(false)
      setError(err instanceof Error ? err.message : 'Reject failed.')
    }
  }

  return (
    <RoleShell roleKey="certification" title="Certification Authority">
      <div className="max-w-7xl mx-auto">

        {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

        <Card className="p-6 border border-border mb-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">Pending Batches</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Batches with status <strong>Created</strong> — only these can be certified.
          </p>
          {pendingBatches.length === 0 ? (
            <p className="text-sm text-foreground/70">No pending batches. All batches are certified or beyond.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-foreground/70">
                    <th className="text-left py-2 px-3 font-medium">Batch ID</th>
                    <th className="text-left py-2 px-3 font-medium">Miner</th>
                    <th className="text-left py-2 px-3 font-medium">Location</th>
                    <th className="text-left py-2 px-3 font-medium">Grade</th>
                    <th className="text-left py-2 px-3 font-medium">Quantity</th>
                    <th className="text-left py-2 px-3 font-medium">Created Time</th>
                    <th className="text-left py-2 px-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingBatches.map((b) => (
                    <tr key={String(b.id)} className="border-b border-border/50 hover:bg-secondary/50">
                      <td className="py-2 px-3 font-mono">{String(b.id)}</td>
                      <td className="py-2 px-3 font-mono">{`${b.miner.slice(0, 6)}...${b.miner.slice(-4)}`}</td>
                      <td className="py-2 px-3">{b.location}</td>
                      <td className="py-2 px-3">{b.grade}</td>
                      <td className="py-2 px-3">{Number(b.quantity)}</td>
                      <td className="py-2 px-3 text-foreground/70">
                        {new Date(Number(b.timestamp) * 1000).toLocaleString()}
                      </td>
                      <td className="py-2 px-3">
                        <Button size="sm" variant="outline" onClick={() => handleReview(b)}>
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6 border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Certificates Issued
            {certAnalytics != null && (
              <span className="ml-2 text-sm font-normal text-foreground/70">
                ({Number(certAnalytics.officerCertCount)} on-chain)
              </span>
            )}
          </h3>
          {myCertificates.length === 0 ? (
            <p className="text-sm text-foreground/70">No certificates issued yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-foreground/70">
                    <th className="text-left py-2 px-3 font-medium">Batch ID</th>
                    <th className="text-left py-2 px-3 font-medium">Certificate</th>
                    <th className="text-left py-2 px-3 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {[...myCertificates].sort((a, b) => Number(b.issuedAt - a.issuedAt)).map((c) => (
                    <tr key={`${c.batchId}-${c.issuedAt}`} className="border-b border-border/50">
                      <td className="py-2 px-3 font-mono">{String(c.batchId)}</td>
                      <td className="py-2 px-3">
                        {c.certificateHash?.trim() ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCertPreviewCid(c.certificateHash)
                              setCertPreviewOpen(true)
                            }}
                          >
                            View
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 px-3 text-foreground/70">
                        {new Date(Number(c.issuedAt) * 1000).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-6 border border-border mt-8">
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Rejections Issued
            {certAnalytics != null && (
              <span className="ml-2 text-sm font-normal text-foreground/70">
                ({Number(certAnalytics.officerRejectCount)} on-chain)
              </span>
            )}
          </h3>
          {myRejections.length === 0 ? (
            <p className="text-sm text-foreground/70">No rejections issued yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-foreground/70">
                    <th className="text-left py-2 px-3 font-medium">Batch ID</th>
                    <th className="text-left py-2 px-3 font-medium">Officer Wallet</th>
                    <th className="text-left py-2 px-3 font-medium">Rejection Reason</th>
                    <th className="text-left py-2 px-3 font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {[...myRejections]
                    .sort((a, b) => Number(b.rejectedAt - a.rejectedAt))
                    .map((r) => (
                      <tr key={`${r.batchId}-${r.rejectedAt}`} className="border-b border-border/50">
                        <td className="py-2 px-3 font-mono">{String(r.batchId)}</td>
                        <td className="py-2 px-3 font-mono">{`${r.rejectedBy.slice(0, 6)}...${r.rejectedBy.slice(-4)}`}</td>
                        <td className="py-2 px-3 max-w-xs truncate text-foreground/80" title={rejectionReasons[`${r.batchId}-${r.rejectedAt}`]}>
                          {rejectionReasons[`${r.batchId}-${r.rejectedAt}`] ?? '…'}
                        </td>
                        <td className="py-2 px-3 text-foreground/70">
                          {new Date(Number(r.rejectedAt) * 1000).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={!!reviewBatch} onOpenChange={(open) => !open && setReviewBatch(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Batch Details & Certification</DialogTitle>
          </DialogHeader>
          {reviewBatch && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm p-4 bg-secondary/30 rounded-lg">
                <span className="text-muted-foreground font-medium">Batch ID:</span>
                <span className="font-mono text-primary font-bold">#{String(reviewBatch.id)}</span>
                <span className="text-muted-foreground font-medium">Miner:</span>
                <span className="font-mono truncate">{reviewBatch.miner}</span>
                <span className="text-muted-foreground font-medium">Location:</span>
                <span>{reviewBatch.location}</span>
                <span className="text-muted-foreground font-medium">Grade:</span>
                <span className="font-bold">{reviewBatch.grade}</span>
                <span className="text-muted-foreground font-medium">Quantity:</span>
                <span className="font-bold">{Number(reviewBatch.quantity)} tons</span>
              </div>

              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Certified Calorific Value</label>
                    <Input
                      type="number"
                      value={calorificValueInput}
                      onChange={(e) => setCalorificValueInput(e.target.value)}
                      placeholder="kcal/kg (e.g. 4500)"
                      className="h-9"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Upload Certificate</label>
                    <div className="flex items-center gap-2">
                      {isPinataConfigured() ? (
                        <div className="relative w-full overflow-hidden">
                          <input
                            type="file"
                            accept=".pdf,.txt,.json,image/*"
                            onChange={handleFileSelect}
                            disabled={uploadingCert || txPending}
                            className="text-[10px] w-full file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-primary file:text-primary-foreground file:cursor-pointer cursor-pointer border rounded border-input px-1 py-1"
                          />
                        </div>
                      ) : (
                        <p className="text-[10px] text-amber-600 italic">Pinata not configured</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {uploadingCert && <p className="text-[10px] text-center text-primary animate-pulse">Uploading to IPFS...</p>}
                {certificateCid && <p className="text-[10px] text-center text-green-600 font-medium">✓ File ready for blockchain confirmation</p>}
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setReviewBatch(null)}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={txPending || reviewBatch.status !== 'Created'}
                  onClick={() => setRejectOpen(true)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/5 border-red-500/20"
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  disabled={
                    txPending ||
                    uploadingCert ||
                    !certificateFile ||
                    !calorificValueInput ||
                    reviewBatch.status !== 'Created' ||
                    !isPinataConfigured()
                  }
                  onClick={handleCertifyClick}
                  className="px-6"
                >
                  {uploadingCert ? 'Uploading…' : txPending ? 'Confirming…' : 'Finalize Certification'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full min-h-28 px-3 py-2 border border-border rounded-md bg-background text-sm"
            />
            {!isPinataConfigured() ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Add <code className="bg-muted px-1 rounded">NEXT_PUBLIC_PINATA_JWT</code> to enable automatic IPFS uploads.
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={txPending || rejectUploading || !rejectReason.trim()}
                onClick={handleReject}
              >
                {rejectUploading ? 'Uploading…' : txPending ? 'Confirming…' : 'Reject Batch'}
              </Button>
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
            <p className="text-sm text-foreground/70">Certificate not available.</p>
          )}
        </DialogContent>
      </Dialog>
    </RoleShell>
  )
}

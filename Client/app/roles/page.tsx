'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown, LogOut, Ticket, Wallet } from 'lucide-react'
import { useActiveAccount, useActiveWallet, useDisconnect, useSendTransaction } from 'thirdweb/react'
import NextDynamic from 'next/dynamic'
import { prepareContractCall, readContract } from 'thirdweb'
import { wallets } from '@/lib/wallets'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { sepolia } from 'thirdweb/chains'
import { client, contract } from '@/lib/thirdweb'
import {
  roleRoutes,
  RoleKey,
  getRoleLabel,
} from '@/lib/roles'
import { isWalletAuthorizedForRole } from '@/lib/onchain/roles'
import { useReadContract } from 'thirdweb/react'
import { roleToRequestIndex } from '@/lib/onchain/requests'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const ConnectButtonDynamic = NextDynamic(
  () => import('thirdweb/react').then((m) => m.ConnectButton),
  { ssr: false },
)

/**
 * Fix: ThirdWeb's connected-state modal (ManageWalletScreen) nests a CopyIcon <button>
 * inside an address <button> — an internal library bug causing a React hydration error.
 *
 * Solution: render ThirdWeb's ConnectButton ONLY when disconnected (the connect
 * wallet flow has no nesting issues). When connected, render our own polished
 * DropdownMenu pill that has identical UX but zero nested <button> elements.
 */
function WalletConnectSection() {
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  const { disconnect } = useDisconnect()

  const shortAddr = account
    ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
    : ''

  if (!account) {
    return (
      <ConnectButtonDynamic
        client={client}
        chain={sepolia}
        wallets={wallets}
      />
    )
  }

  // Connected state — custom pill that avoids TW's modal entirely
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-secondary/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {/* Connected dot */}
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          {/* Wallet icon + address */}
          <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="font-mono">{shortAddr}</span>
          {/* Network badge */}
          <span className="hidden sm:inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            Sepolia
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-1" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <p className="text-xs text-muted-foreground mb-0.5">Connected wallet</p>
          {/* Plain <p> — not a button, no nesting issues */}
          <p className="font-mono text-xs text-foreground break-all">
            {account.address}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onClick={() => wallet && disconnect(wallet)}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function RolesPage() {
  const router = useRouter()
  const account = useActiveAccount()
  const { mutate: sendTransaction, isPending: txPending } = useSendTransaction()

  const [selectedRole, setSelectedRole] = useState<RoleKey | ''>('')
  const [status, setStatus] = useState({
    loading: false,
    error: '',
    success: '',
  })
  const [requestModalOpen, setRequestModalOpen] = useState(false)
  const [consumerType, setConsumerType] = useState<'POWER_PLANT' | 'MANUFACTURING_UNIT'>('MANUFACTURING_UNIT')
  const [showConsumerTypeModal, setShowConsumerTypeModal] = useState(false)

  const { data: ownerAddress } = useReadContract({
    contract,
    method: 'function owner() view returns (address)',
    params: [],
  })

  const getButtonRoleLabel = () => {
    if (!selectedRole) return 'Guest'
    return getRoleLabel(selectedRole)
  }

  const handleLogin = async () => {
    if (!account) {
      setStatus({
        loading: false,
        error: 'Please connect your wallet',
        success: '',
      })
      return
    }

    if (!selectedRole) {
      setStatus({
        loading: false,
        error: 'Select a role',
        success: '',
      })
      return
    }

    setStatus({ loading: true, error: '', success: '' })

    try {
      const addr = account.address.toLowerCase()
      const ownerAddr = (ownerAddress as string)?.toLowerCase()

      if (selectedRole === 'owner') {
        if (!ownerAddr) {
          setStatus({
            loading: false,
            error: 'Contract owner not loaded yet. Please try again.',
            success: '',
          })
          return
        }
        if (addr !== ownerAddr) {
          setStatus({
            loading: false,
            error: 'Access denied: only contract owner can use the admin role.',
            success: '',
          })
          return
        }
        setStatus({ loading: false, error: '', success: '' })
        router.push(roleRoutes.owner)
        return
      }

      const authorized = await isWalletAuthorizedForRole(account.address, selectedRole)
      if (authorized) {
        setStatus({ loading: false, error: '', success: '' })
        router.push(roleRoutes[selectedRole])
        return
      }

      // For industry consumers, ask for consumer type before sending the role request on-chain
      if (selectedRole === 'industry') {
        setStatus({ loading: false, error: '', success: '' })
        setShowConsumerTypeModal(true)
        return
      }

      setStatus({ loading: false, error: '', success: '' })
      const roleIndex = roleToRequestIndex(selectedRole)

      // CRITICAL: Check if already requested to avoid "AlreadyRequested" revert
      // CoalSupplyChainFactory.requestIndex(address, uint8)
      const existingReqIndex = await readContract({
        contract,
        method: 'function requestIndex(address, uint8) view returns (uint256)',
        params: [account.address, roleIndex],
      })

      if (Number(existingReqIndex) > 0) {
        setRequestModalOpen(true)
        return
      }

      const tx = prepareContractCall({
        contract,
        method: 'function requestRole(uint8 role,uint8 consumerType)',
        params: [roleIndex, 0],
      })
      sendTransaction(tx, {
        onSuccess: () => {
          setRequestModalOpen(true)
        },
        onError: (err) => {
          console.error('requestRole failed', err)
          setStatus({
            loading: false,
            error: err?.message?.includes('Already requested')
              ? 'You already have a pending request for this role.'
              : 'Transaction failed. Please try again.',
            success: '',
          })
        },
      })
    } catch (e) {
      console.error('Role check failed', e)
      setStatus({
        loading: false,
        error: 'Failed to verify role from blockchain. Please try again.',
        success: '',
      })
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Ticket className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">CoalChain</span>
          </Link>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Connect & Select Role
          </h1>
          <p className="text-muted-foreground">
            Connect your wallet and choose your role. Requests are stored on-chain.
          </p>
        </div>

        <Card className="p-6 space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Connect Wallet</h3>
            <WalletConnectSection />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Select Role</h3>
            <Select
              onValueChange={(value) => setSelectedRole(value as RoleKey)}
              value={selectedRole}
              disabled={!account}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">
                  Owner / Admin – Manage System
                </SelectItem>
                <SelectItem value="miner">
                  Miner – Create Coal Batches
                </SelectItem>
                <SelectItem value="certification">
                  Certification Authority – Certify Batches
                </SelectItem>
                <SelectItem value="transporter">
                  Transporter – Move Batches
                </SelectItem>
                <SelectItem value="industry">
                  Industry Consumer – Consume Coal
                </SelectItem>
                <SelectItem value="smartgrid">
                  Smart Grid Analytics – Monitor Grid
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {status.error && (
            <div className="text-sm text-red-500">{status.error}</div>
          )}
          {status.success && (
            <div className="text-sm text-green-500">{status.success}</div>
          )}

          <Button
            className="w-full"
            disabled={!account || !selectedRole || status.loading || txPending}
            onClick={handleLogin}
          >
            {status.loading || txPending
              ? (txPending ? 'Submitting request...' : 'Verifying...')
              : `Continue as ${getButtonRoleLabel()}`}
          </Button>
        </Card>
      </div>

      <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
        <DialogContent className="max-w-lg sm:max-w-xl p-8">
          <DialogHeader>
            <DialogTitle className="text-xl mb-2">Waiting for owner approval</DialogTitle>
            <DialogDescription className="text-base">
              Your request has been submitted on-chain. Once the owner approves it, you can return
              here and access your role dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              The owner will review your request. You can close this and check back later.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showConsumerTypeModal} onOpenChange={setShowConsumerTypeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Consumer Type</DialogTitle>
            <DialogDescription>
              You selected the <span className="font-semibold">Industry Consumer</span> role. Choose whether you
              are a Power Plant or a Manufacturing Unit. This is stored on-chain with your role request.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConsumerType('POWER_PLANT')}
                className={`border rounded-lg px-3 py-2 text-sm text-left ${
                  consumerType === 'POWER_PLANT'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-foreground/80 hover:bg-muted'
                }`}
              >
                <div className="font-semibold mb-1">Power Plant</div>
                <div className="text-xs text-foreground/70">
                  Large-scale generation with Smart Grid efficiency reporting.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setConsumerType('MANUFACTURING_UNIT')}
                className={`border rounded-lg px-3 py-2 text-sm text-left ${
                  consumerType === 'MANUFACTURING_UNIT'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-foreground/80 hover:bg-muted'
                }`}
              >
                <div className="font-semibold mb-1">Manufacturing Unit</div>
                <div className="text-xs text-foreground/70">
                  Industrial consumer without grid-level generation reporting.
                </div>
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-md text-xs border border-border text-foreground/80 hover:bg-muted"
                onClick={() => setShowConsumerTypeModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!account || txPending}
                onClick={() => {
                  if (!account) return
                  const roleIndex = roleToRequestIndex('industry')
                  const consumerTypeIndex = consumerType === 'POWER_PLANT' ? 0 : 1

                  // Check for existing request first
                  readContract({
                    contract,
                    method: 'function requestIndex(address, uint8) view returns (uint256)',
                    params: [account.address, roleIndex],
                  }).then((existing: bigint) => {
                    if (Number(existing) > 0) {
                      setShowConsumerTypeModal(false)
                      setRequestModalOpen(true)
                      return
                    }

                    const tx = prepareContractCall({
                      contract,
                      method: 'function requestRole(uint8 role,uint8 consumerType)',
                      params: [roleIndex, consumerTypeIndex],
                    })
                    sendTransaction(tx, {
                      onSuccess: () => {
                        setShowConsumerTypeModal(false)
                        setRequestModalOpen(true)
                      },
                      onError: (err) => {
                        console.error('requestRole (industry) failed', err)
                        setStatus({
                          loading: false,
                          error: err?.message?.includes('Already requested')
                            ? 'You already have a pending request for this role.'
                            : 'Transaction failed. Please try again.',
                          success: '',
                        })
                      },
                    })
                  })
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

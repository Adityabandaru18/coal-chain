'use client'

import { ReactNode, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useActiveAccount,
  useActiveWallet,
  useDisconnect,
  useIsAutoConnecting,
} from 'thirdweb/react'
import { RoleKey, getRoleLabel } from '@/lib/roles'
import { isWalletAuthorizedForRole } from '@/lib/onchain/roles'
import { Ticket } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface RoleShellProps {
  roleKey: RoleKey
  title: string
  children: ReactNode
}

export function RoleShell({ roleKey, title, children }: RoleShellProps) {
  const router = useRouter()
  const account = useActiveAccount()
  const wallet = useActiveWallet()
  const { disconnect } = useDisconnect()
  const isAutoConnecting = useIsAutoConnecting()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!account) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    setChecking(true)
    setAccessError(null)

    isWalletAuthorizedForRole(account.address, roleKey)
      .then((authorized) => {
        if (cancelled) return
        setChecking(false)
        if (!authorized) {
          setAccessError(
            'Access denied. This wallet is not authorized for this role. Redirecting...',
          )
          timeoutId = window.setTimeout(() => router.replace('/roles'), 2000)
        } else {
          setAccessError(null)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChecking(false)
          setAccessError('Failed to verify role from blockchain. Redirecting...')
          timeoutId = window.setTimeout(() => router.replace('/roles'), 2000)
        }
      })

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [account, roleKey, router])

  const shortAddress = account
    ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
    : 'Not connected'

  const handleConfirmLogout = () => {
    if (wallet) {
      disconnect(wallet)
    }
    setConfirmOpen(false)
    router.push('/roles')
  }

  if (!account) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        {isAutoConnecting ? (
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <p className="text-muted-foreground">Reconnecting your wallet...</p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            No wallet connected. Please go back and connect through the Get
            Started flow.
          </p>
        )}
      </main>
    )
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
          <p className="text-muted-foreground">Verifying role from blockchain...</p>
        </div>
      </main>
    )
  }

  if (accessError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-red-500 text-sm">{accessError}</p>
      </main>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col">
        <nav className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 hover:opacity-80 transition"
            >
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Ticket className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg text-foreground hidden sm:inline">
                CoalChain
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline text-sm text-muted-foreground">
                {getRoleLabel(roleKey)}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={() => setConfirmOpen(true)}
                className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm hover:bg-secondary transition cursor-pointer"
              >
                <span className="font-mono">{shortAddress}</span>
              </span>
            </div>
          </div>
        </nav>

        <main className="flex-1">
          <section className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto space-y-6">
            <h1 className="text-3xl font-bold text-foreground">{title}</h1>
            {children}
          </section>
        </main>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm logout</DialogTitle>
            <DialogDescription>
              You are about to disconnect wallet{' '}
              <span className="font-mono">
                {account?.address ?? 'unknown'}
              </span>{' '}
              from the <strong>{getRoleLabel(roleKey)}</strong> dashboard. Your
              role assignment to this wallet will remain, but you will need to
              reconnect to access the dashboard again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmLogout}>
              Logout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}


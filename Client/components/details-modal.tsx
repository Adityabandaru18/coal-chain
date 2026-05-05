'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { X } from 'lucide-react'

interface DetailsModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  details: Record<string, any>
  actions?: Array<{ label: string; onClick: () => void; variant?: 'default' | 'outline' | 'destructive' }>
}

export function DetailsModal({ isOpen, onClose, title, details, actions = [] }: DetailsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md border-0 shadow-lg max-h-96 overflow-y-auto">
        <div className="relative p-8">
          <span
            role="button"
            tabIndex={0}
            onClick={onClose}
            className="absolute top-4 right-4 text-foreground/70 hover:text-foreground transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </span>

          <h2 className="text-2xl font-bold text-foreground mb-6">{title}</h2>

          <div className="space-y-4 mb-6">
            {Object.entries(details).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <label className="block text-sm font-medium text-foreground/70">{key}</label>
                <p className="text-foreground font-medium">{String(value)}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-col">
            {actions.map((action, idx) => (
              <Button
                key={idx}
                variant={action.variant || 'default'}
                onClick={() => {
                  action.onClick()
                  onClose()
                }}
                className="w-full"
              >
                {action.label}
              </Button>
            ))}
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

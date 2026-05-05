'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { X } from 'lucide-react'

interface BatchFormModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
}

export function BatchFormModal({ isOpen, onClose, title = 'Create New Batch' }: BatchFormModalProps) {
  const [formData, setFormData] = useState({
    batchId: '',
    location: '',
    tons: '',
    quality: '8.5',
  })
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[v0] Batch created:', formData)
    setSubmitted(true)
    setTimeout(() => {
      onClose()
      setSubmitted(false)
      setFormData({ batchId: '', location: '', tons: '', quality: '8.5' })
    }, 1500)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md border-0 shadow-lg">
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

          {submitted ? (
            <div className="space-y-4 text-center py-8">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-foreground font-semibold">Batch created successfully!</p>
              <p className="text-sm text-foreground/70">Your batch has been registered in the system</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Batch ID</label>
                <Input
                  type="text"
                  placeholder="B-2024-001"
                  value={formData.batchId}
                  onChange={(e) => setFormData({ ...formData, batchId: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Mining Location</label>
                <Input
                  type="text"
                  placeholder="e.g., Mine Zone A"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Tons</label>
                  <Input
                    type="number"
                    placeholder="450"
                    value={formData.tons}
                    onChange={(e) => setFormData({ ...formData, tons: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Quality Score</label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    placeholder="8.5"
                    value={formData.quality}
                    onChange={(e) => setFormData({ ...formData, quality: e.target.value })}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                Create Batch
              </Button>
            </form>
          )}
        </div>
      </Card>
    </div>
  )
}

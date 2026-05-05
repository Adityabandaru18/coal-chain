'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { X, Mail, Lock } from 'lucide-react'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState({ email: '', password: '', name: '' })
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('[v0] Form submitted:', formData)
    setSubmitted(true)
    setTimeout(() => {
      onClose()
      setSubmitted(false)
      setFormData({ email: '', password: '', name: '' })
      setIsLogin(true)
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

          <h2 className="text-2xl font-bold text-foreground mb-6">
            {isLogin ? 'Login' : 'Create Account'}
          </h2>

          {submitted ? (
            <div className="space-y-4 text-center py-8">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-foreground font-semibold">
                {isLogin ? 'Login successful!' : 'Account created!'}
              </p>
              <p className="text-sm text-foreground/70">
                {isLogin ? 'Welcome back to CoalChain' : 'Welcome to CoalChain'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required={!isLogin}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/50" />
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground/50" />
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                {isLogin ? 'Login' : 'Sign Up'}
              </Button>

              <p className="text-center text-sm text-foreground/70">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setIsLogin(!isLogin)
                    setFormData({ email: '', password: '', name: '' })
                  }}
                  className="text-primary font-semibold hover:underline cursor-pointer"
                >
                  {isLogin ? 'Sign up' : 'Login'}
                </span>
              </p>
            </form>
          )}
        </div>
      </Card>
    </div>
  )
}

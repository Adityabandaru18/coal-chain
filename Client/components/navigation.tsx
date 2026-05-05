'use client'

import { Button } from '@/components/ui/button'
import { ArrowLeft, Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

interface NavigationProps {
  title: string
  role: string
  onBack?: () => void
}

export function Navigation({ title, role, onBack }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navLinks = [
    { label: 'Overview', href: '#' },
    { label: 'Analytics', href: '#' },
    { label: 'Reports', href: '#' },
    { label: 'Settings', href: '#' }
  ]

  return (
    <>
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo & Title */}
            <div className="flex items-center gap-4">
              <Link 
                href="/roles" 
                className="flex items-center gap-2 text-foreground/70 hover:text-foreground transition"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="hidden sm:inline text-sm font-medium">Back</span>
              </Link>
              <div className="hidden sm:flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">C</span>
                </div>
                <h1 className="text-lg font-semibold text-foreground">{title}</h1>
              </div>
            </div>

            {/* Center: Nav Links (Hidden on Mobile) */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <span
                  key={link.label}
                  role="button"
                  tabIndex={0}
                  onClick={() => console.log(`[v0] Navigating to ${link.label}`)}
                  className="text-sm font-medium text-foreground/70 hover:text-foreground transition cursor-pointer"
                >
                  {link.label}
                </span>
              ))}
            </div>

            {/* Right: Role Badge & Mobile Menu */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-lg border border-primary/20">
                <span className="text-xs font-medium text-primary">{role}</span>
              </div>
              
              <span
                role="button"
                tabIndex={0}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 hover:bg-secondary rounded-lg transition cursor-pointer"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </span>
            </div>
          </div>

          {/* Mobile Menu */}
              {mobileMenuOpen && (
                <div className="md:hidden border-t border-border py-4 space-y-2">
                  {navLinks.map((link) => (
                    <span
                      key={link.label}
                      role="button"
                      tabIndex={0}
                      onClick={() => console.log(`[v0] Navigating to ${link.label}`)}
                      className="block w-full text-left text-sm font-medium text-foreground/70 hover:text-foreground px-2 py-2 transition cursor-pointer"
                    >
                      {link.label}
                    </span>
                  ))}
                </div>
              )}
        </div>
      </nav>
    </>
  )
}

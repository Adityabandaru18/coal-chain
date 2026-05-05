'use client'

import { Button } from '@/components/ui/button'
import { ArrowRight, BarChart3, Users, Shield, TrendingUp, Lock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-secondary">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">C</span>
            </div>
            <span className="font-bold text-lg text-foreground hidden sm:inline">CoalChain</span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                router.push('/roles')
              }}
            >
              Get Started <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-4 sm:px-6 lg:px-8 py-20 sm:py-32 max-w-7xl mx-auto">
        <div className="text-center space-y-8 max-w-3xl mx-auto">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-bold text-balance text-foreground leading-tight">
            Governance-Driven Blockchain Based Framework for End to End Coal Supply Chain
            </h1>
            <p className="text-xl text-foreground/70 text-balance leading-relaxed">
              Real-time tracking and governance of coal supply chains across mining, transport, and energy sectors with integrated certification and compliance management.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <Button
              size="lg"
              onClick={() => {
                router.push('/roles')
              }}
              className="font-semibold"
            >
              Get Started <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Learn More
            </Button>
          </div>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-20">
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-primary mb-2">5</div>
            <div className="text-sm text-foreground/70">User Roles</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-primary mb-2">100%</div>
            <div className="text-sm text-foreground/70">Transparency</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-primary mb-2">Real-time</div>
            <div className="text-sm text-foreground/70">Tracking</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="px-4 sm:px-6 lg:px-8 py-20 max-w-7xl mx-auto">
        <div className="space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-foreground">Comprehensive Coal Chain Management</h2>
            <p className="text-lg text-foreground/70 max-w-2xl mx-auto text-balance">
              Complete oversight across all stakeholders with specialized dashboards for each role
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Mining */}
            <div className="bg-card border border-border rounded-lg p-8 space-y-4 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Mining Operations</h3>
              <p className="text-foreground/70 leading-relaxed">
                Track coal batches from extraction, manage certifications, and monitor quality metrics in real-time.
              </p>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li>• Batch extraction tracking</li>
                <li>• Quality certifications</li>
                <li>• Production analytics</li>
              </ul>
            </div>

            {/* Government */}
            <div className="bg-card border border-border rounded-lg p-8 space-y-4 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Government Oversight</h3>
              <p className="text-foreground/70 leading-relaxed">
                Regulatory compliance monitoring and supply chain governance with comprehensive audit trails.
              </p>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li>• Compliance verification</li>
                <li>• Regulatory reports</li>
                <li>• Audit trails</li>
              </ul>
            </div>

            {/* Transport */}
            <div className="bg-card border border-border rounded-lg p-8 space-y-4 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Transport & Logistics</h3>
              <p className="text-foreground/70 leading-relaxed">
                Monitor shipments, track deliveries, and manage transport certifications across routes.
              </p>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li>• Shipment tracking</li>
                <li>• Route optimization</li>
                <li>• Delivery verification</li>
              </ul>
            </div>

            {/* Industry */}
            <div className="bg-card border border-border rounded-lg p-8 space-y-4 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Industry Users</h3>
              <p className="text-foreground/70 leading-relaxed">
                Access supply chain data, verify coal batches, and manage inventory with transparency.
              </p>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li>• Batch verification</li>
                <li>• Inventory management</li>
                <li>• Supply chain visibility</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 bg-primary/5 rounded-xl max-w-7xl mx-auto">
        <div className="space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-foreground">How It Works</h2>
            <p className="text-lg text-foreground/70 max-w-2xl mx-auto text-balance">
              A unified system for complete supply chain transparency
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { number: '1', title: 'Extract', desc: 'Coal is extracted and assigned a unique batch ID' },
              { number: '2', title: 'Certify', desc: 'Quality certifications are generated and verified' },
              { number: '3', title: 'Transport', desc: 'Batches are tracked throughout shipment' },
              { number: '4', title: 'Deliver', desc: 'Final delivery with complete audit trail' },
            ].map((step, idx) => (
              <div key={idx} className="relative">
                <div className="bg-card border border-border rounded-lg p-6 space-y-3">
                  <div className="w-10 h-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center font-bold">
                    {step.number}
                  </div>
                  <h3 className="font-semibold text-foreground text-lg">{step.title}</h3>
                  <p className="text-sm text-foreground/70 leading-relaxed">{step.desc}</p>
                </div>
                {idx < 3 && (
                  <div className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-primary/30">
                    <ArrowRight className="w-6 h-6" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="px-4 sm:px-6 lg:px-8 py-20 max-w-7xl mx-auto">
        <div className="space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-4xl font-bold text-foreground">Why Choose CoalChain</h2>
            <p className="text-lg text-foreground/70 max-w-2xl mx-auto text-balance">
              Industry-leading transparency and governance for sustainable coal supply chains
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <Lock className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Secure & Auditable</h3>
              <p className="text-foreground/70 leading-relaxed">
                Complete audit trails and immutable records ensure transparency and accountability across all transactions.
              </p>
            </div>

            <div className="space-y-4">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Real-time Analytics</h3>
              <p className="text-foreground/70 leading-relaxed">
                Advanced dashboards provide instant insights into production, transport, and supply chain metrics.
              </p>
            </div>

            <div className="space-y-4">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Multi-stakeholder</h3>
              <p className="text-foreground/70 leading-relaxed">
                Designed for miners, government agencies, transporters, industries, and smart grid operators.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 max-w-7xl mx-auto">
        <div className="bg-primary rounded-xl p-12 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-primary-foreground text-balance">
            Ready to Transform Your Supply Chain?
          </h2>
          <p className="text-primary-foreground/90 text-lg max-w-2xl mx-auto text-balance">
            Join the coal industry's leading transparency and governance platform
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              router.push('/roles')
            }}
            className="font-semibold"
          >
            Get Started Now <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 sm:px-6 lg:px-8 py-12 mt-20 bg-background">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Product</h4>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                    }
                    className="hover:text-primary transition cursor-pointer"
                  >
                    Features
                  </span>
                </li>
                <li>
                  <span className="hover:text-primary transition cursor-pointer">
                    Pricing
                  </span>
                </li>
                <li>
                  <span className="hover:text-primary transition cursor-pointer">
                    Security
                  </span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Company</h4>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li>
                  <span className="hover:text-primary transition cursor-pointer">
                    About
                  </span>
                </li>
                <li>
                  <span className="hover:text-primary transition cursor-pointer">
                    Blog
                  </span>
                </li>
                <li>
                  <span className="hover:text-primary transition cursor-pointer">
                    Careers
                  </span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Legal</h4>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li>
                  <span className="hover:text-primary transition cursor-pointer">
                    Privacy
                  </span>
                </li>
                <li>
                  <span className="hover:text-primary transition cursor-pointer">
                    Terms
                  </span>
                </li>
                <li>
                  <span className="hover:text-primary transition cursor-pointer">
                    Contact
                  </span>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground">Resources</h4>
              <ul className="space-y-2 text-sm text-foreground/70">
                <li>
                  <span className="hover:text-primary transition cursor-pointer">
                    Docs
                  </span>
                </li>
                <li>
                  <span className="hover:text-primary transition cursor-pointer">
                    API
                  </span>
                </li>
                <li>
                  <span className="hover:text-primary transition cursor-pointer">
                    Support
                  </span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-foreground/70">
            <p>&copy; 2024 CoalChain. All rights reserved.</p>
          </div>
        </div>
      </footer>

    </main>
  )
}

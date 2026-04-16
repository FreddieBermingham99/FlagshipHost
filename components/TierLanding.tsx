'use client'

import React, { useState, useRef } from 'react'
import {
  ArrowRight,
  Check,
  Clock,
  Package,
  Luggage,
  Eye,
  Star,
  Shield,
  Sparkles,
  Megaphone,
  Building2,
  Activity,
  BadgeCheck,
  Phone,
  Mail,
  ChevronDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import SignagePicker, { SignItem } from '@/components/SignagePicker'

export type TierLandingProps = {
  businessName: string
  city: string
  landmark?: string
  contact?: { email?: string; phone?: string }
  formAction?: string
  stashpointId?: string
  locale?: string
  currency?: string
  ownerEmail?: string
  ownerPhone?: string
}

const signageItems: SignItem[] = [
  {
    id: 'countertop-sign',
    name: 'Countertop Sign',
    src: 'https://i.postimg.cc/V64YDzmc/countertop-Sign.png',
    alt: 'Countertop sign for flagship stashpoints',
  },
  {
    id: 'floor-mat',
    name: 'Floor Mat',
    src: 'https://i.postimg.cc/pTk2qPRb/floorMat.png',
    alt: 'Floor mat for flagship stashpoints',
  },
  {
    id: 'opening-hours',
    name: 'Opening Hours',
    src: 'https://i.postimg.cc/1tM9Jys1/opening-Times-Sign.png',
    alt: 'Opening hours sign for flagship stashpoints',
  },
  {
    id: 'pavement-sign',
    name: 'Pavement Sign',
    src: 'https://i.postimg.cc/ZRjTVJ4T/pavement-Sign.png',
    alt: 'Pavement sign for flagship stashpoints',
  },
  {
    id: 'flag',
    name: 'Flag',
    src: 'https://i.postimg.cc/KzQZJmFH/flag.png',
    alt: 'Flag for flagship stashpoints',
  },
  {
    id: 'neon-sign',
    name: 'Neon Sign',
    src: 'https://i.postimg.cc/V64YDzm8/neonSign.png',
    alt: 'Neon sign for flagship stashpoints',
  },
]

type Tier = 'standard' | 'pro' | null

const Section = ({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) => (
  <section id={id} className={`mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20 ${className || ''}`}>
    {children}
  </section>
)

const standardRequirements = [
  { icon: Clock, label: 'Minimum opening hours' },
  { icon: Package, label: 'Minimum capacity' },
  { icon: Luggage, label: 'Accept all bag sizes' },
  { icon: Eye, label: 'Counter top signs and window signs clearly visible' },
  { icon: Star, label: 'Collect 5 Google Maps reviews per month' },
]

const proExtras = [
  { icon: Shield, label: 'Exclusivity in your area' },
  { icon: Sparkles, label: 'Extra signage (choose your own below)' },
]

export default function TierLanding(props: TierLandingProps) {
  const [selectedTier, setSelectedTier] = useState<Tier>(null)
  const [selectedSigns, setSelectedSigns] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [showSignageError, setShowSignageError] = useState(false)

  const signageRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const p = {
    businessName: props.businessName || 'Your Business',
    city: props.city || 'London',
    landmark: props.landmark || 'a key landmark',
    contact: props.contact || { email: 'partners@stasher.com', phone: '+44 20 4525 2401' },
    formAction: props.formAction,
    currency: props.currency || 'GBP',
    ownerEmail: props.ownerEmail,
    ownerPhone: props.ownerPhone,
  }

  const handleTierSelect = (tier: Tier) => {
    setSelectedTier(tier)
    setShowSignageError(false)

    if (tier === 'pro') {
      setTimeout(() => {
        signageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } else {
      setTimeout(() => {
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (selectedTier === 'pro' && selectedSigns.length < 3) {
      setShowSignageError(true)
      signageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    if (!p.formAction) {
      const form = new FormData(e.currentTarget)
      const subject = encodeURIComponent(`Programme interest — ${p.businessName} (${p.city}) — ${selectedTier?.toUpperCase()}`)
      const body = encodeURIComponent(
        Array.from(form.entries())
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
      )
      window.location.href = `mailto:${p.contact.email}?subject=${subject}&body=${body}`
      return
    }

    setIsSubmitting(true)
    const formEl = e.currentTarget as HTMLFormElement

    try {
      const formData = new FormData(e.currentTarget)
      const data = Object.fromEntries(formData.entries())

      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formAction: p.formAction, ...data }),
      })

      if (response.ok) {
        const params = new URLSearchParams({
          source: 'programme',
          tier: selectedTier || '',
          business: p.businessName || '',
          city: p.city || '',
        })
        window.location.href = `/thank-you?${params.toString()}`
        return
      } else {
        const errorText = await response.text()
        throw new Error(`Submission failed: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`There was an error submitting the form: ${errorMessage}\n\nPlease try again or contact us directly.`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = selectedTier !== null && (!isSubmitting) && (selectedTier === 'standard' || selectedSigns.length >= 3)

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img
              src="https://i.postimg.cc/bwdb20Ky/Google-reservations-logo-8.png"
              alt="Stasher"
              className="h-6"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
            <span className="font-bold">Stasher Partner Programme</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a href="#tiers" className="hover:opacity-80">Plans</a>
            <a href="#apply" className="hover:opacity-80">Register</a>
          </nav>
          <Button size="sm" asChild>
            <a href="#tiers">Get Started</a>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-slate-50 to-white">
        <Section className="text-center">
          <div className="mx-auto max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">
              {p.businessName} &bull; {p.city}
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
              Choose your partner plan
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Earn more with Stasher. Select the programme that&apos;s right for {p.businessName} and start growing your luggage storage revenue.
            </p>
            <div className="mt-8">
              <Button size="lg" variant="outline" asChild>
                <a href="#tiers" className="flex items-center gap-2">
                  See plans <ChevronDown className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </Section>
      </div>

      {/* Tier Cards */}
      <Section id="tiers">
        <div className="grid gap-8 md:grid-cols-2">
          {/* Standard Tier */}
          <Card
            className={`relative cursor-pointer transition-all duration-200 ${
              selectedTier === 'standard'
                ? 'border-primary ring-2 ring-primary shadow-lg'
                : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
            }`}
            onClick={() => handleTierSelect('standard')}
          >
            {selectedTier === 'standard' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                  <Check className="h-3 w-3" /> Selected
                </span>
              </div>
            )}
            <CardHeader className="text-center pb-4">
              <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Standard</p>
              <CardTitle className="mt-2 text-2xl">Extra Commission</CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                Meet our quality standards and earn a higher commission rate on every booking.
              </p>
            </CardHeader>
            <CardContent>
              <div className="border-t pt-6">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Requirements</p>
                <ul className="space-y-3">
                  {standardRequirements.map((req) => (
                    <li key={req.label} className="flex items-start gap-3">
                      <req.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm text-slate-700">{req.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8">
                <Button
                  className="w-full"
                  variant={selectedTier === 'standard' ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTierSelect('standard')
                  }}
                >
                  {selectedTier === 'standard' ? (
                    <span className="flex items-center gap-2"><Check className="h-4 w-4" /> Selected</span>
                  ) : (
                    'Select Standard'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pro Tier */}
          <Card
            className={`relative cursor-pointer transition-all duration-200 ${
              selectedTier === 'pro'
                ? 'border-primary ring-2 ring-primary shadow-lg'
                : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
            }`}
            onClick={() => handleTierSelect('pro')}
          >
            <div className={`absolute -top-3 left-1/2 -translate-x-1/2 ${selectedTier === 'pro' ? '' : ''}`}>
              {selectedTier === 'pro' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                  <Check className="h-3 w-3" /> Selected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-blush px-3 py-1 text-xs font-semibold text-primary">
                  <Sparkles className="h-3 w-3" /> Recommended
                </span>
              )}
            </div>
            <CardHeader className="text-center pb-4">
              <p className="text-sm font-medium uppercase tracking-wider text-primary">Pro</p>
              <CardTitle className="mt-2 text-2xl">Extra Commission + Extra Demand</CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                Everything in Standard, plus we actively drive new customers to {p.businessName}.
              </p>
            </CardHeader>
            <CardContent>
              <div className="border-t pt-6">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  All Standard requirements, plus
                </p>
                <ul className="space-y-3">
                  {standardRequirements.map((req) => (
                    <li key={req.label} className="flex items-start gap-3 opacity-50">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span className="text-sm text-slate-500">{req.label}</span>
                    </li>
                  ))}
                  {proExtras.map((req) => (
                    <li key={req.label} className="flex items-start gap-3">
                      <req.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm font-medium text-slate-700">{req.label}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 rounded-lg bg-slate-50 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
                    How we drive demand
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-xs text-slate-600">Google Ads boost paid for by Stasher</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-xs text-slate-600">Branded store kit provided by Stasher</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-xs text-slate-600">Increased website traffic to your listing</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-xs text-slate-600">Become Stasher&apos;s {p.city} centrepiece</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="mt-8">
                <Button
                  className="w-full"
                  variant={selectedTier === 'pro' ? 'default' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleTierSelect('pro')
                  }}
                >
                  {selectedTier === 'pro' ? (
                    <span className="flex items-center gap-2"><Check className="h-4 w-4" /> Selected</span>
                  ) : (
                    'Select Pro'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      {/* Signage Picker — only visible when Pro is selected */}
      {selectedTier === 'pro' && (
        <div ref={signageRef}>
          <Section id="signage">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                Choose your signage
              </h2>
              <p className="mt-3 text-lg text-slate-600">
                Select the signage you&apos;d like for {p.businessName}. You must choose at least 3 items.
              </p>
              {showSignageError && selectedSigns.length < 3 && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  Please select at least 3 pieces of signage to continue with the Pro plan.
                </p>
              )}
            </div>
            <SignagePicker
              items={signageItems}
              storageKey={`tier-signs-${p.businessName.toLowerCase().replace(/\s+/g, '-')}`}
              onChange={(ids) => {
                setSelectedSigns(ids)
                if (ids.length >= 3) setShowSignageError(false)
              }}
            />
            <div className="mt-6 text-center">
              {selectedSigns.length > 0 ? (
                <p className={`text-sm font-medium ${selectedSigns.length >= 3 ? 'text-green-600' : 'text-amber-600'}`}>
                  {selectedSigns.length} of 3 minimum selected
                  {selectedSigns.length >= 3 && <Check className="ml-1 inline h-4 w-4" />}
                </p>
              ) : (
                <p className="text-sm text-slate-500">Select the signage items you&apos;re interested in</p>
              )}
            </div>
            {selectedSigns.length >= 3 && (
              <div className="mt-8 text-center">
                <Button size="lg" asChild>
                  <a href="#apply" className="flex items-center gap-2">
                    Continue to register <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            )}
          </Section>
        </div>
      )}

      {/* Form */}
      {selectedTier && (
        <div ref={formRef}>
          <Section id="apply" className="bg-slate-50 rounded-3xl">
            <div className="mx-auto max-w-2xl">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
                  Register your interest
                </h2>
                <p className="mt-2 text-slate-600">
                  You&apos;ve selected the <span className="font-semibold text-primary">{selectedTier === 'pro' ? 'Pro' : 'Standard'}</span> plan.
                  {selectedTier === 'pro' && ` ${selectedSigns.length} signage item${selectedSigns.length !== 1 ? 's' : ''} chosen.`}
                </p>
              </div>

              <form method="POST" action={p.formAction} onSubmit={handleSubmit} className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input name="name" required placeholder="Your name" className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Role</label>
                    <Input name="role" placeholder="Owner / Manager" className="mt-1" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Business name</label>
                    <Input name="business" defaultValue={p.businessName} required className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">City</label>
                    <Input name="city" defaultValue={p.city} required className="mt-1" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <Input type="email" name="email" required placeholder="you@example.com" defaultValue={p.ownerEmail} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Phone</label>
                    <Input type="tel" name="phone" placeholder="+44 20 1234 5678" defaultValue={p.ownerPhone} className="mt-1" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Any questions?</label>
                  <Textarea name="notes" className="mt-1" />
                </div>

                <input type="hidden" name="source" value="programme" />
                <input type="hidden" name="stashpointId" value={props.stashpointId || ''} />
                <input type="hidden" name="selectedTier" value={selectedTier || ''} />
                <input type="hidden" name="selectedSigns" value={JSON.stringify(selectedSigns)} />

                {submitSuccess && (
                  <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-sm">
                    Thank you! Your interest has been submitted. We&apos;ll be in touch within one business day.
                  </div>
                )}

                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={!canSubmit}
                  >
                    {isSubmitting
                      ? 'Submitting...'
                      : submitSuccess
                        ? '✓ Submitted'
                        : 'Submit interest'}
                  </Button>
                  {selectedTier === 'pro' && selectedSigns.length < 3 && (
                    <span className="text-xs text-amber-600">
                      Select at least 3 signage items to submit
                    </span>
                  )}
                </div>
                <p className="text-center text-xs text-slate-500">
                  By submitting, you agree to be contacted about the Stasher Partner Programme.
                </p>
              </form>
            </div>
          </Section>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t">
        <Section>
          <div className="flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
            <div className="text-slate-500">
              &copy; {new Date().getFullYear()} Stasher &bull; Partner Programme
            </div>
            <div className="flex items-center gap-4 text-slate-600">
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" /> {p.contact.phone}
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" /> {p.contact.email}
              </div>
            </div>
          </div>
        </Section>
      </footer>
    </div>
  )
}

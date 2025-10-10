'use client'

import React, { useState } from 'react'
import {
  ArrowRight,
  Star,
  Megaphone,
  Building2,
  MapPin,
  Activity,
  BadgeCheck,
  BarChart3,
  Phone,
  Mail,
  LinkIcon,
  TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import SignagePicker, { SignItem } from '@/components/SignagePicker'

export type FlagshipProps = {
  businessName: string
  city: string
  landmark?: string
  heroImageUrl?: string
  contact: { email?: string; phone?: string }
  formAction?: string
  googleMapsUrl?: string
  // Current performance stats
  websiteImpressions?: string
  gmapsImpressions?: string
  bookings?: string
  revenue?: string
  // Expected lift stats
  liftWebsiteImpressions?: string
  liftGmapsImpressions?: string
  liftBookings?: string
  liftRevenue?: string
  currency?: string
  topBookings?: string
  topViews?: string
  topRevenue?: string
  // Business owner contact info (for autofill)
  ownerEmail?: string
  ownerPhone?: string
  parisOne?: string
  parisTwo?: string
  madridOne?: string
  madridTwo?: string
}

const defaultImages = {
  hero: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1600&auto=format&fit=crop',
  signage:
    'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?q=80&w=1200&auto=format&fit=crop',
  floorMat:
    'https://images.unsplash.com/photo-1520420097861-4d99c2d1f2bb?q=80&w=1200&auto=format&fit=crop',
  sticker:
    'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=1200&auto=format&fit=crop',
  caseStudy:
    'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?q=80&w=1400&auto=format&fit=crop',
}

// Signage items for the picker
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

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full bg-blush px-3 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-blush">
    {children}
  </span>
)

const Section = ({ id, children }: { id?: string; children: React.ReactNode }) => (
  <section id={id} className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-20">
    {children}
  </section>
)


export default function FlagshipStashpointLanding(props: FlagshipProps) {
  const [selectedSigns, setSelectedSigns] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const p = {
    businessName: props.businessName || 'Your Business',
    city: props.city || 'Paris',
    landmark: props.landmark || 'a key landmark',
    heroImageUrl: props.heroImageUrl || defaultImages.hero,
    contact: props.contact || { email: 'partners@stasher.com', phone: '+44 20 4525 2401' },
    formAction: props.formAction,
    googleMapsUrl: props.googleMapsUrl || 'https://maps.google.com',
    currency: props.currency,

    // Current performance stats
    websiteImpressions: props.websiteImpressions,
    gmapsImpressions: props.gmapsImpressions,
    bookings: props.bookings,
    revenue: props.revenue,
    // Expected lift stats
    liftWebsiteImpressions: props.liftWebsiteImpressions,
    liftGmapsImpressions: props.liftGmapsImpressions,
    liftBookings: props.liftBookings,
    liftRevenue: props.liftRevenue,
    topBookings: props.topBookings,
    topViews: props.topViews,
    topRevenue: props.topRevenue,
    // Business owner contact
    ownerEmail: props.ownerEmail,
    ownerPhone: props.ownerPhone,
    parisOne: props.parisOne,
    parisTwo: props.parisTwo,
    madridOne: props.madridOne,
    madridTwo: props.madridTwo,
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    if (!p.formAction) {
      // Fallback to mailto if no webhook
      e.preventDefault()
      const form = new FormData(e.currentTarget)
      const subject = encodeURIComponent(`Flagship interest — ${p.businessName} (${p.city})`)
      const body = encodeURIComponent(
        Array.from(form.entries())
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n')
      )
      window.location.href = `mailto:${p.contact.email}?subject=${subject}&body=${body}`
      return
    }

    // Handle webhook submission
    e.preventDefault()
    setIsSubmitting(true)
    const formEl = e.currentTarget as HTMLFormElement

    try {
      const formData = new FormData(e.currentTarget)
      const data = Object.fromEntries(formData.entries())

      // Proxy through our API to avoid CORS and keep credentials server-side
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formAction: p.formAction, ...data }),
      })

      if (response.ok) {
        setSubmitSuccess(true)
        // Success popup
        try {
          window.alert(`Thank you for registering your interest in becoming a Flagship Stashpoint in ${p.city}!`)
        } catch {}
        // Safely reset the form
        try {
          formEl.reset()
        } catch {}
        // Auto-hide success banner after a short delay
        setTimeout(() => {
          setSubmitSuccess(false)
        }, 3000)
      } else {
        throw new Error('Submission failed')
      }
    } catch (error) {
      console.error('Form submission error:', error)
      alert('There was an error submitting the form. Please try again or contact us directly.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <img
              src="https://i.postimg.cc/bwdb20Ky/Google-reservations-logo-8.png"
              alt="Stasher"
              className="h-6"
              onError={(e) => ((e.currentTarget.style.display = 'none'))}
            />
            <span className="font-bold">Stasher Flagship Programme</span>
            <Pill>Invitation</Pill>
          </div>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a href="#performance" className="hover:opacity-80">
              Benefits
            </a>
            <a href="#branding" className="hover:opacity-80">
              Branding
            </a>
            <a href="#case" className="hover:opacity-80">
              Results
            </a>
            <a href="#apply" className="hover:opacity-80">
              Register Interest
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild>
              <a href="#apply">I&apos;m Interested</a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-white">
        <div className="pb-14 pt-28">
          <Section>
            <div className="max-w-3xl">
              <Pill>
                {p.businessName} • {p.city}
              </Pill>
              <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">
                Get <span className="text-primary">hundreds</span> of new Stasher bookings every month.
              </h1>
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-3xl">
                Become a <span className="text-primary">Flagship Stashpoint</span> in {p.city}
              </h2>
              <p className="mt-4 text-lg text-slate-700">
                Join Stasher&apos;s premier partner programme and make {p.businessName} the <span className="text-primary font-bold">go‑to spot for luggage storage</span> in {p.city}. 
              </p>
            </div>

            {/* Performance stats - current and expected */}
            <div id="performance" className="mt-10">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold">{p.businessName}&apos;s Current Monthly Performance</h3>
              </div>
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <Card className="bg-white border-white text-center">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-3xl font-bold text-primary">{p.websiteImpressions || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-primary">Website impressions</CardContent>
                </Card>
                <Card className="bg-white border-white text-center">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-3xl font-bold text-primary">{p.gmapsImpressions || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-primary">Google Maps impressions</CardContent>
                </Card>
                <Card className="bg-white border-white text-center">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-3xl font-bold text-primary">{p.bookings || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-primary">Bookings</CardContent>
                </Card>
                <Card className="bg-white border-white text-center">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-3xl font-bold text-primary">{p.revenue || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-primary">Revenue</CardContent>
                </Card>
              </div>
              
              <div className="text-center mt-10 mb-6">
                <h3 className="text-xl font-semibold text-primary">Expected Performance as a Flagship Stashpoint</h3>
              </div>
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <Card className="bg-primary border-primary text-center">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className="h-8 w-8 text-green-400" strokeWidth={3} />
                    </div>
                    <CardTitle className="text-3xl font-bold text-white">{p.liftWebsiteImpressions || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm font-bold text-blush">Expected website impressions</CardContent>
                </Card>
                <Card className="bg-primary border-primary text-center">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className="h-8 w-8 text-green-400" strokeWidth={3} />
                    </div>
                    <CardTitle className="text-3xl font-bold text-white">{p.liftGmapsImpressions || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm font-bold text-blush">Expected Google Maps impressions</CardContent>
                </Card>
                <Card className="bg-primary border-primary text-center">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className="h-8 w-8 text-green-400" strokeWidth={3} />
                    </div>
                    <CardTitle className="text-3xl font-bold text-white">{p.liftBookings || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm font-bold text-blush">Expected Bookings</CardContent>
                </Card>
                <Card className="bg-primary border-primary text-center">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className="h-8 w-8 text-green-400" strokeWidth={3} />
                    </div>
                    <CardTitle className="text-3xl font-bold text-white">{p.liftRevenue || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm font-bold text-blush">Expected Revenue</CardContent>
                </Card>
              </div>
              </div>
             <div className="text-center mt-32 mb-6">
             <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
             How do we achieve this lift?            
             </h2>
             </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <Megaphone className="h-5 w-5" />
                  <CardTitle className="text-base">Google Ads Boost paid for by Stasher</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  We&apos;ll pay for Google Ads campaigns targeting {p.city} travellers and direct them to your listing.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <Building2 className="h-5 w-5" />
                  <CardTitle className="text-base">Branded Store Kit provided by Stasher</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  Exterior and interior signage of your choice, co-branded with {p.businessName} to boost trust and walk‑ins.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <Activity className="h-5 w-5" />
                  <CardTitle className="text-base">Increased Website Traffic</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  We&apos;ll improve the visibility of your listing on our website and blog to increase traffic and bookings.
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <BadgeCheck className="h-5 w-5" />
                  <CardTitle className="text-base">Become Stasher&apos;s {p.city} Centrepiece</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  Stasher&apos;s out of home advertising campaigns in {p.city} will be strategically centred around {p.businessName} to attract more customers to your location.
                </CardContent>
              </Card>
            </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <a href="#apply" className="flex items-center">
                    Register your interest <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a
                    href="#case"
                    className="flex items-center"
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    See your area potential
                  </a>
                </Button>
              </div>

              {/* Why this business - Personalised pitch */}
              <div className="mt-24">
                <Card className="border-blush bg-gradient-to-r from-blush to-blush/50">
                  <CardContent className="p-6 md:p-8">
                    <div className="grid items-center gap-6 md:grid-cols-3">
                      <div className="md:col-span-2">
                        <h3 className="text-2xl md:text-3xl font-bold text-primary">Why {p.businessName}?</h3>
                        <p className="mt-3 text-lg text-slate-700">
                          Your location near {p.landmark} makes you the ideal flagship candidate to serve
                          travellers arriving in {p.city}. We&apos;ll drive demand directly to your door via paid
                          search and priority placement.
                        </p>
                        <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-slate-700">
                          <li>Increase your monthly revenue by hundreds of {p.currency}</li>
                          <li>Rank as one of our top Stashpoints in {p.city}</li>
                          <li>Benefit from our out of home and paid advertising campaigns in {p.city}</li>
                        </ul>
                      </div>
                      <div className="flex items-center justify-center">
                        <img
                          src={p.parisTwo || defaultImages.caseStudy}
                          alt={p.businessName}
                          className="aspect-[4/5] w-full max-w-xs rounded-xl border bg-white shadow object-cover"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
            </div>
          </Section>
        </div>
      </div>
      {/* Signage Picker */}
      <Section id="branding">
        <div className="text-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            What kind of signage can a Flagship Stashpoint get?
            </h2>
            <p className="mt-3 text-lg text-slate-700">
              Choose the signage you&apos;d like for {p.businessName}. Select all that apply - we can tailor them to your storefront.
            </p>
        </div>
        <SignagePicker
          items={signageItems}
          storageKey={`flagship-signs-${p.businessName.toLowerCase().replace(/\s+/g, '-')}`}
          onChange={setSelectedSigns}
        />
        <div className="mt-6 text-center text-sm text-slate-600">
          {selectedSigns.length > 0 ? (
            <p>
              ✓ {selectedSigns.length} item{selectedSigns.length !== 1 ? 's' : ''} selected
            </p>
          ) : (
            <p>Select the signage items you&apos;re interested in</p>
          )}
        </div>
      </Section>

      {/* Case study / expected impact */}
      <Section id="case">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <img
            className="h-80 w-full rounded-2xl object-cover shadow"
            src={p.parisOne || defaultImages.caseStudy}
            alt="Case study"
          />
          <div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              How is the top Stashpoint in {p.city} performing?
            </h2>
            <p className="mt-4 text-slate-700">
              In {p.city}, Stasher&apos;s current top location has had:
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-3xl">{p.topViews || '—'}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600">Views this year</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-3xl">{p.topBookings || '—'}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600">
                  Bookings this year
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-3xl">{p.topRevenue || '—'}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600">
                  Revenue this year
                </CardContent>
              </Card>
            </div>
            <div className="mt-6 flex items-center gap-3 text-sm">
              <BarChart3 className="h-4 w-4" />
              <span>Featured in city campaigns: Google Ads, blog posts, OOH billboards.</span>
            </div>
          </div>
        </div>
      </Section>

      {/* Apply / CTA form */}
      <Section id="apply">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              Register your interest
            </h2>
            <p className="mt-2 text-slate-700">
              Tell us a few details and our partnerships team will be in touch within one business
              day.
            </p>
            <form method="POST" action={p.formAction} onSubmit={handleSubmit} className="mt-6 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm">Your name</label>
                  <Input name="name" required placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="text-sm">Role</label>
                  <Input name="role" placeholder="Owner / Manager" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm">Business name</label>
                  <Input name="business" defaultValue={p.businessName} required />
                </div>
                <div>
                  <label className="text-sm">City</label>
                  <Input name="city" defaultValue={p.city} required />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm">Email</label>
                  <Input type="email" name="email" required placeholder="you@example.com" defaultValue={p.ownerEmail} />
                </div>
                <div>
                  <label className="text-sm">Phone</label>
                  <Input type="tel" name="phone" placeholder="+33 1 23 45 67 89" defaultValue={p.ownerPhone} />
                </div>
              </div>
              <div>
                <label className="text-sm">Any questions that you might have?</label>
                <Textarea
                  name="notes"
                />
              </div>
              {/* Hidden input for selected signs */}
              <input type="hidden" name="selectedSigns" value={JSON.stringify(selectedSigns)} />
              
              {submitSuccess && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-sm">
                  ✓ Thank you! Your interest has been submitted. We&apos;ll be in touch within one business day.
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <Button type="submit" className="" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : submitSuccess ? '✓ Submitted' : 'Submit interest'}
                </Button>
                <span className="text-xs text-slate-500">
                  By submitting, you agree to be contacted about the Flagship Programme.
                </span>
              </div>
            </form>
          </div>

          <div className="lg:pl-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What you&apos;ll get</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">
                <ul className="list-disc space-y-2 pl-5">
                  <li>Priority listing & city page feature</li>
                  <li>Inclusion in Google Ads & blog content</li>
                  <li>
                    Co‑branded signage kit (signs, floor mats, opening time stickers, flags)
                  </li>
                  <li>Improved visibility on our website</li>
                  <li>The centrepiece of our home advertising campaigns in {p.city}</li>
                  <li>Increased Google Maps reviews and visibility</li>
                  <li>Dedicated partner success support</li>
                  <li>Measurement & monthly insights</li>
                </ul>
                <div className="mt-4 flex flex-col gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" /> {p.contact.phone}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" /> {p.contact.email}
                  </div>
                  <a
                    className="mt-2 inline-flex items-center gap-2 text-primary hover:underline"
                    href="#performance"
                  >
                    <Star className="h-4 w-4" /> Why become a flagship?
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Section>

      {/* Footer */}
      <footer className="border-t">
        <Section>
          <div className="flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
            <div className="text-slate-600">
              © {new Date().getFullYear()} Stasher • Flagship Programme
            </div>
            <div className="flex items-center gap-4">
              <a className="inline-flex items-center gap-1 hover:underline" href="#apply">
                <LinkIcon className="h-4 w-4" />
                Register interest
              </a>
              <a className="inline-flex items-center gap-1 hover:underline" href="#performance">
                Benefits
              </a>
              <a className="inline-flex items-center gap-1 hover:underline" href="#case">
                Results
              </a>
            </div>
          </div>
        </Section>
      </footer>
    </div>
  )
}


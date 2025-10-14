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
  locale?: string // 'en' or 'fr'
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

// Translations
const translations = {
  en: {
    // Header
    programTitle: 'Stasher Flagship Programme',
    invitation: 'Invitation',
    navBenefits: 'Benefits',
    navBranding: 'Branding',
    navResults: 'Results',
    navRegister: 'Register Interest',
    ctaInterested: "I'm Interested",
    
    // Hero
    heroTitle: 'Get hundreds of new Stasher bookings every month.',
    heroSubtitle: 'Become a Flagship Stashpoint in',
    heroDescription: "Join Stasher's premier partner programme and make {businessName} the go‑to spot for luggage storage in {city}.",
    
    // Performance
    currentPerformance: "{businessName}'s Current Monthly Performance",
    expectedPerformance: 'Expected Performance as a Flagship Stashpoint',
    websiteImpressions: 'Website impressions',
    gmapsImpressions: 'Google Maps impressions',
    bookings: 'Bookings',
    revenue: 'Revenue',
    expectedWebsite: 'Expected website impressions',
    expectedGmaps: 'Expected Google Maps impressions',
    expectedBookings: 'Expected Bookings',
    expectedRevenue: 'Expected Revenue',
    
    // How section
    howTitle: 'How do we achieve this lift?',
    googleAdsTitle: 'Google Ads Boost paid for by Stasher',
    googleAdsDesc: "We'll pay for Google Ads campaigns targeting {city} travellers and direct them to your listing.",
    brandedKitTitle: 'Branded Store Kit provided by Stasher',
    brandedKitDesc: 'Exterior and interior signage of your choice, co-branded with {businessName} to boost trust and walk‑ins.',
    trafficTitle: 'Increased Website Traffic',
    trafficDesc: "We'll improve the visibility of your listing on our website and blog to increase traffic and bookings.",
    centerpieceTitle: "Become Stasher's {city} Centrepiece",
    centerpieceDesc: "Stasher's out of home advertising campaigns in {city} will be strategically centred around {businessName} to attract more customers to your location.",
    
    // CTA buttons
    registerInterest: 'Register your interest',
    seeAreaPotential: 'See your area potential',
    
    // Why section
    whyTitle: 'Why {businessName}?',
    whyDescription: "Your location near {landmark} makes you the ideal flagship candidate to serve travellers arriving in {city}. We'll drive demand directly to your door via paid search and priority placement.",
    whyBullet1: 'Increase your monthly revenue by hundreds of {currency}',
    whyBullet2: 'Rank as one of our top Stashpoints in {city}',
    whyBullet3: 'Benefit from our out of home and paid advertising campaigns in {city}',
    whyBullet4: 'Become the primary Stashpoint destination for your area',
    
    // Signage
    signageTitle: 'What kind of signage can a Flagship Stashpoint get?',
    signageDescription: "Choose the signage you'd like for {businessName}. Select all that apply - we can tailor them to your storefront.",
    signageSelected: '{count} item{plural} selected',
    signagePrompt: "Select the signage items you're interested in",
    
    // Case study
    caseTitle: 'How is the top Stashpoint in {city} performing?',
    caseDescription: "In {city}, Stasher's current top location has had:",
    viewsYear: 'Views this year',
    bookingsYear: 'Bookings this year',
    revenueYear: 'Revenue this year',
    
    // Form
    formTitle: 'Register your interest',
    formSubtitle: "Ready to become {city}'s flagship Stashpoint? Let's talk.",
    formName: 'Name',
    formNamePlaceholder: 'Your name',
    formEmail: 'Email',
    formEmailPlaceholder: 'you@example.com',
    formPhone: 'Phone',
    formPhonePlaceholder: '+33 1 23 45 67 89',
    formQuestions: 'Any questions that you might have?',
    formSubmitting: 'Submitting...',
    formSubmitted: '✓ Submitted',
    formSubmit: 'Submit interest',
    formDisclaimer: 'By submitting, you agree to be contacted about the Flagship Programme.',
    formSuccess: "✓ Thank you! Your interest has been submitted. We'll be in touch within one business day.",
    
    // What you'll get
    whatYouGet: "What you'll get",
    benefitPriority: 'Priority listing & city page feature',
    benefitAds: 'Inclusion in Google Ads & blog content',
    benefitSignage: 'Co‑branded signage kit (signs, floor mats, opening time stickers, flags)',
    benefitVisibility: 'Improved visibility on our website',
    benefitCenterpiece: 'The centrepiece of our home advertising campaigns in {city}',
    benefitReviews: 'Increased Google Maps reviews and visibility',
    benefitSupport: 'Dedicated partner success support',
    benefitInsights: 'Measurement & monthly insights',
    whyBecome: 'Why become a flagship?',
    
    // Footer
    footerCopyright: '© {year} Stasher • Flagship Programme',
    footerRegister: 'Register interest',
    footerBenefits: 'Benefits',
    footerResults: 'Results',
  },
  fr: {
    // Header
    programTitle: 'Programme Flagship Stasher',
    invitation: 'Invitation',
    navBenefits: 'Avantages',
    navBranding: 'Marque',
    navResults: 'Résultats',
    navRegister: "Manifester son intérêt",
    ctaInterested: "Je suis intéressé",
    
    // Hero
    heroTitle: 'Obtenez des centaines de nouvelles réservations Stasher chaque mois.',
    heroSubtitle: 'Devenez un Flagship Stashpoint à',
    heroDescription: "Rejoignez le programme partenaire premium de Stasher et faites de {businessName} le lieu incontournable pour le stockage de bagages à {city}.",
    
    // Performance
    currentPerformance: "Performance mensuelle actuelle de {businessName}",
    expectedPerformance: 'Performance attendue en tant que Flagship Stashpoint',
    websiteImpressions: 'Impressions sur le site web',
    gmapsImpressions: 'Impressions Google Maps',
    bookings: 'Réservations',
    revenue: 'Revenus',
    expectedWebsite: 'Impressions site web attendues',
    expectedGmaps: 'Impressions Google Maps attendues',
    expectedBookings: 'Réservations attendues',
    expectedRevenue: 'Revenus attendus',
    
    // How section
    howTitle: 'Comment réalisons-nous cette amélioration ?',
    googleAdsTitle: 'Publicités Google payées par Stasher',
    googleAdsDesc: "Nous paierons pour des campagnes Google Ads ciblant les voyageurs de {city} et les dirigerons vers votre annonce.",
    brandedKitTitle: 'Kit de magasin de marque fourni par Stasher',
    brandedKitDesc: 'Signalétique extérieure et intérieure de votre choix, co-marquée avec {businessName} pour renforcer la confiance et attirer les clients.',
    trafficTitle: 'Augmentation du trafic sur le site web',
    trafficDesc: "Nous améliorerons la visibilité de votre annonce sur notre site web et blog pour augmenter le trafic et les réservations.",
    centerpieceTitle: "Devenez le point central de Stasher à {city}",
    centerpieceDesc: "Les campagnes publicitaires hors domicile de Stasher à {city} seront stratégiquement centrées sur {businessName} pour attirer plus de clients vers votre emplacement.",
    
    // CTA buttons
    registerInterest: 'Manifester votre intérêt',
    seeAreaPotential: 'Voir le potentiel de votre zone',
    
    // Why section
    whyTitle: 'Pourquoi {businessName} ?',
    whyDescription: 'Votre emplacement près de {landmark} fait de vous le candidat idéal pour servir les voyageurs arrivant à {city}. Nous générerons la demande directement à votre porte via la recherche payante et le placement prioritaire.',
    whyBullet1: 'Augmentez vos revenus mensuels de centaines de {currency}',
    whyBullet2: 'Classez-vous parmi nos meilleurs Stashpoints à {city}',
    whyBullet3: 'Bénéficiez de nos campagnes publicitaires hors domicile et payantes à {city}',
    whyBullet4: 'Devenez la destination Stashpoint principale de votre zone',
    
    // Signage
    signageTitle: 'Quel type de signalétique un Flagship Stashpoint peut-il obtenir ?',
    signageDescription: "Choisissez la signalétique que vous souhaitez pour {businessName}. Sélectionnez tout ce qui s'applique - nous pouvons les adapter à votre vitrine.",
    signageSelected: '{count} article{plural} sélectionné{plural}',
    signagePrompt: "Sélectionnez les articles de signalétique qui vous intéressent",
    
    // Case study
    caseTitle: 'Comment se comporte le meilleur Stashpoint à {city} ?',
    caseDescription: "À {city}, l'emplacement principal actuel de Stasher a eu :",
    viewsYear: 'Vues cette année',
    bookingsYear: 'Réservations cette année',
    revenueYear: 'Revenus cette année',
    
    // Form
    formTitle: 'Manifester votre intérêt',
    formSubtitle: "Prêt à devenir le Flagship Stashpoint de {city} ? Parlons-en.",
    formName: 'Nom',
    formNamePlaceholder: 'Votre nom',
    formEmail: 'Email',
    formEmailPlaceholder: 'vous@exemple.com',
    formPhone: 'Téléphone',
    formPhonePlaceholder: '+33 1 23 45 67 89',
    formQuestions: 'Avez-vous des questions ?',
    formSubmitting: 'Envoi en cours...',
    formSubmitted: '✓ Envoyé',
    formSubmit: 'Soumettre mon intérêt',
    formDisclaimer: 'En soumettant, vous acceptez d\'être contacté concernant le Programme Flagship.',
    formSuccess: "✓ Merci ! Votre intérêt a été soumis. Nous vous contacterons dans un jour ouvrable.",
    
    // What you'll get
    whatYouGet: "Ce que vous obtiendrez",
    benefitPriority: 'Annonce prioritaire et mise en avant sur la page de la ville',
    benefitAds: 'Inclusion dans les Google Ads et le contenu du blog',
    benefitSignage: 'Kit de signalétique co-marqué (enseignes, tapis de sol, autocollants horaires, drapeaux)',
    benefitVisibility: 'Visibilité améliorée sur notre site web',
    benefitCenterpiece: 'Le point central de nos campagnes publicitaires à domicile à {city}',
    benefitReviews: 'Avis Google Maps et visibilité accrus',
    benefitSupport: 'Support dédié à la réussite des partenaires',
    benefitInsights: 'Mesure et informations mensuelles',
    whyBecome: 'Pourquoi devenir flagship ?',
    
    // Footer
    footerCopyright: '© {year} Stasher • Programme Flagship',
    footerRegister: 'Manifester son intérêt',
    footerBenefits: 'Avantages',
    footerResults: 'Résultats',
  },
};

export default function FlagshipStashpointLanding(props: FlagshipProps) {
  const [selectedSigns, setSelectedSigns] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Get translations based on locale (default to 'en')
  const locale = (props.locale || 'en') as 'en' | 'fr'
  const t = translations[locale]
  
  // Debug: Log locale to console
  console.log('Locale received:', props.locale, '| Using:', locale)
  
  // Helper function to replace placeholders in translation strings
  const translate = (key: keyof typeof t, replacements?: Record<string, string>) => {
    let text = t[key] as string
    if (replacements) {
      Object.entries(replacements).forEach(([placeholder, value]) => {
        text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value || '')
      })
    }
    return text
  }

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
        const errorText = await response.text()
        console.error('Server error:', response.status, errorText)
        throw new Error(`Submission failed: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      console.error('Form submission error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`There was an error submitting the form: ${errorMessage}\n\nPlease try again or contact us directly.`)
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
            <span className="font-bold">{t.programTitle}</span>
            <Pill>{t.invitation}</Pill>
          </div>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a href="#performance" className="hover:opacity-80">
              {t.navBenefits}
            </a>
            <a href="#branding" className="hover:opacity-80">
              {t.navBranding}
            </a>
            <a href="#case" className="hover:opacity-80">
              {t.navResults}
            </a>
            <a href="#apply" className="hover:opacity-80">
              {t.navRegister}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild>
              <a href="#apply">{t.ctaInterested}</a>
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
                {t.heroTitle}
              </h1>
              <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-3xl">
                {t.heroSubtitle} <span className="text-primary">{p.city}</span>
              </h2>
              <p className="mt-4 text-lg text-slate-700">
                {translate('heroDescription', { businessName: p.businessName, city: p.city })}
              </p>
            </div>

            {/* Performance stats - current and expected */}
            <div id="performance" className="mt-10">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold">{translate('currentPerformance', { businessName: p.businessName })}</h3>
        </div>
              <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <Card className="bg-white border-white text-center">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-3xl font-bold text-primary">{p.websiteImpressions || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-primary">{t.websiteImpressions}</CardContent>
                </Card>
                <Card className="bg-white border-white text-center">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-3xl font-bold text-primary">{p.gmapsImpressions || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-primary">{t.gmapsImpressions}</CardContent>
                </Card>
                <Card className="bg-white border-white text-center">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-3xl font-bold text-primary">{p.bookings || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-primary">{t.bookings}</CardContent>
                </Card>
                <Card className="bg-white border-white text-center">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-3xl font-bold text-primary">{p.revenue || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-primary">{t.revenue}</CardContent>
                </Card>
      </div>

              <div className="text-center mt-10 mb-6">
                <h3 className="text-xl font-semibold text-primary">{t.expectedPerformance}</h3>
              </div>
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                <Card className="bg-primary border-primary text-center">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className="h-8 w-8 text-green-400" strokeWidth={3} />
                    </div>
                    <CardTitle className="text-3xl font-bold text-white">{p.liftWebsiteImpressions || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm font-bold text-blush">{t.expectedWebsite}</CardContent>
                </Card>
                <Card className="bg-primary border-primary text-center">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className="h-8 w-8 text-green-400" strokeWidth={3} />
                    </div>
                    <CardTitle className="text-3xl font-bold text-white">{p.liftGmapsImpressions || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm font-bold text-blush">{t.expectedGmaps}</CardContent>
                </Card>
                <Card className="bg-primary border-primary text-center">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className="h-8 w-8 text-green-400" strokeWidth={3} />
                    </div>
                    <CardTitle className="text-3xl font-bold text-white">{p.liftBookings || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm font-bold text-blush">{t.expectedBookings}</CardContent>
                </Card>
                <Card className="bg-primary border-primary text-center">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-center mb-2">
                      <TrendingUp className="h-8 w-8 text-green-400" strokeWidth={3} />
                    </div>
                    <CardTitle className="text-3xl font-bold text-white">{p.liftRevenue || '—'}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm font-bold text-blush">{t.expectedRevenue}</CardContent>
                </Card>
              </div>
        </div>
             <div className="text-center mt-32 mb-6">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
             {t.howTitle}            
            </h2>
             </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <Megaphone className="h-5 w-5" />
                  <CardTitle className="text-base">{t.googleAdsTitle}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  {translate('googleAdsDesc', { city: p.city })}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <Building2 className="h-5 w-5" />
                  <CardTitle className="text-base">{t.brandedKitTitle}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  {translate('brandedKitDesc', { businessName: p.businessName })}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <Activity className="h-5 w-5" />
                  <CardTitle className="text-base">{t.trafficTitle}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  {t.trafficDesc}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center gap-3 pb-2">
                  <BadgeCheck className="h-5 w-5" />
                  <CardTitle className="text-base">{translate('centerpieceTitle', { city: p.city })}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  {translate('centerpieceDesc', { city: p.city, businessName: p.businessName })}
                </CardContent>
              </Card>
            </div>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <a href="#apply" className="flex items-center">
                    {t.registerInterest} <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <a
                    href="#case"
                    className="flex items-center"
                  >
                    <MapPin className="mr-2 h-4 w-4" />
                    {t.seeAreaPotential}
                  </a>
                </Button>
              </div>

              {/* Why this business - Personalised pitch */}
              <div className="mt-24">
                <Card className="border-blush bg-gradient-to-r from-blush to-blush/50">
                  <CardContent className="p-6 md:p-8">
                    <div className="grid items-center gap-6 md:grid-cols-3">
                      <div className="md:col-span-2">
                        <h3 className="text-2xl md:text-3xl font-bold text-primary">{translate('whyTitle', { businessName: p.businessName })}</h3>
                        <p className="mt-3 text-lg text-slate-700">
                          {translate('whyDescription', { landmark: p.landmark, city: p.city })}
                        </p>
                        <ul className="mt-4 list-disc space-y-2 pl-5 text-base text-slate-700">
                          <li>{translate('whyBullet1', { currency: p.currency || 'EUR' })}</li>
                          <li>{translate('whyBullet2', { city: p.city })}</li>
                          <li>{translate('whyBullet3', { city: p.city })}</li>
                          <li>{t.whyBullet4}</li>
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
            {t.signageTitle}
            </h2>
            <p className="mt-3 text-lg text-slate-700">
              {translate('signageDescription', { businessName: p.businessName })}
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
              {translate('signageSelected', { count: selectedSigns.length.toString(), plural: selectedSigns.length !== 1 ? 's' : '' })}
            </p>
          ) : (
            <p>{t.signagePrompt}</p>
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
              {translate('caseTitle', { city: p.city })}
            </h2>
            <p className="mt-4 text-slate-700">
              {translate('caseDescription', { city: p.city })}
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-3xl">{p.topViews || '—'}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600">{t.viewsYear}</CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-3xl">{p.topBookings || '—'}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600">
                  {t.bookingsYear}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-3xl">{p.topRevenue || '—'}</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-slate-600">
                  {t.revenueYear}
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
              {t.formTitle}
            </h2>
            <p className="mt-2 text-slate-700">
              {translate('formSubtitle', { city: p.city })}
            </p>
            <form method="POST" action={p.formAction} onSubmit={handleSubmit} className="mt-6 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm">{t.formName}</label>
                  <Input name="name" required placeholder={t.formNamePlaceholder} />
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
                  <label className="text-sm">{t.formEmail}</label>
                  <Input type="email" name="email" required placeholder={t.formEmailPlaceholder} defaultValue={p.ownerEmail} />
                </div>
                <div>
                  <label className="text-sm">{t.formPhone}</label>
                  <Input type="tel" name="phone" placeholder={t.formPhonePlaceholder} defaultValue={p.ownerPhone} />
                </div>
              </div>
              <div>
                <label className="text-sm">{t.formQuestions}</label>
                <Textarea
                  name="notes"
                />
              </div>
              {/* Hidden input for selected signs */}
              <input type="hidden" name="selectedSigns" value={JSON.stringify(selectedSigns)} />
              
              {submitSuccess && (
                <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-green-800 text-sm">
                  {t.formSuccess}
                </div>
              )}
              
              <div className="flex items-center gap-3">
                <Button type="submit" className="" disabled={isSubmitting}>
                  {isSubmitting ? t.formSubmitting : submitSuccess ? t.formSubmitted : t.formSubmit}
                </Button>
                <span className="text-xs text-slate-500">
                  {t.formDisclaimer}
                </span>
              </div>
            </form>
          </div>

          <div className="lg:pl-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t.whatYouGet}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-slate-700">
                <ul className="list-disc space-y-2 pl-5">
                  <li>{t.benefitPriority}</li>
                  <li>{t.benefitAds}</li>
                  <li>{t.benefitSignage}</li>
                  <li>{t.benefitVisibility}</li>
                  <li>{translate('benefitCenterpiece', { city: p.city })}</li>
                  <li>{t.benefitReviews}</li>
                  <li>{t.benefitSupport}</li>
                  <li>{t.benefitInsights}</li>
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
                    <Star className="h-4 w-4" /> {t.whyBecome}
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
              {translate('footerCopyright', { year: new Date().getFullYear().toString() })}
            </div>
            <div className="flex items-center gap-4">
              <a className="inline-flex items-center gap-1 hover:underline" href="#apply">
                <LinkIcon className="h-4 w-4" />
                {t.footerRegister}
              </a>
              <a className="inline-flex items-center gap-1 hover:underline" href="#performance">
                {t.footerBenefits}
              </a>
              <a className="inline-flex items-center gap-1 hover:underline" href="#case">
                {t.footerResults}
              </a>
            </div>
          </div>
        </Section>
      </footer>
    </div>
  )
}


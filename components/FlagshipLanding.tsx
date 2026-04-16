'use client'

import React, { useState, useRef } from 'react'
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
  Check,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import SignagePicker, { SignItem } from '@/components/SignagePicker'
import type { SupportedLandingLocale } from '@/lib/landing-locale'

export type FlagshipProps = {
  businessName: string
  city: string
  landmark?: string
  heroImageUrl?: string
  contact?: { email?: string; phone?: string }
  formAction?: string
  stashpointId?: string
  googleMapsUrl?: string
  locale?: string // 'en', 'fr', 'es', 'de', 'it', 'pt', or 'nl'
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
    expectedPerformance: 'Expected Monthly Performance as a Flagship Stashpoint',
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
    signageDescription: "Choose the signage you'd like for {businessName}. You must select at least 3 items — we can tailor them to your storefront.",
    signageSelected: '{count} item{plural} selected',
    signagePrompt: "Select at least 3 signage items you're interested in",
    signageError: 'Please select at least 3 pieces of signage to submit your interest.',
    formSignageWarning: 'Select at least 3 signage items to submit',
    
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
    signageDescription: "Choisissez la signalétique que vous souhaitez pour {businessName}. Vous devez sélectionner au moins 3 articles — nous pouvons les adapter à votre vitrine.",
    signageSelected: '{count} article{plural} sélectionné{plural}',
    signagePrompt: "Sélectionnez au moins 3 articles de signalétique qui vous intéressent",
    signageError: 'Veuillez sélectionner au moins 3 éléments de signalétique pour envoyer votre demande.',
    formSignageWarning: 'Sélectionnez au moins 3 articles de signalétique pour envoyer',
    
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
  es: {
    // Header
    programTitle: 'Programa Flagship de Stasher',
    invitation: 'Invitación',
    navBenefits: 'Beneficios',
    navBranding: 'Marca',
    navResults: 'Resultados',
    navRegister: 'Registrar interés',
    ctaInterested: 'Estoy interesado',
    
    // Hero
    heroTitle: 'Obtén cientos de nuevas reservas a través de Stasher cada mes.',
    heroSubtitle: 'Conviértete en un Flagship Stashpoint en',
    heroDescription: 'Únete al programa de socios premium de Stasher y convierte a {businessName} en el lugar de referencia para el almacenamiento de equipaje en {city}.',
    
    // Performance
    currentPerformance: 'Rendimiento mensual actual de {businessName}',
    expectedPerformance: 'Rendimiento esperado como Flagship Stashpoint',
    websiteImpressions: 'Impresiones en el sitio web',
    gmapsImpressions: 'Impresiones de Google Maps',
    bookings: 'Reservas',
    revenue: 'Ingresos',
    expectedWebsite: 'Impresiones esperadas en el sitio web',
    expectedGmaps: 'Impresiones esperadas de Google Maps',
    expectedBookings: 'Reservas esperadas',
    expectedRevenue: 'Ingresos esperados',
    
    // How section
    howTitle: '¿Cómo logramos esta mejora?',
    googleAdsTitle: 'Anuncios de Google pagados por Stasher',
    googleAdsDesc: 'Pagaremos campañas de Google Ads enfocadas a viajeros en {city} y los dirigiremos a tu anuncio.',
    brandedKitTitle: 'Kit de tienda de marca proporcionado por Stasher',
    brandedKitDesc: 'Señalización exterior e interior de tu elección, conjuntamente con {businessName} para aumentar la confianza y las visitas.',
    trafficTitle: 'Aumento del tráfico del sitio web',
    trafficDesc: 'Mejoraremos la visibilidad de tu anuncio en nuestro sitio web y blog para aumentar el tráfico y las reservas.',
    centerpieceTitle: 'Conviértete en el punto central de Stasher en {city}',
    centerpieceDesc: 'Las campañas publicitarias en exteriores de Stasher en {city} estarán estratégicamente centradas en {businessName} para atraer más clientes a tu ubicación.',
    
    // CTA buttons
    registerInterest: 'Registra tu interés',
    seeAreaPotential: 'Ver el potencial de tu área',
    
    // Why section
    whyTitle: '¿Por qué {businessName}?',
    whyDescription: 'Tu ubicación cerca de {landmark} te convierte en el candidato ideal para servir a los viajeros que llegan a {city}. Generaremos demanda directamente a tu puerta a través de anuncios de pago en buscadores y ubicación prioritaria.',
    whyBullet1: 'Aumenta tus ingresos mensuales hasta en cientos de {currency}',
    whyBullet2: 'Posicionate como uno de nuestros mejores Stashpoints en {city}',
    whyBullet3: 'Benefíciate de nuestras campañas publicitarias en exteriores y de pago en {city}',
    whyBullet4: 'Conviértete en el destino Stashpoint principal de tu zona',
    
    // Signage
    signageTitle: '¿Qué tipo de señalización puedes obtener como Flagship Stashpoint?',
    signageDescription: 'Elige la señalización que te gustaría para {businessName}. Debes seleccionar al menos 3 artículos — podemos adaptarlos a tu tienda.',
    signageSelected: '{count} artículo{plural} seleccionado{plural}',
    signagePrompt: 'Selecciona al menos 3 artículos de señalización que te interesen',
    signageError: 'Selecciona al menos 3 artículos de señalética para enviar tu solicitud.',
    formSignageWarning: 'Selecciona al menos 3 artículos de señalética para enviar',
    
    // Case study
    caseTitle: '¿Cómo está funcionando el mejor Stashpoint en {city}?',
    caseDescription: 'En {city}, la ubicación principal actual de Stasher ha tenido:',
    viewsYear: 'Vistas este año',
    bookingsYear: 'Reservas este año',
    revenueYear: 'Ingresos este año',
    
    // Form
    formTitle: 'Registra tu interés',
    formSubtitle: '¿Listo para convertirte en el Flagship Stashpoint de {city}? Hablemos.',
    formName: 'Nombre',
    formNamePlaceholder: 'Tu nombre',
    formEmail: 'Email',
    formEmailPlaceholder: 'tu@ejemplo.com',
    formPhone: 'Teléfono',
    formPhonePlaceholder: '+34 912 34 56 78',
    formQuestions: '¿Tienes alguna pregunta?',
    formSubmitting: 'Enviando...',
    formSubmitted: '✓ Enviado',
    formSubmit: 'Enviar interés',
    formDisclaimer: 'Al enviar, aceptas ser contactado sobre el Programa Flagship.',
    formSuccess: '✓ ¡Gracias! Tu interés ha sido enviado. Nos pondremos en contacto en un día hábil.',
    
    // What you'll get
    whatYouGet: 'Lo que obtendrás',
    benefitPriority: 'Anuncio prioritario y destacado en la página de la ciudad',
    benefitAds: 'Inclusión en Google Ads y contenido del blog',
    benefitSignage: 'Kit de señalización conjunta con tu marca (letreros, alfombras, pegatinas de horarios, banderas)',
    benefitVisibility: 'Visibilidad mejorada en nuestro sitio web',
    benefitCenterpiece: 'El punto central de nuestras campañas publicitarias en {city}',
    benefitReviews: 'Aumento de reseñas y visibilidad en Google Maps',
    benefitSupport: 'Soporte dedicado para el éxito de los socios',
    benefitInsights: 'Medición e insights mensuales',
    whyBecome: '¿Por qué convertirse en flagship?',
    
    // Footer
    footerCopyright: '© {year} Stasher • Programa Flagship',
    footerRegister: 'Registrar interés',
    footerBenefits: 'Beneficios',
    footerResults: 'Resultados',
  },
  de: {
    // Header
    programTitle: 'Stasher Flagship-Programm',
    invitation: 'Einladung',
    navBenefits: 'Vorteile',
    navBranding: 'Branding',
    navResults: 'Ergebnisse',
    navRegister: 'Interesse bekunden',
    ctaInterested: 'Ich bin interessiert',

    // Hero
    heroTitle: 'Erhalten Sie jeden Monat Hunderte neuer Stasher-Buchungen.',
    heroSubtitle: 'Werden Sie ein Flagship-Stashpoint in',
    heroDescription: 'Treten Sie dem Premium-Partnerprogramm von Stasher bei und machen Sie {businessName} zur ersten Adresse für Gepäckaufbewahrung in {city}.',

    // Performance
    currentPerformance: 'Aktuelle monatliche Leistung von {businessName}',
    expectedPerformance: 'Erwartete monatliche Leistung als Flagship-Stashpoint',
    websiteImpressions: 'Website-Impressionen',
    gmapsImpressions: 'Google Maps-Impressionen',
    bookings: 'Buchungen',
    revenue: 'Umsatz',
    expectedWebsite: 'Erwartete Website-Impressionen',
    expectedGmaps: 'Erwartete Google Maps-Impressionen',
    expectedBookings: 'Erwartete Buchungen',
    expectedRevenue: 'Erwarteter Umsatz',

    // How section
    howTitle: 'Wie erreichen wir dieses Wachstum?',
    googleAdsTitle: 'Von Stasher bezahlte Google Ads',
    googleAdsDesc: 'Wir schalten Google Ads-Kampagnen für Reisende in {city} und leiten sie zu Ihrem Eintrag.',
    brandedKitTitle: 'Marken-Store-Kit von Stasher',
    brandedKitDesc: 'Außen- und Innenbeschilderung Ihrer Wahl, co-gebrandet mit {businessName}, um Vertrauen und Laufkundschaft zu stärken.',
    trafficTitle: 'Mehr Website-Traffic',
    trafficDesc: 'Wir verbessern die Sichtbarkeit Ihres Eintrags auf unserer Website und im Blog, um Traffic und Buchungen zu steigern.',
    centerpieceTitle: 'Werden Sie das Herzstück von Stasher in {city}',
    centerpieceDesc: 'Die Out-of-Home-Kampagnen von Stasher in {city} werden strategisch auf {businessName} ausgerichtet, um mehr Kunden zu Ihrem Standort zu bringen.',

    // CTA buttons
    registerInterest: 'Interesse bekunden',
    seeAreaPotential: 'Potenzial Ihrer Region ansehen',

    // Why section
    whyTitle: 'Warum {businessName}?',
    whyDescription: 'Ihre Lage in der Nähe von {landmark} macht Sie zum idealen Flagship-Kandidaten für Reisende in {city}. Wir bringen die Nachfrage direkt zu Ihrer Tür – über bezahlte Suche und bevorzugte Platzierung.',
    whyBullet1: 'Steigern Sie Ihren Monatsumsatz um Hunderte von {currency}',
    whyBullet2: 'Gehören Sie zu den Top-Stashpoints in {city}',
    whyBullet3: 'Profitieren Sie von unseren Out-of-Home- und Paid-Kampagnen in {city}',
    whyBullet4: 'Werden Sie das wichtigste Stashpoint-Ziel in Ihrer Region',

    // Signage
    signageTitle: 'Welche Beschilderung erhält ein Flagship-Stashpoint?',
    signageDescription: 'Wählen Sie die Beschilderung für {businessName}. Sie müssen mindestens 3 Artikel auswählen – wir passen sie Ihrem Schaufenster an.',
    signageSelected: '{count} Artikel ausgewählt',
    signagePrompt: 'Wählen Sie mindestens 3 Beschilderungsartikel aus, die Sie interessieren',
    signageError: 'Bitte wählen Sie mindestens 3 Beschilderungsartikel, um Ihre Anfrage zu senden.',
    formSignageWarning: 'Wählen Sie mindestens 3 Beschilderungsartikel zum Absenden',

    // Case study
    caseTitle: 'Wie schneidet der beste Stashpoint in {city} ab?',
    caseDescription: 'In {city} hatte der aktuelle Top-Standort von Stasher:',
    viewsYear: 'Aufrufe dieses Jahr',
    bookingsYear: 'Buchungen dieses Jahr',
    revenueYear: 'Umsatz dieses Jahr',

    // Form
    formTitle: 'Interesse bekunden',
    formSubtitle: 'Bereit, der Flagship-Stashpoint in {city} zu werden? Lassen Sie uns reden.',
    formName: 'Name',
    formNamePlaceholder: 'Ihr Name',
    formEmail: 'E-Mail',
    formEmailPlaceholder: 'sie@beispiel.de',
    formPhone: 'Telefon',
    formPhonePlaceholder: '+49 30 12345678',
    formQuestions: 'Haben Sie Fragen?',
    formSubmitting: 'Wird gesendet...',
    formSubmitted: '✓ Gesendet',
    formSubmit: 'Interesse absenden',
    formDisclaimer: 'Mit dem Absenden stimmen Sie zu, zum Flagship-Programm kontaktiert zu werden.',
    formSuccess: '✓ Danke! Ihr Interesse wurde übermittelt. Wir melden uns innerhalb eines Werktags.',

    // What you'll get
    whatYouGet: 'Das erhalten Sie',
    benefitPriority: 'Bevorzugte Platzierung und Stadt-Seiten-Feature',
    benefitAds: 'Teil von Google Ads und Blog-Inhalten',
    benefitSignage: 'Co-gebrandetes Beschilderungs-Kit (Schilder, Bodenmatten, Öffnungszeit-Aufkleber, Flaggen)',
    benefitVisibility: 'Verbesserte Sichtbarkeit auf unserer Website',
    benefitCenterpiece: 'Herzstück unserer Out-of-Home-Kampagnen in {city}',
    benefitReviews: 'Mehr Google Maps-Bewertungen und Sichtbarkeit',
    benefitSupport: 'Dedizierter Partner-Success-Support',
    benefitInsights: 'Messung und monatliche Insights',
    whyBecome: 'Warum Flagship werden?',

    // Footer
    footerCopyright: '© {year} Stasher • Flagship-Programm',
    footerRegister: 'Interesse bekunden',
    footerBenefits: 'Vorteile',
    footerResults: 'Ergebnisse',
  },
  it: {
    // Header
    programTitle: 'Programma Flagship Stasher',
    invitation: 'Invito',
    navBenefits: 'Vantaggi',
    navBranding: 'Branding',
    navResults: 'Risultati',
    navRegister: 'Manifesta interesse',
    ctaInterested: 'Sono interessato',

    // Hero
    heroTitle: 'Ottieni centinaia di nuove prenotazioni Stasher ogni mese.',
    heroSubtitle: 'Diventa uno Stashpoint Flagship a',
    heroDescription: 'Unisciti al programma partner premium di Stasher e trasforma {businessName} nel punto di riferimento per il deposito bagagli a {city}.',

    // Performance
    currentPerformance: 'Performance mensile attuale di {businessName}',
    expectedPerformance: 'Performance mensile attesa come Stashpoint Flagship',
    websiteImpressions: 'Impressioni sul sito web',
    gmapsImpressions: 'Impressioni su Google Maps',
    bookings: 'Prenotazioni',
    revenue: 'Ricavi',
    expectedWebsite: 'Impressioni sul sito web attese',
    expectedGmaps: 'Impressioni su Google Maps attese',
    expectedBookings: 'Prenotazioni attese',
    expectedRevenue: 'Ricavi attesi',

    // How section
    howTitle: 'Come otteniamo questa crescita?',
    googleAdsTitle: 'Google Ads pagati da Stasher',
    googleAdsDesc: 'Pagheremo campagne Google Ads rivolte ai viaggiatori di {city}, indirizzandoli al tuo annuncio.',
    brandedKitTitle: 'Kit store brandizzato fornito da Stasher',
    brandedKitDesc: 'Segnaletica interna ed esterna a tua scelta, co-brandizzata con {businessName} per aumentare fiducia e affluenza.',
    trafficTitle: 'Più traffico sul sito web',
    trafficDesc: 'Miglioreremo la visibilità del tuo annuncio sul nostro sito e blog per aumentare traffico e prenotazioni.',
    centerpieceTitle: 'Diventa il fulcro di Stasher a {city}',
    centerpieceDesc: 'Le campagne pubblicitarie out-of-home di Stasher a {city} saranno strategicamente incentrate su {businessName} per portare più clienti nel tuo locale.',

    // CTA buttons
    registerInterest: 'Manifesta il tuo interesse',
    seeAreaPotential: 'Vedi il potenziale della tua zona',

    // Why section
    whyTitle: 'Perché {businessName}?',
    whyDescription: 'La tua posizione vicino a {landmark} ti rende il candidato flagship ideale per i viaggiatori che arrivano a {city}. Porteremo domanda direttamente alla tua porta tramite ricerca a pagamento e posizionamento prioritario.',
    whyBullet1: 'Aumenta i tuoi ricavi mensili di centinaia di {currency}',
    whyBullet2: 'Posizionati tra i nostri migliori Stashpoint a {city}',
    whyBullet3: 'Approfitta delle nostre campagne out-of-home e a pagamento a {city}',
    whyBullet4: 'Diventa la principale destinazione Stashpoint della tua area',

    // Signage
    signageTitle: 'Che tipo di segnaletica può ottenere uno Stashpoint Flagship?',
    signageDescription: 'Scegli la segnaletica che preferisci per {businessName}. Devi selezionare almeno 3 articoli — possiamo adattarli al tuo locale.',
    signageSelected: '{count} articoli selezionati',
    signagePrompt: 'Seleziona almeno 3 articoli di segnaletica che ti interessano',
    signageError: 'Seleziona almeno 3 articoli di segnaletica per inviare la tua richiesta.',
    formSignageWarning: 'Seleziona almeno 3 articoli di segnaletica per inviare',

    // Case study
    caseTitle: 'Come sta andando il migliore Stashpoint a {city}?',
    caseDescription: 'A {city}, la location principale attuale di Stasher ha avuto:',
    viewsYear: 'Visualizzazioni quest\u2019anno',
    bookingsYear: 'Prenotazioni quest\u2019anno',
    revenueYear: 'Ricavi quest\u2019anno',

    // Form
    formTitle: 'Manifesta il tuo interesse',
    formSubtitle: 'Pronto a diventare lo Stashpoint Flagship di {city}? Parliamone.',
    formName: 'Nome',
    formNamePlaceholder: 'Il tuo nome',
    formEmail: 'Email',
    formEmailPlaceholder: 'tu@esempio.it',
    formPhone: 'Telefono',
    formPhonePlaceholder: '+39 02 1234 5678',
    formQuestions: 'Hai qualche domanda?',
    formSubmitting: 'Invio in corso...',
    formSubmitted: '✓ Inviato',
    formSubmit: 'Invia interesse',
    formDisclaimer: 'Inviando, accetti di essere contattato per il Programma Flagship.',
    formSuccess: '✓ Grazie! Il tuo interesse è stato inviato. Ti contatteremo entro un giorno lavorativo.',

    // What you'll get
    whatYouGet: 'Cosa otterrai',
    benefitPriority: 'Annuncio prioritario e in evidenza nella pagina della città',
    benefitAds: 'Inclusione in Google Ads e contenuti del blog',
    benefitSignage: 'Kit di segnaletica co-brandizzato (insegne, tappeti, adesivi orari, bandiere)',
    benefitVisibility: 'Maggiore visibilità sul nostro sito',
    benefitCenterpiece: 'Il fulcro delle nostre campagne pubblicitarie a {city}',
    benefitReviews: 'Aumento di recensioni e visibilità su Google Maps',
    benefitSupport: 'Supporto dedicato al successo del partner',
    benefitInsights: 'Misurazioni e insight mensili',
    whyBecome: 'Perché diventare flagship?',

    // Footer
    footerCopyright: '© {year} Stasher • Programma Flagship',
    footerRegister: 'Manifesta interesse',
    footerBenefits: 'Vantaggi',
    footerResults: 'Risultati',
  },
  pt: {
    // Header
    programTitle: 'Programa Flagship Stasher',
    invitation: 'Convite',
    navBenefits: 'Benefícios',
    navBranding: 'Marca',
    navResults: 'Resultados',
    navRegister: 'Registar interesse',
    ctaInterested: 'Tenho interesse',

    // Hero
    heroTitle: 'Receba centenas de novas reservas Stasher todos os meses.',
    heroSubtitle: 'Torne-se um Stashpoint Flagship em',
    heroDescription: 'Junte-se ao programa parceiro premium da Stasher e faça de {businessName} o local de referência para depósito de bagagens em {city}.',

    // Performance
    currentPerformance: 'Desempenho mensal atual de {businessName}',
    expectedPerformance: 'Desempenho mensal esperado como Stashpoint Flagship',
    websiteImpressions: 'Impressões no site',
    gmapsImpressions: 'Impressões no Google Maps',
    bookings: 'Reservas',
    revenue: 'Receita',
    expectedWebsite: 'Impressões esperadas no site',
    expectedGmaps: 'Impressões esperadas no Google Maps',
    expectedBookings: 'Reservas esperadas',
    expectedRevenue: 'Receita esperada',

    // How section
    howTitle: 'Como alcançamos este crescimento?',
    googleAdsTitle: 'Google Ads pagos pela Stasher',
    googleAdsDesc: 'Vamos pagar campanhas de Google Ads para viajantes em {city} e direcioná-los ao seu anúncio.',
    brandedKitTitle: 'Kit de loja com marca fornecido pela Stasher',
    brandedKitDesc: 'Sinalização exterior e interior à sua escolha, co-marcada com {businessName} para aumentar a confiança e as visitas.',
    trafficTitle: 'Mais tráfego no site',
    trafficDesc: 'Vamos melhorar a visibilidade do seu anúncio no nosso site e blog para aumentar tráfego e reservas.',
    centerpieceTitle: 'Torne-se o centro da Stasher em {city}',
    centerpieceDesc: 'As campanhas de publicidade out-of-home da Stasher em {city} serão estrategicamente centradas em {businessName} para atrair mais clientes à sua localização.',

    // CTA buttons
    registerInterest: 'Registe o seu interesse',
    seeAreaPotential: 'Ver o potencial da sua zona',

    // Why section
    whyTitle: 'Porquê {businessName}?',
    whyDescription: 'A sua localização perto de {landmark} torna-o o candidato flagship ideal para os viajantes que chegam a {city}. Vamos levar procura diretamente à sua porta através de pesquisa paga e colocação prioritária.',
    whyBullet1: 'Aumente a sua receita mensal em centenas de {currency}',
    whyBullet2: 'Classifique-se entre os melhores Stashpoints em {city}',
    whyBullet3: 'Beneficie das nossas campanhas out-of-home e pagas em {city}',
    whyBullet4: 'Torne-se o principal destino Stashpoint da sua área',

    // Signage
    signageTitle: 'Que tipo de sinalização pode obter um Stashpoint Flagship?',
    signageDescription: 'Escolha a sinalização que pretende para {businessName}. Deve selecionar pelo menos 3 itens — podemos adaptá-la à sua loja.',
    signageSelected: '{count} itens selecionados',
    signagePrompt: 'Selecione pelo menos 3 itens de sinalização do seu interesse',
    signageError: 'Selecione pelo menos 3 itens de sinalização para enviar o seu pedido.',
    formSignageWarning: 'Selecione pelo menos 3 itens de sinalização para enviar',

    // Case study
    caseTitle: 'Como está a correr o melhor Stashpoint em {city}?',
    caseDescription: 'Em {city}, a principal localização atual da Stasher teve:',
    viewsYear: 'Visualizações este ano',
    bookingsYear: 'Reservas este ano',
    revenueYear: 'Receita este ano',

    // Form
    formTitle: 'Registe o seu interesse',
    formSubtitle: 'Pronto para se tornar o Stashpoint Flagship de {city}? Vamos conversar.',
    formName: 'Nome',
    formNamePlaceholder: 'O seu nome',
    formEmail: 'Email',
    formEmailPlaceholder: 'voce@exemplo.com',
    formPhone: 'Telefone',
    formPhonePlaceholder: '+351 21 123 45 67',
    formQuestions: 'Tem alguma questão?',
    formSubmitting: 'A enviar...',
    formSubmitted: '✓ Enviado',
    formSubmit: 'Enviar interesse',
    formDisclaimer: 'Ao enviar, aceita ser contactado sobre o Programa Flagship.',
    formSuccess: '✓ Obrigado! O seu interesse foi submetido. Entraremos em contacto dentro de um dia útil.',

    // What you'll get
    whatYouGet: 'O que irá receber',
    benefitPriority: 'Anúncio prioritário e destaque na página da cidade',
    benefitAds: 'Inclusão em Google Ads e conteúdos do blog',
    benefitSignage: 'Kit de sinalização co-marcado (placas, tapetes, autocolantes de horário, bandeiras)',
    benefitVisibility: 'Maior visibilidade no nosso site',
    benefitCenterpiece: 'O centro das nossas campanhas publicitárias em {city}',
    benefitReviews: 'Mais avaliações e visibilidade no Google Maps',
    benefitSupport: 'Suporte dedicado ao sucesso do parceiro',
    benefitInsights: 'Medição e insights mensais',
    whyBecome: 'Porquê tornar-se flagship?',

    // Footer
    footerCopyright: '© {year} Stasher • Programa Flagship',
    footerRegister: 'Registar interesse',
    footerBenefits: 'Benefícios',
    footerResults: 'Resultados',
  },
  nl: {
    // Header
    programTitle: 'Stasher Flagship-programma',
    invitation: 'Uitnodiging',
    navBenefits: 'Voordelen',
    navBranding: 'Branding',
    navResults: 'Resultaten',
    navRegister: 'Interesse aangeven',
    ctaInterested: 'Ik ben geïnteresseerd',

    // Hero
    heroTitle: 'Ontvang elke maand honderden nieuwe Stasher-boekingen.',
    heroSubtitle: 'Word een Flagship-Stashpoint in',
    heroDescription: 'Sluit je aan bij het premium partnerprogramma van Stasher en maak {businessName} hét adres voor bagageopslag in {city}.',

    // Performance
    currentPerformance: 'Huidige maandprestaties van {businessName}',
    expectedPerformance: 'Verwachte maandprestaties als Flagship-Stashpoint',
    websiteImpressions: 'Website-impressies',
    gmapsImpressions: 'Google Maps-impressies',
    bookings: 'Boekingen',
    revenue: 'Omzet',
    expectedWebsite: 'Verwachte website-impressies',
    expectedGmaps: 'Verwachte Google Maps-impressies',
    expectedBookings: 'Verwachte boekingen',
    expectedRevenue: 'Verwachte omzet',

    // How section
    howTitle: 'Hoe bereiken we deze groei?',
    googleAdsTitle: 'Google Ads betaald door Stasher',
    googleAdsDesc: 'Wij betalen Google Ads-campagnes gericht op reizigers in {city} en sturen ze naar jouw vermelding.',
    brandedKitTitle: 'Merkpakket voor je winkel van Stasher',
    brandedKitDesc: 'Buiten- en binnenbewegwijzering naar keuze, co-branded met {businessName} om vertrouwen en aanloop te verhogen.',
    trafficTitle: 'Meer websiteverkeer',
    trafficDesc: 'We verbeteren de zichtbaarheid van je vermelding op onze website en blog om verkeer en boekingen te verhogen.',
    centerpieceTitle: 'Word het middelpunt van Stasher in {city}',
    centerpieceDesc: 'De out-of-home-campagnes van Stasher in {city} draaien strategisch om {businessName} om meer klanten naar je locatie te brengen.',

    // CTA buttons
    registerInterest: 'Geef je interesse aan',
    seeAreaPotential: 'Bekijk het potentieel van je gebied',

    // Why section
    whyTitle: 'Waarom {businessName}?',
    whyDescription: 'Je locatie nabij {landmark} maakt je de ideale flagship-kandidaat voor reizigers die in {city} aankomen. We brengen vraag rechtstreeks naar je deur via betaalde zoekresultaten en prioriteitsplaatsing.',
    whyBullet1: 'Verhoog je maandomzet met honderden {currency}',
    whyBullet2: 'Hoor bij onze top-Stashpoints in {city}',
    whyBullet3: 'Profiteer van onze out-of-home- en betaalde campagnes in {city}',
    whyBullet4: 'Word de belangrijkste Stashpoint-bestemming in je omgeving',

    // Signage
    signageTitle: 'Welke bewegwijzering krijgt een Flagship-Stashpoint?',
    signageDescription: 'Kies de bewegwijzering voor {businessName}. Je moet minstens 3 items selecteren — we passen ze aan je winkel aan.',
    signageSelected: '{count} items geselecteerd',
    signagePrompt: 'Selecteer minstens 3 bewegwijzeringsitems die je interesseren',
    signageError: 'Selecteer minstens 3 bewegwijzeringsitems om je aanvraag te verzenden.',
    formSignageWarning: 'Selecteer minstens 3 bewegwijzeringsitems om te verzenden',

    // Case study
    caseTitle: 'Hoe presteert de beste Stashpoint in {city}?',
    caseDescription: 'In {city} heeft de huidige topvestiging van Stasher het volgende bereikt:',
    viewsYear: 'Weergaven dit jaar',
    bookingsYear: 'Boekingen dit jaar',
    revenueYear: 'Omzet dit jaar',

    // Form
    formTitle: 'Geef je interesse aan',
    formSubtitle: 'Klaar om de Flagship-Stashpoint van {city} te worden? Laten we praten.',
    formName: 'Naam',
    formNamePlaceholder: 'Je naam',
    formEmail: 'E-mail',
    formEmailPlaceholder: 'jij@voorbeeld.nl',
    formPhone: 'Telefoon',
    formPhonePlaceholder: '+31 20 123 4567',
    formQuestions: 'Heb je vragen?',
    formSubmitting: 'Bezig met verzenden...',
    formSubmitted: '✓ Verzonden',
    formSubmit: 'Interesse versturen',
    formDisclaimer: 'Door te verzenden ga je akkoord om gecontacteerd te worden over het Flagship-programma.',
    formSuccess: '✓ Bedankt! Je interesse is ingediend. We nemen binnen één werkdag contact op.',

    // What you'll get
    whatYouGet: 'Wat je krijgt',
    benefitPriority: 'Prioriteitsvermelding en uitlichting op de stadspagina',
    benefitAds: 'Opname in Google Ads en bloginhoud',
    benefitSignage: 'Co-branded bewegwijzeringspakket (borden, vloermatten, openingsstickers, vlaggen)',
    benefitVisibility: 'Verbeterde zichtbaarheid op onze website',
    benefitCenterpiece: 'Het middelpunt van onze reclamecampagnes in {city}',
    benefitReviews: 'Meer Google Maps-reviews en zichtbaarheid',
    benefitSupport: 'Toegewijde partner-successupport',
    benefitInsights: 'Meting en maandelijkse inzichten',
    whyBecome: 'Waarom flagship worden?',

    // Footer
    footerCopyright: '© {year} Stasher • Flagship-programma',
    footerRegister: 'Interesse aangeven',
    footerBenefits: 'Voordelen',
    footerResults: 'Resultaten',
  },
}

const localeBundles: Record<SupportedLandingLocale, typeof translations.en> = {
  en: translations.en,
  fr: translations.fr,
  es: translations.es,
  de: translations.de,
  it: translations.it,
  pt: translations.pt,
  nl: translations.nl,
}

export default function FlagshipStashpointLanding(props: FlagshipProps) {
  const [selectedSigns, setSelectedSigns] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSignageError, setShowSignageError] = useState(false)
  const signageRef = useRef<HTMLDivElement>(null)

  // Get translations based on locale (default to 'en')
  const locale = (props.locale || 'en') as SupportedLandingLocale
  const t = localeBundles[locale] || translations.en
  
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
    if (selectedSigns.length < 3) {
      e.preventDefault()
      setShowSignageError(true)
      signageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

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
        const params = new URLSearchParams({
          source: 'flagship',
          business: p.businessName || '',
          city: p.city || '',
          locale,
        })
        window.location.href = `/thank-you?${params.toString()}`
        return
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
      <div ref={signageRef}>
        <Section id="branding">
          <div className="text-center mb-8">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              {t.signageTitle}
              </h2>
              <p className="mt-3 text-lg text-slate-700">
                {translate('signageDescription', { businessName: p.businessName })}
              </p>
              {showSignageError && selectedSigns.length < 3 && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {t.signageError}
                </p>
              )}
            </div>
          <SignagePicker
            items={signageItems}
            storageKey={`flagship-signs-${p.businessName.toLowerCase().replace(/\s+/g, '-')}`}
            onChange={(ids) => {
              setSelectedSigns(ids)
              if (ids.length >= 3) setShowSignageError(false)
            }}
          />
          <div className="mt-6 text-center">
            {selectedSigns.length > 0 ? (
              <p className={`text-sm font-medium ${selectedSigns.length >= 3 ? 'text-green-600' : 'text-amber-600'}`}>
                {translate('signageSelected', { count: selectedSigns.length.toString(), plural: selectedSigns.length !== 1 ? 's' : '' })}
                {selectedSigns.length >= 3 && <Check className="ml-1 inline h-4 w-4" />}
              </p>
            ) : (
              <p className="text-sm text-slate-600">{t.signagePrompt}</p>
            )}
          </div>
        </Section>
      </div>

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
              <input type="hidden" name="source" value="flagship" />
              <input type="hidden" name="stashpointId" value={props.stashpointId || ''} />
              <input type="hidden" name="selectedSigns" value={JSON.stringify(selectedSigns)} />
              
              
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" className="" disabled={isSubmitting || selectedSigns.length < 3}>
                  {isSubmitting ? t.formSubmitting : t.formSubmit}
                </Button>
                {selectedSigns.length < 3 && (
                  <span className="text-xs text-amber-600">
                    {t.formSignageWarning}
                  </span>
                )}
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


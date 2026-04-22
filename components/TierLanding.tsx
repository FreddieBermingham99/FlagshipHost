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
import { cn } from '@/lib/utils'
import SignagePicker, { SignItem } from '@/components/SignagePicker'
import {
  normalizeLandingLocale,
  type SupportedLandingLocale,
} from '@/lib/landing-locale'
import type { ProgrammeStashpointSummary } from '@/lib/programme-tier-types'

export type { ProgrammeStashpointSummary } from '@/lib/programme-tier-types'

export type TierLandingProps = {
  businessName: string
  city: string
  landmark?: string
  contact?: { email?: string; phone?: string }
  formAction?: string
  stashpointId?: string
  /** Stasher host id — server expands one programme submit into one row per active stashpoint. */
  hostId?: string
  /** `hosts.common_name` — default value for the contact name field. */
  hostDisplayName?: string
  /** When provided, business names render as pills (from DB); submit still uses server-side expansion by `hostId`. */
  programmeStashpoints?: ProgrammeStashpointSummary[]
  locale?: SupportedLandingLocale | string
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
  { icon: Clock, key: 'reqHours' as const },
  { icon: Package, key: 'reqCapacity' as const },
  { icon: Luggage, key: 'reqBagSizes' as const },
  { icon: Eye, key: 'reqSignage' as const },
  { icon: Star, key: 'reqReviews' as const },
]

const proExtras = [
  { icon: Shield, key: 'proExtraExclusivity' as const },
  { icon: Sparkles, key: 'proExtraSignage' as const },
]

const tierTranslations = {
  en: {
    headerTitle: 'Stasher Partner Programme',
    navPlans: 'Plans',
    navRegister: 'Register',
    headerCta: 'Get Started',
    heroTitle: 'Choose your partner plan',
    heroDescription: "Earn more with Stasher. Select the programme that's right for {businessName} and start growing your luggage storage revenue.",
    heroCta: 'See plans',
    badgeSelected: 'Selected',
    badgeRecommended: 'Recommended',
    tierStandardTag: 'Standard',
    tierStandardTitle: 'Extra Commission',
    tierStandardDesc: 'Meet our quality standards and earn a higher commission rate on every booking.',
    requirementsLabel: 'Requirements',
    reqHours: 'Minimum opening hours',
    reqCapacity: 'Minimum capacity',
    reqBagSizes: 'Accept all bag sizes',
    reqSignage: 'Countertop signs and window signs clearly visible',
    reqReviews: 'Collect 5 Google Maps reviews per month',
    selectStandard: 'Select Standard',
    tierProTag: 'Pro',
    tierProTitle: 'Extra Commission + Extra Demand',
    tierProDesc: 'Everything in Standard, plus we actively drive new customers to {businessName}.',
    allStandardPlus: 'All Standard requirements, plus',
    proExtraExclusivity: 'Exclusivity with Stasher',
    proExtraSignage: 'Extra signage of your choice',
    howWeDrive: 'How we drive demand',
    driveAds: 'Google Ads boost paid for by Stasher',
    driveKit: 'Branded store kit provided by Stasher',
    driveTraffic: 'Increased website traffic to your listing',
    driveCentrepiece: "Become Stasher's {city} centrepiece",
    selectPro: 'Select Pro',
    signageTitle: 'Choose your signage',
    signageDescription: "Select the signage you'd like for {businessName}. You must choose at least 3 items.",
    signageError: 'Please select at least 3 pieces of signage to continue with the Pro plan.',
    signageCount: '{count} of 3 minimum selected',
    signagePrompt: "Select the signage items you're interested in",
    signageContinue: 'Continue to register',
    formTitle: 'Register your interest',
    formSelectedStandard: "You've selected the Standard plan.",
    formSelectedPro: "You've selected the Pro plan. {count} signage items chosen.",
    formName: 'Name',
    formNamePlaceholder: 'Your name',
    formRole: 'Role',
    formRolePlaceholder: 'Owner / Manager',
    formBusiness: 'Business name',
    formCityMultiHint:
      'City and country are taken from each listing when you submit — edit them in your Stasher dashboard if needed.',
    formCity: 'City',
    formEmail: 'Email',
    formEmailPlaceholder: 'you@example.com',
    formPhone: 'Phone',
    formPhonePlaceholder: '+44 20 1234 5678',
    formQuestions: 'Any questions?',
    formSubmitting: 'Submitting...',
    formSubmit: 'Submit interest',
    formSignageWarning: 'Select at least 3 signage items to submit',
    formDisclaimer: 'By submitting, you agree to be contacted about the Stasher Partner Programme.',
    footerCopyright: '\u00a9 {year} Stasher \u2022 Partner Programme',
  },
  fr: {
    headerTitle: 'Programme Partenaire Stasher',
    navPlans: 'Formules',
    navRegister: 'S\u2019inscrire',
    headerCta: 'Commencer',
    heroTitle: 'Choisissez votre formule partenaire',
    heroDescription: "Gagnez plus avec Stasher. S\u00e9lectionnez le programme qui convient \u00e0 {businessName} et augmentez vos revenus de consigne \u00e0 bagages.",
    heroCta: 'Voir les formules',
    badgeSelected: 'S\u00e9lectionn\u00e9',
    badgeRecommended: 'Recommand\u00e9',
    tierStandardTag: 'Standard',
    tierStandardTitle: 'Commission suppl\u00e9mentaire',
    tierStandardDesc: 'Respectez nos standards de qualit\u00e9 et gagnez un taux de commission plus \u00e9lev\u00e9 sur chaque r\u00e9servation.',
    requirementsLabel: 'Exigences',
    reqHours: 'Horaires d\u2019ouverture minimum',
    reqCapacity: 'Capacit\u00e9 minimum',
    reqBagSizes: 'Accepter toutes les tailles de bagages',
    reqSignage: 'Signal\u00e9tique en comptoir et en vitrine bien visible',
    reqReviews: 'Collecter 5 avis Google Maps par mois',
    selectStandard: 'Choisir Standard',
    tierProTag: 'Pro',
    tierProTitle: 'Commission suppl\u00e9mentaire + demande accrue',
    tierProDesc: 'Tout ce qui est inclus dans Standard, plus nous g\u00e9n\u00e9rons activement de nouveaux clients pour {businessName}.',
    allStandardPlus: 'Toutes les exigences Standard, plus',
    proExtraExclusivity: 'Exclusivit\u00e9 avec Stasher',
    proExtraSignage: 'Signal\u00e9tique suppl\u00e9mentaire de votre choix',
    howWeDrive: 'Comment nous g\u00e9n\u00e9rons la demande',
    driveAds: 'Boost Google Ads pay\u00e9 par Stasher',
    driveKit: 'Kit de magasin de marque fourni par Stasher',
    driveTraffic: 'Trafic accru vers votre annonce',
    driveCentrepiece: 'Devenez la pi\u00e8ce ma\u00eetresse de Stasher \u00e0 {city}',
    selectPro: 'Choisir Pro',
    signageTitle: 'Choisissez votre signal\u00e9tique',
    signageDescription: "S\u00e9lectionnez la signal\u00e9tique souhait\u00e9e pour {businessName}. Vous devez choisir au moins 3 articles.",
    signageError: 'Veuillez s\u00e9lectionner au moins 3 \u00e9l\u00e9ments de signal\u00e9tique pour continuer avec la formule Pro.',
    signageCount: '{count} sur 3 minimum s\u00e9lectionn\u00e9s',
    signagePrompt: 'S\u00e9lectionnez les \u00e9l\u00e9ments de signal\u00e9tique qui vous int\u00e9ressent',
    signageContinue: 'Continuer vers l\u2019inscription',
    formTitle: 'Manifester votre int\u00e9r\u00eat',
    formSelectedStandard: 'Vous avez choisi la formule Standard.',
    formSelectedPro: 'Vous avez choisi la formule Pro. {count} \u00e9l\u00e9ments de signal\u00e9tique s\u00e9lectionn\u00e9s.',
    formName: 'Nom',
    formNamePlaceholder: 'Votre nom',
    formRole: 'R\u00f4le',
    formRolePlaceholder: 'Propri\u00e9taire / Manager',
    formBusiness: 'Nom de l\u2019entreprise',
    formCityMultiHint:
      'La ville et le pays proviennent de chaque annonce lors de l\u2019envoi \u2014 modifiez-les dans votre tableau de bord Stasher si besoin.',
    formCity: 'Ville',
    formEmail: 'Email',
    formEmailPlaceholder: 'vous@exemple.com',
    formPhone: 'T\u00e9l\u00e9phone',
    formPhonePlaceholder: '+33 1 23 45 67 89',
    formQuestions: 'Des questions ?',
    formSubmitting: 'Envoi en cours...',
    formSubmit: 'Soumettre mon int\u00e9r\u00eat',
    formSignageWarning: 'S\u00e9lectionnez au moins 3 \u00e9l\u00e9ments de signal\u00e9tique pour soumettre',
    formDisclaimer: 'En soumettant, vous acceptez d\u2019\u00eatre contact\u00e9 concernant le Programme Partenaire Stasher.',
    footerCopyright: '\u00a9 {year} Stasher \u2022 Programme Partenaire',
  },
  es: {
    headerTitle: 'Programa de Socios Stasher',
    navPlans: 'Planes',
    navRegister: 'Registrarse',
    headerCta: 'Comenzar',
    heroTitle: 'Elige tu plan de socio',
    heroDescription: 'Gana m\u00e1s con Stasher. Selecciona el programa adecuado para {businessName} y empieza a aumentar tus ingresos por dep\u00f3sito de equipaje.',
    heroCta: 'Ver planes',
    badgeSelected: 'Seleccionado',
    badgeRecommended: 'Recomendado',
    tierStandardTag: 'Standard',
    tierStandardTitle: 'Comisi\u00f3n extra',
    tierStandardDesc: 'Cumple con nuestros est\u00e1ndares de calidad y gana una comisi\u00f3n m\u00e1s alta en cada reserva.',
    requirementsLabel: 'Requisitos',
    reqHours: 'Horario m\u00ednimo de apertura',
    reqCapacity: 'Capacidad m\u00ednima',
    reqBagSizes: 'Aceptar todos los tama\u00f1os de maletas',
    reqSignage: 'Se\u00f1al\u00e9tica de mostrador y escaparate claramente visible',
    reqReviews: 'Conseguir 5 rese\u00f1as de Google Maps al mes',
    selectStandard: 'Elegir Standard',
    tierProTag: 'Pro',
    tierProTitle: 'Comisi\u00f3n extra + demanda extra',
    tierProDesc: 'Todo lo del plan Standard, adem\u00e1s llevamos activamente nuevos clientes a {businessName}.',
    allStandardPlus: 'Todos los requisitos Standard, m\u00e1s',
    proExtraExclusivity: 'Exclusividad con Stasher',
    proExtraSignage: 'Se\u00f1al\u00e9tica extra de tu elecci\u00f3n',
    howWeDrive: 'C\u00f3mo generamos demanda',
    driveAds: 'Impulso de Google Ads pagado por Stasher',
    driveKit: 'Kit de tienda de marca proporcionado por Stasher',
    driveTraffic: 'Mayor tr\u00e1fico a tu anuncio',
    driveCentrepiece: 'Convi\u00e9rtete en el punto central de Stasher en {city}',
    selectPro: 'Elegir Pro',
    signageTitle: 'Elige tu se\u00f1al\u00e9tica',
    signageDescription: 'Selecciona la se\u00f1al\u00e9tica que prefieres para {businessName}. Debes elegir al menos 3 art\u00edculos.',
    signageError: 'Selecciona al menos 3 art\u00edculos de se\u00f1al\u00e9tica para continuar con el plan Pro.',
    signageCount: '{count} de 3 m\u00ednimo seleccionados',
    signagePrompt: 'Selecciona los art\u00edculos de se\u00f1al\u00e9tica que te interesan',
    signageContinue: 'Continuar con el registro',
    formTitle: 'Registra tu inter\u00e9s',
    formSelectedStandard: 'Has seleccionado el plan Standard.',
    formSelectedPro: 'Has seleccionado el plan Pro. {count} art\u00edculos de se\u00f1al\u00e9tica elegidos.',
    formName: 'Nombre',
    formNamePlaceholder: 'Tu nombre',
    formRole: 'Rol',
    formRolePlaceholder: 'Due\u00f1o / Gerente',
    formBusiness: 'Nombre del negocio',
    formCityMultiHint:
      'La ciudad y el pa\u00eds se toman de cada anuncio al enviar; ed\u00edtalos en tu panel de Stasher si hace falta.',
    formCity: 'Ciudad',
    formEmail: 'Email',
    formEmailPlaceholder: 'tu@ejemplo.com',
    formPhone: 'Tel\u00e9fono',
    formPhonePlaceholder: '+34 912 34 56 78',
    formQuestions: '\u00bfAlguna pregunta?',
    formSubmitting: 'Enviando...',
    formSubmit: 'Enviar inter\u00e9s',
    formSignageWarning: 'Selecciona al menos 3 art\u00edculos de se\u00f1al\u00e9tica para enviar',
    formDisclaimer: 'Al enviar, aceptas ser contactado sobre el Programa de Socios Stasher.',
    footerCopyright: '\u00a9 {year} Stasher \u2022 Programa de Socios',
  },
  de: {
    headerTitle: 'Stasher Partnerprogramm',
    navPlans: 'Pl\u00e4ne',
    navRegister: 'Registrieren',
    headerCta: 'Loslegen',
    heroTitle: 'W\u00e4hlen Sie Ihren Partnerplan',
    heroDescription: 'Verdienen Sie mehr mit Stasher. W\u00e4hlen Sie das Programm, das zu {businessName} passt, und steigern Sie Ihre Ums\u00e4tze aus Gep\u00e4ckaufbewahrung.',
    heroCta: 'Pl\u00e4ne ansehen',
    badgeSelected: 'Ausgew\u00e4hlt',
    badgeRecommended: 'Empfohlen',
    tierStandardTag: 'Standard',
    tierStandardTitle: 'Extra Provision',
    tierStandardDesc: 'Erf\u00fcllen Sie unsere Qualit\u00e4tsstandards und erhalten Sie eine h\u00f6here Provision bei jeder Buchung.',
    requirementsLabel: 'Anforderungen',
    reqHours: 'Mindest\u00f6ffnungszeiten',
    reqCapacity: 'Mindestkapazit\u00e4t',
    reqBagSizes: 'Alle Gep\u00e4ckgr\u00f6\u00dfen akzeptieren',
    reqSignage: 'Theken- und Schaufensterschilder gut sichtbar',
    reqReviews: '5 Google Maps-Bewertungen pro Monat sammeln',
    selectStandard: 'Standard w\u00e4hlen',
    tierProTag: 'Pro',
    tierProTitle: 'Extra Provision + extra Nachfrage',
    tierProDesc: 'Alles aus Standard, plus wir bringen aktiv neue Kunden zu {businessName}.',
    allStandardPlus: 'Alle Standard-Anforderungen, plus',
    proExtraExclusivity: 'Exklusivit\u00e4t mit Stasher',
    proExtraSignage: 'Zus\u00e4tzliche Beschilderung Ihrer Wahl',
    howWeDrive: 'So schaffen wir Nachfrage',
    driveAds: 'Google Ads-Boost von Stasher bezahlt',
    driveKit: 'Marken-Store-Kit von Stasher',
    driveTraffic: 'Mehr Website-Traffic zu Ihrem Eintrag',
    driveCentrepiece: 'Werden Sie das Herzst\u00fcck von Stasher in {city}',
    selectPro: 'Pro w\u00e4hlen',
    signageTitle: 'W\u00e4hlen Sie Ihre Beschilderung',
    signageDescription: 'W\u00e4hlen Sie die Beschilderung f\u00fcr {businessName}. Sie m\u00fcssen mindestens 3 Artikel ausw\u00e4hlen.',
    signageError: 'Bitte w\u00e4hlen Sie mindestens 3 Beschilderungsartikel, um mit dem Pro-Plan fortzufahren.',
    signageCount: '{count} von 3 Mindestauswahl ausgew\u00e4hlt',
    signagePrompt: 'W\u00e4hlen Sie die Beschilderungsartikel, die Sie interessieren',
    signageContinue: 'Weiter zur Registrierung',
    formTitle: 'Interesse bekunden',
    formSelectedStandard: 'Sie haben den Standard-Plan gew\u00e4hlt.',
    formSelectedPro: 'Sie haben den Pro-Plan gew\u00e4hlt. {count} Beschilderungsartikel ausgew\u00e4hlt.',
    formName: 'Name',
    formNamePlaceholder: 'Ihr Name',
    formRole: 'Rolle',
    formRolePlaceholder: 'Inhaber / Manager',
    formBusiness: 'Unternehmensname',
    formCityMultiHint:
      'Stadt und Land werden pro Eintrag beim Absenden \u00fcbernommen \u2014 bei Bedarf im Stasher-Dashboard anpassen.',
    formCity: 'Stadt',
    formEmail: 'E-Mail',
    formEmailPlaceholder: 'sie@beispiel.de',
    formPhone: 'Telefon',
    formPhonePlaceholder: '+49 30 12345678',
    formQuestions: 'Haben Sie Fragen?',
    formSubmitting: 'Wird gesendet...',
    formSubmit: 'Interesse senden',
    formSignageWarning: 'W\u00e4hlen Sie mindestens 3 Beschilderungsartikel zum Absenden',
    formDisclaimer: 'Mit dem Absenden stimmen Sie zu, zum Stasher Partnerprogramm kontaktiert zu werden.',
    footerCopyright: '\u00a9 {year} Stasher \u2022 Partnerprogramm',
  },
  it: {
    headerTitle: 'Programma Partner Stasher',
    navPlans: 'Piani',
    navRegister: 'Registrati',
    headerCta: 'Inizia',
    heroTitle: 'Scegli il tuo piano partner',
    heroDescription: 'Guadagna di pi\u00f9 con Stasher. Scegli il programma giusto per {businessName} e inizia ad aumentare i tuoi ricavi dal deposito bagagli.',
    heroCta: 'Vedi i piani',
    badgeSelected: 'Selezionato',
    badgeRecommended: 'Consigliato',
    tierStandardTag: 'Standard',
    tierStandardTitle: 'Commissione extra',
    tierStandardDesc: 'Rispetta i nostri standard qualitativi e guadagna una commissione pi\u00f9 alta su ogni prenotazione.',
    requirementsLabel: 'Requisiti',
    reqHours: 'Orari di apertura minimi',
    reqCapacity: 'Capacit\u00e0 minima',
    reqBagSizes: 'Accettare tutte le dimensioni di bagagli',
    reqSignage: 'Segnaletica da banco e vetrina ben visibile',
    reqReviews: 'Raccogliere 5 recensioni Google Maps al mese',
    selectStandard: 'Scegli Standard',
    tierProTag: 'Pro',
    tierProTitle: 'Commissione extra + domanda extra',
    tierProDesc: 'Tutto ci\u00f2 che c\u2019\u00e8 in Standard, in pi\u00f9 portiamo attivamente nuovi clienti a {businessName}.',
    allStandardPlus: 'Tutti i requisiti Standard, pi\u00f9',
    proExtraExclusivity: 'Esclusivit\u00e0 con Stasher',
    proExtraSignage: 'Segnaletica extra a tua scelta',
    howWeDrive: 'Come generiamo domanda',
    driveAds: 'Boost Google Ads pagato da Stasher',
    driveKit: 'Kit store brandizzato fornito da Stasher',
    driveTraffic: 'Maggior traffico al tuo annuncio',
    driveCentrepiece: 'Diventa il fulcro di Stasher a {city}',
    selectPro: 'Scegli Pro',
    signageTitle: 'Scegli la tua segnaletica',
    signageDescription: 'Seleziona la segnaletica che vuoi per {businessName}. Devi scegliere almeno 3 articoli.',
    signageError: 'Seleziona almeno 3 articoli di segnaletica per continuare con il piano Pro.',
    signageCount: '{count} su 3 minimi selezionati',
    signagePrompt: 'Seleziona gli articoli di segnaletica che ti interessano',
    signageContinue: 'Continua alla registrazione',
    formTitle: 'Manifesta il tuo interesse',
    formSelectedStandard: 'Hai scelto il piano Standard.',
    formSelectedPro: 'Hai scelto il piano Pro. {count} articoli di segnaletica selezionati.',
    formName: 'Nome',
    formNamePlaceholder: 'Il tuo nome',
    formRole: 'Ruolo',
    formRolePlaceholder: 'Titolare / Manager',
    formBusiness: 'Nome dell\u2019attivit\u00e0',
    formCityMultiHint:
      'Citt\u00e0 e paese sono presi da ogni annuncio all\u2019invio; modificali nel dashboard Stasher se necessario.',
    formCity: 'Citt\u00e0',
    formEmail: 'Email',
    formEmailPlaceholder: 'tu@esempio.it',
    formPhone: 'Telefono',
    formPhonePlaceholder: '+39 02 1234 5678',
    formQuestions: 'Hai domande?',
    formSubmitting: 'Invio in corso...',
    formSubmit: 'Invia interesse',
    formSignageWarning: 'Seleziona almeno 3 articoli di segnaletica per inviare',
    formDisclaimer: 'Inviando, accetti di essere contattato riguardo al Programma Partner Stasher.',
    footerCopyright: '\u00a9 {year} Stasher \u2022 Programma Partner',
  },
  pt: {
    headerTitle: 'Programa de Parceiros Stasher',
    navPlans: 'Planos',
    navRegister: 'Registar',
    headerCta: 'Comece agora',
    heroTitle: 'Escolha o seu plano de parceiro',
    heroDescription: 'Ganhe mais com a Stasher. Escolha o programa ideal para {businessName} e aumente a sua receita com dep\u00f3sito de bagagens.',
    heroCta: 'Ver planos',
    badgeSelected: 'Selecionado',
    badgeRecommended: 'Recomendado',
    tierStandardTag: 'Standard',
    tierStandardTitle: 'Comiss\u00e3o extra',
    tierStandardDesc: 'Cumpra os nossos padr\u00f5es de qualidade e ganhe uma comiss\u00e3o mais alta em cada reserva.',
    requirementsLabel: 'Requisitos',
    reqHours: 'Hor\u00e1rio de abertura m\u00ednimo',
    reqCapacity: 'Capacidade m\u00ednima',
    reqBagSizes: 'Aceitar todos os tamanhos de bagagem',
    reqSignage: 'Sinaliza\u00e7\u00e3o de balc\u00e3o e montra bem vis\u00edvel',
    reqReviews: 'Recolher 5 avalia\u00e7\u00f5es no Google Maps por m\u00eas',
    selectStandard: 'Escolher Standard',
    tierProTag: 'Pro',
    tierProTitle: 'Comiss\u00e3o extra + procura extra',
    tierProDesc: 'Tudo o que o Standard inclui, al\u00e9m disso trazemos ativamente novos clientes a {businessName}.',
    allStandardPlus: 'Todos os requisitos do Standard, mais',
    proExtraExclusivity: 'Exclusividade com a Stasher',
    proExtraSignage: 'Sinaliza\u00e7\u00e3o extra \u00e0 sua escolha',
    howWeDrive: 'Como geramos procura',
    driveAds: 'Boost de Google Ads pago pela Stasher',
    driveKit: 'Kit de loja co-marcado fornecido pela Stasher',
    driveTraffic: 'Mais tr\u00e1fego para o seu an\u00fancio',
    driveCentrepiece: 'Torne-se o centro da Stasher em {city}',
    selectPro: 'Escolher Pro',
    signageTitle: 'Escolha a sua sinaliza\u00e7\u00e3o',
    signageDescription: 'Selecione a sinaliza\u00e7\u00e3o que pretende para {businessName}. Deve escolher pelo menos 3 itens.',
    signageError: 'Selecione pelo menos 3 itens de sinaliza\u00e7\u00e3o para continuar no plano Pro.',
    signageCount: '{count} de 3 m\u00ednimos selecionados',
    signagePrompt: 'Selecione os itens de sinaliza\u00e7\u00e3o do seu interesse',
    signageContinue: 'Continuar para registo',
    formTitle: 'Registe o seu interesse',
    formSelectedStandard: 'Escolheu o plano Standard.',
    formSelectedPro: 'Escolheu o plano Pro. {count} itens de sinaliza\u00e7\u00e3o selecionados.',
    formName: 'Nome',
    formNamePlaceholder: 'O seu nome',
    formRole: 'Fun\u00e7\u00e3o',
    formRolePlaceholder: 'Propriet\u00e1rio / Gerente',
    formBusiness: 'Nome do neg\u00f3cio',
    formCityMultiHint:
      'Cidade e pa\u00eds v\u00eam de cada an\u00fancio ao enviar; edite no painel Stasher se precisar.',
    formCity: 'Cidade',
    formEmail: 'Email',
    formEmailPlaceholder: 'voce@exemplo.com',
    formPhone: 'Telefone',
    formPhonePlaceholder: '+351 21 123 45 67',
    formQuestions: 'Tem alguma quest\u00e3o?',
    formSubmitting: 'A enviar...',
    formSubmit: 'Enviar interesse',
    formSignageWarning: 'Selecione pelo menos 3 itens de sinaliza\u00e7\u00e3o para enviar',
    formDisclaimer: 'Ao enviar, aceita ser contactado sobre o Programa de Parceiros Stasher.',
    footerCopyright: '\u00a9 {year} Stasher \u2022 Programa de Parceiros',
  },
  nl: {
    headerTitle: 'Stasher Partnerprogramma',
    navPlans: 'Plannen',
    navRegister: 'Registreren',
    headerCta: 'Aan de slag',
    heroTitle: 'Kies je partnerplan',
    heroDescription: 'Verdien meer met Stasher. Kies het programma dat past bij {businessName} en laat je omzet uit bagageopslag groeien.',
    heroCta: 'Bekijk plannen',
    badgeSelected: 'Geselecteerd',
    badgeRecommended: 'Aanbevolen',
    tierStandardTag: 'Standard',
    tierStandardTitle: 'Extra commissie',
    tierStandardDesc: 'Voldoe aan onze kwaliteitsnormen en verdien een hogere commissie op elke boeking.',
    requirementsLabel: 'Vereisten',
    reqHours: 'Minimale openingstijden',
    reqCapacity: 'Minimale capaciteit',
    reqBagSizes: 'Alle bagageformaten accepteren',
    reqSignage: 'Toonbank- en raamborden duidelijk zichtbaar',
    reqReviews: 'Maandelijks 5 Google Maps-reviews verzamelen',
    selectStandard: 'Kies Standard',
    tierProTag: 'Pro',
    tierProTitle: 'Extra commissie + extra vraag',
    tierProDesc: 'Alles uit Standard, plus we brengen actief nieuwe klanten naar {businessName}.',
    allStandardPlus: 'Alle Standard-vereisten, plus',
    proExtraExclusivity: 'Exclusiviteit met Stasher',
    proExtraSignage: 'Extra bewegwijzering naar keuze',
    howWeDrive: 'Zo zorgen we voor vraag',
    driveAds: 'Google Ads-boost betaald door Stasher',
    driveKit: 'Merkpakket voor je winkel van Stasher',
    driveTraffic: 'Meer websiteverkeer naar je vermelding',
    driveCentrepiece: 'Word het middelpunt van Stasher in {city}',
    selectPro: 'Kies Pro',
    signageTitle: 'Kies je bewegwijzering',
    signageDescription: 'Kies de bewegwijzering voor {businessName}. Je moet minstens 3 items kiezen.',
    signageError: 'Selecteer minstens 3 bewegwijzeringsitems om verder te gaan met het Pro-plan.',
    signageCount: '{count} van minimaal 3 geselecteerd',
    signagePrompt: 'Selecteer de bewegwijzeringsitems waarin je ge\u00efnteresseerd bent',
    signageContinue: 'Door naar registreren',
    formTitle: 'Geef je interesse aan',
    formSelectedStandard: 'Je hebt het Standard-plan gekozen.',
    formSelectedPro: 'Je hebt het Pro-plan gekozen. {count} bewegwijzeringsitems geselecteerd.',
    formName: 'Naam',
    formNamePlaceholder: 'Je naam',
    formRole: 'Rol',
    formRolePlaceholder: 'Eigenaar / Manager',
    formBusiness: 'Bedrijfsnaam',
    formCityMultiHint:
      'Stad en land worden per vermelding bij verzenden overgenomen; pas ze zo nodig aan in je Stasher-dashboard.',
    formCity: 'Stad',
    formEmail: 'E-mail',
    formEmailPlaceholder: 'jij@voorbeeld.nl',
    formPhone: 'Telefoon',
    formPhonePlaceholder: '+31 20 123 4567',
    formQuestions: 'Vragen?',
    formSubmitting: 'Bezig met verzenden...',
    formSubmit: 'Interesse versturen',
    formSignageWarning: 'Selecteer minstens 3 bewegwijzeringsitems om te verzenden',
    formDisclaimer: 'Door te verzenden ga je akkoord om gecontacteerd te worden over het Stasher Partnerprogramma.',
    footerCopyright: '\u00a9 {year} Stasher \u2022 Partnerprogramma',
  },
} as const

type TierTranslationKey = keyof typeof tierTranslations.en
type TierLocaleBundle = Record<TierTranslationKey, string>

const tierLocaleBundles: Record<SupportedLandingLocale, TierLocaleBundle> = {
  en: tierTranslations.en,
  fr: tierTranslations.fr,
  es: tierTranslations.es,
  de: tierTranslations.de,
  it: tierTranslations.it,
  pt: tierTranslations.pt,
  nl: tierTranslations.nl,
}

function interpolate(str: string, vars: Record<string, string | number>): string {
  return str.replace(/\{(\w+)\}/g, (_m, k) => {
    const v = vars[k]
    return v === undefined || v === null ? '' : String(v)
  })
}

export default function TierLanding(props: TierLandingProps) {
  const [selectedTier, setSelectedTier] = useState<Tier>(null)
  const [selectedSigns, setSelectedSigns] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
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

  const locPills = props.programmeStashpoints
  const multiLoc = Boolean(locPills && locPills.length > 1)
  const firstBiz = locPills?.[0]?.businessName ?? p.businessName
  const firstCity = locPills?.[0]?.city ?? p.city

  const localeKey: SupportedLandingLocale = normalizeLandingLocale(props.locale) ?? 'en'
  const bundle = tierLocaleBundles[localeKey] ?? tierLocaleBundles.en
  const t = (key: TierTranslationKey, vars?: Record<string, string | number>) =>
    vars ? interpolate(bundle[key], vars) : bundle[key]

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
          locale: localeKey,
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
            <span className="font-bold">{t('headerTitle')}</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a href="#tiers" className="hover:opacity-80">{t('navPlans')}</a>
            <a href="#apply" className="hover:opacity-80">{t('navRegister')}</a>
          </nav>
          <Button size="sm" asChild>
            <a href="#tiers">{t('headerCta')}</a>
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
              {t('heroTitle')}
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              {t('heroDescription', { businessName: p.businessName })}
            </p>
            <div className="mt-8">
              <Button size="lg" variant="outline" asChild>
                <a href="#tiers" className="flex items-center gap-2">
                  {t('heroCta')} <ChevronDown className="h-4 w-4" />
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
                  <Check className="h-3 w-3" /> {t('badgeSelected')}
                </span>
              </div>
            )}
            <CardHeader className="text-center pb-4">
              <p className="text-sm font-medium uppercase tracking-wider text-slate-500">{t('tierStandardTag')}</p>
              <CardTitle className="mt-2 text-2xl">{t('tierStandardTitle')}</CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                {t('tierStandardDesc')}
              </p>
            </CardHeader>
            <CardContent>
              <div className="border-t pt-6">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">{t('requirementsLabel')}</p>
                <ul className="space-y-3">
                  {standardRequirements.map((req) => (
                    <li key={req.key} className="flex items-start gap-3">
                      <req.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm text-slate-700">{t(req.key)}</span>
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
                    <span className="flex items-center gap-2"><Check className="h-4 w-4" /> {t('badgeSelected')}</span>
                  ) : (
                    t('selectStandard')
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
                  <Check className="h-3 w-3" /> {t('badgeSelected')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-blush px-3 py-1 text-xs font-semibold text-primary">
                  <Sparkles className="h-3 w-3" /> {t('badgeRecommended')}
                </span>
              )}
            </div>
            <CardHeader className="text-center pb-4">
              <p className="text-sm font-medium uppercase tracking-wider text-primary">{t('tierProTag')}</p>
              <CardTitle className="mt-2 text-2xl">{t('tierProTitle')}</CardTitle>
              <p className="mt-2 text-sm text-slate-600">
                {t('tierProDesc', { businessName: p.businessName })}
              </p>
            </CardHeader>
            <CardContent>
              <div className="border-t pt-6">
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('allStandardPlus')}
                </p>
                <ul className="space-y-3">
                  {standardRequirements.map((req) => (
                    <li key={req.key} className="flex items-start gap-3 opacity-50">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span className="text-sm text-slate-500">{t(req.key)}</span>
                    </li>
                  ))}
                  {proExtras.map((req) => (
                    <li key={req.key} className="flex items-start gap-3">
                      <req.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm font-medium text-slate-700">{t(req.key)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 rounded-lg bg-slate-50 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary">
                    {t('howWeDrive')}
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <Megaphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-xs text-slate-600">{t('driveAds')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-xs text-slate-600">{t('driveKit')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-xs text-slate-600">{t('driveTraffic')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="text-xs text-slate-600">{t('driveCentrepiece', { city: p.city })}</span>
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
                    <span className="flex items-center gap-2"><Check className="h-4 w-4" /> {t('badgeSelected')}</span>
                  ) : (
                    t('selectPro')
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
                {t('signageTitle')}
              </h2>
              <p className="mt-3 text-lg text-slate-600">
                {t('signageDescription', { businessName: p.businessName })}
              </p>
              {showSignageError && selectedSigns.length < 3 && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  {t('signageError')}
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
                  {t('signageCount', { count: selectedSigns.length })}
                  {selectedSigns.length >= 3 && <Check className="ml-1 inline h-4 w-4" />}
                </p>
              ) : (
                <p className="text-sm text-slate-500">{t('signagePrompt')}</p>
              )}
            </div>
            {selectedSigns.length >= 3 && (
              <div className="mt-8 text-center">
                <Button size="lg" asChild>
                  <a href="#apply" className="flex items-center gap-2">
                    {t('signageContinue')} <ArrowRight className="h-4 w-4" />
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
                  {t('formTitle')}
                </h2>
                <p className="mt-2 text-slate-600">
                  {selectedTier === 'pro'
                    ? t('formSelectedPro', { count: selectedSigns.length })
                    : t('formSelectedStandard')}
                </p>
              </div>

              <form method="POST" action={p.formAction} onSubmit={handleSubmit} className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">{t('formName')}</label>
                    <Input
                      name="name"
                      required
                      placeholder={t('formNamePlaceholder')}
                      defaultValue={props.hostDisplayName ?? ''}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('formRole')}</label>
                    <Input name="role" placeholder={t('formRolePlaceholder')} className="mt-1" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">{t('formBusiness')}</label>
                    {locPills && locPills.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {locPills.slice(0, 3).map((sp) => (
                            <span
                              key={sp.stashpointId}
                              className={cn(
                                'inline-flex max-w-[220px] items-center truncate rounded-full border border-slate-200',
                                'bg-white px-3 py-1 text-xs font-medium text-slate-800 shadow-sm'
                              )}
                              title={`${sp.businessName} — ${sp.city}`}
                            >
                              {sp.businessName}
                            </span>
                          ))}
                          {locPills.length > 3 && (
                            <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">
                              +{locPills.length - 3}
                            </span>
                          )}
                        </div>
                        <input type="hidden" name="business" value={firstBiz} />
                      </div>
                    ) : (
                      <Input name="business" defaultValue={p.businessName} required className="mt-1" />
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('formCity')}</label>
                    {multiLoc ? (
                      <div className="mt-1 space-y-2">
                        <p className="text-sm text-slate-600">{t('formCityMultiHint')}</p>
                        <input type="hidden" name="city" value={firstCity} />
                      </div>
                    ) : (
                      <Input name="city" defaultValue={p.city} required className="mt-1" />
                    )}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium">{t('formEmail')}</label>
                    <Input type="email" name="email" required placeholder={t('formEmailPlaceholder')} defaultValue={p.ownerEmail} className="mt-1" />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('formPhone')}</label>
                    <Input type="tel" name="phone" placeholder={t('formPhonePlaceholder')} defaultValue={p.ownerPhone} className="mt-1" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">{t('formQuestions')}</label>
                  <Textarea name="notes" className="mt-1" />
                </div>

                <input type="hidden" name="source" value="programme" />
                <input type="hidden" name="stashpointId" value={props.stashpointId || ''} />
                <input type="hidden" name="hostId" value={props.hostId || ''} />
                {props.programmeStashpoints && props.programmeStashpoints.length > 0 && (
                  <input
                    type="hidden"
                    name="programmeStashpointsPayload"
                    value={JSON.stringify(props.programmeStashpoints)}
                  />
                )}
                <input type="hidden" name="selectedTier" value={selectedTier || ''} />
                <input type="hidden" name="selectedSigns" value={JSON.stringify(selectedSigns)} />


                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={!canSubmit}
                  >
                    {isSubmitting ? t('formSubmitting') : t('formSubmit')}
                  </Button>
                  {selectedTier === 'pro' && selectedSigns.length < 3 && (
                    <span className="text-xs text-amber-600">
                      {t('formSignageWarning')}
                    </span>
                  )}
                </div>
                <p className="text-center text-xs text-slate-500">
                  {t('formDisclaimer')}
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
              {t('footerCopyright', { year: new Date().getFullYear() })}
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

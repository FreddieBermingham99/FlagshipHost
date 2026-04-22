'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { CheckCircle2, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  normalizeLandingLocale,
  type SupportedLandingLocale,
} from '@/lib/landing-locale'

const thankYouTranslations = {
  en: {
    signageTitle: 'Thanks for your signage order!',
    interestTitle: 'Thank you for your interest!',
    signagePrefix: 'Your signage order',
    programmePrefix: 'Your application for the',
    programmePlanSuffix: 'plan',
    submissionPrefix: 'Your submission',
    forBusiness: 'for',
    inCity: 'in',
    received: 'has been received.',
    whatNext: 'What happens next?',
    nextSignage: 'Our team will prepare your signage order. Please allow up to 2-4 weeks for delivery.',
    nextDefault: 'Our team will review your details and be in touch soon with more information and next steps.',
  },
  fr: {
    signageTitle: 'Merci pour votre commande de signal\u00e9tique !',
    interestTitle: 'Merci de votre int\u00e9r\u00eat !',
    signagePrefix: 'Votre commande de signal\u00e9tique',
    programmePrefix: 'Votre candidature pour la formule',
    programmePlanSuffix: '',
    submissionPrefix: 'Votre demande',
    forBusiness: 'pour',
    inCity: '\u00e0',
    received: 'a bien \u00e9t\u00e9 re\u00e7ue.',
    whatNext: 'Et maintenant ?',
    nextSignage: 'Notre \u00e9quipe pr\u00e9pare votre commande de signal\u00e9tique. Comptez 2 \u00e0 4 semaines pour la livraison.',
    nextDefault: 'Notre \u00e9quipe va examiner vos informations et vous recontactera prochainement avec la suite.',
  },
  es: {
    signageTitle: '\u00a1Gracias por tu pedido de se\u00f1al\u00e9tica!',
    interestTitle: '\u00a1Gracias por tu inter\u00e9s!',
    signagePrefix: 'Tu pedido de se\u00f1al\u00e9tica',
    programmePrefix: 'Tu solicitud para el plan',
    programmePlanSuffix: '',
    submissionPrefix: 'Tu solicitud',
    forBusiness: 'para',
    inCity: 'en',
    received: 'ha sido recibida.',
    whatNext: '\u00bfQu\u00e9 pasa ahora?',
    nextSignage: 'Nuestro equipo preparar\u00e1 tu pedido de se\u00f1al\u00e9tica. Por favor espera entre 2 y 4 semanas para la entrega.',
    nextDefault: 'Nuestro equipo revisar\u00e1 tus datos y se pondr\u00e1 en contacto pronto con m\u00e1s informaci\u00f3n y los siguientes pasos.',
  },
  de: {
    signageTitle: 'Danke f\u00fcr Ihre Beschilderungsbestellung!',
    interestTitle: 'Danke f\u00fcr Ihr Interesse!',
    signagePrefix: 'Ihre Beschilderungsbestellung',
    programmePrefix: 'Ihre Bewerbung f\u00fcr den',
    programmePlanSuffix: 'Plan',
    submissionPrefix: 'Ihre Eingabe',
    forBusiness: 'f\u00fcr',
    inCity: 'in',
    received: 'ist eingegangen.',
    whatNext: 'Wie geht es weiter?',
    nextSignage: 'Unser Team bereitet Ihre Beschilderungsbestellung vor. Bitte rechnen Sie mit 2-4 Wochen Lieferzeit.',
    nextDefault: 'Unser Team pr\u00fcft Ihre Daten und meldet sich bald mit weiteren Informationen und den n\u00e4chsten Schritten.',
  },
  it: {
    signageTitle: 'Grazie per il tuo ordine di segnaletica!',
    interestTitle: 'Grazie per il tuo interesse!',
    signagePrefix: 'Il tuo ordine di segnaletica',
    programmePrefix: 'La tua candidatura per il piano',
    programmePlanSuffix: '',
    submissionPrefix: 'La tua richiesta',
    forBusiness: 'per',
    inCity: 'a',
    received: '\u00e8 stato ricevuto.',
    whatNext: 'E adesso?',
    nextSignage: 'Il nostro team preparer\u00e0 il tuo ordine di segnaletica. Prevedi 2-4 settimane per la consegna.',
    nextDefault: 'Il nostro team esaminer\u00e0 i tuoi dati e ti contatter\u00e0 presto con maggiori informazioni e i prossimi passi.',
  },
  pt: {
    signageTitle: 'Obrigado pela sua encomenda de sinaliza\u00e7\u00e3o!',
    interestTitle: 'Obrigado pelo seu interesse!',
    signagePrefix: 'A sua encomenda de sinaliza\u00e7\u00e3o',
    programmePrefix: 'A sua candidatura para o plano',
    programmePlanSuffix: '',
    submissionPrefix: 'A sua submiss\u00e3o',
    forBusiness: 'para',
    inCity: 'em',
    received: 'foi recebida.',
    whatNext: 'E agora?',
    nextSignage: 'A nossa equipa vai preparar a sua encomenda de sinaliza\u00e7\u00e3o. Considere entre 2 e 4 semanas para a entrega.',
    nextDefault: 'A nossa equipa vai analisar os seus dados e entrar\u00e1 em contacto em breve com mais informa\u00e7\u00f5es e pr\u00f3ximos passos.',
  },
  nl: {
    signageTitle: 'Bedankt voor je bewegwijzeringsbestelling!',
    interestTitle: 'Bedankt voor je interesse!',
    signagePrefix: 'Je bewegwijzeringsbestelling',
    programmePrefix: 'Je aanvraag voor het',
    programmePlanSuffix: 'plan',
    submissionPrefix: 'Je inzending',
    forBusiness: 'voor',
    inCity: 'in',
    received: 'is ontvangen.',
    whatNext: 'Wat gebeurt er nu?',
    nextSignage: 'Ons team bereidt je bewegwijzeringsbestelling voor. Reken op 2-4 weken levertijd.',
    nextDefault: 'Ons team bekijkt je gegevens en neemt binnenkort contact op met meer informatie en de volgende stappen.',
  },
} as const

function ThankYouContent() {
  const params = useSearchParams()
  const business = params.get('business') || ''
  const city = params.get('city') || ''
  const source = params.get('source') || 'flagship'
  const tier = params.get('tier') || ''
  const rawLocale = params.get('locale')

  const locale: SupportedLandingLocale = normalizeLandingLocale(rawLocale) ?? 'en'
  const t = thankYouTranslations[locale] ?? thankYouTranslations.en

  const isProgramme = source === 'programme'
  const isSignage = source === 'signage'
  const tierLabel = tier === 'pro' ? 'Pro' : tier === 'standard' ? 'Standard' : ''

  // Build the body sentence dynamically
  const body = (() => {
    const prefix = isSignage
      ? t.signagePrefix
      : isProgramme && tierLabel
      ? `${t.programmePrefix} ${tierLabel}${t.programmePlanSuffix ? ` ${t.programmePlanSuffix}` : ''}`
      : t.submissionPrefix

    return (
      <>
        {prefix}
        {business && (
          <>
            {' '}
            {t.forBusiness}{' '}
            <span className="font-semibold">{business}</span>
          </>
        )}
        {city && (
          <>
            {' '}
            {t.inCity} {city}
          </>
        )}{' '}
        {t.received}
      </>
    )
  })()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-lg border-0 shadow-xl">
        <CardContent className="px-8 py-12 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-9 w-9 text-green-600" />
          </div>

          <h1 className="mb-3 text-2xl font-bold tracking-tight text-slate-900">
            {isSignage ? t.signageTitle : t.interestTitle}
          </h1>

          <p className="mx-auto mb-6 max-w-md text-slate-600">{body}</p>

          <div className="mx-auto max-w-sm rounded-lg border border-blue-100 bg-blue-50 px-5 py-4">
            <div className="flex items-start gap-3 text-left">
              <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-blue-900">{t.whatNext}</p>
                <p className="mt-1 text-sm text-blue-700">
                  {isSignage ? t.nextSignage : t.nextDefault}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ThankYouPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
          <p className="text-slate-400">Loading...</p>
        </div>
      }
    >
      <ThankYouContent />
    </Suspense>
  )
}

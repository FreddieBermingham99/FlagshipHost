'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { CheckCircle2, ArrowLeft, Mail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function ThankYouContent() {
  const params = useSearchParams()
  const business = params.get('business') || ''
  const city = params.get('city') || ''
  const source = params.get('source') || 'flagship'
  const tier = params.get('tier') || ''

  const isProgramme = source === 'programme'
  const tierLabel = tier === 'pro' ? 'Pro' : tier === 'standard' ? 'Standard' : ''

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <Card className="w-full max-w-lg border-0 shadow-xl">
        <CardContent className="px-8 py-12 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-9 w-9 text-green-600" />
          </div>

          <h1 className="mb-3 text-2xl font-bold tracking-tight text-slate-900">
            Thank you for your interest!
          </h1>

          <p className="mx-auto mb-6 max-w-md text-slate-600">
            {isProgramme && tierLabel ? (
              <>
                Your application for the <span className="font-semibold">{tierLabel}</span> plan
                {business && <> for <span className="font-semibold">{business}</span></>}
                {city && <> in {city}</>} has been received.
              </>
            ) : (
              <>
                Your submission
                {business && <> for <span className="font-semibold">{business}</span></>}
                {city && <> in {city}</>} has been received.
              </>
            )}
          </p>

          <div className="mx-auto mb-8 max-w-sm rounded-lg border border-blue-100 bg-blue-50 px-5 py-4">
            <div className="flex items-start gap-3 text-left">
              <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
              <div>
                <p className="text-sm font-medium text-blue-900">What happens next?</p>
                <p className="mt-1 text-sm text-blue-700">
                  Our team will review your details and be in touch soon with more information and next steps.
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
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

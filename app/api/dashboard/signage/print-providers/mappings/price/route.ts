import { NextResponse } from 'next/server'

import { requireDashboardSessionApi } from '@/lib/require-dashboard-session'
import { cloudprinterListProducts } from '@/lib/print-providers/cloudprinter/client'
import { helloprintQuote } from '@/lib/print-providers/helloprint/client'
import { solopressPriceByAttribute } from '@/lib/print-providers/solopress/client'
import {
  isSolopressTurnaround,
  SOLOPRESS_DEFAULT_TURNAROUND,
} from '@/lib/print-providers/solopress/catalog'
import { PRINT_PROVIDER_NAMES } from '@/lib/print-providers/registry'
import type { PrintProviderName } from '@/lib/print-providers/types'

export const dynamic = 'force-dynamic'

function isProviderName(value: unknown): value is PrintProviderName {
  return typeof value === 'string' && (PRINT_PROVIDER_NAMES as readonly string[]).includes(value)
}

function formatMoney(amount: number, currency = 'GBP'): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

function formatCents(cents: number, currency = 'EUR'): string {
  return formatMoney(cents / 100, currency)
}

export async function POST(req: Request) {
  const authErr = requireDashboardSessionApi()
  if (authErr) return authErr

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isProviderName(body.provider)) {
    return NextResponse.json({ error: 'provider is required' }, { status: 400 })
  }

  const provider = body.provider
  const providerProduct =
    typeof body.provider_product === 'string' ? body.provider_product.trim() : ''
  const providerAttributes =
    body.provider_attributes && typeof body.provider_attributes === 'object'
      ? (body.provider_attributes as Record<string, unknown>)
      : {}
  const quantity =
    typeof body.quantity === 'number' && body.quantity > 0 ? Math.floor(body.quantity) : 1

  try {
    if (provider === 'cloudprinter') {
      if (!providerProduct) {
        return NextResponse.json({ priceLabel: null, productLabel: null })
      }
      const products = await cloudprinterListProducts()
      const match = products.find((p) => p.reference === providerProduct)
      if (!match) {
        return NextResponse.json({
          priceLabel: null,
          productLabel: providerProduct,
          note: 'Product not found on account',
        })
      }
      const amount = Number.parseFloat(match.from_price)
      return NextResponse.json({
        priceLabel: Number.isFinite(amount)
          ? formatMoney(amount, match.currency || 'EUR')
          : null,
        productLabel: match.name || providerProduct,
        note: 'From price (qty 1)',
      })
    }

    if (provider === 'helloprint') {
      const variantKey = String(providerAttributes.variantKey ?? '').trim()
      if (!variantKey.includes('~')) {
        return NextResponse.json({ priceLabel: null, productLabel: providerProduct || null })
      }
      const serviceLevelRaw = String(providerAttributes.serviceLevel ?? 'standard').toLowerCase()
      const serviceLevel: 'saver' | 'standard' | 'express' =
        serviceLevelRaw === 'saver' || serviceLevelRaw === 'express'
          ? (serviceLevelRaw as 'saver' | 'express')
          : 'standard'
      const res = await helloprintQuote({
        destinationCountryCode: 'GB',
        items: [{ variantKey, quantity, serviceLevel }],
      })
      if (!res.success) {
        return NextResponse.json({
          priceLabel: null,
          productLabel: variantKey,
          note: res.message || 'Quote unavailable',
        })
      }
      const variants = res.data?.items?.[variantKey]
      const first = variants ? Object.values(variants).flat()[0] : undefined
      const cents = first?.prices?.centAmountInclTax ?? first?.prices?.centAmountExclTax
      const currency = res.data?.currency || 'EUR'
      const productKey = providerProduct || variantKey.split('~')[0]
      return NextResponse.json({
        priceLabel: typeof cents === 'number' ? formatCents(cents, currency) : null,
        productLabel: productKey,
        note: typeof cents === 'number' ? `Quoted (${serviceLevel}, qty ${quantity})` : 'Quote returned no price',
      })
    }

    if (provider === 'solopress') {
      if (!providerProduct) {
        return NextResponse.json({ priceLabel: null, productLabel: null })
      }
      const noSides =
        typeof providerAttributes.noSides === 'number'
          ? providerAttributes.noSides
          : Number(providerAttributes.noSides) || 1
      const turnaround = isSolopressTurnaround(providerAttributes.turnaround)
        ? providerAttributes.turnaround
        : SOLOPRESS_DEFAULT_TURNAROUND
      const res = await solopressPriceByAttribute({
        ...providerAttributes,
        product: providerProduct,
        noSides,
        quantity,
        turnaround,
      })
      const r = res.result ?? {}
      const gross = typeof r.grossCost === 'number' ? r.grossCost : null
      const currency = typeof r.currency === 'string' ? r.currency : 'GBP'
      return NextResponse.json({
        priceLabel: gross != null ? formatMoney(gross, currency) : null,
        productLabel: providerProduct,
        note: gross != null ? `Gross (qty ${quantity})` : 'Price unavailable — check product attributes',
      })
    }

    return NextResponse.json({ priceLabel: null, productLabel: null })
  } catch (err) {
    return NextResponse.json(
      {
        priceLabel: null,
        productLabel: providerProduct || null,
        note: err instanceof Error ? err.message : 'Failed to fetch price',
      },
      { status: 200 }
    )
  }
}

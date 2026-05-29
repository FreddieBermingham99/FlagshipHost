/**
 * Registry that maps a provider name to its PrintProvider implementation.
 * Everything else in the codebase imports through this registry to keep
 * Solopress / Helloprint specifics out of business logic.
 */

import 'server-only'

import { cloudprinterProvider } from '@/lib/print-providers/cloudprinter'
import { helloprintProvider } from '@/lib/print-providers/helloprint'
import { solopressProvider } from '@/lib/print-providers/solopress'
import type { PrintProvider, PrintProviderName } from '@/lib/print-providers/types'

const REGISTRY: Record<PrintProviderName, PrintProvider> = {
  solopress: solopressProvider,
  helloprint: helloprintProvider,
  cloudprinter: cloudprinterProvider,
}

export function getPrintProvider(name: PrintProviderName | string): PrintProvider | null {
  if (name in REGISTRY) {
    return REGISTRY[name as PrintProviderName]
  }
  return null
}

export function listPrintProviders(): PrintProvider[] {
  return Object.values(REGISTRY)
}

export function listEnabledProviderNames(): PrintProviderName[] {
  return (Object.keys(REGISTRY) as PrintProviderName[]).filter((n) => REGISTRY[n].enabled)
}

export const PRINT_PROVIDER_NAMES: readonly PrintProviderName[] = Object.freeze(
  Object.keys(REGISTRY) as PrintProviderName[]
)

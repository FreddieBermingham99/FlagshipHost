import type { Metadata } from 'next'
import SignageCatalogDashboard from '@/components/SignageCatalogDashboard'

export const metadata: Metadata = {
  title: 'Signage Catalog · Stasher Dashboard',
  robots: { index: false, follow: false },
}

export default function SignageCatalogPage() {
  return <SignageCatalogDashboard />
}

import type { Metadata } from 'next'
import FlagshipDashboard from '@/components/FlagshipDashboard'
import { resolveFlagshipSiteBaseUrl } from '@/lib/flagship-site-url'

export const metadata: Metadata = {
  title: 'Flagship dashboard · Stasher',
  robots: { index: false, follow: false },
}

export default function DashboardPage() {
  return <FlagshipDashboard siteBaseUrl={resolveFlagshipSiteBaseUrl()} />
}

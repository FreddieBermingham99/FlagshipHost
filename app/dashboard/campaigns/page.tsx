import type { Metadata } from 'next'
import CampaignsDashboard from '@/components/CampaignsDashboard'

export const metadata: Metadata = {
  title: 'Campaigns · Stasher Dashboard',
  robots: { index: false, follow: false },
}

export default function CampaignsPage() {
  return <CampaignsDashboard />
}

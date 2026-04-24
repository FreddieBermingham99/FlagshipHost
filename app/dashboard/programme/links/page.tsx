import type { Metadata } from 'next'
import ProgrammeLinksDashboard from '@/components/ProgrammeLinksDashboard'

export const metadata: Metadata = {
  title: 'Programme Links · Stasher Dashboard',
  robots: { index: false, follow: false },
}

export default function ProgrammeLinksPage() {
  return <ProgrammeLinksDashboard />
}


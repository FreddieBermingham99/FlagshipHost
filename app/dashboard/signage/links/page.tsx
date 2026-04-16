import type { Metadata } from 'next'
import SignageLinksDashboard from '@/components/SignageLinksDashboard'

export const metadata: Metadata = {
  title: 'Signage Links · Stasher Dashboard',
  robots: { index: false, follow: false },
}

export default function SignageLinksPage() {
  return <SignageLinksDashboard />
}

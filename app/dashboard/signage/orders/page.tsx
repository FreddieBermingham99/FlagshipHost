import type { Metadata } from 'next'
import SignageOrdersDashboard from '@/components/SignageOrdersDashboard'

export const metadata: Metadata = {
  title: 'Signage Orders · Stasher Dashboard',
  robots: { index: false, follow: false },
}

export default function SignageOrdersPage() {
  return <SignageOrdersDashboard />
}

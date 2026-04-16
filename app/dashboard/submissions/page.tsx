import type { Metadata } from 'next'
import SubmissionsDashboard from '@/components/SubmissionsDashboard'

export const metadata: Metadata = {
  title: 'Submissions · Stasher Dashboard',
  robots: { index: false, follow: false },
}

export default function SubmissionsPage() {
  return <SubmissionsDashboard />
}

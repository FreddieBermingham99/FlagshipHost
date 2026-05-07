import type { Metadata } from 'next'
import SignageAutomationSettingsDashboard from '@/components/SignageAutomationSettingsDashboard'

export const metadata: Metadata = {
  title: 'Signage Automation · Stasher Dashboard',
  robots: { index: false, follow: false },
}

export default function SignageAutomationPage() {
  return <SignageAutomationSettingsDashboard />
}

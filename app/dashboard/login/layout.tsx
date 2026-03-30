import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard sign-in · Stasher',
  robots: { index: false, follow: false },
}

export default function DashboardLoginLayout({ children }: { children: React.ReactNode }) {
  return children
}

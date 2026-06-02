'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/submissions', label: 'Submissions' },
  { href: '/dashboard/campaigns', label: 'Campaigns' },
  { href: '/dashboard/delivery-burst', label: 'Delivery burst' },
  { href: '/dashboard/signage/orders', label: 'Signage orders' },
  { href: '/dashboard/signage/city-activation', label: 'City activation' },
  { href: '/dashboard/signage/catalog', label: 'Signage catalog' },
  { href: '/dashboard/signage/automation', label: 'Signage automation' },
  { href: '/dashboard/signage/links', label: 'Signage links' },
  { href: '/dashboard/programme/links', label: 'Programme links' },
]

export default function DashboardNav() {
  const pathname = usePathname()
  if (pathname?.startsWith('/dashboard/login')) return null

  const onLogout = async () => {
    try {
      await fetch('/api/dashboard/logout', { method: 'POST' })
    } finally {
      window.location.href = '/dashboard/login'
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-pink-100 bg-white/95 shadow-sm backdrop-blur">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-blush to-primary" />
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname === item.href || pathname?.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-primary/80 hover:bg-blush hover:text-primary'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-full border border-primary/20 px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-blush hover:text-primary"
        >
          Log out
        </button>
      </div>
    </header>
  )
}

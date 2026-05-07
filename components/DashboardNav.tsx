'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/submissions', label: 'Submissions' },
  { href: '/dashboard/campaigns', label: 'Campaigns' },
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
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center gap-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-2.5 py-1.5 text-sm transition ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
          className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
        >
          Log out
        </button>
      </div>
    </header>
  )
}

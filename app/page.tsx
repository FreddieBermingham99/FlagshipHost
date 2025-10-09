import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="max-w-2xl text-center">
        <h1 className="mb-4 font-dm text-5xl font-bold text-primary">
          Stasher Flagship Locations
        </h1>
        <p className="mb-8 text-lg text-gray-600">
          Personalized landing pages for our flagship Stashpoint partners.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link href="/flagship/le-grand-hotel">
            <Button size="lg" className="w-full sm:w-auto">
              View Example Page
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}


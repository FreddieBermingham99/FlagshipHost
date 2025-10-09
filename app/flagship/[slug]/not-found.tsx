import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      <div className="max-w-2xl text-center">
        <h1 className="mb-4 font-dm text-5xl font-bold text-primary">Location Not Found</h1>
        <p className="mb-8 text-lg text-gray-600">
          We couldn't find the flagship location you're looking for.
        </p>
        <Link href="/">
          <Button size="lg">Return Home</Button>
        </Link>
      </div>
    </div>
  )
}


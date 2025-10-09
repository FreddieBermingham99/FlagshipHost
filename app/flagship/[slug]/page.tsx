import { notFound } from 'next/navigation'
import { getBusinessBySlug, fetchSheetRows } from '@/lib/sheets'
import FlagshipLanding from '@/components/FlagshipLanding'

type PageProps = {
  params: {
    slug: string
  }
}

// Enable revalidation every 5 minutes
export const revalidate = 300

// Generate static params for all slugs (optional - for SSG)
export async function generateStaticParams() {
  try {
    const rows = await fetchSheetRows()
    return rows.filter((row) => row.slug).map((row) => ({ slug: row.slug }))
  } catch (error) {
    console.error('Error generating static params:', error)
    return []
  }
}

export default async function FlagshipPage({ params }: PageProps) {
  const business = await getBusinessBySlug(params.slug)

  if (!business) {
    notFound()
  }

  return (
    <FlagshipLanding
      businessName={business.businessName}
      city={business.city}
      landmark={business.landmark}
      heroImageUrl={business.heroImageUrl}
      contact={{
        email: business.contactEmail,
        phone: business.contactPhone,
      }}
      formAction={business.formAction}
      googleMapsUrl={business.googleMapsUrl}
      currency={business.currency}
      websiteImpressions={business.websiteImpressions}
      gmapsImpressions={business.gmapsImpressions}
      bookings={business.bookings}
      revenue={business.revenue}
      liftWebsiteImpressions={business.liftWebsiteImpressions}
      liftGmapsImpressions={business.liftGmapsImpressions}
      liftBookings={business.liftBookings}
      liftRevenue={business.liftRevenue}
      topBookings={business.topBookings}
      topViews={business.topViews}
      topRevenue={business.topRevenue}
      ownerEmail={business.ownerEmail}
      ownerPhone={business.ownerPhone}
      parisOne={business.parisOne}
      parisTwo={business.parisTwo}
      madridOne={business.madridOne}
      madridTwo={business.madridTwo}
    />
  )
}


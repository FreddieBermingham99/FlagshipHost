import { notFound } from 'next/navigation'
import DeliveryBurstApp from '@/components/DeliveryBurstApp'
import { getDeliveryBurstCampaignBySlug, isDeliveryBurstDbConfigured } from '@/lib/delivery-burst-db'

export const dynamic = 'force-dynamic'

type PageProps = { params: { slug: string } }

export default async function DeliveryBurstPage({ params }: PageProps) {
  const slug = decodeURIComponent(params.slug?.trim() ?? '')
  if (!slug) notFound()

  if (!isDeliveryBurstDbConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <p className="text-sm text-slate-600">Delivery burst is not configured.</p>
      </div>
    )
  }

  const campaign = await getDeliveryBurstCampaignBySlug(slug)
  if (!campaign) notFound()

  return <DeliveryBurstApp slug={slug} />
}

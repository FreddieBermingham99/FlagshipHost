# Stasher Flagship Locations

A Next.js 14 application that generates personalized landing pages for potential Flagship Stashpoints, powered by Google Sheets data.

## Features

- 🎨 **Modern Design System**: Tailwind CSS + shadcn/ui + lucide-react
- 📝 **DM Sans Typography**: Clean, bold headings with professional styling
- 🎨 **Brand Colors**: 
  - Primary: `#164087`
  - Accent (blush): `#ffe4e8`
  - Background: `#ffffff`
- 🔄 **Dynamic Routing**: Personalized pages at `/flagship/[slug]`
- 📊 **Google Sheets Integration**: Read-only data source
- 📝 **Smart Forms**: POST to Zapier/webhooks or fallback to mailto
- ⚡ **Server-Side Rendering**: Edge-safe, with 5-minute revalidation

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Google Sheets

1. Create a Google Sheet with the following columns (exact names):
   - `slug` - URL-friendly identifier (e.g., `le-grand-hotel`)
   - `businessName` - Business name (e.g., `Le Grand Hotel`)
   - `city` - City name (e.g., `Paris`)
   - `landmark` - Optional nearby landmark (e.g., `Gare du Nord`)
   - `heroImageUrl` - Optional hero image URL
   - `contactEmail` - Contact email address
   - `contactPhone` - Optional contact phone
   - `googleMapsUrl` - Optional Google Maps link
   - `formAction` - Optional webhook URL (e.g., Zapier)

2. Make your sheet publicly readable:
   - File → Share → Change to "Anyone with the link can view"

3. Get a Google Sheets API key:
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Create a new project or select existing
   - Enable Google Sheets API
   - Create credentials → API key
   - Copy the API key

4. Get your Sheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit
   ```

### 3. Set Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your values:

```env
GOOGLE_SHEETS_API_KEY=your_api_key_here
GOOGLE_SHEETS_ID=your_sheet_id_here
GOOGLE_SHEETS_RANGE=Data!A1:Z1000
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Access Dynamic Pages

Visit `/flagship/[slug]` where `[slug]` matches a slug from your Google Sheet.

Example: `/flagship/le-grand-hotel`

## Project Structure

```
stasher-flagship/
├── app/
│   ├── flagship/
│   │   └── [slug]/
│   │       ├── page.tsx          # Dynamic route handler
│   │       └── not-found.tsx     # 404 page
│   ├── layout.tsx                # Root layout with DM Sans
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
├── components/
│   ├── FlagshipLanding.tsx       # Main landing component
│   └── ui/                       # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       └── textarea.tsx
├── lib/
│   ├── sheets.ts                 # Google Sheets integration
│   └── utils.ts                  # Utility functions
└── ...config files
```

## Form Behavior

The contact form has smart fallback logic:

1. **If `formAction` is provided**: POST form data to that URL (e.g., Zapier webhook)
2. **Otherwise**: Open `mailto:` link with pre-filled subject and body

## Deployment

### Vercel (Recommended)

```bash
npm run build
```

Deploy to Vercel and add environment variables in the dashboard.

### Other Platforms

Ensure the platform supports:
- Next.js 14 App Router
- Edge runtime
- Environment variables

## Customization

### Colors

Edit `tailwind.config.ts` to change brand colors:

```ts
colors: {
  primary: {
    DEFAULT: '#164087',
    foreground: '#ffffff',
  },
  blush: {
    DEFAULT: '#ffe4e8',
    foreground: '#164087',
  },
}
```

### Typography

DM Sans is configured in `app/layout.tsx`. To change fonts:

```ts
import { YOUR_FONT } from 'next/font/google'

const yourFont = YOUR_FONT({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-your-font',
})
```

### Revalidation Time

Change cache duration in `app/flagship/[slug]/page.tsx`:

```ts
export const revalidate = 300 // seconds
```

## Print-on-demand fulfilment (Solopress + Helloprint + Cloudprinter)

Signage orders can be routed automatically to a print-on-demand provider so the team
no longer has to forward artwork manually. Items without an active mapping continue
to flow through the existing ops digest / fast-track emails — provider integration
is strictly additive.

### One-time setup

1. **Add API keys to `.env.local`** (see `.env.example`):
   - `SOLOPRESS_API_KEY`, `SOLOPRESS_WEBHOOK_SECRET`, `SOLOPRESS_ENABLED=true`
   - `HELLOPRINT_API_KEY`, `HELLOPRINT_WEBHOOK_TOKEN`, `HELLOPRINT_ENABLED=true`
   - `CLOUDPRINTER_API_KEY`, `CLOUDPRINTER_WEBHOOK_APIKEY`, `CLOUDPRINTER_ENABLED=true`
2. **Register the Solopress webhook** once per environment:
   ```bash
   SOLOPRESS_WEBHOOK_URL=https://stasher.example.com/api/webhooks/solopress \
   SOLOPRESS_WEBHOOK_SECRET="$(openssl rand -hex 32)" \
   npm run register-solopress-webhook
   ```
   Copy the returned `webhookID` into `SOLOPRESS_WEBHOOK_ID`.
3. **Tell Helloprint the callback URL** during onboarding:
   `https://stasher.example.com/api/webhooks/helloprint/<HELLOPRINT_WEBHOOK_TOKEN>`
   (Helloprint callbacks are unsigned; the token in the path is the only
   authentication, so generate it with `openssl rand -hex 32`.)
4. **Configure Cloudprinter** in the [Cloudprinter admin dashboard](https://admin.cloudprinter.com):
   - Create or open a *CloudCore API Interface* — set its mode to **Sandbox** for
     demos, **Live** for production. The displayed API key goes in
     `CLOUDPRINTER_API_KEY` (the mode is part of the key itself, so the base URL
     never changes between sandbox and live).
   - Create a *CloudSignal Webhooks* configuration with endpoint
     `https://stasher.example.com/api/webhooks/cloudprinter`. The Webhook API
     key shown there (different from the order API key) goes in
     `CLOUDPRINTER_WEBHOOK_APIKEY`.
5. **Configure catalog mappings** in
   *Dashboard → Signage → Catalog → Print provider fulfilment mappings*. Each mapping
   ties a catalog item (optionally narrowed by `option_match`) to one of:
   - **Solopress**: `provider_product` (e.g. `Flag`) + attributes
     (`material`, `size`, `colours`, `turnaround`, `noSides`, …).
   - **Helloprint**: `provider_attributes.variantKey` + `serviceLevel`
     (`saver` / `standard` / `express`).
   - **Cloudprinter**: `provider_product` (Cloudprinter product reference such as
     `panel_foamex_a4_p`, validated by the "Validate product" button) plus
     `provider_attributes`:
     ```json
     {
       "shipping_level": "cp_saver",
       "file_type": "product",
       "title": "Optional product title",
       "options": [{ "type": "total_pages", "count": "1" }]
     }
     ```

### How automation runs

- **Order placement → auto-fulfilment.** `queueGenerateSignageForOrder` (called from
  the host submit endpoint, the generic `/api/submit` route, and the dashboard
  campaign trigger) now chains directly into `fulfilSignageOrder` once the PNGs are
  uploaded. Any item with an active provider mapping is submitted to the provider
  in the same background task — no manual fast-track press required.
- Fast-track / digest runs still work for retries and one-off pushes (they call
  `fulfilSignageOrder` explicitly; the per-item `alreadyPlaced` check makes this
  idempotent).
- For each item with an active mapping, the PNG is wrapped into a print-ready PDF
  (`lib/signage-automation/render-pdf.ts`), MD5-hashed (required by Cloudprinter),
  uploaded to Drive with a public direct URL, and submitted to the provider.
- Items without a mapping are dropped from the manual ops email so they're not
  double-handled.
- Status callbacks arrive at the webhook routes which update
  `signage_provider_jobs` and roll up `signage_orders.fulfillment_status`. Each
  provider authenticates differently:
  - **Solopress** signs the body (`X-Solopress-Signature: HMAC-SHA256`).
  - **Helloprint** uses a long opaque token in the callback URL path.
  - **Cloudprinter** embeds its `apikey` in the JSON body and we timing-safe
    compare it against `CLOUDPRINTER_WEBHOOK_APIKEY`.

### Operating the integration

- *Dashboard → Signage → Orders* now shows provider job status, tracking, and lets
  ops Retry / Cancel (Solopress only) / Update address (Solopress only) for each
  order from the detail modal.
- ARTWORK_REJECTED from Helloprint sets `asset_error` on the item so it surfaces in
  the orders list for manual intervention.
- Cloudprinter does not expose customer cancel/address-update endpoints in
  CloudCore v1.0 — use the Cloudprinter admin panel before validation completes.
- Cloudprinter retries non-200 webhook responses up to 100 times over 7 days, so
  the handler returns 200 even on "unknown reference" (logged for ops).
- Unit tests for HMAC / token / apikey verification, status mapping and the mapping
  resolver live in `tests/print-providers/`; run `npm run test:print-providers`.

## License

Private - Stasher Internal Use Only


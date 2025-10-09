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

## License

Private - Stasher Internal Use Only


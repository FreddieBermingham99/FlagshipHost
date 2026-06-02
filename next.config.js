/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
  },
  experimental: {
    serverComponentsExternalPackages: [
      '@napi-rs/canvas',
      '@napi-rs/canvas/node-canvas',
      'pdfkit',
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const prev = config.externals
      const canvasExternals = [
        '@napi-rs/canvas',
        '@napi-rs/canvas/node-canvas',
        'pdfkit',
      ]
      if (Array.isArray(prev)) {
        config.externals = [...prev, ...canvasExternals]
      } else if (prev == null) {
        config.externals = canvasExternals
      } else {
        config.externals = [prev, ...canvasExternals]
      }
    }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

module.exports = nextConfig

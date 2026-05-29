/** @type {import('next').NextConfig} */
const nextConfig = {
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

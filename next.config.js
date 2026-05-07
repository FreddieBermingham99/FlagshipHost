/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const prev = config.externals
      if (Array.isArray(prev)) {
        config.externals = [...prev, '@napi-rs/canvas']
      } else if (prev == null) {
        config.externals = ['@napi-rs/canvas']
      } else {
        config.externals = [prev, '@napi-rs/canvas']
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

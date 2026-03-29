import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['irontrain.motiona.xyz']
    }
  }
};

export default nextConfig;

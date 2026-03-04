import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: ['irontrain.motiona.xyz']
    }
  }
};

export default nextConfig;

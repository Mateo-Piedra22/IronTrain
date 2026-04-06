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
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      'lucide-react/dist/esm/icons/fingerprint.js': 'lucide-react/dist/esm/icons/fingerprint-pattern.js',
    };

    return config;
  }
};

export default nextConfig;

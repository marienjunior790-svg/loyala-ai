import type { NextConfig } from 'next';

function supabaseImageHost(): string {
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
    }
  } catch {
    /* build-time placeholder */
  }
  return 'placeholder.supabase.co';
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  transpilePackages: [
    '@loyala/ui',
    '@loyala/core-iam',
    '@loyala/db',
    '@loyala/domain-crm',
    '@loyala/events',
    '@loyala/validation',
    '@loyala/integrations',
  ],
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dropdown-menu'],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: supabaseImageHost(), pathname: '/storage/v1/**' }],
    formats: ['image/avif', 'image/webp'],
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [{ key: 'X-DNS-Prefetch-Control', value: 'on' }],
    },
  ],
};

export default nextConfig;

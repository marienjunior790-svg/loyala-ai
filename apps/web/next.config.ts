import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@loyala/ui',
    '@loyala/core-iam',
    '@loyala/db',
    '@loyala/domain-crm',
    '@loyala/events',
    '@loyala/validation',
  ],
};

export default nextConfig;

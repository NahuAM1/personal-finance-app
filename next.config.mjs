/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push(
        { 'ws': 'commonjs ws' },
        { 'bufferutil': 'commonjs bufferutil' },
        { 'utf-8-validate': 'commonjs utf-8-validate' },
      );
    }
    return config;
  },
}

export default nextConfig

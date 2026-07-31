/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["web-push"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const extras = ["web-push"];
      if (Array.isArray(config.externals)) {
        config.externals.push(...extras);
      } else {
        config.externals = [config.externals, ...extras].filter(Boolean);
      }
    }
    return config;
  },
};

export default nextConfig;

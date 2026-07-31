/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["web-push", "xlsx"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const extras = ["web-push", "xlsx"];
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

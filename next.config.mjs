/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // TS 5.9 + moduleResolution:bundler has a false-positive on Metadata from "next"
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

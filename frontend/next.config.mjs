/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  eslint: {
    // Linting is run explicitly in CI.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

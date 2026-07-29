const isProduction = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build a self-contained production server (.next/standalone/server.js) that
  // bundles only the runtime files + traced node_modules it actually needs — so
  // the Docker image copies a small standalone tree instead of the whole repo +
  // full node_modules. The standalone server honors PORT/HOSTNAME env vars; the
  // container sets HOSTNAME=0.0.0.0 so it binds all interfaces (it defaults to
  // localhost otherwise). See frontend/Dockerfile.
  output: 'standalone',
  // Hides the dev-mode route indicator badge (bottom-left "N" button) — it's
  // Next.js tooling chrome, not app UI, and was showing up in every screen.
  devIndicators: false,
  // Dev-only proxy to the local backend — production must set NEXT_PUBLIC_API_URL instead
  // (see frontend/src/config/api.js), which talks to the backend directly and skips this rewrite.
  async rewrites() {
    if (isProduction) return [];
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
    ];
  },
  // Allow hot module replacement (HMR) websocket connections from local dev IPs (phone testing on same Wi-Fi)
  ...(isProduction ? {} : { allowedDevOrigins: ['172.20.10.5', '192.168.1.4', '192.168.1.4:3000', '127.0.2.2', '127.0.2.2:3000','192.168.1.45'] }),
};

export default nextConfig;

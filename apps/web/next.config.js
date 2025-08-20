/** @type {import('next').NextConfig} */
const nextConfig = {
  // Security headers configuration
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
          }
        ]
      }
    ];
  },

  // Security configuration
  poweredByHeader: false, // Remove X-Powered-By header
  
  // Strict mode for React
  reactStrictMode: true,

  // Configure allowed domains for images
  images: {
    domains: process.env.NODE_ENV === 'production' 
      ? ['planrrr.io', 'cdn.planrrr.io'] 
      : ['localhost'],
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Environment variables to expose to the browser
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },

  // Webpack configuration for additional security
  webpack: (config, { isServer }) => {
    // Add security plugins or modifications here if needed
    if (!isServer) {
      // Client-side security configurations
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        stream: false,
        buffer: false,
      };
    }
    
    return config;
  },

  // Redirects for security
  async redirects() {
    return [
      // Redirect any attempts to access internal Next.js paths
      {
        source: '/_next/:path*',
        has: [
          {
            type: 'header',
            key: 'x-middleware-subrequest',
          },
        ],
        destination: '/403',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
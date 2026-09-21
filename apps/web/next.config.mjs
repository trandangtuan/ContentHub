/** @type {import('next').NextConfig} */
const nextConfig = {
  // isomorphic-dompurify pulls in jsdom for server-side sanitization; jsdom
  // reads its default-stylesheet.css relative to __dirname at runtime, which
  // breaks if webpack bundles it. Keep it a real Node require instead.
  serverExternalPackages: ["isomorphic-dompurify", "jsdom"],
  transpilePackages: [
    "@contenthub/database",
    "@contenthub/seo",
    "@contenthub/shared",
    "@contenthub/search",
    "@contenthub/auth",
    "@contenthub/analytics",
  ],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }, { protocol: "http", hostname: "**" }],
  },
};

export default nextConfig;

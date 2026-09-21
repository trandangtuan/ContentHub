import type { Metadata } from "next";
import { getSeoConfig } from "@/lib/seo-config";
import "./globals.css";

export function generateMetadata(): Metadata {
  const config = getSeoConfig();
  const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION;

  return {
    metadataBase: new URL(config.siteUrl),
    // No `template` here: every page's title is already fully composed by
    // packages/seo's titleTemplates (which embed the site name per
    // docs/SEO.md #12) — a template would double it up.
    title: config.siteName,
    verification: googleSiteVerification ? { google: googleSiteVerification } : undefined,
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const config = getSeoConfig();
  return (
    <html lang={config.defaultLocale}>
      <body>{children}</body>
    </html>
  );
}

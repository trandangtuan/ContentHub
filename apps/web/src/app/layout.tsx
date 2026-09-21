import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { getSeoConfig } from "@/lib/seo-config";
import "./globals.css";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam-pro",
  display: "swap",
});

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
    <html lang={config.defaultLocale} className={beVietnamPro.variable}>
      <body>{children}</body>
    </html>
  );
}

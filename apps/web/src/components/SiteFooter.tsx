import { getSeoConfig } from "@/lib/seo-config";

export function SiteFooter() {
  const config = getSeoConfig();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <span>
          © {year} {config.siteName}. Nội dung do cộng đồng sáng tác.
        </span>
        <span className="row" style={{ gap: 16 }}>
          <a href="/robots.txt">robots.txt</a>
          <a href="/sitemap.xml">sitemap.xml</a>
          <a href="/llms.txt">llms.txt</a>
        </span>
      </div>
    </footer>
  );
}

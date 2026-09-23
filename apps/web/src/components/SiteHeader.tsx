import Link from "next/link";
import { getSeoConfig } from "@/lib/seo-config";
import { paths, CONTENT_TYPES } from "@contenthub/seo";
import { AuthNav } from "@/components/AuthNav";

/** Server-rendered site chrome (spec #7: reader pages stay light — only AuthNav is a client island). */
export function SiteHeader() {
  const config = getSeoConfig();

  return (
    <header className="site-header">
      <div className="container">
        <Link href={paths.home()} className="site-logo">
          {config.siteName}
        </Link>
        <nav className="site-nav" aria-label="Primary">
          {CONTENT_TYPES.map((c) => (
            <Link key={c.type} href={paths.section(c.urlPrefix)}>
              {c.label}
            </Link>
          ))}
          <Link href={paths.categoryList()}>Thể loại</Link>
          <Link href={paths.authorList()}>Tác giả</Link>
        </nav>
        <AuthNav />
      </div>
    </header>
  );
}

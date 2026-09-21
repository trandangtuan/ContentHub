import Link from "next/link";
import type { BreadcrumbItem } from "@contenthub/seo";

/** Semantic <nav> breadcrumb (docs/SEO.md #16, #28) — same trail data feeds the BreadcrumbList JSON-LD. */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={item.path}>
          {index > 0 && " > "}
          {index === items.length - 1 ? <span aria-current="page">{item.name}</span> : <Link href={item.path}>{item.name}</Link>}
        </span>
      ))}
    </nav>
  );
}

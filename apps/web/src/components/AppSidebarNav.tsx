"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarItem {
  href: string;
  label: string;
  /** Set on the "overview" root link so a sub-route (e.g. /dashboard/stories) doesn't also light it up. */
  exact?: boolean;
}

/** Active-state-aware nav links shared by the dashboard and admin sidebars. */
export function AppSidebarNav({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname();

  return (
    <nav>
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

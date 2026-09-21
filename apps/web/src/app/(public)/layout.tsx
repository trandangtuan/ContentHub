import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

/**
 * Shared chrome for every public page (home, /truyen, /tac-gia, /the-loai,
 * /tag, /login, /register). A route group — "(public)" is stripped from
 * the URL, so /truyen stays /truyen. Kept separate from /dashboard and
 * /admin so neither ships the other's nav or code.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}

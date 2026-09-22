import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

// Root-level fallback for any path outside the (public) route group (which has
// its own not-found.tsx with the same content). Kept in sync deliberately —
// this only fires for stray top-level paths, not the crawled public surface.
export default function RootNotFound() {
  return (
    <>
      <SiteHeader />
      <main className="container">
        <div className="empty-state" style={{ padding: "4rem 1rem", textAlign: "center" }}>
          <h1>Không tìm thấy trang</h1>
          <p className="text-muted">Trang bạn tìm không tồn tại, đã bị gỡ, hoặc đường dẫn không còn đúng.</p>
          <p className="row" style={{ justifyContent: "center", marginTop: "1.5rem" }}>
            <Link href="/" className="btn btn-primary">
              Về trang chủ
            </Link>
            <Link href="/truyen" className="btn">
              Danh sách truyện
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

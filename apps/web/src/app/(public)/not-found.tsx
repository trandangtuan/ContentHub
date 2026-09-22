import Link from "next/link";

// Renders inside the (public) route group's layout, so it keeps the site
// header/footer instead of Next's bare default 404 — real navigation for a
// crawler or reader who followed a stale/broken link, still a true HTTP 404.
export default function PublicNotFound() {
  return (
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
  );
}

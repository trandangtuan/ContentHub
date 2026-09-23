"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/use-session";
import { api, ApiError, type CommentRecord } from "@/lib/api-client";

interface Props {
  contentId: string;
  /** Only meaningful for a "multi" partsMode type — ties the comment to one chapter, not the whole story. */
  contentPartId?: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}

function Avatar({ name }: { name: string }) {
  return <span className="avatar-fallback">{name.charAt(0).toUpperCase()}</span>;
}

/**
 * Renders on any content's reading page (`Comment` is keyed on `Content`,
 * not on a per-type table — docs/ARCHITECTURE.md), so a new ContentType
 * gets comments for free by mounting this unchanged.
 */
export function Comments({ contentId, contentPartId }: Props) {
  const { session } = useSession();
  const [comments, setComments] = useState<CommentRecord[] | null>(null);
  const [total, setTotal] = useState(0);
  const [newBody, setNewBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.comments.list(contentId).then((res) => {
      setComments(res.items);
      setTotal(res.total);
    });
  }

  useEffect(load, [contentId]);

  async function submitComment() {
    if (!session?.csrfToken || !newBody.trim()) return;
    setError(null);
    setPosting(true);
    try {
      await api.comments.create(session.csrfToken, contentId, { body: newBody.trim(), contentPartId });
      setNewBody("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể gửi bình luận");
    } finally {
      setPosting(false);
    }
  }

  async function submitReply(parentId: string) {
    if (!session?.csrfToken || !replyBody.trim()) return;
    setError(null);
    setReplying(true);
    try {
      await api.comments.create(session.csrfToken, contentId, { body: replyBody.trim(), contentPartId, parentId });
      setReplyBody("");
      setReplyingTo(null);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể gửi trả lời");
    } finally {
      setReplying(false);
    }
  }

  async function removeComment(id: string) {
    if (!session?.csrfToken) return;
    if (!window.confirm("Xóa bình luận này?")) return;
    setBusyId(id);
    try {
      await api.comments.delete(session.csrfToken, id);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể xóa bình luận");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="stack" style={{ marginTop: "2rem" }}>
      <h2>Bình luận {total > 0 ? `(${total})` : ""}</h2>

      {session?.authenticated ? (
        <div className="stack-sm">
          <textarea
            placeholder="Viết bình luận..."
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={3}
            maxLength={2000}
          />
          <div>
            <button type="button" className="btn btn-sm btn-primary" disabled={posting || !newBody.trim()} onClick={submitComment}>
              {posting ? "Đang gửi..." : "Gửi bình luận"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">
          <Link href="/login">Đăng nhập</Link> để bình luận.
        </p>
      )}
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}

      {comments === null ? (
        <p className="text-sm text-muted">Đang tải bình luận...</p>
      ) : comments.length === 0 ? (
        <p className="empty-state">Chưa có bình luận nào — hãy là người đầu tiên.</p>
      ) : (
        <ul className="comment-list">
          {comments.map((comment) => (
            <li key={comment.id} className="comment-item">
              <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                <Avatar name={comment.author.displayName} />
                <div style={{ flex: 1 }}>
                  <p className="text-sm">
                    <strong>{comment.author.displayName}</strong> <span className="text-muted">· {formatDate(comment.createdAt)}</span>
                  </p>
                  <p>{comment.body}</p>
                  <div className="row" style={{ gap: 12 }}>
                    {session?.authenticated && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}>
                        Trả lời
                      </button>
                    )}
                    {session?.userId === comment.author.id && (
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === comment.id} onClick={() => removeComment(comment.id)}>
                        Xóa
                      </button>
                    )}
                  </div>

                  {replyingTo === comment.id && (
                    <div className="stack-sm" style={{ marginTop: 8 }}>
                      <textarea placeholder={`Trả lời ${comment.author.displayName}...`} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} rows={2} maxLength={2000} />
                      <div className="row">
                        <button type="button" className="btn btn-sm btn-primary" disabled={replying || !replyBody.trim()} onClick={() => submitReply(comment.id)}>
                          {replying ? "Đang gửi..." : "Gửi trả lời"}
                        </button>
                        <button type="button" className="btn btn-sm" onClick={() => setReplyingTo(null)}>
                          Hủy
                        </button>
                      </div>
                    </div>
                  )}

                  {comment.replies.length > 0 && (
                    <ul className="comment-list comment-replies">
                      {comment.replies.map((reply) => (
                        <li key={reply.id} className="comment-item">
                          <div className="row" style={{ gap: 8, alignItems: "flex-start" }}>
                            <Avatar name={reply.author.displayName} />
                            <div style={{ flex: 1 }}>
                              <p className="text-sm">
                                <strong>{reply.author.displayName}</strong> <span className="text-muted">· {formatDate(reply.createdAt)}</span>
                              </p>
                              <p>{reply.body}</p>
                              {session?.userId === reply.author.id && (
                                <button type="button" className="btn btn-ghost btn-sm" disabled={busyId === reply.id} onClick={() => removeComment(reply.id)}>
                                  Xóa
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

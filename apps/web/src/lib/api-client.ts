"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, body.message ?? "Request failed");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface StoryRecord {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: string;
  visibility: string;
  publishedAt: string | null;
}

export interface ChapterRecord {
  id: string;
  title: string;
  slug: string;
  position: number;
  bodyHtml: string | null;
  wordCount: number;
  readingTimeMinutes: number;
  status: string;
  publishedAt: string | null;
  scheduledAt: string | null;
}

export interface SessionInfo {
  authenticated: boolean;
  userId?: string;
  role?: string;
  creatorProfileId?: string | null;
  csrfToken?: string;
}

/** Client-side dashboard calls all go through the API (not direct Prisma) so auth/CSRF/RBAC are enforced the same way they are for any other API consumer. */
export const api = {
  getSession: () => request<SessionInfo>("/api/v1/auth/session"),
  register: (data: { email: string; password: string; displayName: string }) => request("/api/v1/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) => request("/api/v1/auth/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request("/api/v1/auth/logout", { method: "POST" }),

  withCsrf(csrfToken: string, init?: RequestInit): RequestInit {
    return { ...init, headers: { ...init?.headers, "x-csrf-token": csrfToken } };
  },

  createCreatorProfile: (csrfToken: string, data: { displayName: string; bio?: string }) =>
    request("/api/v1/creator/profile", api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify(data) })),
  getMyCreatorProfile: () => request("/api/v1/creator/me"),

  listMyStories: () => request<{ stories: StoryRecord[] }>("/api/v1/creator/stories"),
  getStory: (id: string) => request<StoryRecord>(`/api/v1/creator/stories/${id}`),
  createStory: (csrfToken: string, data: Record<string, unknown>) =>
    request<StoryRecord>("/api/v1/creator/stories", api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify(data) })),
  updateStory: (csrfToken: string, id: string, data: Record<string, unknown>) =>
    request<StoryRecord>(`/api/v1/creator/stories/${id}`, api.withCsrf(csrfToken, { method: "PATCH", body: JSON.stringify(data) })),
  publishStory: (csrfToken: string, id: string) => request(`/api/v1/creator/stories/${id}/publish`, api.withCsrf(csrfToken, { method: "POST" })),
  unpublishStory: (csrfToken: string, id: string) => request(`/api/v1/creator/stories/${id}/unpublish`, api.withCsrf(csrfToken, { method: "POST" })),

  listChapters: (storyId: string) => request<{ chapters: ChapterRecord[] }>(`/api/v1/creator/stories/${storyId}/chapters`),
  getChapter: (chapterId: string) => request<ChapterRecord>(`/api/v1/creator/chapters/${chapterId}`),
  createChapter: (csrfToken: string, storyId: string, data: Record<string, unknown>) =>
    request<ChapterRecord>(`/api/v1/creator/stories/${storyId}/chapters`, api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify(data) })),
  updateChapter: (csrfToken: string, chapterId: string, data: Record<string, unknown>) =>
    request<ChapterRecord>(`/api/v1/creator/chapters/${chapterId}`, api.withCsrf(csrfToken, { method: "PATCH", body: JSON.stringify(data) })),
  publishChapter: (csrfToken: string, chapterId: string, scheduledAt?: string) =>
    request(`/api/v1/creator/chapters/${chapterId}/publish`, api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify({ scheduledAt }) })),

  getWallet: () => request("/api/v1/creator/wallet"),
  getAnalytics: () => request("/api/v1/creator/analytics"),
};

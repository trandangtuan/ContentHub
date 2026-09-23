"use client";

import type { ContentTypeConfig } from "@contenthub/seo";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? "GET";
  // Every request declares Content-Type: application/json below, but several
  // callers (content().publish/unpublish, admin reactivateUser/reviewReport/…)
  // issue a POST with no body. Fastify rejects an empty body sent with a JSON
  // content-type, so default to "{}" for any body-carrying method.
  const needsDefaultBody = init?.body === undefined && method !== "GET" && method !== "HEAD";

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    body: needsDefaultBody ? "{}" : init?.body,
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

export type UploadPurpose = "cover" | "avatar" | "chapter-image";

export interface UploadResult {
  key: string;
  url: string;
}

/**
 * Separate from request() because a file upload must NOT get the JSON
 * Content-Type header — the browser needs to set its own
 * multipart/form-data boundary when the body is a FormData instance.
 */
async function uploadFile(csrfToken: string, purpose: UploadPurpose, file: File, contextSlug?: string): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  const query = contextSlug ? `?contextSlug=${encodeURIComponent(contextSlug)}` : "";

  const response = await fetch(`${API_URL}/api/v1/creator/uploads/${purpose}${query}`, {
    method: "POST",
    credentials: "include",
    headers: { "x-csrf-token": csrfToken },
    body: form,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, body.message ?? "Upload failed");
  }
  return response.json() as Promise<UploadResult>;
}

export interface CategoryRecord {
  id: string;
  slug: string;
  name: string;
}

export interface CreatorProfileRecord {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
}

/** Generic across every ContentType (packages/seo's registry). A "single" partsMode type's sole body lives at `parts[0]`. */
export interface ContentItemRecord {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  shortDescription?: string | null;
  coverImage?: string | null;
  status: string;
  visibility: string;
  publishedAt: string | null;
  attributes?: Record<string, unknown> | null;
  categories?: { category: CategoryRecord }[];
  parts?: PartRecord[];
  _count?: { parts: number };
}

/** A "multi" partsMode type's chapter, or a "single" type's sole body-holding part. */
export interface PartRecord {
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

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  status: string;
  createdAt: string;
  creatorProfile: { slug: string } | null;
}

export interface AdminStory {
  id: string;
  title: string;
  slug: string;
  status: string;
  visibility: string;
  deletedAt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  creator: { slug: string; displayName: string };
  seoMetadata: { noindex: boolean } | null;
}

export interface AdminReport {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reporter: { email: string; displayName: string };
  actions: { id: string; action: string; reason: string | null; createdAt: string }[];
}

export interface RevenueConfigRecord {
  id: string;
  version: number;
  creatorPoolPercentage: number;
  platformPercentage: number;
  fraudReservePercentage: number;
  minimumPayoutThresholdCents: string;
  currency: string;
  effectiveFrom: string;
  createdAt: string;
}

export interface PayoutRecord {
  id: string;
  creatorId: string;
  amountCents: string;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  requestedAt: string;
  processedAt: string | null;
  failureReason: string | null;
  creator: { slug: string; displayName: string };
  payoutAccount: { provider: string };
}

export interface SeoHealth {
  totalPublic: number;
  missingDescription: number;
  missingCover: number;
  noindexed: number;
  duplicateSlugs: number;
  publishedWithoutChapters: number;
}

export interface AdminStats {
  users: number;
  creators: number;
  stories: number;
  chapters: number;
  openReports: number;
  pendingPayouts: number;
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
  getMyCreatorProfile: () => request<CreatorProfileRecord>("/api/v1/creator/me"),
  updateMyCreatorProfile: (csrfToken: string, data: { bio?: string; avatarUrl?: string }) =>
    request<CreatorProfileRecord>("/api/v1/creator/profile", api.withCsrf(csrfToken, { method: "PATCH", body: JSON.stringify(data) })),

  uploadFile,

  listCategories: () => request<{ categories: CategoryRecord[] }>("/api/v1/creator/categories"),
  createCategory: (csrfToken: string, name: string) =>
    request<CategoryRecord>("/api/v1/creator/categories", api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify({ name }) })),

  /**
   * One factory bound to a ContentType's registry config (packages/seo) —
   * every dashboard/[section] page calls the same methods regardless of
   * type. A new type needs no new client methods, only a registry entry.
   */
  content(config: ContentTypeConfig) {
    const base = `/api/v1/creator/${config.apiResource}`;
    const partsBase = config.partsApiResource ? `/api/v1/creator/${config.partsApiResource}` : undefined;

    return {
      list: () => request<Record<string, ContentItemRecord[]>>(base).then((r) => r[config.apiResource]!),
      get: (id: string) => request<ContentItemRecord>(`${base}/${id}`),
      create: (csrfToken: string, data: Record<string, unknown>) => request<ContentItemRecord>(base, api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify(data) })),
      update: (csrfToken: string, id: string, data: Record<string, unknown>) =>
        request<ContentItemRecord>(`${base}/${id}`, api.withCsrf(csrfToken, { method: "PATCH", body: JSON.stringify(data) })),
      publish: (csrfToken: string, id: string) => request<ContentItemRecord>(`${base}/${id}/publish`, api.withCsrf(csrfToken, { method: "POST" })),
      unpublish: (csrfToken: string, id: string) => request<ContentItemRecord>(`${base}/${id}/unpublish`, api.withCsrf(csrfToken, { method: "POST" })),
      delete: (csrfToken: string, id: string) => request<void>(`${base}/${id}`, api.withCsrf(csrfToken, { method: "DELETE" })),

      // Only meaningful for a "multi" partsMode type.
      listParts: (itemId: string) => request<Record<string, PartRecord[]>>(`${base}/${itemId}/${config.partsApiResource}`).then((r) => r[config.partsApiResource!]!),
      getPart: (partId: string) => request<PartRecord>(`${partsBase}/${partId}`),
      createPart: (csrfToken: string, itemId: string, data: Record<string, unknown>) =>
        request<PartRecord>(`${base}/${itemId}/${config.partsApiResource}`, api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify(data) })),
      updatePart: (csrfToken: string, partId: string, data: Record<string, unknown>) =>
        request<PartRecord>(`${partsBase}/${partId}`, api.withCsrf(csrfToken, { method: "PATCH", body: JSON.stringify(data) })),
      publishPart: (csrfToken: string, partId: string, scheduledAt?: string) =>
        request<PartRecord>(`${partsBase}/${partId}/publish`, api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify({ scheduledAt }) })),
      unpublishPart: (csrfToken: string, partId: string) => request<PartRecord>(`${partsBase}/${partId}/unpublish`, api.withCsrf(csrfToken, { method: "POST" })),
      deletePart: (csrfToken: string, partId: string) => request<void>(`${partsBase}/${partId}`, api.withCsrf(csrfToken, { method: "DELETE" })),
    };
  },

  getWallet: () => request("/api/v1/creator/wallet"),
  getAnalytics: () => request("/api/v1/creator/analytics"),

  admin: {
    getStats: () => request<AdminStats>("/api/v1/admin/stats"),

    listUsers: (params: { status?: string; role?: string; q?: string; limit?: number; offset?: number } = {}) =>
      request<{ items: AdminUser[]; total: number }>(`/api/v1/admin/users?${new URLSearchParams(params as Record<string, string>)}`),
    suspendUser: (csrfToken: string, id: string, reason: string) =>
      request<AdminUser>(`/api/v1/admin/users/${id}/suspend`, api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify({ reason }) })),
    reactivateUser: (csrfToken: string, id: string) =>
      request<AdminUser>(`/api/v1/admin/users/${id}/reactivate`, api.withCsrf(csrfToken, { method: "POST" })),

    listStories: (params: { status?: string; q?: string; limit?: number; offset?: number } = {}) =>
      request<{ items: AdminStory[]; total: number }>(`/api/v1/admin/stories?${new URLSearchParams(params as Record<string, string>)}`),
    storyAction: (csrfToken: string, id: string, action: "publish" | "unpublish" | "delete" | "restore" | "noindex", reason?: string) =>
      request<AdminStory>(`/api/v1/admin/stories/${id}/${action}`, api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify({ reason }) })),

    listReports: (params: { status?: string; limit?: number; offset?: number } = {}) =>
      request<{ items: AdminReport[]; total: number }>(`/api/v1/admin/reports?${new URLSearchParams(params as Record<string, string>)}`),
    reviewReport: (csrfToken: string, id: string) => request<AdminReport>(`/api/v1/admin/reports/${id}/review`, api.withCsrf(csrfToken, { method: "POST" })),
    rejectReport: (csrfToken: string, id: string) => request<AdminReport>(`/api/v1/admin/reports/${id}/reject`, api.withCsrf(csrfToken, { method: "POST" })),
    resolveReportWithAction: (csrfToken: string, id: string, body: { targetType: string; targetId: string; action: string; reason?: string }) =>
      request(`/api/v1/admin/reports/${id}/action`, api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify(body) })),

    listRevenueConfigs: () => request<{ items: RevenueConfigRecord[] }>("/api/v1/admin/revenue-configs"),
    createRevenueConfig: (
      csrfToken: string,
      data: { creatorPoolPercentage: number; platformPercentage: number; fraudReservePercentage: number; minimumPayoutThresholdCents: string; currency: string; effectiveFrom: string },
    ) => request<RevenueConfigRecord>("/api/v1/admin/revenue-configs", api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify(data) })),

    adjustWallet: (csrfToken: string, creatorId: string, amountCents: string, description: string) =>
      request(`/api/v1/admin/creators/${creatorId}/wallet/adjust`, api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify({ amountCents, description }) })),

    listPayouts: (params: { status?: string; limit?: number; offset?: number } = {}) =>
      request<{ items: PayoutRecord[]; total: number }>(`/api/v1/admin/payouts?${new URLSearchParams(params as Record<string, string>)}`),
    setPayoutStatus: (csrfToken: string, id: string, status: "PROCESSING" | "PAID" | "FAILED" | "REVERSED", failureReason?: string) =>
      request<PayoutRecord>(`/api/v1/admin/payouts/${id}/status`, api.withCsrf(csrfToken, { method: "POST", body: JSON.stringify({ status, failureReason }) })),

    getSeoHealth: () => request<SeoHealth>("/api/v1/admin/seo-health"),
  },
};

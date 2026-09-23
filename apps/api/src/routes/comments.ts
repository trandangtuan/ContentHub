import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@contenthub/database";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors.js";

// Matches docs/DATABASE.md's note that `depth` is denormalized so replies
// past a configured max can be rejected cheaply, without a recursive query.
// 1 = a reply can answer a top-level comment, but not another reply.
const MAX_COMMENT_DEPTH = 1;

const userSelect = { id: true, displayName: true, avatarUrl: true } as const;

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  contentPartId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
});

type CommentWithAuthor = {
  id: string;
  body: string;
  depth: number;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; displayName: string; avatarUrl: string | null };
  replies?: CommentWithAuthor[];
};

interface SerializedComment {
  id: string;
  body: string;
  depth: number;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; displayName: string; avatarUrl: string | null };
  replies: SerializedComment[];
}

function serializeComment(comment: CommentWithAuthor): SerializedComment {
  return {
    id: comment.id,
    body: comment.body,
    depth: comment.depth,
    parentId: comment.parentId,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    author: comment.user,
    replies: (comment.replies ?? []).map(serializeComment),
  };
}

async function requireCommentableContent(contentId: string) {
  const content = await prisma.content.findFirst({ where: { id: contentId, status: "PUBLISHED", visibility: "PUBLIC", deletedAt: null } });
  if (!content) throw new NotFoundError("Content not found");
  return content;
}

/**
 * Comments are keyed on `Content` (docs/ARCHITECTURE.md — every ContentType
 * shares the same Content row shape), so one route set covers every type —
 * a new ContentType needs no comment-specific code.
 */
export function registerCommentRoutes(app: FastifyInstance) {
  app.get("/content/:contentId/comments", async (request) => {
    const { contentId } = z.object({ contentId: z.string().uuid() }).parse(request.params);
    const query = listQuerySchema.parse(request.query);
    await requireCommentableContent(contentId);

    const where = { contentId, parentId: null, status: "PUBLISHED" as const, deletedAt: null };
    const [comments, total] = await Promise.all([
      prisma.comment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit,
        skip: query.offset,
        include: {
          user: { select: userSelect },
          replies: {
            where: { status: "PUBLISHED", deletedAt: null },
            orderBy: { createdAt: "asc" },
            include: { user: { select: userSelect } },
          },
        },
      }),
      prisma.comment.count({ where }),
    ]);

    return { items: comments.map(serializeComment), total, limit: query.limit, offset: query.offset };
  });

  app.post("/content/:contentId/comments", async (request, reply) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { contentId } = z.object({ contentId: z.string().uuid() }).parse(request.params);
    const body = createCommentSchema.parse(request.body);
    await requireCommentableContent(contentId);

    let depth = 0;
    if (body.parentId) {
      const parent = await prisma.comment.findFirst({ where: { id: body.parentId, contentId, deletedAt: null } });
      if (!parent) throw new NotFoundError("Comment not found");
      if (parent.depth >= MAX_COMMENT_DEPTH) throw new ValidationError(`Replies can only be nested ${MAX_COMMENT_DEPTH} level(s) deep`);
      depth = parent.depth + 1;
    }

    if (body.contentPartId) {
      const part = await prisma.contentPart.findFirst({ where: { id: body.contentPartId, contentId, status: "PUBLISHED", deletedAt: null } });
      if (!part) throw new NotFoundError("Part not found");
    }

    const comment = await prisma.comment.create({
      data: {
        contentId,
        contentPartId: body.contentPartId,
        userId: session.userId,
        parentId: body.parentId,
        depth,
        body: body.body,
      },
      include: { user: { select: userSelect } },
    });

    reply.status(201);
    return serializeComment({ ...comment, replies: [] });
  });

  app.delete("/comments/:id", async (request, reply) => {
    const session = app.requireAuth(request);
    app.requireCsrf(request);
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.deletedAt) throw new NotFoundError("Comment not found");
    const isOwner = comment.userId === session.userId;
    const isModerator = session.role === "MODERATOR" || session.role === "ADMIN";
    if (!isOwner && !isModerator) throw new ForbiddenError();

    await prisma.comment.update({ where: { id }, data: { status: "DELETED", deletedAt: new Date() } });
    reply.status(204).send();
  });
}

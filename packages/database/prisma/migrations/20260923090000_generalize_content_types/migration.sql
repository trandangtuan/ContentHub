-- Generalizes the per-ContentType extension tables into a single pattern
-- (packages/seo's content-types registry), so a new ContentType with only
-- scalar metadata needs no new table/migration, and every type's body reuses
-- ContentPart (previously ARTICLE stored its body on its own `articles`
-- table instead).

-- AlterTable: generic type-specific metadata bag (replaces `stories.subtitle`/`age_rating`)
ALTER TABLE "contents" ADD COLUMN "attributes" JSONB;

-- Data migration: stories.subtitle/age_rating -> contents.attributes
UPDATE "contents" c
SET "attributes" = jsonb_strip_nulls(jsonb_build_object('subtitle', s.subtitle, 'ageRating', s.age_rating))
FROM "stories" s
WHERE s.content_id = c.id AND (s.subtitle IS NOT NULL OR s.age_rating IS NOT NULL);

-- Data migration: articles.* -> one content_parts row per article (position 1,
-- fixed slug "content" — never rendered in a URL for a single-part type).
INSERT INTO "content_parts" (id, content_id, title, slug, position, body_json, body_html, word_count, reading_time_minutes, status, published_at, created_at, updated_at)
SELECT gen_random_uuid(), c.id, c.title, 'content', 1, a.body_json, a.body_html, a.word_count, a.reading_time_minutes,
  CASE c.status WHEN 'PUBLISHED' THEN 'PUBLISHED'::"ContentPartStatus" WHEN 'UNPUBLISHED' THEN 'UNPUBLISHED'::"ContentPartStatus" ELSE 'DRAFT'::"ContentPartStatus" END,
  c.published_at, a.created_at, a.updated_at
FROM "articles" a
JOIN "contents" c ON c.id = a.content_id;

-- DropForeignKey
ALTER TABLE "articles" DROP CONSTRAINT "articles_content_id_fkey";

-- DropForeignKey
ALTER TABLE "stories" DROP CONSTRAINT "stories_content_id_fkey";

-- DropTable
DROP TABLE "articles";

-- DropTable
DROP TABLE "stories";

-- Keep contents.search_vector in sync with title/short_description/description.
-- MVP full-text search target (see packages/search). Weighted: title heaviest.
CREATE OR REPLACE FUNCTION contents_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.short_description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contents_search_vector_trigger ON contents;
CREATE TRIGGER contents_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, short_description, description ON contents
  FOR EACH ROW EXECUTE FUNCTION contents_search_vector_update();

-- Backfill existing rows.
UPDATE contents SET title = title;

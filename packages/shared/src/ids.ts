import { v7 as uuidv7 } from "uuid";

/**
 * Time-ordered UUID for application-generated ids where insertion order
 * matters for index locality (e.g. queue job ids, event ids created before
 * they reach Postgres). Database primary keys use Postgres' gen_random_uuid()
 * directly; this is for the rarer case of generating an id client-side.
 */
export function generateId(): string {
  return uuidv7();
}

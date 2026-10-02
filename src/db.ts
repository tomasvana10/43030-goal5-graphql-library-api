import path from "node:path";

export type Db = {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
};

const SCHEMA = `
  create table if not exists books (
    id serial primary key,
    title text not null,
    author text not null
  );
  create table if not exists members (
    id serial primary key,
    name text not null
  );
  create table if not exists loans (
    id serial primary key,
    book_id integer not null unique references books,
    member_id integer not null references members
  );
`;

export async function openDb({
  url,
  dataDir,
}: {
  url?: string;
  dataDir?: string;
}): Promise<Db> {
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url });
    await pool.query(SCHEMA);
    return {
      query: async <T>(text: string, params?: unknown[]) => ({
        rows: (await pool.query(text, params)).rows as T[],
      }),
      close: () => pool.end(),
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const client = await PGlite.create(dataDir);
  await client.exec(SCHEMA);
  return {
    query: <T>(text: string, params?: unknown[]) =>
      client.query<T>(text, params),
    close: () => client.close(),
  };
}

const shared = globalThis as typeof globalThis & { libraryDb?: Promise<Db> };

export function getDb() {
  shared.libraryDb ??= openDb({
    url: process.env.DATABASE_URL,
    dataDir: path.join(process.cwd(), ".data"),
  }).catch((error) => {
    shared.libraryDb = undefined;
    throw error;
  });
  return shared.libraryDb;
}

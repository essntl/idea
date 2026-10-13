/**
 * Applies pending SQL migrations from prisma/migrations at container start.
 *
 * A small replacement for `prisma migrate deploy` (the Prisma CLI would add ~265 MB to the image).
 * It uses Prisma's own `_prisma_migrations` table and checksums (SHA-256 of migration.sql),
 * so the two are interchangeable: `prisma migrate status/deploy` keeps working against the same database.
 */
import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const LOCK_ID = 72707369; // arbitrary constant for pg_advisory_lock

async function main() {
  const dir = path.resolve(process.argv[2] ?? "prisma/migrations");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        "id" VARCHAR(36) PRIMARY KEY NOT NULL,
        "checksum" VARCHAR(64) NOT NULL,
        "finished_at" TIMESTAMPTZ,
        "migration_name" VARCHAR(255) NOT NULL,
        "logs" TEXT,
        "rolled_back_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )`);

    const { rows } = await client.query<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>(
      `SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`,
    );
    const failed = rows.filter((r) => !r.finished_at && !r.rolled_back_at);
    if (failed.length) {
      throw new Error(
        `A previous migration failed and needs attention: ${failed.map((r) => r.migration_name).join(", ")}. ` +
          `Fix the database, then mark it resolved (npx prisma migrate resolve --rolled-back <name>).`,
      );
    }
    const applied = new Map(rows.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => [r.migration_name, r.checksum]));

    const names = (await readdir(dir, { withFileTypes: true }))
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    let count = 0;
    for (const name of names) {
      const sql = await readFile(path.join(dir, name, "migration.sql"), "utf8").catch(() => null);
      if (sql === null) continue;
      const checksum = createHash("sha256").update(sql).digest("hex");
      if (applied.has(name)) {
        if (applied.get(name) !== checksum) console.warn(`  ! ${name} was modified after it was applied (checksum differs)`);
        continue;
      }
      const id = randomUUID();
      console.log(`  applying ${name}`);
      await client.query(`INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, applied_steps_count) VALUES ($1, $2, $3, now(), 0)`, [id, checksum, name]);
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query(`UPDATE "_prisma_migrations" SET finished_at = now(), applied_steps_count = 1 WHERE id = $1`, [id]);
        await client.query("COMMIT");
        count++;
      } catch (err) {
        await client.query("ROLLBACK");
        await client.query(`UPDATE "_prisma_migrations" SET logs = $2 WHERE id = $1`, [id, String((err as Error).stack ?? err)]);
        throw new Error(`Migration ${name} failed: ${(err as Error).message}`);
      }
    }
    console.log(count ? `  ${count} migration(s) applied` : "  database is up to date");
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    await client.end();
  }
}

main().catch((err) => {
  console.error(`x ${(err as Error).message}`);
  process.exit(1);
});

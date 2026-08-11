#!/usr/bin/env node
/**
 * Applies supabase/migrations/*.sql to the Supabase Postgres database.
 *
 * Not the Supabase CLI: `supabase db push` insists on 14-digit timestamp
 * filenames, and renaming nine already-applied migrations (referenced by
 * number throughout the code comments and docs) to satisfy it would risk
 * re-running schema changes against production for no benefit.
 *
 * Applied migrations are tracked in public.schema_migrations, each runs
 * inside its own transaction, and a session-level advisory lock stops two
 * runs (a teammate and a deploy hook, say) from racing.
 *
 * Usage:
 *   npm run db:status              list applied / pending
 *   npm run db:migrate             apply everything pending
 *   npm run db:migrate -- --dry-run   print what would run, change nothing
 *   npm run db:baseline -- --through 008
 *                                  mark 001–008 as applied WITHOUT running
 *                                  them, for a database already migrated by
 *                                  hand. Omitting --through baselines every
 *                                  pending file, which is wrong if some of
 *                                  them genuinely haven't run yet.
 *
 * Needs SUPABASE_DB_URL — Supabase Dashboard → Project Settings →
 * Database → Connection string. Use the session-mode pooler (port 5432)
 * or the direct connection; the transaction-mode pooler on 6543 can't
 * run this reliably.
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");

// Arbitrary but fixed — any value works as long as every runner uses the
// same one.
const ADVISORY_LOCK_KEY = 8_472_119_003;

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const BASELINE = args.includes("--baseline");
const STATUS_ONLY = args.includes("--status");

// --through 008 / --through 008_drop_whatsapp_connection.sql — matched as
// a filename prefix, so the leading number alone is enough.
const throughIndex = args.indexOf("--through");
const THROUGH = throughIndex === -1 ? null : args[throughIndex + 1];

// ── .env loading ─────────────────────────────────────────────────
// Next.js loads these itself; a standalone node script doesn't. Parsed
// here rather than pulling in dotenv for twenty lines of work.
function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue; // real env wins
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// .env.local overrides .env, matching Next.js precedence. Tracked so the
// "not set" error can name the file that actually exists rather than
// guessing at one the project doesn't use.
const ENV_FILES = [".env.local", ".env"];
const loadedEnvFiles = ENV_FILES.filter((f) => {
  const full = path.join(ROOT, f);
  const exists = existsSync(full);
  if (exists) loadEnvFile(full);
  return exists;
});

// ── Helpers ──────────────────────────────────────────────────────
const color = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

/**
 * Throws rather than calling process.exit, so the connection still closes
 * and stdout still flushes — process.exit truncates piped output, which
 * loses exactly the error text you need when this runs in CI.
 */
class MigrateError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

function fail(message, hint) {
  throw new MigrateError(message, hint);
}

function checksum(contents) {
  return createHash("sha256").update(contents).digest("hex").slice(0, 16);
}

async function readMigrations() {
  const entries = await readdir(MIGRATIONS_DIR);
  const files = entries.filter((f) => f.endsWith(".sql")).sort();

  return Promise.all(
    files.map(async (name) => {
      const sql = await readFile(path.join(MIGRATIONS_DIR, name), "utf8");
      return { name, sql, checksum: checksum(sql) };
    })
  );
}

function redactUrl(url) {
  return url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:****@");
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    // The project ref is public (it's in NEXT_PUBLIC_SUPABASE_URL), so
    // echoing it back is safe and saves hunting for the right project in
    // a dashboard with several.
    const projectRef =
      process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;
    const targetFile = loadedEnvFiles[0] ?? ".env.local";

    fail(
      `SUPABASE_DB_URL is not set${
        loadedEnvFiles.length > 0 ? ` in ${loadedEnvFiles.join(" or ")}` : " (no env file found)"
      }.`,
      [
        `Add it to ${targetFile} (gitignored — it contains the database password):`,
        "",
        color.dim(
          `  SUPABASE_DB_URL="postgresql://postgres.${projectRef ?? "<ref>"}:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"`
        ),
        "",
        "Copy the real string from the Supabase Dashboard: press Connect (top of the",
        "project page) and take the URI under Session pooler — it already has the",
        "right host and region, so you only fill in the database password.",
        "",
        "Use the session-mode pooler (port 5432) or the direct connection —",
        "the transaction-mode pooler on port 6543 cannot run migrations reliably.",
        ...(projectRef ? ["", color.dim(`This project's ref is ${projectRef}.`)] : []),
      ].join("\n")
    );
  }

  if (connectionString.includes(":6543")) {
    console.warn(
      color.yellow(
        "! SUPABASE_DB_URL points at port 6543 (transaction-mode pooler). Migrations may fail — " +
          "prefer the session-mode pooler or direct connection on port 5432."
      )
    );
  }

  const migrations = await readMigrations();
  if (migrations.length === 0) fail(`No .sql files found in ${MIGRATIONS_DIR}`);

  const client = new pg.Client({
    connectionString,
    // Supabase terminates TLS with a chain node doesn't ship a root for.
    // The connection is still encrypted; only chain verification is
    // relaxed, which is what every Supabase client does here.
    ssl: { rejectUnauthorized: false },
    application_name: "petra-paws-migrate",
  });

  try {
    await client.connect();
  } catch (err) {
    fail(
      `Could not connect to the database: ${err.message}`,
      `Connection string used: ${color.dim(redactUrl(connectionString))}`
    );
  }

  console.log(`${color.dim("→")} Connected to ${color.dim(redactUrl(connectionString))}\n`);

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        name       text PRIMARY KEY,
        checksum   text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const { rows: appliedRows } = await client.query(
      "SELECT name, checksum, applied_at FROM public.schema_migrations"
    );
    const applied = new Map(appliedRows.map((r) => [r.name, r]));

    const pending = migrations.filter((m) => !applied.has(m.name));

    // An edited migration that already ran means the file no longer
    // describes the live schema — worth surfacing loudly, but not worth
    // blocking on, since it changes nothing about what runs next.
    for (const migration of migrations) {
      const record = applied.get(migration.name);
      if (record && record.checksum !== migration.checksum) {
        console.warn(
          color.yellow(
            `! ${migration.name} has changed since it was applied ` +
              `(${record.checksum} → ${migration.checksum}). ` +
              `Add a new migration instead of editing an applied one.`
          )
        );
      }
    }

    // ── Status ─────────────────────────────────────────────────────
    if (STATUS_ONLY) {
      console.log(color.bold("Migrations"));
      for (const migration of migrations) {
        const record = applied.get(migration.name);
        console.log(
          record
            ? `  ${color.green("✓")} ${migration.name} ${color.dim(
                `applied ${new Date(record.applied_at).toISOString()}`
              )}`
            : `  ${color.yellow("•")} ${migration.name} ${color.dim("pending")}`
        );
      }
      console.log(
        `\n${applied.size} applied, ${pending.length} pending.${
          pending.length > 0 ? " Run `npm run db:migrate` to apply." : ""
        }`
      );
      return;
    }

    // ── Baseline ───────────────────────────────────────────────────
    if (BASELINE) {
      if (pending.length === 0) {
        console.log("Nothing to baseline — every migration is already recorded.");
        return;
      }

      let toBaseline = pending;
      if (THROUGH) {
        const cutoff = migrations.findIndex((m) => m.name.startsWith(THROUGH));
        if (cutoff === -1) {
          fail(
            `No migration matches --through "${THROUGH}".`,
            "Available:\n" + migrations.map((m) => `  ${m.name}`).join("\n")
          );
        }
        const included = new Set(migrations.slice(0, cutoff + 1).map((m) => m.name));
        toBaseline = pending.filter((m) => included.has(m.name));
      }

      if (toBaseline.length === 0) {
        console.log(`Nothing to baseline up to "${THROUGH}" — already recorded.`);
        return;
      }

      console.log(
        color.bold("Baselining") +
          " — recording these as applied WITHOUT running them:\n" +
          toBaseline.map((m) => `  ${m.name}`).join("\n")
      );

      const stillPending = pending.filter((m) => !toBaseline.includes(m));
      if (stillPending.length > 0) {
        console.log(
          color.dim("\nLeft pending, to be applied by `npm run db:migrate`:\n") +
            stillPending.map((m) => color.dim(`  ${m.name}`)).join("\n")
        );
      }

      console.log(
        color.dim(
          "\nOnly correct for migrations whose schema already exists in the " +
            "database (e.g. pasted into the SQL Editor by hand). Anything " +
            "baselined by mistake will never run.\n"
        )
      );

      if (DRY_RUN) {
        console.log(color.yellow("Dry run — nothing recorded."));
        return;
      }

      for (const migration of toBaseline) {
        await client.query(
          "INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING",
          [migration.name, migration.checksum]
        );
      }
      console.log(color.green(`✓ Baselined ${toBaseline.length} migration(s).`));
      return;
    }

    // ── Apply ──────────────────────────────────────────────────────
    if (pending.length === 0) {
      console.log(color.green("✓ Database is up to date — nothing to apply."));
      return;
    }

    // The existing production database was migrated by hand through the SQL
    // Editor, long before this tracker existed. Running 001 against it
    // would fail on "relation already exists" — safely rolled back, but
    // baffling. Catch it here and name the fix instead.
    if (applied.size === 0) {
      const { rows } = await client.query(
        "SELECT to_regclass('public.appointments') IS NOT NULL AS schema_exists"
      );
      if (rows[0].schema_exists) {
        const lastApplied = migrations.at(-2)?.name ?? migrations[0].name;
        fail(
          "This database already has the app's schema, but no migrations are recorded.",
          [
            "It was migrated by hand before this tracker existed, so applying 001 would fail.",
            "",
            "Record the migrations that already ran, then apply only the new ones:",
            "",
            color.dim(`  npm run db:baseline -- --through <last-applied>   # e.g. 008`),
            color.dim(`  npm run db:migrate`),
            "",
            `Check the Supabase Table Editor to confirm which was last applied.`,
            `Newest file here is ${migrations.at(-1)?.name}; the one before it is ${lastApplied}.`,
          ].join("\n")
        );
      }
    }

    console.log(`${color.bold("Pending")} (${pending.length}):`);
    for (const migration of pending) console.log(`  ${migration.name}`);
    console.log();

    if (DRY_RUN) {
      console.log(color.yellow("Dry run — nothing was applied."));
      return;
    }

    // Session-level, so a crashed run releases it when the connection
    // drops rather than wedging every future run.
    const { rows: lockRows } = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [
      ADVISORY_LOCK_KEY,
    ]);
    if (!lockRows[0].locked) {
      fail("Another migration run holds the lock. Wait for it to finish and try again.");
    }

    try {
      for (const migration of pending) {
        process.stdout.write(`  ${migration.name} … `);

        // One transaction per migration: a failure leaves that migration
        // fully rolled back, so the file can be fixed and re-run rather
        // than leaving half a schema change behind.
        await client.query("BEGIN");
        try {
          await client.query(migration.sql);
          await client.query(
            "INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)",
            [migration.name, migration.checksum]
          );
          await client.query("COMMIT");
          console.log(color.green("done"));
        } catch (err) {
          await client.query("ROLLBACK").catch(() => {});
          console.log(color.red("failed"));
          fail(
            `${migration.name} failed and was rolled back: ${err.message}`,
            err.hint ? `Postgres hint: ${err.hint}` : undefined
          );
        }
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => {});
    }

    console.log(`\n${color.green("✓")} Applied ${pending.length} migration(s).`);
  } finally {
    await client.end().catch(() => {});
  }
}

try {
  await main();
} catch (err) {
  console.error(`\n${color.red("✖")} ${err.message}`);
  if (err instanceof MigrateError && err.hint) console.error(`\n${err.hint}\n`);
  else if (!(err instanceof MigrateError) && err.stack) console.error(color.dim(err.stack));
  process.exitCode = 1;
}

import { pool } from './postgres'

export async function runMigrations() {
  if (!process.env.DATABASE_URL) return
  const client = await pool.connect()
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Business" (
        "id"        TEXT NOT NULL PRIMARY KEY,
        "name"      TEXT NOT NULL,
        "location"  TEXT NOT NULL DEFAULT '',
        "join_code" TEXT NOT NULL UNIQUE
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id"          TEXT NOT NULL PRIMARY KEY,
        "name"        TEXT NOT NULL,
        "email"       TEXT NOT NULL UNIQUE,
        "role"        TEXT NOT NULL,
        "color"       TEXT NOT NULL,
        "phone"       TEXT,
        "business_id" TEXT NOT NULL REFERENCES "Business"("id")
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Shift" (
        "id"                   TEXT NOT NULL PRIMARY KEY,
        "business_id"          TEXT NOT NULL REFERENCES "Business"("id"),
        "date"                 TEXT NOT NULL,
        "start_time"           TEXT NOT NULL,
        "end_time"             TEXT NOT NULL,
        "role_needed"          TEXT NOT NULL,
        "assigned_employee_id" TEXT,
        "status"               TEXT NOT NULL,
        "notes"                TEXT
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "WorkLog" (
        "id"            TEXT NOT NULL PRIMARY KEY,
        "employee_id"   TEXT NOT NULL REFERENCES "User"("id"),
        "employee_name" TEXT NOT NULL,
        "business_id"   TEXT NOT NULL REFERENCES "Business"("id"),
        "date"          TEXT NOT NULL,
        "clock_in"      TEXT NOT NULL,
        "clock_out"     TEXT NOT NULL,
        "hours"         DOUBLE PRECISION NOT NULL,
        "notes"         TEXT
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ShiftApplication" (
        "id"            TEXT NOT NULL PRIMARY KEY,
        "shift_id"      TEXT NOT NULL REFERENCES "Shift"("id"),
        "employee_id"   TEXT NOT NULL,
        "employee_name" TEXT NOT NULL,
        "business_id"   TEXT NOT NULL REFERENCES "Business"("id"),
        "status"        TEXT NOT NULL DEFAULT 'pending',
        "created_at"    TEXT NOT NULL
      )
    `)
    await client.query(`ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS positions TEXT NOT NULL DEFAULT '[]'`)
    await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS password_hash TEXT`)
    await client.query(`ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS recurring_group_id TEXT`)

    // ── Branch (multi-pobočka) ──────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Branch" (
        "id"          TEXT NOT NULL PRIMARY KEY,
        "name"        TEXT NOT NULL,
        "address"     TEXT NOT NULL DEFAULT '',
        "business_id" TEXT NOT NULL REFERENCES "Business"("id"),
        "created_at"  TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS "Branch_business_id_idx" ON "Branch"("business_id")`)

    // ── EmployeeBranch (junction with permissions) ──────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS "EmployeeBranch" (
        "id"          TEXT NOT NULL PRIMARY KEY,
        "user_id"     TEXT NOT NULL REFERENCES "User"("id"),
        "branch_id"   TEXT NOT NULL REFERENCES "Branch"("id"),
        "role"        TEXT NOT NULL DEFAULT 'employee',
        "permissions" TEXT[] NOT NULL DEFAULT '{}',
        UNIQUE("user_id", "branch_id")
      )
    `)
    await client.query(`CREATE INDEX IF NOT EXISTS "EmployeeBranch_branch_id_idx" ON "EmployeeBranch"("branch_id")`)

    // ── Shift extensions ────────────────────────────────────────────────────
    await client.query(`ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "branch_id" TEXT REFERENCES "Branch"("id")`)
    await client.query(`ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "actual_start" TEXT`)
    await client.query(`ALTER TABLE "Shift" ADD COLUMN IF NOT EXISTS "actual_end" TEXT`)
    await client.query(`CREATE INDEX IF NOT EXISTS "Shift_branch_id_idx" ON "Shift"("branch_id")`)

    console.log('[migrate] Migrations completed')
  } catch (e) {
    console.error('[migrate] Migration error:', e)
  } finally {
    client.release()
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { pool } from '@/lib/postgres'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== 'ksh-init-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Debug: check if DATABASE_URL is set
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    return NextResponse.json({ error: 'DATABASE_URL is not set' }, { status: 500 })
  }

  let client
  try {
    client = await pool.connect()
  } catch (e: any) {
    return NextResponse.json({ error: 'DB connect failed', detail: e.message }, { status: 500 })
  }

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
      CREATE TABLE IF NOT EXISTS "QrToken" (
        "id"          TEXT NOT NULL PRIMARY KEY,
        "business_id" TEXT NOT NULL,
        "token"       TEXT NOT NULL,
        "expires_at"  TIMESTAMPTZ NOT NULL,
        "created_at"  TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ClockSession" (
        "id"            TEXT NOT NULL PRIMARY KEY,
        "business_id"   TEXT NOT NULL,
        "employee_id"   TEXT NOT NULL,
        "employee_name" TEXT NOT NULL,
        "date"          TEXT NOT NULL,
        "clock_in"      TEXT NOT NULL,
        "clock_out"     TEXT,
        "hours"         DOUBLE PRECISION,
        "created_at"    TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    // Idempotent migrations for new columns
    await client.query(`ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS positions TEXT NOT NULL DEFAULT '[]'`)
    await client.query(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS password_hash TEXT`)

    // ShiftApplication table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ShiftApplication" (
        "id"            TEXT NOT NULL PRIMARY KEY,
        "shift_id"      TEXT NOT NULL,
        "employee_id"   TEXT NOT NULL,
        "employee_name" TEXT NOT NULL,
        "business_id"   TEXT NOT NULL,
        "status"        TEXT NOT NULL DEFAULT 'approved',
        "created_at"    TEXT NOT NULL
      )
    `)

    // Ensure demo businesses exist in DB (so join codes 111111/222222/333333 work)
    const demoBiz = [
      { id: 'biz-1', name: 'Kavárna Aroma', location: 'Praha', code: '111111' },
      { id: 'biz-2', name: 'Bistro Dvůr', location: 'Brno', code: '222222' },
      { id: 'biz-3', name: 'Café Central', location: 'Ostrava', code: '333333' },
    ]
    for (const b of demoBiz) {
      await client.query(
        `INSERT INTO "Business" (id, name, location, join_code) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
        [b.id, b.name, b.location, b.code]
      )
    }

    return NextResponse.json({ ok: true, message: 'Tabulky vytvořeny, demo biznisy přidány.' })
  } catch (e: any) {
    return NextResponse.json({ error: 'Query failed', detail: e.message }, { status: 500 })
  } finally {
    client.release()
  }
}

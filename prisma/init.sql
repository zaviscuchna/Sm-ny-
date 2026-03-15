CREATE TABLE IF NOT EXISTS "Business" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "location"  TEXT NOT NULL DEFAULT '',
  "join_code" TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS "User" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "email"       TEXT NOT NULL UNIQUE,
  "role"        TEXT NOT NULL,
  "color"       TEXT NOT NULL,
  "phone"       TEXT,
  "business_id" TEXT NOT NULL REFERENCES "Business"("id")
);

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
);

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
);

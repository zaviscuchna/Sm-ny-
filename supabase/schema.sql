-- ══════════════════════════════════════════════════════════════════════════════
-- Směny organizátor — Supabase schema
-- Spusť celý tento soubor v Supabase: Database > SQL Editor > New query > Run
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── BUSINESSES ───────────────────────────────────────────────────────────────
create table if not exists businesses (
  id         text primary key,         -- 'biz-reg-<timestamp>'
  name       text not null,
  location   text not null default '',
  join_code  text unique not null      -- 6-místný kód pro pozvání zaměstnanců
);

-- ─── USERS ────────────────────────────────────────────────────────────────────
create table if not exists users (
  id           text primary key,       -- 'u-reg-<timestamp>'
  name         text not null,
  email        text not null unique,
  role         text not null check (role in ('manager','employee','superadmin')),
  color        text,
  phone        text,
  business_id  text references businesses(id) on delete cascade
);

create index if not exists users_email_idx    on users(email);
create index if not exists users_business_idx on users(business_id);

-- ─── SHIFTS ───────────────────────────────────────────────────────────────────
create table if not exists shifts (
  id                    text primary key,   -- 's-<timestamp>-<index>'
  business_id           text not null references businesses(id) on delete cascade,
  date                  text not null,      -- 'YYYY-MM-DD'
  start_time            text not null,      -- 'HH:mm'
  end_time              text not null,      -- 'HH:mm'
  role_needed           text not null,
  assigned_employee_id  text references users(id) on delete set null,
  status                text not null default 'open'
                          check (status in ('open','assigned','confirmed','pending')),
  notes                 text
);

create index if not exists shifts_business_date on shifts(business_id, date);

-- ─── WORK LOGS ────────────────────────────────────────────────────────────────
create table if not exists work_logs (
  id             text primary key,     -- 'wl-<timestamp>'
  business_id    text not null references businesses(id) on delete cascade,
  employee_id    text not null references users(id) on delete cascade,
  employee_name  text not null,
  date           text not null,        -- 'YYYY-MM-DD'
  clock_in       text not null,        -- 'HH:mm'
  clock_out      text not null,        -- 'HH:mm'
  hours          numeric(4,1) not null,
  notes          text
);

create index if not exists work_logs_business_date on work_logs(business_id, date);
create index if not exists work_logs_employee      on work_logs(employee_id);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Aplikace spravuje přístup sama (business_id scoping), RLS zatím vypnuto.
-- Zapnout až při přechodu na Supabase Auth.
alter table businesses  disable row level security;
alter table users       disable row level security;
alter table shifts      disable row level security;
alter table work_logs   disable row level security;

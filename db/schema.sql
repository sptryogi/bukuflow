-- BukuFlow v2: skema database (PostgreSQL / Neon). Aman dijalankan berulang kali.

CREATE TABLE IF NOT EXISTS institutions (
  id serial PRIMARY KEY,
  name text NOT NULL,
  name_norm text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS institutions_norm_idx ON institutions (name_norm);

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'guru')),
  status text NOT NULL CHECK (status IN ('menunggu_email', 'menunggu_acc', 'aktif', 'ditolak')),
  institution_id int REFERENCES institutions (id) ON DELETE SET NULL,
  school_name text,
  approved_via text CHECK (approved_via IN ('email', 'admin')),
  verify_hash text,
  verify_expires timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_uq ON users (lower(email));

CREATE TABLE IF NOT EXISTS books (
  id serial PRIMARY KEY,
  title text NOT NULL UNIQUE,
  level text NOT NULL CHECK (level IN ('Pemula', 'Madya', 'Mahir')),
  price int CHECK (price IS NULL OR price >= 0),
  source text
);

CREATE TABLE IF NOT EXISTS programs (
  id serial PRIMARY KEY,
  institution_id int NOT NULL REFERENCES institutions (id) ON DELETE CASCADE,
  months int NOT NULL CHECK (months IN (3, 6, 12)),
  weeks int NOT NULL CHECK (weeks BETWEEN 1 AND 104),
  start_date date NOT NULL,
  mode text NOT NULL CHECK (mode IN ('awal_bulan', 'lanjutan')),
  continues_from int REFERENCES programs (id) ON DELETE SET NULL,
  week_offset int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'menunggu_data' CHECK (status IN ('menunggu_data', 'siap')),
  copies int NOT NULL DEFAULT 2 CHECK (copies BETWEEN 1 AND 20),
  alloc_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS programs_inst_idx ON programs (institution_id);

CREATE TABLE IF NOT EXISTS students (
  id serial PRIMARY KEY,
  institution_id int NOT NULL REFERENCES institutions (id) ON DELETE CASCADE,
  nis text NOT NULL,
  name text NOT NULL,
  level text NOT NULL CHECK (level IN ('Pemula', 'Madya', 'Mahir')),
  UNIQUE (institution_id, nis)
);

CREATE TABLE IF NOT EXISTS program_students (
  program_id int NOT NULL REFERENCES programs (id) ON DELETE CASCADE,
  student_id int NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  level text NOT NULL CHECK (level IN ('Pemula', 'Madya', 'Mahir')),
  PRIMARY KEY (program_id, student_id)
);

CREATE TABLE IF NOT EXISTS allocations (
  program_id int NOT NULL REFERENCES programs (id) ON DELETE CASCADE,
  student_id int NOT NULL REFERENCES students (id) ON DELETE CASCADE,
  week int NOT NULL CHECK (week >= 1),
  book_id int NOT NULL REFERENCES books (id) ON DELETE RESTRICT,
  PRIMARY KEY (program_id, student_id, week)
);

CREATE INDEX IF NOT EXISTS allocations_prog_week_idx ON allocations (program_id, week);

CREATE TABLE IF NOT EXISTS throttle (
  key text PRIMARY KEY,
  count int NOT NULL,
  window_start timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO settings (key, value) VALUES ('max_students', '300') ON CONFLICT (key) DO NOTHING;

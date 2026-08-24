import {neon} from '@neondatabase/serverless';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is missing');
const sql=neon(process.env.DATABASE_URL);
await sql`CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  topic JSONB NOT NULL,
  persona TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'teach',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  beliefs JSONB NOT NULL DEFAULT '[]'::jsonb,
  exam JSONB,
  turn INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
)`;
await sql`CREATE INDEX IF NOT EXISTS lessons_user_updated_idx ON lessons(user_id,updated_at DESC)`;
await sql`CREATE TABLE IF NOT EXISTS ai_generations (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  model TEXT NOT NULL,
  input JSONB NOT NULL,
  output JSONB,
  token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
)`;
await sql`CREATE INDEX IF NOT EXISTS generations_lesson_idx ON ai_generations(lesson_id,created_at)`;
await sql`ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS routing JSONB NOT NULL DEFAULT '{}'::jsonb`;
await sql`CREATE TABLE IF NOT EXISTS generated_topics (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  request JSONB NOT NULL,
  topic JSONB,
  model TEXT,
  token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,normalized_title)
)`;
await sql`CREATE INDEX IF NOT EXISTS generated_topics_user_idx ON generated_topics(user_id,updated_at DESC)`;
await sql`ALTER TABLE generated_topics ADD COLUMN IF NOT EXISTS routing JSONB NOT NULL DEFAULT '{}'::jsonb`;
await sql`CREATE TABLE IF NOT EXISTS rate_limit_windows (bucket TEXT NOT NULL,identity TEXT NOT NULL,window_started TIMESTAMPTZ NOT NULL DEFAULT NOW(),request_count INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(bucket,identity))`;
await sql`CREATE INDEX IF NOT EXISTS rate_limit_window_age_idx ON rate_limit_windows(window_started)`;
await sql`CREATE TABLE IF NOT EXISTS generation_leases (identity TEXT NOT NULL,lane TEXT NOT NULL,lease_id UUID NOT NULL,expires_at TIMESTAMPTZ NOT NULL,PRIMARY KEY(identity,lane))`;
await sql`CREATE INDEX IF NOT EXISTS generation_lease_expiry_idx ON generation_leases(expires_at)`;
await sql`CREATE TABLE IF NOT EXISTS error_events (incident_id TEXT PRIMARY KEY,request_id TEXT NOT NULL,user_id TEXT,route TEXT NOT NULL,kind TEXT NOT NULL,status_code INTEGER NOT NULL,message TEXT NOT NULL,fingerprint TEXT NOT NULL,duration_ms INTEGER NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
await sql`CREATE INDEX IF NOT EXISTS errors_created_idx ON error_events(created_at DESC)`;
await sql`CREATE INDEX IF NOT EXISTS errors_fingerprint_idx ON error_events(fingerprint,created_at DESC)`;
console.log('Protégé persistence schema is ready.');

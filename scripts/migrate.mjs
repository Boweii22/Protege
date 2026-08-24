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
console.log('Protégé persistence schema is ready.');

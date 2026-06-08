-- src/migrations/schema.sql
-- ═══════════════════════════════════════════════════════════
--  CONFESSIONAL - COMPLETE DATABASE SCHEMA
-- ═══════════════════════════════════════════════════════════

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fast text search

-- ── USERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username      VARCHAR(30) NOT NULL UNIQUE,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),                    -- NULL for Google-only accounts
  google_id     VARCHAR(255) UNIQUE,
  photo_url     TEXT,
  role          VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('user','moderator','admin')),
  status        VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','banned','suspended')),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verify_token VARCHAR(255),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until  TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ── TERMS ACCEPTANCE ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS terms_acceptance (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version    VARCHAR(20) NOT NULL DEFAULT '1.0',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  INET,
  user_agent  TEXT
);

CREATE INDEX IF NOT EXISTS idx_terms_user ON terms_acceptance(user_id);

-- ── PASSWORD RESET TOKENS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(255) NOT NULL UNIQUE,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_token ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id);

-- ── USER SESSIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
  ip_address   INET,
  user_agent   TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(refresh_token_hash);

-- ── POSTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL CHECK (char_length(content) BETWEEN 10 AND 1000),
  category      VARCHAR(50) NOT NULL DEFAULT 'Random',
  reaction_love    INTEGER NOT NULL DEFAULT 0,
  reaction_laugh   INTEGER NOT NULL DEFAULT 0,
  reaction_sad     INTEGER NOT NULL DEFAULT 0,
  reaction_shocked INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  report_count  INTEGER NOT NULL DEFAULT 0,
  is_hidden     BOOLEAN NOT NULL DEFAULT FALSE,
  trending_score FLOAT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_trending ON posts(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_posts_content_fts ON posts USING gin(to_tsvector('english', content));

-- ── REACTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id       UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN ('love','laugh','sad','shocked')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, post_id)  -- one reaction per user per post
);

CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON reactions(user_id);

-- ── COMMENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES comments(id) ON DELETE CASCADE,  -- for nested replies
  content    TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

-- ── REPORTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id  UUID REFERENCES comments(id) ON DELETE CASCADE,
  reason      VARCHAR(50) NOT NULL,
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed','actioned')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_post ON reports(post_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- ── BOOKMARKS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ── AUTO-UPDATE TIMESTAMPS ────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_users_updated
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER trigger_posts_updated
  BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── TRENDING SCORE FUNCTION ───────────────────────────────
CREATE OR REPLACE FUNCTION calculate_trending_score(
  reactions INT, comments INT, age_hours FLOAT
) RETURNS FLOAT AS $$
BEGIN
  RETURN (reactions + comments * 2.0) / POWER(age_hours + 2.0, 1.5);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

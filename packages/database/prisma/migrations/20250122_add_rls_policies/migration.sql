-- Enable Row Level Security on all tenant-scoped tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Team" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Connection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Publication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MediaAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Template" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Analytics" ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owners (important for security)
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Team" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Post" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Connection" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Publication" FORCE ROW LEVEL SECURITY;
ALTER TABLE "MediaAsset" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Template" FORCE ROW LEVEL SECURITY;
ALTER TABLE "Analytics" FORCE ROW LEVEL SECURITY;

-- Create app-specific configuration functions
CREATE OR REPLACE FUNCTION current_team_id() RETURNS TEXT AS $$
  SELECT current_setting('app.current_team_id', true)::TEXT;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('app.current_user_id', true)::TEXT;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION bypass_rls() RETURNS BOOLEAN AS $$
  SELECT current_setting('app.bypass_rls', true)::BOOLEAN;
$$ LANGUAGE SQL STABLE;

-- Team policies
CREATE POLICY "team_isolation_policy" ON "Team"
  FOR ALL
  USING (
    bypass_rls() = true OR
    id = current_team_id()
  );

-- User policies
CREATE POLICY "user_team_isolation_policy" ON "User"
  FOR ALL
  USING (
    bypass_rls() = true OR
    "teamId" = current_team_id()
  );

CREATE POLICY "user_self_access_policy" ON "User"
  FOR ALL
  USING (
    bypass_rls() = true OR
    id = current_user_id()
  );

-- Post policies
CREATE POLICY "post_team_isolation_policy" ON "Post"
  FOR ALL
  USING (
    bypass_rls() = true OR
    "teamId" = current_team_id()
  );

CREATE POLICY "post_author_policy" ON "Post"
  FOR UPDATE, DELETE
  USING (
    bypass_rls() = true OR
    ("teamId" = current_team_id() AND "userId" = current_user_id())
  );

-- Connection policies
CREATE POLICY "connection_team_isolation_policy" ON "Connection"
  FOR ALL
  USING (
    bypass_rls() = true OR
    "teamId" = current_team_id()
  );

-- Publication policies (inherit from post)
CREATE POLICY "publication_team_isolation_policy" ON "Publication"
  FOR ALL
  USING (
    bypass_rls() = true OR
    EXISTS (
      SELECT 1 FROM "Post"
      WHERE "Post".id = "Publication"."postId"
      AND "Post"."teamId" = current_team_id()
    )
  );

-- MediaAsset policies
CREATE POLICY "media_team_isolation_policy" ON "MediaAsset"
  FOR ALL
  USING (
    bypass_rls() = true OR
    "teamId" = current_team_id()
  );

-- Template policies
CREATE POLICY "template_team_isolation_policy" ON "Template"
  FOR ALL
  USING (
    bypass_rls() = true OR
    "teamId" = current_team_id()
  );

CREATE POLICY "template_public_access_policy" ON "Template"
  FOR SELECT
  USING (
    bypass_rls() = true OR
    "isPublic" = true OR
    "teamId" = current_team_id()
  );

-- Analytics policies (inherit from post)
CREATE POLICY "analytics_team_isolation_policy" ON "Analytics"
  FOR ALL
  USING (
    bypass_rls() = true OR
    EXISTS (
      SELECT 1 FROM "Post"
      WHERE "Post".id = "Analytics"."postId"
      AND "Post"."teamId" = current_team_id()
    )
  );

-- Create indexes for RLS performance
CREATE INDEX IF NOT EXISTS "idx_user_team_id" ON "User"("teamId");
CREATE INDEX IF NOT EXISTS "idx_post_team_id" ON "Post"("teamId");
CREATE INDEX IF NOT EXISTS "idx_post_team_user" ON "Post"("teamId", "userId");
CREATE INDEX IF NOT EXISTS "idx_connection_team_id" ON "Connection"("teamId");
CREATE INDEX IF NOT EXISTS "idx_media_team_id" ON "MediaAsset"("teamId");
CREATE INDEX IF NOT EXISTS "idx_template_team_id" ON "Template"("teamId");
CREATE INDEX IF NOT EXISTS "idx_template_public" ON "Template"("isPublic", "teamId");

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
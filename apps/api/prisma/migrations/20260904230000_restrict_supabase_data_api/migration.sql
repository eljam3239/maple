-- Take the tables out of Supabase's Data API.
--
-- Supabase exposes the `public` schema over PostgREST to the `anon` and
-- `authenticated` roles, and a new project grants those roles ALL privileges on
-- every table created there. The project's anon key is public by design, so on
-- a fresh project this meant anyone holding it could read DailyPuzzle — today's
-- answer — and also INSERT, UPDATE, DELETE or TRUNCATE any table.
--
-- Nothing here uses the Data API; the game talks to its own API, which connects
-- as the owner role. So we revoke the grants outright, stop the default
-- privileges from re-granting them to tables that later migrations create, and
-- enable row level security as a second line of defence. The owner has
-- BYPASSRLS, so the application is unaffected.
--
-- Every statement is guarded: these roles only exist on Supabase, and this
-- migration must also apply to a plain PostgreSQL used for local development
-- and tests.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    -- Existing objects.
    REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

    -- Future objects. Prisma migrations run as the owner, so it is the owner's
    -- default privileges that decide what a newly created table grants.
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated',
      current_user);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated',
      current_user);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated',
      current_user);
  END IF;
END
$$;

-- Defence in depth: even if a grant returns, RLS with no policies denies every
-- non-bypassing role.
ALTER TABLE "City"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DailyPuzzle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Player"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GameSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Guess"       ENABLE ROW LEVEL SECURITY;

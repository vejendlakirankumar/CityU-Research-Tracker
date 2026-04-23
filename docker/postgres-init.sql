-- PostgreSQL initialization: create limited-privilege roles
-- Runs once when the container is first created (before Laravel migrations)

-- Create read-only role for reporting/analytics (password set separately)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rrp_readonly') THEN
    CREATE ROLE rrp_readonly LOGIN PASSWORD 'changeme_readonly';
  END IF;
END
$$;

-- Grant read-only access on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO rrp_readonly;

-- Revoke default public access
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO rrp_readonly;

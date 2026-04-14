-- Create a separate database for integration tests so they never touch dev data.
-- This script runs automatically on first container init via the docker entrypoint.
SELECT 'CREATE DATABASE spotterspace_test OWNER spotterspace'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'spotterspace_test')\gexec

-- Enable PostGIS in the test database (matches the dev database setup)
\c spotterspace_test
CREATE EXTENSION IF NOT EXISTS postgis;

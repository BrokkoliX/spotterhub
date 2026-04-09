-- Create a separate database for integration tests so they never touch dev data.
-- This script runs automatically on first container init via the docker entrypoint.
SELECT 'CREATE DATABASE spotterhub_test OWNER spotterhub'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'spotterhub_test')\gexec

-- Enable PostGIS in the test database (matches the dev database setup)
\c spotterhub_test
CREATE EXTENSION IF NOT EXISTS postgis;

-- AgencyOS — Migration 0001: Extensions, schemas, and enums
-- Forward-only migration. Applies to a fresh Supabase Postgres database.

-- Required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "btree_gin";

-- Schemas
create schema if not exists public;
create schema if not exists private;  -- security-definer helpers, internal tables
create schema if not exists audit;    -- append-only audit events
create schema if not exists storage;  -- Supabase Storage (managed)

-- Stable enums for genuinely stable states
do $$ begin
  create type membership_status as enum ('active', 'suspended', 'removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_status as enum ('pending', 'approved', 'changes_requested', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type time_entry_status as enum ('open', 'submitted', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type visibility as enum ('internal', 'client', 'restricted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type import_job_status as enum ('pending', 'validating', 'running', 'completed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type automation_run_status as enum ('pending', 'running', 'succeeded', 'failed', 'dead_letter');
exception when duplicate_object then null; end $$;

-- Default privileges: revoke from anon/authenticated for private schema
revoke all on schema private from public, anon, authenticated;
revoke all on schema audit from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

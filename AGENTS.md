Project: Vendor Risk Management SaaS

Stack
Next.js App Router
Supabase Postgres
TypeScript
Tailwind

Database
Source of truth: /db/migrations/001_init.sql

Rules
- All tables are multi-tenant using org_id
- Always filter queries by org_id



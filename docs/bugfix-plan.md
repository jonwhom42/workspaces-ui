# Bug Fix Plan – Workspace Bootstrapping

## Observed Issues
1. **Login redirect loop** – Users with existing workspaces were forced onto `/onboarding/workspace` because `pages/app` bailed when `getUserWorkspaces` returned an empty array (no default provisioning).
2. **Workspace creation failing** – RLS blocked `/api/workspaces/create` inserts because it used the anon Supabase client instead of the service-role client.
3. **Workspace shell empty** – With no successful memberships, the WorkspaceContext never received SSR workspaces, so the drawer rendered blank.

## Diagnostic Steps
- Added `console.info` statements in `pages/app/index.tsx` and `WorkspaceContext` to log the fetched workspace counts, provisioning attempts, and redirect decisions.
- Created deterministic unit tests (`tests/workspaceRouting.test.ts`) for the new routing helper used by `/app` to ensure cookie and fallback behavior stay predictable.

## Fix Strategy
1. **Eliminate onboarding dependency**
   - Remove `/onboarding/workspace` and middleware coverage.
   - Auto-provision a default workspace (via service-role client) the first time `/app` detects none, then re-fetch membership-scoped data before redirecting.
2. **Centralize provisioning helpers**
   - Reintroduce `createWorkspaceWithOwner` in `lib/workspaces.ts` and share it between `/app` and `/api/workspaces/create.ts`.
3. **Transparent routing logic**
   - Move fallback selection into `lib/workspaceRouting.ts` (tested with Vitest) so future agents can reuse/extend the behavior safely.
4. **API hardening**
   - `/api/workspaces/create` now uses the service-role client for inserts then rolls back on membership failures, preventing RLS errors and orphan rows.

These steps ensure every authenticated user always lands on a valid workspace dashboard while keeping provisioning auditable for future AI/agent flows.

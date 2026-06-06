# Production Deployment Checklist
## v1.0 Attendance Analytics Suite

This checklist must be fully completed and signed off prior to any promotion of code from Staging to Production.

---

## 1. Pre-Deployment
- [ ] **Database Backup**: Verify that a full database snapshot has been taken in the last 1 hour.
- [ ] **Downtime Notice**: Notify Principals and Teachers of the scheduled 30-minute maintenance window.
- [ ] **Rollback Package Prepared**: Ensure `production_rollback_package.zip` is downloaded and accessible to the deployment engineer.

## 2. Migration & RLS Verification
- [ ] **Execute Phase 1 Migrations**: Apply core tables (profiles, classes, subjects, attendance).
- [ ] **Execute Phase 2 Migrations**: Apply alert tables and triggers.
- [ ] **Execute Phase 3 & Readiness Migrations**: Apply parent architecture, school settings, and KPI enhancements.
- [ ] **Verify Row Level Security (RLS)**: Ensure all tables have RLS enabled.
  - `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('attendance', 'system_alerts', 'parents');`

## 3. Application Deployment
- [ ] **Build Environment**: Run `npm run build` locally to verify zero syntax/linting errors.
- [ ] **Deploy Frontend**: Push build artifacts to the production hosting provider (Vercel/Netlify/etc).
- [ ] **Environment Variables**: Verify `.env.production` contains the correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## 4. Post-Deployment Smoke Tests
- [ ] **Login Verification**: Log in as a Teacher, Parent, and Principal successfully.
- [ ] **Write Verification**: As a teacher, successfully mark one student present.
- [ ] **Trigger Verification**: Verify the attendance record correctly triggered or updated a `system_alerts` row if applicable.
- [ ] **PDF Generation**: As a student, verify the Certificate Generator triggers the PDF download.

## 5. Rollback Decision Matrix
> [!CAUTION]
> If any of the following occur during deployment, **ABORT** and initiate Rollback Procedures:

| Scenario | Action |
|----------|--------|
| Database Migration Fails halfway | **ABORT** -> Execute Rollback Package |
| Frontend Deployment Fails | **ABORT** -> Revert to previous build commit |
| Post-Deployment Smoke Test Fails (Cannot write attendance) | **ABORT** -> Investigate RLS / Rollback DB |
| Users cannot log in | **ABORT** -> Check Auth Configuration |

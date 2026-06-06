# Administrator Operations Guide
## v1.0 Attendance Analytics Suite

This guide is designed for Database Administrators and IT Staff managing the Gyanoday Niketan Attendance Analytics Suite post-launch.

---

## 1. User Management & Mapping

### Mapping Parents to Students
Parents require explicit database mapping to view their child's records.
1. Create a row in the `parents` table with the user's Supabase Auth `user_id`.
2. Map the parent to the student in the `parent_student_map` table.

```sql
INSERT INTO public.parents (name, user_id) VALUES ('John Doe', 'uuid-from-auth');
INSERT INTO public.parent_student_map (parent_id, student_id, relationship) VALUES ('parent-uuid', 'student-uuid', 'Parent');
```

## 2. School Settings (Attendance Locks)
The system relies on the `school_settings` table to control global configurations.

**Setting the Daily Lock Time:**
```sql
UPDATE public.school_settings 
SET setting_value = '18:00:00' 
WHERE setting_key = 'attendance_lock_time_default';
```
If a teacher misses this cut-off, only an Administrator or Principal can execute an Attendance Override.

## 3. Managing System Alerts
Alerts are generated automatically by the `handle_attendance_alerts()` Postgres Trigger.
If an alert is stuck in an 'open' state erroneously, you can resolve it manually:
```sql
UPDATE public.system_alerts
SET status = 'resolved', resolution_notes = 'Manual Admin Override'
WHERE id = 'alert-uuid';
```

## 4. Backup & Restore Procedures

### Database Backups
It is critical that Daily Point-in-Time Recovery (PITR) backups are enabled in the Supabase Dashboard.
1. Navigate to Supabase -> Database -> Backups.
2. Verify daily backups are completing successfully.

### Restore Procedures
If data corruption occurs, use the Supabase Dashboard to restore the latest clean snapshot. If only a minor migration failed, utilize the Emergency Rollback Procedures.

## 5. Emergency Rollback Procedures
If a production deployment causes catastrophic failure, use the Rollback Packages provided in the `releases/production_rollback_package.zip`.

> [!CAUTION]
> Running rollback scripts will drop tables and permanently delete data generated during that phase. Verify backups before proceeding!

**Execution:**
1. Extract `production_rollback_package.zip`.
2. Run the rollback scripts in *reverse chronological order*:
   - `rollback_production_readiness.sql`
   - `rollback_phase3.sql`
   - `rollback_phase2.sql`
   - `rollback_phase1.sql`
3. Verify table removals via the `information_schema` checks included at the end of each script.

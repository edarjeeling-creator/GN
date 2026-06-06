# Teacher User Guide
## v1.0 Attendance Analytics Suite

Welcome to the Teacher Dashboard for the Gyanoday Niketan Attendance Analytics Suite. This guide will assist you in managing daily attendance for your assigned classes efficiently and accurately.

---

## 1. Login & Navigation
Navigate to your portal using your Teacher credentials. Your dashboard now includes a tailored **Class Attendance Overview**.

![[Placeholder: Insert Screenshot of Teacher Dashboard]]

## 2. Key Features

### Class Attendance Overview Widget
Provides real-time feedback on your assigned classes:
- **Present / Absent Today**: Real-time counts of your students' statuses today.
- **On Leave**: Tracks students marked as 'Leave' or 'Medical Leave'.
- **Students at Risk**: Tracks how many of your students currently have active consecutive absence alerts.

### Daily Attendance Register
Navigate to `Classes -> Take Attendance`.
- **Mark All Present**: A quick-action button to default all students to Present. A confirmation dialog will appear to prevent accidental clicks.
- **Medical Leave**: A dedicated status for excused medical absences. This does not penalize the student's attendance percentage.

## 3. Common Tasks

### Marking Daily Attendance
1. Click on the class you wish to manage.
2. Select **Take Attendance**.
3. Use the toggle buttons next to each student's name (Present, Absent, Late, Half Day, Leave, Medical Leave).
4. Click **Save Attendance** before the daily lock time.

### Viewing Student History
1. Click on a student's name in your class list.
2. View their attendance history and any active **System Alerts** linked to them.

## 4. Troubleshooting & FAQs
### Common Errors & Solutions

**Q: The attendance register is grayed out and locked!**
> **Solution:** The school has a strict **Attendance Lock Time** (e.g., 6:00 PM). If you miss this deadline, you can no longer modify the register. You must contact the Principal to process an Admin Override.

**Q: I accidentally marked a student Absent instead of Present.**
> **Solution:** If the lock time has not passed, simply re-open the register and update the status. The old notification sent to parents will be automatically invalidated, and the system will log the correction.

**Q: A student is not appearing in my class list.**
> **Solution:** The student may not be assigned to your `class_id` in the database. Please contact the Administrator to verify the student's enrollment mapping.

**Q: I hit "Save" but the network disconnected.**
> **Solution:** The system will show an error toast if saving fails. Check your internet connection and click Save again. You can verify your submission by checking the "Pending Entries" widget on your dashboard.

# Principal User Guide
## v1.0 Attendance Analytics Suite

Welcome to the Principal Dashboard for the Gyanoday Niketan Attendance Analytics Suite. This guide will help you navigate your operational controls, track school-wide attendance, manage alerts, and export reports.

---

## 1. Login & Navigation
Navigate to your portal using your Principal credentials. Your dashboard is divided into logical tabs:
- **Overview**: Real-time operational KPIs (Today's Attendance, Pending Classes, Open Alerts).
- **Attendance Reports**: Deep dive into analytics, heatmaps, leaderboards, and CSV exports.
- **User Search**: Look up specific students or teachers.
- **Notices**: Broadcast messages to the school.

![[Placeholder: Insert Screenshot of Dashboard Overview]]

## 2. Key Features

### Operational KPIs
Instantly view critical daily stats:
- **Today's Attendance %**: Automatically excludes students on valid Medical Leave.
- **Pending Classes**: Identifies how many classes have not yet marked attendance for the day.
- **Alert Triage**: View how many Open Alerts exist vs. Critical Alerts.

### Trend Analytics & Heatmaps
Under the **Attendance Reports** tab:
- Use the **Trend Lines** to visualize attendance patterns over the last 14 days.
- Use the **Class Heatmap** to spot chronic issues across different sections and classes instantly. Deep red indicates poor attendance, while green indicates strong attendance.

### System Alerts Management
The system automatically generates alerts for consecutive absences (e.g., 3 days = Watch, 5 days = Risk, 7 days = Critical).
- As a Principal, you can review these alerts.
- Once a student returns to school, or is marked as Medical Leave, the system **automatically resolves** the alert.

### CSV Exports
You can export completely auditable CSV reports filtering by:
- Today
- Yesterday
- Last 7 Days
- Custom Range

The exports include the timestamp of when attendance was submitted, and the name of the teacher who marked it.

## 3. Common Tasks

### Exporting an Audit Report
1. Go to the **Attendance Reports** tab.
2. Select your desired date range from the dropdown.
3. Click the **Export CSV** button.

### Overriding an Attendance Lock
If a teacher missed the daily cut-off time (e.g., 6:00 PM), the system automatically locks their register. 
1. Navigate to the class register (via search or impersonation view if configured).
2. As a Principal, you retain override privileges.
3. You will be prompted to enter an **Override Reason** which will be permanently logged in the audit trail.

## 4. Troubleshooting & FAQs
### Common Errors & Solutions

**Q: The dashboard is not updating today's percentages.**
> **Solution:** Ensure that teachers have actually submitted their attendance. Check the "Pending Classes" KPI. If it matches the total number of classes, no data has been entered yet.

**Q: My CSV Export failed to download.**
> **Solution:** Check if your browser is blocking pop-up downloads. Allow downloads from the portal domain.

**Q: A student has been absent for 8 days but the alert says "Resolved".**
> **Solution:** The system automatically resolves alerts if a teacher marks the student as 'Present', 'Leave', or 'Medical Leave' on any subsequent day. Check the student's individual attendance history to verify if a teacher retroactively updated a date.

# 🎯 EduTrack - Quick Visual Summary

## How It Works (Simple Version)

### The 5-Step Flow:

```
┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐
│   User   │  →   │  Login   │  →   │ System   │  →   │   Use    │  →   │  See     │
│  Opens   │      │ Verifies │      │ Generates│      │ Features │      │ Results  │
│ Website  │      │ Password │      │   JWT    │      │ (QR etc) │      │(Reports) │
└──────────┘      └──────────┘      └──────────┘      └──────────┘      └──────────┘
```

---

## What Each Part Does:

### 🖥️ FRONTEND (What You See)
- Website in browser
- Login screen
- Attendance tab
- Analytics dashboard
- Reports page
- Your courses & grades

### ⚙️ BACKEND (What Works Behind)
- Receives requests
- Validates data
- Checks database
- Calculates analytics
- Generates reports
- Sends data back

### 💾 DATABASE (Where Data Lives)
- All 25 user accounts
- 5 courses
- Attendance records
- Grades
- Performance data

---

## Teacher Flow (Simple):

```
1. LOGIN
   Email: arun.kumar@edutrack.com
   Pass: password123
   
2. SELECT COURSE
   Choose: CSE-201 (Data Structures)
   
3. GENERATE QR
   Click button → Get QR code with token
   
4. SHARE WITH STUDENTS
   Show on projector or screen
   
5. VIEW RESULTS
   See who marked attendance
   See analytics instantly
```

---

## Student Flow (Simple):

```
1. LOGIN
   Email: student1@edutrack.com
   Pass: password123
   
2. SEE COURSES
   Shows all 5 courses enrolled
   
3. MARK ATTENDANCE
   Get teacher's QR token
   Enter token
   Click "Mark Attendance"
   
4. SEE CONFIRMATION
   ✅ Marked present
   Shows distance & time
   
5. VIEW GRADES
   See your performance
   See attendance %
   See all courses
```

---

## The 5 B.Tech Courses:

```
All start together, all 20 students in each:

CSE-201 (Data Structures)
↑
ME-204 (Thermodynamics)
↑
ECE-202 (Circuit Analysis)
↑
CE-203 (Structural Design)
↑
EE-205 (Power Systems)

Every student attends all 5!
```

---

## How QR Attendance Works:

```
STEP 1: TEACHER GENERATES
├─ Location: 28.5355, 77.3910 (classroom)
├─ Creates unique token: ATD-A1B2C3
├─ Valid for 15 minutes
└─ Shows on screen

STEP 2: STUDENT SCANS/ENTERS TOKEN
├─ Enters: ATD-A1B2C3
├─ Allows location access
├─ Gets own location: 28.5360, 77.3905
└─ Sends to backend

STEP 3: BACKEND CHECKS
├─ Token valid? YES ✓
├─ Not expired? YES ✓ (less than 15 min)
├─ Distance OK? 95m < 120m ✓
└─ All checks pass!

STEP 4: ATTENDANCE RECORDED
├─ Mark: PRESENT
├─ Time: 08:15 AM
├─ Distance: 95m
└─ Date: 2026-04-19

STEP 5: SHOWS CONFIRMATION
├─ ✅ Attendance marked!
├─ Distance from class: 95m
└─ Course: CSE-201
```

---

## How Analytics Work:

```
REAL-TIME DATA:

Every day the system calculates:
├─ How many students present/absent
├─ Attendance percentage
├─ Trends over 15 days
├─ Student performance per course
├─ Grades vs attendance correlation
├─ Who needs intervention
└─ Performance recommendations

TEACHER SEES:
├─ Today: 80% attendance (16 out of 20)
├─ Trend: Last 15 days = 82% avg
├─ Low attendance: Chirag, Nikhil (< 70%)
├─ Perfect attendance: Arjun, Fiona (100%)
└─ Monthly report: Download PDF
```

---

## Security Explained:

```
PASSWORD PROTECTION:
Your password → Hashed with bcrypt → Stored in DB
(Cannot be read, even by admin)

LOGIN PROCESS:
You enter password → Backend compares with hash → 
Matches? YES → Generate token

JWT TOKEN:
├─ Created with your info
├─ Expires in 7 days
├─ Used for all requests
├─ Cannot be forged (signed with secret)

LOCATION VALIDATION:
├─ Your location checked via GPS
├─ Distance calculated accurately
├─ Cannot fake attendance from home (>120m away)
└─ Data not permanently stored

EACH REQUEST VERIFIED:
├─ Token valid?
├─ User role correct?
├─ Data ownership correct?
└─ Then allowed to proceed
```

---

## Data Flow Example:

```
SCENARIO: Student marks attendance

┌────────────────────────────────────┐
│ Student's Phone/Browser            │
│ Clicks: "Mark Attendance"           │
└────────────┬────────────────────────┘
             │ Sends: {
             │   token: "ATD-A1B2C3",
             │   latitude: 28.5360,
             │   longitude: 77.3905
             │ }
             │
             ▼
┌────────────────────────────────────┐
│ Backend Server (5000)              │
│ 1. Find QR session by token        │
│ 2. Check if still valid (15 min)   │
│ 3. Calculate distance              │
│ 4. If valid: Save to database      │
│ 5. Send success response           │
└────────────┬────────────────────────┘
             │ Returns: {
             │   success: true,
             │   distance: 95,
             │   message: "Marked!"
             │ }
             │
             ▼
┌────────────────────────────────────┐
│ Student's Phone/Browser            │
│ Shows: ✅ Attendance marked!        │
│        Distance: 95m               │
└────────────────────────────────────┘
```

---

## What Happens Each Day:

```
MORNING (8:00 AM):
├─ Students arrive
├─ Teacher opens attendance
├─ Generates QR code
└─ Students mark attendance

DURING CLASS (8:05-9:30 AM):
├─ Attendance recorded
├─ Teacher can see live who came
├─ Can send alerts to absent students
└─ Class proceeds normally

AFTER CLASS (9:30 AM):
├─ System auto-calculates attendance %
├─ Updates analytics
├─ Stores in database
├─ Teacher can view report
└─ Students can see their attendance

END OF MONTH (Apr 30):
├─ Teacher generates monthly report
├─ All students' attendance summarized
├─ Grades included
├─ Performance analysis added
├─ Can be downloaded as PDF
└─ Report saved in system
```

---

## Key Features at a Glance:

| Feature | What It Does |
|---------|------------|
| **QR Attendance** | Smart way to mark attendance with location check |
| **Geofencing** | Ensures student is physically in classroom (120m) |
| **Analytics** | Real-time attendance & performance tracking |
| **Monthly Reports** | Auto-generated PDF with all statistics |
| **Performance Index** | Shows how each student is doing (0-100 score) |
| **Multi-Subject** | All 20 students in all 5 courses |
| **Grades Tracking** | Individual grades per course (A-D) |
| **Notifications** | Teachers can alert students |
| **Security** | Passwords hashed, location verified |
| **Real Data** | 15 days pre-seeded for testing |

---

## Database Collections (What's Stored):

```
users (25 total)
├─ 5 Teachers (with emails)
└─ 20 Students (with emails)

classes (5 total)
├─ Each has 1 teacher + 20 students
└─ Each has schedule & location

attendance (1500+ records)
├─ Each day, each student, each course
├─ Marked present or absent
└─ With timestamp & distance

grades (100+ records)
├─ Each student in each course
├─ Includes internals, finals, final grade
└─ Updated as needed

courseAnalytics (ongoing)
├─ Daily snapshots
├─ Attendance %, trends
└─ Performance insights

studentPerformance (ongoing)
├─ Index per student
├─ Monthly breakdown
└─ Correlations
```

---

## Running It (Quick):

```
STEP 1: Start Backend
cd backend && npm start
→ Runs on port 5000

STEP 2: Start Frontend
cd frontend && npm run dev
→ Runs on port 5173

STEP 3: Create Data (one time)
curl -X POST http://localhost:5000/api/setup/multi-subject

STEP 4: Login
Website: http://localhost:5173
Email & password from LOGIN_CREDENTIALS.md

STEP 5: Use Features!
└─ Generate QR
└─ Mark attendance
└─ View analytics
└─ Download reports
```

---

## That's It!

The entire system is:
1. **Frontend** (what you click)
2. **Backend** (what processes it)
3. **Database** (where data lives)

All working together to create your Smart Classroom! 🎓

---

📖 **For more details:** Open `HOW_IT_WORKS.md` file

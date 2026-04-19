# 🎓 EduTrack - Complete System Explanation

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Browser                         │
│              (React Frontend - Port 5173)               │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Login      │  │  Dashboard   │  │  Attendance  │  │
│  │   Screen     │  │   (Teacher/  │  │   QR Code    │  │
│  │              │  │   Student)   │  │   Marking    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼──────────────────┼──────────────────┼─────────┘
          │                  │                  │
          │ HTTP Requests    │ Fetch API        │
          │ (JSON)           │ (JSON)           │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────┐
│                                                         │
│         Backend API Server (Node.js/Express)           │
│              (Port 5000)                                │
│                                                         │
│  ┌────────────────────────────────────────────────┐   │
│  │              API Endpoints                     │   │
│  │                                                │   │
│  │  POST /api/auth/login                        │   │
│  │  POST /api/setup/multi-subject               │   │
│  │  POST /api/attendance/qr/create              │   │
│  │  POST /api/attendance/qr/submit              │   │
│  │  GET  /api/analytics/course/:courseId        │   │
│  │  POST /api/reports/generate-monthly          │   │
│  │  ... and many more                           │   │
│  │                                                │   │
│  └────────────────────────────────────────────────┘   │
│                       │                                 │
│                       │ Query/Update                    │
│                       │                                 │
│  ┌────────────────────▼────────────────────────────┐  │
│  │     MongoDB Database or In-Memory Storage       │  │
│  │                                                 │  │
│  │  Collections:                                   │  │
│  │  - users (teachers & students)                 │  │
│  │  - classes (5 B.Tech courses)                  │  │
│  │  - attendance (daily records)                  │  │
│  │  - grades (marks per course)                   │  │
│  │  - assignments                                 │  │
│  │  - courseAnalytics                             │  │
│  │  - studentPerformance                          │  │
│  │  - attendanceQrSessions                        │  │
│  │                                                 │  │
│  └────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 How Data Flows

### Step 1: USER SIGNUP/LOGIN

```
┌─────────────────┐
│  Student Types  │
│ Email & Pass    │
│  in Browser     │
└────────┬────────┘
         │
         │ Frontend sends to backend
         │ POST /api/auth/login
         │ Body: {email, password}
         │
         ▼
┌──────────────────────────┐
│  Backend Receives Request │
│ - Checks database        │
│ - Validates password     │
│ - Generates JWT Token    │
└────────┬─────────────────┘
         │
         │ Response sent back
         │ {success, token, user}
         │
         ▼
┌──────────────────────────┐
│  Frontend Stores         │
│ - JWT Token in localStorage
│ - User info              │
│ - Shows Dashboard        │
└──────────────────────────┘
```

---

## 🎯 THE 5 B.TECH COURSES

All courses run simultaneously. All 20 students attend all 5 courses.

```
┌────────────────────────────────────────────────────────┐
│              5 B.TECH COURSES                          │
├────────────────────────────────────────────────────────┤
│                                                        │
│  COURSE 1: CSE-201                                   │
│  └─ Data Structures & Algorithms                      │
│  └─ Teacher: Arun Kumar                               │
│  └─ Students: All 20                                  │
│  └─ Schedule: Monday 10-11:30, Wednesday 2-3:30     │
│  └─ Room: CSE-201-101                                │
│                                                        │
│  COURSE 2: ME-204                                    │
│  └─ Thermodynamics                                    │
│  └─ Teacher: Priya Singh                              │
│  └─ Students: All 20                                  │
│  └─ Schedule: Monday 11-12:30, Wednesday 3-4:30     │
│  └─ Room: ME-204-101                                 │
│                                                        │
│  COURSE 3: ECE-202                                   │
│  └─ Circuit Analysis                                  │
│  └─ Teacher: Vikram Patel                             │
│  └─ Students: All 20                                  │
│                                                        │
│  COURSE 4: CE-203                                    │
│  └─ Structural Design                                 │
│  └─ Teacher: Deepak Sharma                            │
│  └─ Students: All 20                                  │
│                                                        │
│  COURSE 5: EE-205                                    │
│  └─ Power Systems                                     │
│  └─ Teacher: Neha Gupta                               │
│  └─ Students: All 20                                  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 👨‍🏫 HOW TEACHER WORKFLOW WORKS

### Teacher Login
```
1. Teacher opens website: http://localhost:5173
2. Clicks "Login" tab
3. Enters: arun.kumar@edutrack.com / password123
4. Backend verifies credentials
5. Frontend stores JWT token
6. Dashboard loads with:
   - All 20 enrolled students
   - 5 courses they teach
   - Analytics & reports
```

### Teacher Generates QR Attendance

```
┌────────────────────────────────────┐
│   Teacher in Classroom            │
│   Goes to "Attendance" Tab        │
│   Clicks "Use My Class Location"  │
└────────────┬─────────────────────┘
             │
             │ Browser requests GPS location
             │ (popup: "Allow location access?")
             │
             ▼
┌────────────────────────────────────┐
│   Teacher clicks "Allow"           │
│   Browser gets GPS: 28.5355, 77.3910
│   (This is classroom coordinates)  │
└────────────┬─────────────────────┘
             │
             │ Teacher clicks 
             │ "Generate Attendance QR"
             │
             ▼
┌────────────────────────────────────────────┐
│   Frontend sends to Backend:               │
│   POST /api/attendance/qr/create          │
│   Body: {                                  │
│     classId: "CSE-201",                   │
│     teacherId: "teacher1_id",             │
│     latitude: 28.5355,                    │
│     longitude: 77.3910,                   │
│     rangeMeters: 120,                     │
│     expiresMinutes: 15                    │
│   }                                        │
└────────────┬───────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────┐
│   Backend:                                 │
│   1. Generates unique token: ATD-A1B2C3   │
│   2. Saves QR session to database         │
│   3. Creates QR image URL                 │
│   4. Sets expiry = now + 15 minutes       │
│   5. Sends back QR image & token          │
└────────────┬───────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│   Frontend displays:                    │
│   - QR Code Image                       │
│   - Token: ATD-A1B2C3                   │
│   - "Expires in 15 minutes"             │
│   - Teacher shares with students        │
└─────────────────────────────────────────┘
```

**Real Example:**
```
Teacher shows QR code to all students:
- QR code displays on screen
- Students can scan with phone
- OR students type token: ATD-A1B2C3
```

---

## 👨‍🎓 HOW STUDENT WORKFLOW WORKS

### Student Login
```
1. Student opens website: http://localhost:5173
2. Clicks "Login" tab
3. Enters: student1@edutrack.com / password123
4. Backend verifies (finds student in database)
5. Generates JWT token
6. Dashboard shows:
   - All 5 enrolled courses
   - My attendance per course
   - My grades
   - My performance index
```

### Student Marks Attendance with QR

```
┌─────────────────────────────────────────────┐
│   Student in Classroom                     │
│   Goes to "Attendance" Tab                 │
│   Sees teacher's QR code on screen         │
│   Or teacher tells them token: ATD-A1B2C3  │
└────────────┬────────────────────────────────┘
             │
             │ Student types token in text box:
             │ ATD-A1B2C3
             │
             ▼
┌────────────────────────────────────────────┐
│   Student clicks "Mark Attendance"         │
│   Browser prompts: "Allow location access?"│
│   Student clicks "Allow"                   │
│   Student's GPS captured: 28.5360, 77.3905│
│   (Should be ~100m from teacher)           │
└────────────┬───────────────────────────────┘
             │
             │ Frontend sends to Backend:
             │ POST /api/attendance/qr/submit
             │ Body: {
             │   token: "ATD-A1B2C3",
             │   studentId: "student1_id",
             │   latitude: 28.5360,
             │   longitude: 77.3905
             │ }
             │
             ▼
┌────────────────────────────────────────────────┐
│   Backend Validation:                          │
│                                                │
│   1. Find QR Session with token ATD-A1B2C3    │
│   2. Check if NOT expired (still in 15 min)   │
│   3. Calculate distance using Haversine:      │
│                                                │
│      Teacher: 28.5355, 77.3910                │
│      Student: 28.5360, 77.3905                │
│      Distance = 100 meters                    │
│                                                │
│   4. Check if 100m <= 120m (range) ✓         │
│   5. Mark attendance in database              │
│   6. Record: {                                │
│        class: "CSE-201",                      │
│        student: "student1_id",                │
│        date: "2026-04-19",                    │
│        status: "present",                     │
│        markedAt: now,                         │
│        distanceMeters: 100                    │
│      }                                         │
│   7. Send success response                    │
│                                                │
└────────────┬─────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Frontend shows:                   │
│   ✅ "Attendance marked!"           │
│   "Distance: 100m from classroom"   │
│   "Attendance recorded for CSE-201" │
└─────────────────────────────────────┘
```

**What happens if validation fails:**

```
Scenario 1: Token expired (>15 minutes)
❌ Error: "QR code has expired. Ask teacher for new QR"

Scenario 2: Student too far (>120m away)
❌ Error: "You are 500m away from classroom. Get closer!"

Scenario 3: Token already used today
❌ Error: "You already marked attendance for this class today"
```

---

## 📊 HOW ANALYTICS WORK

### Real-Time Attendance Tracking

```
Backend Database (Attendance Collection):
┌─────────────────────────────────────────────┐
│ Course: CSE-201                             │
│                                             │
│ 2026-04-19 (Today):                        │
│  ├─ Arjun Kumar: PRESENT (100m from class) │
│  ├─ Bhavna Singh: PRESENT (95m away)       │
│  ├─ Chirag Patel: ABSENT (didn't come)     │
│  ├─ Deepika Sharma: PRESENT (110m away)    │
│  ├─ Eshan Kumar: PRESENT                   │
│  ...                                        │
│  └─ Taran Sharma: ABSENT                   │
│                                             │
│ Summary: 16 Present, 4 Absent = 80%        │
└─────────────────────────────────────────────┘
```

### Teacher Views Analytics

```
Teacher Clicks "Analytics" in Dashboard:

┌─────────────────────────────────────────┐
│   CSE-201 ATTENDANCE ANALYTICS           │
├─────────────────────────────────────────┤
│                                          │
│   Today's Attendance: 80% (16/20)        │
│   ┌──────────────────────────────────┐   │
│   │ ████████░░░░░░░░░░░░  80%        │   │
│   └──────────────────────────────────┘   │
│                                          │
│   This Week: 82%                         │
│   This Month: 78%                        │
│   This Year: 75%                         │
│                                          │
│   Attendance Trend (Last 15 days):       │
│   Day 1:  75% │                          │
│   Day 2:  80% │░                         │
│   Day 3:  82% │░░                        │
│   Day 4:  78% │░░░                       │
│   ...                                    │
│                                          │
│   Low Attendance Students:                │
│   ├─ Chirag Patel: 55% (11/20 days)     │
│   ├─ Nikhil Singh: 60% (12/20 days)     │
│   └─ Taran Sharma: 65% (13/20 days)     │
│                                          │
│   Perfect Attendance:                    │
│   ├─ Arjun Kumar: 100%                  │
│   ├─ Fiona Singh: 100%                  │
│   └─ Gaurav Patel: 100%                 │
│                                          │
└─────────────────────────────────────────┘
```

---

## 📈 HOW PERFORMANCE TRACKING WORKS

### Student Performance Index

Each student has a **Performance Index (0-100)** calculated from:

```
Performance Index Formula:
┌─────────────────────────────────────────┐
│ Performance = (Factors Weighted)        │
│                                          │
│ 40% Attendance                          │
│    └─ Marks: 0-100 (15 days history)   │
│    └─ Your attendance %                │
│                                          │
│ 35% Grades                              │
│    └─ A=10, B+=8, B=7, C=5, D=0        │
│    └─ Average across all subjects       │
│                                          │
│ 15% Assignments                         │
│    └─ Submitted/Total                  │
│                                          │
│ 10% Participation                       │
│    └─ Class activities                 │
│                                          │
└─────────────────────────────────────────┘
```

**Example Student:**

```
Name: Arjun Kumar

Per Course Performance:
┌─────────────────────────────────────────┐
│ CSE-201 (Data Structures)               │
│ Attendance: 85% │████░░░░░░  85%        │
│ Grade: A (10/10)                        │
│ Assignments: 7/8                        │
│ Performance Index: 92                   │
│ Status: ✅ EXCELLENT                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ME-204 (Thermodynamics)                 │
│ Attendance: 78% │███░░░░░░░  78%        │
│ Grade: B+ (8/10)                        │
│ Assignments: 6/8                        │
│ Performance Index: 78                   │
│ Status: ⚠️ NEEDS IMPROVEMENT             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ECE-202 (Circuit Analysis)              │
│ ... similar breakdown                   │
└─────────────────────────────────────────┘
```

---

## 📋 HOW MONTHLY REPORTS WORK

### Report Generation

```
Teacher Clicks: "Generate Monthly Report"
├─ Selects: Month = April, Year = 2026
└─ Backend generates report:

┌────────────────────────────────────────────┐
│         CSE-201 ATTENDANCE REPORT          │
│         APRIL 2026                         │
├────────────────────────────────────────────┤
│                                            │
│ Prepared by: Arun Kumar                   │
│ Total Days: 20 (excluding weekends)       │
│                                            │
│ STUDENT ATTENDANCE SUMMARY:                │
│ ┌──────────────────────────────────────┐   │
│ │ Name        │ Present │ Absent │ %   │   │
│ ├─────────────┼─────────┼────────┼─────┤   │
│ │ Arjun Kumar │   20    │   0    │ 100%│   │
│ │ Bhavna ...  │   18    │   2    │ 90% │   │
│ │ Chirag ...  │   14    │   6    │ 70% │   │
│ │ Deepika ... │   19    │   1    │ 95% │   │
│ │ ...         │   ...   │  ...   │ ... │   │
│ │ Taran ...   │   15    │   5    │ 75% │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ STATISTICS:                                │
│ ├─ Average Attendance: 82%                │
│ ├─ Highest: Arjun Kumar (100%)            │
│ ├─ Lowest: Chirag Patel (70%)             │
│ ├─ Low Attendance (<75%): 4 students     │
│ └─ Critical Alert: 1 student <60%        │
│                                            │
│ RECOMMENDATIONS:                           │
│ ├─ Follow up with low attendance students │
│ ├─ Commend perfect attendance students    │
│ └─ Schedule meetings with parents         │
│                                            │
│ Generated: 2026-04-19 10:30 AM            │
│ PDF Export: Download                      │
│                                            │
└────────────────────────────────────────────┘
```

---

## 🗺️ HOW GEOFENCING WORKS

### The Haversine Formula (Distance Calculation)

```
CONCEPT:
Earth is a sphere. To find distance between two GPS points,
use Haversine formula (calculates great-circle distance)

FORMULA:
a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
c = 2 ⋅ atan2( √a, √(1−a) )
d = R ⋅ c   (R = Earth's radius in meters)

EXAMPLE:
┌─────────────────────────────────────┐
│ Teacher Location (Classroom):       │
│ Latitude: 28.5355°N                 │
│ Longitude: 77.3910°E                │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Student Location (Nearby):          │
│ Latitude: 28.5365°N                 │
│ Longitude: 77.3905°E                │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Calculation:                        │
│ Distance = 100 meters ✓             │
│ Allowed Range = 120 meters          │
│ 100m <= 120m → ✅ ALLOWED           │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Scenario 2 - Student Far Away:      │
│ Student Latitude: 28.5455°N         │
│ Student Longitude: 77.3910°E        │
│                                     │
│ Distance = 1000 meters ❌           │
│ 1000m > 120m → REJECTED             │
│ Error: "You are too far from class" │
└─────────────────────────────────────┘
```

---

## 🔐 HOW SECURITY WORKS

### Authentication Flow

```
┌─────────────────────────────────────────┐
│ 1. LOGIN                                │
│    User enters: email + password        │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 2. BACKEND VERIFICATION                 │
│    - Find user in database by email     │
│    - Check if exists ❓                 │
│      NO → Return "User not found"       │
│      YES → Continue                     │
│    - Compare password with hash         │
│      bcrypt.compare(inputPassword,      │
│               hashedPasswordInDB)        │
│      MATCH → Continue                   │
│      NO MATCH → Return "Wrong password" │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 3. JWT TOKEN GENERATION                 │
│    Create token containing:             │
│    {                                    │
│      email: "student1@edutrack.com",   │
│      role: "student",                  │
│      name: "Arjun Kumar",              │
│      iat: 1713607200,                  │
│      exp: 1713693600 (24 hours later)  │
│    }                                    │
│    Signed with secret key               │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 4. FRONTEND STORES TOKEN                │
│    localStorage.setItem(                │
│      'edutrack_token',                  │
│      'eyJhbGc...(long token)'           │
│    )                                    │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 5. FUTURE REQUESTS                      │
│    All API calls include:               │
│    Headers: {                           │
│      'Authorization':                   │
│      'Bearer eyJhbGc...'                │
│    }                                    │
│    Backend verifies token before        │
│    processing request                   │
└─────────────────────────────────────────┘
```

---

## 💾 HOW DATA IS STORED

### Database Structure

```
MongoDB Database: "edutrack"

┌─────────────────────────────────────────┐
│ users Collection (25 documents)         │
├─────────────────────────────────────────┤
│ {                                       │
│   _id: ObjectId(...),                   │
│   name: "Arun Kumar",                   │
│   email: "arun.kumar@edutrack.com",    │
│   passwordHash: "$2a$10$...(bcrypt)",   │
│   role: "teacher",                      │
│   department: "Computer Science",       │
│   createdAt: Date(2026-04-19)          │
│ }                                       │
│                                         │
│ • 5 teacher documents                   │
│ • 20 student documents                  │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ classes Collection (5 documents)        │
├─────────────────────────────────────────┤
│ {                                       │
│   _id: ObjectId(...),                   │
│   name: "Data Structures & Algorithms", │
│   code: "CSE-201",                      │
│   teacher: ObjectId(...ref to teacher),│
│   students: [ObjectId(...20 refs)],    │
│   schedule: [{                          │
│     day: "Monday",                      │
│     time: "10:00 AM - 11:30 AM"        │
│   }],                                   │
│   createdAt: Date(2026-04-19)          │
│ }                                       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ attendance Collection (>300 documents)  │
├─────────────────────────────────────────┤
│ {                                       │
│   _id: ObjectId(...),                   │
│   class: ObjectId(...),                 │
│   student: ObjectId(...),               │
│   date: Date(2026-04-19),              │
│   status: "present",  // or "absent"    │
│   markedAt: Date(2026-04-19T08:15Z),   │
│   distanceMeters: 100                   │
│ }                                       │
│                                         │
│ • 20 students × 5 courses × 15 days    │
│ • Total: 1500 attendance records       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ grades Collection (100 documents)       │
├─────────────────────────────────────────┤
│ {                                       │
│   _id: ObjectId(...),                   │
│   class: ObjectId(...),                 │
│   student: ObjectId(...),               │
│   internals: 85,  // out of 100         │
│   finals: 92,     // out of 100         │
│   grade: "A",     // letter grade       │
│   createdAt: Date(2026-04-19)          │
│ }                                       │
│                                         │
│ • 20 students × 5 courses = 100 records│
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ courseAnalytics Collection (5 docs)     │
├─────────────────────────────────────────┤
│ {                                       │
│   _id: ObjectId(...),                   │
│   course: ObjectId(...),                │
│   date: Date(2026-04-19),              │
│   presentCount: 16,                     │
│   absentCount: 4,                       │
│   attendancePercentage: 80,             │
│   insights: {                           │
│     highestAbsent: [3 students],       │
│     perfectAttendance: [5 students]    │
│   }                                     │
│ }                                       │
└─────────────────────────────────────────┘
```

---

## 🚀 COMPLETE WORKFLOW EXAMPLE

### Real Scenario: Today's CSE-201 Class

**8:00 AM - Teacher Preparation**
```
1. Teacher Arun Kumar opens website
2. Logs in: arun.kumar@edutrack.com / password123
3. Selects "Data Structures & Algorithms" course
4. Goes to Attendance tab
5. Clicks "Use My Class Location"
   - Browser popup: "Allow location?"
   - Teacher clicks "Allow"
   - Location captured: 28.5355, 77.3910 (exact classroom)
6. Clicks "Generate Attendance QR"
   - Backend creates QR session
   - QR displayed with token: ATD-A1B2C3
   - Expires in 15 minutes
7. Teacher displays QR on projector
```

**8:05 AM - Students Arrive**
```
All 20 students enter classroom with phones

Student 1 (Arjun):
  1. Opens website
  2. Logs in: student1@edutrack.com
  3. Goes to Attendance tab
  4. Sees QR code on screen, enters token: ATD-A1B2C3
  5. Clicks "Capture My Location"
  6. Clicks "Mark Attendance"
  7. Backend validation:
     - Token valid ✓
     - Token not expired ✓
     - Distance 95m < 120m ✓
  8. Result: ✅ "Attendance marked for CSE-201"

Student 2 (Bhavna):
  Same process...
  [18 more students follow]

Total: 16 marked present, 4 absent (marked later)
```

**8:20 AM - Real-Time Analytics**
```
Teacher clicks "Analytics":
- Sees 16/20 present (80%)
- See names of who came
- See who's missing
- Can send notifications to absent students
```

**End of Day - Reports**
```
Teacher clicks "Generate Monthly Report":
- System calculates April 2026 stats
- 20 days of attendance
- All 20 students analyzed
- Average: 82%
- Identifies low attendance: 4 students
- Can download as PDF
```

---

## ✅ SUMMARY: HOW IT ALL WORKS

1. **Setup** → `/api/setup/multi-subject` creates 25 users + 5 courses
2. **Login** → User auth with JWT token
3. **Teacher** → Generates QR with GPS + 15 min expiry
4. **Student** → Enters QR, system validates location + time
5. **Attendance** → Recorded in database
6. **Analytics** → Real-time calculation & display
7. **Reports** → Monthly summaries auto-generated
8. **Security** → Passwords hashed, tokens time-limited, location validated

---

**Everything works together to create a complete Smart Classroom System! 🎓**

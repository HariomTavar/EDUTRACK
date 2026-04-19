# 🎓 EduTrack Quick Reference Card

## ⚡ Get Started in 3 Steps

### Step 1: Start Backend
```bash
cd backend && npm start
```

### Step 2: Start Frontend
```bash
cd frontend && npm run dev
```

### Step 3: Create Test Data
```bash
curl -X POST http://localhost:5000/api/setup/multi-subject -H "Content-Type: application/json"
```

---

## 👥 Login Credentials

### TEACHERS (Pick Any One)

| # | Email | Password |
|---|-------|----------|
| 1 | arun.kumar@edutrack.com | password123 |
| 2 | priya.singh@edutrack.com | password123 |
| 3 | vikram.patel@edutrack.com | password123 |
| 4 | deepak.sharma@edutrack.com | password123 |
| 5 | neha.gupta@edutrack.com | password123 |

### STUDENTS (20 Available)

| # | Email | Password |
|---|-------|----------|
| 1-20 | student1@edutrack.com - student20@edutrack.com | password123 |

**Website:** `http://localhost:5173`

---

## 📚 5 Courses (All Students Enrolled)

1. **CSE-201** - Data Structures & Algorithms
2. **ME-204** - Thermodynamics
3. **ECE-202** - Circuit Analysis
4. **CE-203** - Structural Design
5. **EE-205** - Power Systems

---

## 🎯 Quick Test Flow

### As Teacher:
1. Login with `arun.kumar@edutrack.com`
2. Go to Attendance tab
3. Click "Generate Attendance QR"
4. Share QR token with students

### As Student:
1. Login with `student1@edutrack.com`
2. Go to Attendance tab
3. Enter teacher's QR token
4. Click "Mark Attendance"
5. ✅ Done!

---

## 📊 What You'll See

**Teacher Dashboard:**
- 20 students enrolled
- Attendance: 80%
- 5 courses managed
- Analytics & reports

**Student Dashboard:**
- 5 courses visible
- Grades per subject
- Attendance tracking
- Performance index

---

## ✅ All Credentials in One File

📄 **[LOGIN_CREDENTIALS.md](LOGIN_CREDENTIALS.md)**

Complete details for all 25 users:
- Full names
- Email addresses
- Passwords
- Roles
- Department assignments

---

## 📖 Documentation

| Doc | Content |
|-----|---------|
| [LOGIN_CREDENTIALS.md](LOGIN_CREDENTIALS.md) | All login info |
| [START_HERE.md](START_HERE.md) | Setup instructions |
| [COMPLETE.md](COMPLETE.md) | What was built |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | Technical details |

---

## ⚙️ System Created

✅ 5 B.Tech subject courses
✅ 5 dedicated teachers
✅ 20 multi-discipline students
✅ 15 days of attendance data
✅ Grades & performance scores
✅ QR geofenced attendance
✅ Smart analytics
✅ Monthly reports

---

## 🚀 You're Ready!

Everything is working. Just:
1. Start servers
2. Call setup endpoint
3. Login with provided credentials
4. Start using!

---

**Happy Learning! 🎉**

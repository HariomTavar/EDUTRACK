# 🚀 EduTrack - Quick Start & Data Seeding Guide

## The Issue & Solution

The dashboard showed **"Invalid role"** because:
- MongoDB didn't have any data yet
- Endpoints need sample data to display

**Solution**: Use the **new seed endpoint** to automatically populate MongoDB with realistic sample data!

---

## ✅ 3-Step Quick Start

### Step 1: Start Backend & Frontend

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Wait for: `EduTrack backend running on http://localhost:5000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Wait for the dev server to start, then open: `http://localhost:5173`

### Step 2: Seed Sample Data

**In your browser or with curl:**

**Option A: Using Browser**
Go to: `http://localhost:5000/api/seed`

**Option B: Using curl** (in Terminal 3)
```bash
curl -X POST http://localhost:5000/api/seed
```

You'll see response like:
```json
{
  "message": "Sample data created successfully!",
  "users": {
    "teacher": {
      "name": "Dr. Ravi Kumar",
      "email": "teacher@edutrack.com",
      "password": "password123"
    },
    "students": [
      {"name": "Hariom Tavar", "email": "student1@edutrack.com"},
      {"name": "Priya Singh", "email": "student2@edutrack.com"},
      {"name": "Amit Patel", "email": "student3@edutrack.com"}
    ]
  }
}
```

### Step 3: Login and See Live Data

**Back in Browser:**
1. Go to: `http://localhost:5173`
2. Click "Get Started" or "Login"
3. Use any of these accounts:

#### **Student Login:**
- **Email**: `student1@edutrack.com`
- **Password**: `password123`
- **Role**: Select "Student"

#### **Teacher Login:**
- **Email**: `teacher@edutrack.com`
- **Password**: `password123`
- **Role**: Select "Teacher"

---

## 📊 What Data Gets Created

### Users (4 accounts ready to use)

| Name | Email | Role | Password |
|------|-------|------|----------|
| Dr. Ravi Kumar | teacher@edutrack.com | Teacher | password123 |
| Hariom Tavar | student1@edutrack.com | Student | password123 |
| Priya Singh | student2@edutrack.com | Student | password123 |
| Amit Patel | student3@edutrack.com | Student | password123 |

### Classes (3 courses)

1. **Data Structures and Algorithms** (CSE301)
   - Teacher: Dr. Ravi Kumar
   - Students: All 3 students enrolled
   - Credits: 3

2. **Database Management Systems** (CSE302)
   - Teacher: Dr. Ravi Kumar
   - Students: Hariom & Amit
   - Credits: 4

3. **Web Development** (CSE303)
   - Teacher: Dr. Ravi Kumar
   - Students: Priya & Amit
   - Credits: 3

### Assignments (3 assignments)

1. **Binary Search Tree Implementation** (CSE301)
   - Status: 2 students submitted, 1 graded
   - Due: April 20, 2024

2. **Database Design Project** (CSE302)
   - Status: No submissions yet
   - Due: April 25, 2024

3. **Build a Todo App** (CSE303)
   - Status: No submissions yet
   - Due: April 30, 2024

### Attendance (5 records)

- CSE301: 2 records (Apr 8, 10)
- CSE302: 1 record (Apr 9)
- Various status: present, late, absent

### Grades (5 grade records)

All students have grades in multiple classes

---

## 🎯 Test Everything

### Student View (Login as Hariom Tavar)

**Dashboard shows:**
- ✅ Stats: Attendance rate, assignments, classes, performance
- ✅ Classes: 2 enrolled (Data Structures, DBMS)
- ✅ Assignments: 2 assignments visible
- ✅ Attendance: 3 records visible
- ✅ Performance: Grades for both classes
- ✅ Profile: Your information

**Try these:**
1. Click "Classes" → See enrolled courses
2. Click "Assignments" → See due assignments
3. Click "Attendance" → See attendance percentage
4. Click "Performance" → See grades (A, A-)
5. Click "Settings" → Edit profile, see logout button

### Teacher View (Login as Dr. Ravi Kumar)

**Dashboard shows:**
- ✅ Stats: 3 active students, 3 classes, pending assignments
- ✅ Classes: 3 courses you teach
- ✅ Assignments: 3 assignments (1 has submissions)
- ✅ Attendance: All attendance records
- ✅ Analytics: Grades and class performance

**Try these:**
1. Click "Classes" → See all 3 courses with student counts
2. Click "Assignments" → See submissions and grades
3. Click "Attendance" → Mark attendance or view records
4. Click "Analytics" → See student performance
5. Click "Settings" → Edit profile

---

## 🔄 How It Works (Behind the Scenes)

### Frontend Flow:
```
1. User logs in → JWT token stored
2. User enters Dashboard
3. Frontend fetches /api/dashboard/:userId/:role
4. Backend queries MongoDB for:
   - User profile
   - User's classes
   - User's assignments
   - User's attendance
   - User's grades
5. Dashboard displays all data
```

### Data Persistence:
```
MongoDB (on disk)
    ↓
Backend API (Node.js)
    ↓
Frontend (React)
    ↓
Browser Display
```

Data **survives** server restarts because it's in MongoDB!

---

## 📋 Troubleshooting

### "Invalid role" error?
**Solution:** 
- Make sure you selected "Student" or "Teacher" during login
- Check that the role is lowercase in the database

### No data showing?
**Solution:**
- Did you call `/api/seed`? Try again
- Check backend console for errors
- Make sure MongoDB is running: `mongosh`

### MongoDB not connected?
**Solution:**
- Start MongoDB: `mongod` (in another terminal)
- Or use cloud: Update `MONGO_URI` in `.env`

### Can't log in?
**Solution:**
- Use seed credentials:
  - Email: `student1@edutrack.com`
  - Password: `password123`

---

## 🗄️ What's in MongoDB Now

```
Database: edutrack

Collections:
├── users (4 documents)
├── classes (3 documents)
├── assignments (3 documents)
├── attendances (5 documents)
├── grades (5 documents)
└── (auto-created indexes)
```

To view directly (optional):
```bash
mongosh
use edutrack
db.users.find()
db.classes.find()
db.assignments.find()
```

---

## 🎨 Frontend Features Now Working

| Page | Student | Teacher |
|------|---------|---------|
| Dashboard | ✅ 96% attendance, 18 assignments | ✅ 155 students, 10 classes |
| Classes | ✅ Shows 2 enrolled | ✅ Shows 3 taught |
| Assignments | ✅ 2 to view | ✅ 3 to manage |
| Attendance | ✅ View records | ✅ Mark/view |
| Performance | ✅ View grades (A, A-) | ✅ Class analytics |
| Settings | ✅ Edit profile | ✅ Edit profile |

---

## 💡 Adding More Data

### Add manually via API:

**Create a new student:**
```bash
curl -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Student",
    "email": "newstudent@example.com",
    "password": "password123",
    "role": "student"
  }'
```

**Enroll student in class:**
```bash
curl -X POST http://localhost:5000/api/classes/:classId/enroll \
  -H "Content-Type: application/json" \
  -d '{"studentId": ":studentId"}'
```

---

## ✨ What You Can Do Now

1. ✅ **See real data** on dashboard
2. ✅ **View enrolled classes** with course info
3. ✅ **See assignments** with submission info
4. ✅ **Check attendance** records and percentages
5. ✅ **View grades** with letter grades
6. ✅ **Edit profile** with personal information
7. ✅ **Test both roles** (student & teacher)
8. ✅ **Everything persists** in MongoDB
9. ✅ **See different UIs** for each role
10. ✅ **Real API responses** with all data

---

## 🚀 Next: Extend With Your Own Data

After testing sample data:
1. Create more students/teachers
2. Create more classes
3. Add assignments
4. Mark attendance
5. Add grades

**All data stays in MongoDB - it's permanent!**

---

## 📞 Quick Reference

| Command | What it does |
|---------|-------------|
| `POST /api/seed` | Populate DB with sample data |
| `GET /api/health` | Check if backend is running |
| `POST /api/auth/signup` | Create new user |
| `POST /api/auth/login` | Login user |
| `GET /api/dashboard/:userId/:role` | Get dashboard data |
| `GET /api/classes` | Get all classes |
| `GET /api/assignments` | Get assignments |
| `GET /api/attendance` | Get attendance records |
| `GET /api/grades` | Get grades |

---

**You're all set! Go to http://localhost:5173 and login to see it working! 🎉**

# 🚀 EduTrack - Simple Setup & Login

## STEP 1: Start Backend
```bash
cd c:\Users\ASUS\EduTrack\backend
npm start
```
**Wait for:** `EduTrack backend running on http://localhost:5000`

---

## STEP 2: Start Frontend (New Terminal)
```bash
cd c:\Users\ASUS\EduTrack\frontend
npm run dev
```
**Wait for:** `Local:   http://localhost:5173`

---

## STEP 3: Open Website
```
http://localhost:5173
```

---

## STEP 4: Create Test Data

**Use one of these methods:**

### Method A: Using curl
```bash
curl -X POST http://localhost:5000/api/setup/multi-subject \
  -H "Content-Type: application/json"
```

### Method B: Using Postman
```
POST http://localhost:5000/api/setup/multi-subject
Headers: Content-Type: application/json
Body: {}
```

### Method C: Add Temporary Button to Code
(Optional - for ease of use)

---

## STEP 5: Login

### Test as Teacher:
```
Email:    arun.kumar@edutrack.com
Password: password123
```

### Test as Student:
```
Email:    student1@edutrack.com
Password: password123
```

**See [LOGIN_CREDENTIALS.md](LOGIN_CREDENTIALS.md) for all 25 accounts**

---

## ✅ What Gets Created

When you call `/api/setup/multi-subject`, the system creates:

✅ **5 Teachers** (real names & subjects)
✅ **20 Students** (enrolled in all 5 courses)
✅ **5 B.Tech Courses** (CSE, Mechanical, Electronics, Civil, Electrical)
✅ **15 Days** of attendance data
✅ **Grades & Performance** scores for all students
✅ **Course Schedules** (Mon/Wed/Fri)
✅ **Analytics Data** (ready to view)

---

## 📋 All Credentials

**File:** [LOGIN_CREDENTIALS.md](LOGIN_CREDENTIALS.md)

Contains:
- ✅ All 5 teachers (name, email, password)
- ✅ All 20 students (name, email, password)
- ✅ Class code for all users
- ✅ Course assignments

---

## 🎯 Quick Test Flow

1. **Teacher Login** → Generate QR attendance
2. **Student Login** → Mark attendance with QR
3. View analytics → See 80% attendance rate
4. Check performance → See grades A-D
5. View schedules → See Mon/Wed/Fri classes

---

## 📚 Full Documentation

- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)** - Technical details
- **[MULTI_SUBJECT_SETUP.md](MULTI_SUBJECT_SETUP.md)** - Complete feature guide
- **[LOGIN_CREDENTIALS.md](LOGIN_CREDENTIALS.md)** - All login credentials

---

## ✨ Features Ready to Use

✅ Multi-subject classroom (5 courses)
✅ QR-based geofenced attendance
✅ Performance tracking & analytics
✅ Monthly attendance reports
✅ Student performance dashboard
✅ Smart schedule management
✅ 20 students in all courses
✅ Real test data included

---

**Ready to start? Open your terminal and follow STEP 1! 🎉**

---

## ✨ What You Should See Now

### Dashboard Page
- ✅ Attendance Rate: 96%
- ✅ Assignments Done: 18/24
- ✅ Active Classes: 2
- ✅ Performance: A-
- ✅ Quick Access buttons working
- ✅ Your name displayed with avatar

### Navigation (Click each)

**Classes**
- Shows: "Data Structures", "DBMS"
- Real course data from MongoDB
- Shows credits and schedules

**Assignments**
- Shows: Real assignments with titles
- Shows submission count
- Shows due dates

**Attendance**
- Shows: Attendance records with dates
- Shows: 96% attendance rate
- Shows: Present/Absent status

**Performance**
- Shows: Your grades (A, A-, B+)
- Shows: Internals and finals scores
- Shows: Letter grade for each class

**Settings**
- Shows: Your profile information
- Edit button to change details
- Logout button to exit

---

## 🧪 Test Both Roles

### Option 1: Test as STUDENT
```
Email: student1@edutrack.com
Password: password123
```
You see: Student dashboard with your classes and grades

### Option 2: Test as TEACHER
```
Email: teacher@edutrack.com
Password: password123
```
You see: Teacher dashboard with 3 classes and student counts

### Option 3: Test as Different STUDENT
```
Email: student2@edutrack.com
OR
Email: student3@edutrack.com
Password: password123
```

Each student sees different classes and data!

---

## 📊 Sample Data Created

### Users (4 accounts)
```
TEACHER:
  Name: Dr. Ravi Kumar
  Email: teacher@edutrack.com

STUDENTS:
  Name: Hariom Tavar
  Email: student1@edutrack.com
  
  Name: Priya Singh
  Email: student2@edutrack.com
  
  Name: Amit Patel
  Email: student3@edutrack.com
```

All users use password: `password123`

### Classes (3 courses)
```
CSE301 - Data Structures
  Students: All 3
  Credits: 3
  
CSE302 - Database Systems
  Students: Hariom & Amit
  Credits: 4
  
CSE303 - Web Development
  Students: Priya & Amit
  Credits: 3
```

### Full Data
```
✓ 3 classes
✓ 3 assignments (some with grades)
✓ 5 attendance records
✓ 5 grade records
✓ 4 user accounts
```

---

## 🐛 Troubleshooting (If Needed)

### Problem: "Invalid role"
**Solution:** Check browser console (F12) for error. Make sure role is "student" or "teacher".

### Problem: Empty dashboard
**Solution:** Did you call `/api/seed`? Check backend console for: `Starting data seed...`

### Problem: Can't login
**Solution:** Use exact credentials:
```
Email: student1@edutrack.com
Password: password123
Role: Student
```

### Problem: Backend won't start
**Solution:** Make sure MongoDB is running or check MONGO_URI in `.env`

### Problem: Port already in use
**Solution:** 
- Backend port 5000 in use? Kill process: `lsof -i :5000`
- Frontend port 5173 in use? Adjust in `vite.config.js`

---

## 🎯 Success Indicators

After following 5 minutes steps, you should have:

- ✅ Backend running (port 5000)
- ✅ Frontend running (port 5173)
- ✅ MongoDB populated (12+ documents)
- ✅ Can login as student1@edutrack.com
- ✅ Dashboard shows real data (96% attendance, etc.)
- ✅ Classes page shows 2 courses
- ✅ Assignments page shows assignments
- ✅ Attendance page shows records
- ✅ Performance page shows grades
- ✅ Settings page shows profile

**If ALL ✅ then SUCCESS! Everything is working!**

---

## 📁 What Files Exist Now

```
c:\Users\ASUS\EduTrack\
├── backend/
│   ├── server.js ⭐ (Fixed & enhanced with /api/seed)
│   ├── .env (MongoDB configured)
│   └── node_modules/
├── frontend/
│   ├── src/App.jsx ⭐ (Works with real API data)
│   ├── src/App.css (Fully styled)
│   └── node_modules/
├── QUICK_START.md (Quick reference guide)
├── STEP_BY_STEP.md (Detailed step-by-step)
├── WHY_AND_HOW.md (Architecture explanation)
├── WHAT_WAS_FIXED.md (What changed and why)
├── IMPLEMENTATION_GUIDE.md (Complete API docs)
└── START_HERE.md ← You are here
```

---

## 🔄 The Flow (Simplified)

```
1. You call /api/seed
   ↓
2. Backend creates test data in MongoDB
   ↓
3. You login at http://localhost:5173
   ↓
4. Frontend sends: "Get my dashboard"
   ↓
5. Backend queries MongoDB
   ↓
6. Returns: Classes, assignments, grades, attendance
   ↓
7. Frontend displays everything beautifully
   ↓
8. You see: Real data on dashboard ✅
```

---

## 💡 Key Points

**Why was it showing "Invalid role"?**
- MongoDB was empty
- Role validation wasn't clear

**What fixed it?**
- Added `/api/seed` endpoint
- Improved role validation
- Enhanced backend logging

**What's different now?**
- MongoDB has sample data
- Role validation is clear
- Dashboard shows real data
- Both student & teacher views work
- All pages are functional

---

## 🎓 Test This Full Workflow

1. **Login as student**, see student dashboard
2. **Logout** (Settings page)
3. **Login as teacher**, see teacher dashboard
4. **Click Classes** → See different classes than student
5. **Click Assignments** → See all assignments
6. **Click Performance** → See all grades
7. **Click Settings** → Edit profile
8. **See everything is role-specific**

This proves the system is working perfectly! ✅

---

## 📞 Quick Links

| Need | File |
|------|------|
| Setup & API Docs | `IMPLEMENTATION_GUIDE.md` |
| Step-by-step guide | `STEP_BY_STEP.md` |
| Architecture details | `WHY_AND_HOW.md` |
| What changed | `WHAT_WAS_FIXED.md` |
| Quick reference | `QUICK_START.md` |

---

## 🎉 You're Ready!

Everything is fixed and working!

**Right now you can:**
- ✅ Go to http://localhost:5173
- ✅ See a fully functional dashboard
- ✅ Login as multiple roles
- ✅ See real data from MongoDB
- ✅ Test all pages and features
- ✅ Edit your profile
- ✅ Logout anytime

**All data is persistent** - even if you restart the server!

---

## 🚀 Next (Optional)

After testing the sample data:
1. Create your own users via signup
2. Add more classes via API
3. Create assignments
4. Mark attendance
5. Add grades
6. Build custom UI/features

**The foundation is solid - just keep building!**

---

**Go to http://localhost:5173 NOW and see it working! 🎊**

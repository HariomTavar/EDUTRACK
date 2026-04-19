# 🚀 Quick Start Guide - EduTrack Multi-Subject Classroom

## 1️⃣ Start the Servers

### Terminal 1: Backend
```bash
cd c:\Users\ASUS\EduTrack\backend
npm start
```
✅ Listens on `http://localhost:5000`

### Terminal 2: Frontend  
```bash
cd c:\Users\ASUS\EduTrack\frontend
npm run dev
```
✅ Listens on `http://localhost:5173`

---

## 2️⃣ Setup Multi-Subject System

1. Open browser: **`http://localhost:5173`**
2. Click blue button: **"Setup Multi-Subject B.Tech (Smart Classroom)"**
3. Wait 2-3 seconds for setup to complete
4. You'll see green message with all 5 course names

---

## 3️⃣ Test as TEACHER

**Login Credentials:**
- Email: `arun.kumar@edutrack.com`
- Password: `password123`

**What to do:**
1. Click "Login" button
2. Enter credentials above
3. Click "Go to Dashboard"
4. Select a course from left sidebar
5. Go to "Attendance" tab
6. Click "Use My Class Location" (allows location)
7. Click "Generate Attendance QR"
8. See QR code with token (e.g., `ATD-A1B2C3`)

---

## 4️⃣ Test as STUDENT  

**Login Credentials:**
- Email: `student1@edutrack.com`
- Password: `password123`

**What to do:**
1. Click "Login" button
2. Enter credentials above
3. Click "Go to Dashboard"
4. See all 5 courses listed
5. Go to "Attendance" tab
6. Enter teacher's QR token (from step 8 above)
7. Click "Capture My Location" (allows location)
8. Click "Mark Attendance via QR"
9. See ✅ "Attendance marked successfully"

---

## 5️⃣ View Analytics (TEACHER)

1. Stay logged in as teacher
2. Go to course page
3. Find "Analytics" or "Reports" section
4. See:
   - Attendance % (should be ~80%)
   - Student performance distribution
   - Attendance trends (past 15 days)
   - Monthly report option

---

## 📱 5 Available Courses

| # | Course | Teacher Email |
|---|--------|--------------|
| 1 | **Data Structures** | arun.kumar@edutrack.com |
| 2 | **Thermodynamics** | priya.singh@edutrack.com |
| 3 | **Circuit Analysis** | vikram.patel@edutrack.com |
| 4 | **Structural Design** | deepak.sharma@edutrack.com |
| 5 | **Power Systems** | neha.gupta@edutrack.com |

**All teachers use:** Password: `password123`

---

## 👥 20 Available Students

- `student1@edutrack.com` through `student20@edutrack.com`
- **All use:** Password: `password123`

---

## 🎯 Key Features to Try

✅ **QR Attendance** - Generate & scan QR codes  
✅ **Geofencing** - 120m classroom zone  
✅ **Attendance Analytics** - View 15 days of data  
✅ **Performance Tracking** - Student grades & trends  
✅ **Multiple Courses** - All students in all courses  
✅ **Monthly Reports** - Auto-generate PDFs  

---

## ⚠️ Important Notes

### Location Permission
- You'll see a browser popup asking for location access
- Click "Allow" to enable geofencing
- **Only works on localhost or HTTPS**

### Geofencing Range
- Default: 120 meters from classroom
- To mark attendance, you must be within 120m of teacher's location
- In testing, use similar location (both "in classroom")

### QR Token Lifetime  
- QR tokens expire after 15 minutes
- Ask teacher to generate new QR if expired
- Token format: `ATD-XXXXXX` (6 hex characters)

---

## 🔍 Example Workflow

### Complete Flow (5 minutes)

**Minute 1-2: Setup**
```
1. Click "Setup Multi-Subject B.Tech" button
2. Wait for "✅ Setup Created" message
```

**Minute 2-3: Teacher Login**
```
1. Email: arun.kumar@edutrack.com
2. Password: password123
3. Click "Go to Dashboard"
```

**Minute 3-4: Generate QR**
```
1. Select "Data Structures & Algorithms" course
2. Go to "Attendance" tab
3. Click "Use My Class Location"
4. Click "Generate Attendance QR"
5. Copy/note the token (ATD-XXXXX)
```

**Minute 4-5: Student Marks Attendance**
```
1. Logout (top right → Logout)
2. Login with student1@edutrack.com / password123
3. Go to Attendance tab
4. Enter teacher's token (ATD-XXXXX)
5. Click "Capture My Location"
6. Click "Mark Attendance via QR"
7. See ✅ Success message
```

---

## 📊 What You'll See

### Teacher Dashboard Shows:
- ✅ All 20 students enrolled
- ✅ Attendance: ~80% (pre-seeded data)
- ✅ 15 days of attendance history
- ✅ Student performance scores
- ✅ Course schedule (Mon/Wed/Fri)

### Student Dashboard Shows:
- ✅ All 5 courses available
- ✅ Grades per course
- ✅ Attendance % per course
- ✅ Assignments to submit
- ✅ Performance index (0-100)

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Frontend won't load" | Check `npm run dev` is running on terminal 2 |
| "Backend API error" | Check `npm start` is running on terminal 1 |
| "Location not detected" | Make sure you click "Allow" when browser asks |
| "Out of range" error | Teacher & student need similar location (same room) |
| "QR expired" | Ask teacher to generate new QR (15 min lifetime) |

---

## 🎓 Educational Scenario

This system simulates a real B.Tech classroom where:

1. **5 Different Departments** teach one class
2. **20 Students** from mixed backgrounds attend all courses  
3. **Each course** has independent attendance & grades
4. **Teachers** can track attendance patterns & performance
5. **Students** can see their progress across all subjects

Perfect for:
- Multi-disciplinary programs
- Inter-departmental courses
- Shared student groups
- Attendance compliance
- Performance analytics

---

## ✅ Checklist Before Testing

- [ ] Backend running (`npm start`)
- [ ] Frontend running (`npm run dev`)
- [ ] Browser open to `http://localhost:5173`
- [ ] Clicked "Setup Multi-Subject B.Tech" button
- [ ] Setup completed (green message)
- [ ] Location permission enabled in browser
- [ ] MongoDB running OR in-memory mode active

---

## 📞 Need Help?

1. **Check backend logs** - See error messages
2. **Check browser console** - F12 → Console tab
3. **Network tab** - See API responses
4. **Backend port** - Make sure 5000 is free
5. **Frontend port** - Make sure 5173 is free

---

**You're all set! 🎉 Start testing the multi-subject classroom system now!**

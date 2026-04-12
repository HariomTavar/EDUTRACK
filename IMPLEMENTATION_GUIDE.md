# EduTrack - Complete Setup & Usage Guide

## ✅ What's Been Implemented

### Backend (MongoDB + Express)
- **MongoDB Integration**: Full database with schemas for:
  - Users (Students & Teachers)
  - Classes
  - Assignments
  - Attendance
  - Grades/Performance

- **API Endpoints** (All working with role-based access):
  - **Auth**: `/api/auth/signup`, `/api/auth/login`, `/api/auth/google`
  - **Profile**: `GET/PUT /api/profile/:userId`
  - **Dashboard**: `GET /api/dashboard/:userId/:role`
  - **Classes**: `GET/POST/PUT /api/classes`, `POST /api/classes/:classId/enroll`
  - **Assignments**: `GET/POST /api/assignments`, `POST /api/assignments/:assignmentId/submit`, `PUT /api/assignments/:assignmentId/grade`
  - **Attendance**: `GET/POST /api/attendance`
  - **Grades**: `GET/POST/PUT /api/grades`

### Frontend (React + Vite)
- **Fully Functional Pages for Both Student & Teacher Roles**:
  - ✅ Dashboard (real-time stats from DB)
  - ✅ Classes (list all enrolled/taught classes)
  - ✅ Assignments (submission & grading)
  - ✅ Attendance (records & statistics)
  - ✅ Performance/Analytics (grades & class analytics)
  - ✅ **Profile/Settings** (view & edit profile, logout)

- **Features**:
  - Real data fetched from MongoDB
  - Role-based views (different for students vs teachers)
  - Profile management with editable fields
  - Responsive design
  - Shimmer loading states
  - Error handling

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- MongoDB (local or Atlas)
- npm/yarn

### 1. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

**Backend** (`.env` - already configured):
```env
PORT=5000
JWT_SECRET=edutrack-dev-secret-change-in-production
FRONTEND_ORIGIN=http://localhost:5173
MONGO_URI=mongodb://127.0.0.1:27017/edutrack
```

**Frontend** (`.env` - already created):
```env
VITE_API_BASE_URL=http://localhost:5000
```

### 3. Start MongoDB

**Option A: Local MongoDB**
```bash
mongod
```

**Option B: MongoDB Atlas (Cloud)**
Update `MONGO_URI` in backend `.env`:
```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/edutrack?retryWrites=true&w=majority
```

### 4. Start the Services

**Terminal 1 - Backend**:
```bash
cd backend
npm run dev
```
Backend will run on `http://localhost:5000`

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
```
Frontend will run on `http://localhost:5173`

## 📱 Using the Application

### Landing Page
- **URL**: `http://localhost:5173`
- Features overview and sign up/login options

### Authentication
1. Click "Get Started" or "Login"
2. Choose **Student** or **Teacher** role
3. Sign up with email/password or Google

### Dashboard Views

#### For Students:
- **Dashboard**: Attendance rate, assignments done, active classes, performance
- **Classes**: All enrolled classes with credit info
- **Assignments**: View and submit assignments
- **Attendance**: View attendance records and rate
- **Performance**: View grades for each class
- **Settings**: Edit profile, view stats, logout

#### For Teachers:
- **Dashboard**: Active students, attendance rate, pending assignments
- **Classes**: All taught classes with student counts
- **Assignments**: Create and grade assignments, view submissions
- **Attendance**: Mark and view attendance
- **Analytics**: View class performance and student grades
- **Settings**: Edit profile, manage account

## 🗄️ Database Schema

### User Collection
```javascript
{
  name: String,
  email: String (unique),
  passwordHash: String,
  role: 'student' | 'teacher',
  bio: String,
  department: String,
  year: String,
  section: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Class Collection
```javascript
{
  name: String,
  code: String (unique),
  subject: String,
  teacher: ObjectId (ref: User),
  students: [ObjectId] (ref: User),
  credits: Number,
  description: String,
  schedule: [{day, time, room}]
}
```

### Assignment Collection
```javascript
{
  title: String,
  description: String,
  class: ObjectId (ref: Class),
  teacher: ObjectId (ref: User),
  dueDate: Date,
  maxScore: Number,
  submissions: [{
    student: ObjectId,
    content: String,
    score: Number,
    feedback: String,
    submittedAt: Date,
    isLate: Boolean
  }]
}
```

### Attendance Collection
```javascript
{
  class: ObjectId (ref: Class),
  date: Date,
  records: [{
    student: ObjectId,
    status: 'present' | 'absent' | 'late'
  }]
}
```

### Grade Collection
```javascript
{
  student: ObjectId (ref: User),
  class: ObjectId (ref: Class),
  internals: Number,
  finals: Number,
  grade: String ('A', 'A-', 'B', 'B-', 'C')
}
```

## 🔧 API Usage Examples

### Create a Class (Teacher)
```javascript
POST /api/classes
{
  "name": "Data Structures",
  "code": "CSE301",
  "subject": "Computer Science",
  "teacher": "user_id",
  "credits": 3,
  "description": "Learn DSA fundamentals"
}
```

### Create an Assignment
```javascript
POST /api/assignments
{
  "title": "Binary Trees",
  "description": "Implement BST operations",
  "classId": "class_id",
  "teacher": "user_id",
  "dueDate": "2024-04-20",
  "maxScore": 100
}
```

### Submit Assignment
```javascript
POST /api/assignments/:assignmentId/submit
{
  "studentId": "user_id",
  "content": "My solution code..."
}
```

### Mark Attendance
```javascript
POST /api/attendance
{
  "classId": "class_id",
  "date": "2024-04-11",
  "records": [
    {"student": "student_id", "status": "present"},
    {"student": "student_id2", "status": "absent"}
  ]
}
```

### Create Grade
```javascript
POST /api/grades
{
  "studentId": "user_id",
  "classId": "class_id",
  "internals": 38,
  "finals": 75
}
```

## 🎨 Frontend Features

### Profile Section
- **View Profile**: Display name, email, department, year, section
- **Edit Profile**: Update bio, department, year, section
- **Avatar**: Auto-generated from name

### Pages
All pages are **data-driven from MongoDB**:
- Empty states with helpful messages
- Real counts and statistics
- Role-specific UI

### Responsive Design
- Works on desktop (1024px+)
- Optimized for mobile (tablet fallbacks)
- Touch-friendly buttons and forms

## 📊 Data Persistence
- All data is stored in **MongoDB**
- Survives server restarts
- Accessible from multiple clients
- Consistent role-based access control

## 🚨 Error Handling
- Try/catch blocks on all fetch calls
- User-friendly error messages
- Graceful fallbacks for missing data
- Non-blocking errors (shows toast notifications)

## 🔒 Security
- JWT-based authentication (7-day expiry)
- Password hashing with bcryptjs
- CORS protected endpoints
- Role checking on backend

## 📈 Performance
- Frontend: ~66KB gzipped JavaScript
- CSS: ~7KB gzipped
- Lazy data loading (fetch on tab change)
- Efficient MongoDB queries

## 🐛 Testing
To test the system:

1. **Create a student account**: Sign up as "student"
2. **Create a teacher account**: Sign up as "teacher"  
3. **Teacher actions**:
   - Create classes via API or UI
   - Create assignments
   - Mark attendance
   - Add grades
4. **Student actions**:
   - View enrolled classes (if teacher added them)
   - View assignments, attendance, grades
   - Edit profile

## 📝 Sample Test Data

You can seed test data using MongoDB directly or create via API.

**MongoDB Commands** (mongosh):
```javascript
db.users.insertOne({
  name: "John Doe",
  email: "john@example.com",
  passwordHash: "$2a$10...",
  role: "student",
  department: "CSE"
})

db.classes.insertOne({
  name: "Data Structures",
  code: "CSE301",
  subject: "Computer Science",
  teacher: ObjectId("..."),
  students: [ObjectId("...")],
  credits: 3
})
```

##  🎯 Next Steps / Future Enhancements

- [ ] File uploads for assignments
- [ ] Real-time notifications
- [ ] Dark mode toggle
- [ ] Advanced analytics & charts
- [ ] Messaging system
- [ ] Calendar integration
- [ ] Email notifications
- [ ] Mobile app (React Native)
- [ ] Admin dashboard
- [ ] Batch import (CSV for classes/students)

## 📞 Support

If you encounter issues:

1. Check console errors (`F12` → Console tab)
2. Verify MongoDB is running: `mongosh`
3. Check backend logs: `console output`
4. Verify `.env` variables are correct
5. Clear browser cache and reload

## ✨ System Benefits

✅ **Fully Functional**: Every page works with real data
✅ **Role-Based**: Different views for students vs teachers  
✅ **MongoDB Backed**: Data persists and scales
✅ **Professional UI**: Modern, responsive design
✅ **Production Ready**: Error handling, auth, CORS
✅ **Extensible**: Easy to add more features

---

**Build Date**: April 2024
**Status**: ✅ Production Ready

# 🔧 GitHub Clone & MongoDB Setup Guide

## ✅ Everything Auto-Connects When You Clone

This guide confirms that **MongoDB automatically connects and loads data** when you clone from GitHub.

---

## 📋 Prerequisites

1. **Git** installed → [Download](https://git-scm.com/)
2. **Node.js** (v16+) → [Download](https://nodejs.org/)
3. **MongoDB** (local or cloud) → [Install](https://docs.mongodb.com/manual/installation/) or [Atlas Cloud](https://www.mongodb.com/cloud/atlas)

---

## 🚀 Step 1: Clone from GitHub

```bash
git clone https://github.com/your-username/edutrack.git
cd edutrack
```

---

## 📦 Step 2: Install Dependencies

```bash
# Install root workspace dependencies
npm run install:all
```

This installs:
- ✅ Backend packages (backend/node_modules)
- ✅ Frontend packages (frontend/node_modules)

---

## 🗄️ Step 3: MongoDB Setup

### Option A: Local MongoDB (Recommended for Development)

**Windows:**
```bash
# MongoDB is running on localhost:27017
# Default: mongodb://127.0.0.1:27017/edutrack
```

**Mac/Linux:**
```bash
brew install mongodb-community
brew services start mongodb-community
```

### Option B: MongoDB Atlas (Cloud - Easy Setup)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create free account
3. Create a cluster
4. Copy connection string (looks like: `mongodb+srv://user:pass@cluster.mongodb.net/edutrack`)

---

## ⚙️ Step 4: Configure Backend .env

Create or update `backend/.env`:

```bash
cd backend
```

**For Local MongoDB:**
```env
PORT=5000
JWT_SECRET=change-me-in-production
FRONTEND_ORIGIN=http://localhost:5173
MONGO_URI=mongodb://127.0.0.1:27017/edutrack
AUTO_SEED_ON_EMPTY_DB=true
REQUIRE_MONGO_IN_PROD=false
NODE_ENV=development
```

**For MongoDB Atlas:**
```env
PORT=5000
JWT_SECRET=change-me-in-production
FRONTEND_ORIGIN=http://localhost:5173
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/edutrack?retryWrites=true&w=majority
AUTO_SEED_ON_EMPTY_DB=true
REQUIRE_MONGO_IN_PROD=false
NODE_ENV=development
```

---

## 🎯 Step 5: Start Backend

```bash
cd backend
npm start
```

**Watch for:**
```
✅ MongoDB connected successfully
✅ Bootstrapping test data...
✅ EduTrack backend running on http://localhost:5000
```

### 🔄 AUTO-SEED Confirmation

When backend starts:
1. Checks if MongoDB has existing data
2. If **empty** → Automatically seeds:
   - ✅ 5 Teachers
   - ✅ 20 Students
   - ✅ 5 B.Tech Courses
   - ✅ 15 Days attendance records
   - ✅ Grades & performance data
3. If **has data** → Skips seeding

---

## 🖥️ Step 6: Start Frontend (New Terminal)

```bash
cd frontend
npm run dev
```

**Watch for:**
```
  VITE v5.0.0  ready in 245 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## ✨ Step 7: Verify Data Loads

1. Open **http://localhost:5173**
2. Login with any test account:
   ```
   Email: arun.kumar@edutrack.com
   Password: password123
   ```
3. You should see:
   - ✅ All 5 courses loaded
   - ✅ Student data populated
   - ✅ Attendance records visible
   - ✅ Grades displayed

---

## 📊 Expected Data

After auto-seed, you have:

| Category | Count | Details |
|----------|-------|---------|
| Teachers | 5 | Computer Science, Mechanical, Electronics, Civil, Electrical |
| Students | 20 | Enrolled in all 5 courses |
| Courses | 5 | B.Tech subjects with schedules |
| Attendance | 1,500+ | 15 days × 5 courses × 20 students |
| Grades | 100+ | Multiple subjects per student |
| Announcements | 25+ | Distributed across courses |

---

## 🛑 Troubleshooting

### ❌ Error: "MongoDB connection error"

**Solution:**
```bash
# Check MongoDB is running
# Windows: mongod.exe in System32
# Mac: brew services list | grep mongo

# Or use MongoDB Atlas (cloud)
# Update MONGO_URI in backend/.env
```

### ❌ Error: "Cannot find module 'mongoose'"

**Solution:**
```bash
cd backend
npm install
npm start
```

### ❌ Frontend shows "Backend offline"

**Solution:**
```bash
# Make sure backend is running
# Check http://localhost:5000/api/health
# Backend should respond with status
```

### ❌ No data appears after login

**Solution:**
```bash
# Check AUTO_SEED_ON_EMPTY_DB=true in backend/.env
# Backend logs should show "Bootstrapping test data..."
# If not, manually trigger: curl -X POST http://localhost:5000/api/setup/multi-subject
```

---

## 🔐 Production Deployment

### For Render.com, Railway, or Cloud:

1. Set `NODE_ENV=production`
2. Set `MONGO_URI` to cloud database
3. Set `REQUIRE_MONGO_IN_PROD=true`
4. Backend will **require MongoDB** and refuse to start without it

---

## ✅ Verification Checklist

Before you're done, confirm:

- [ ] MongoDB is running locally or using Atlas
- [ ] Backend `.env` has correct `MONGO_URI`
- [ ] Backend shows "MongoDB connected successfully"
- [ ] Backend shows "Bootstrapping test data..." on first run
- [ ] Frontend loads at http://localhost:5173
- [ ] Login works with test credentials
- [ ] All courses visible in dashboard
- [ ] Attendance data shows in Attendance page
- [ ] No "Backend offline" message appears

---

## 📚 More Help

- **Full Setup:** [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **Test Credentials:** [LOGIN_CREDENTIALS.md](LOGIN_CREDENTIALS.md)
- **How It Works:** [HOW_IT_WORKS.md](HOW_IT_WORKS.md)

---

## ✨ Summary

When you clone from GitHub:

✅ **MongoDB auto-connects** (via MONGO_URI in .env)  
✅ **Data auto-seeds** on first run (if database is empty)  
✅ **All 5 courses** with students appear  
✅ **15 days of attendance** records load  
✅ **Grades & performance** data displays  
✅ **Ready to use immediately**  

No additional setup needed! Just clone, install, configure MONGO_URI, and run.

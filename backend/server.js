import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/edutrack'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const uploadsDir = path.join(__dirname, 'uploads')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadsDir),
    filename: (_req, file, callback) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
      callback(null, `${Date.now()}-${safeName}`)
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
})

const allowedOrigins = [
  FRONTEND_ORIGIN,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
]

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }

      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
      if (allowedOrigins.includes(origin) || isLocalhost) {
        callback(null, true)
        return
      }

      callback(new Error('Not allowed by CORS'))
    },
  })
)
app.use(express.json())
app.use('/uploads', express.static(uploadsDir))

const users = new Map()
let mongoReady = false

// ============ MONGOOSE SCHEMAS ============

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, default: '' },
    role: { type: String, enum: ['student', 'teacher'], default: 'student' },
    authProvider: { type: String, default: 'local' },
    bio: { type: String, default: '' },
    department: { type: String, default: '' },
    year: { type: String, default: '' },
    section: { type: String, default: '' },
    phone: { type: String, default: '' },
    avatar: { type: String, default: '' },
    twoFactorEnabled: { type: Boolean, default: false },
    theme: { type: String, enum: ['light', 'dark'], default: 'light' },
  },
  { timestamps: true }
)

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    subject: { type: String, required: true, trim: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    credits: { type: Number, default: 3 },
    description: { type: String, default: '' },
    schedule: [{
      day: String,
      time: String,
      room: String,
    }],
  },
  { timestamps: true }
)

const assignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date, required: true },
    maxScore: { type: Number, default: 100 },
    submissions: [{
      student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      content: String,
      score: Number,
      feedback: String,
      submittedAt: { type: Date, default: Date.now },
      isLate: Boolean,
      fileName: String,
      fileUrl: String,
      fileSize: Number,
    }],
  },
  { timestamps: true }
)

const attendanceSchema = new mongoose.Schema(
  {
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    date: { type: Date, required: true },
    records: [{
      student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['present', 'absent', 'late'], default: 'absent' },
    }],
  },
  { timestamps: true }
)

const gradeSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    internals: { type: Number, default: 0 },
    finals: { type: Number, default: 0 },
    grade: { type: String, default: 'N/A' },
  },
  { timestamps: true }
)

const User = mongoose.models.User || mongoose.model('User', userSchema)
const Class = mongoose.models.Class || mongoose.model('Class', classSchema)
const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema)
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema)
const Grade = mongoose.models.Grade || mongoose.model('Grade', gradeSchema)

async function connectMongo() {
  if (!MONGO_URI) {
    console.warn('MONGO_URI is not set. Using in-memory auth storage for development only.')
    return false
  }

  if (mongoose.connection.readyState === 1) {
    return true
  }

  try {
    await mongoose.connect(MONGO_URI)
    console.log('MongoDB connected successfully')
    return true
  } catch (error) {
    console.error('MongoDB connection error:', error.message)
    return false
  }
}

function createToken(user) {
  return jwt.sign(
    {
      email: user.email,
      role: user.role,
      name: user.name,
      id: user._id || user.id,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )
}

async function findUserByEmail(email) {
  const normalizedEmail = String(email).trim().toLowerCase()

  if (mongoReady) {
    return User.findOne({ email: normalizedEmail })
  }

  return users.get(normalizedEmail) || null
}

async function saveUser(user) {
  if (mongoReady) {
    const created = await User.create(user)
    return created.toObject()
  }

  users.set(user.email, user)
  return user
}

function toUserResponse(user) {
  return {
    id: user._id || user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    authProvider: user.authProvider || 'local',
    bio: user.bio || '',
    department: user.department || '',
    year: user.year || '',
    section: user.section || '',
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    theme: user.theme || 'light',
  }
}

function normalizeRole(role, fallback = 'student') {
  return role === 'teacher' ? 'teacher' : role === 'student' ? 'student' : fallback
}

// ============ HELPER FUNCTIONS ============

async function getStudentDashboardData(userId) {
  try {
    const studentClasses = await Class.find({ students: userId }).lean()
    const assignmentsCount = await Assignment.find({ class: { $in: studentClasses.map(c => c._id) } })
    const attendanceRecords = await Attendance.find({ class: { $in: studentClasses.map(c => c._id) } }).lean()
    
    const present = attendanceRecords.reduce((sum, record) => {
      const studentRecord = record.records.find(r => r.student.toString() === userId)
      return sum + (studentRecord?.status === 'present' ? 1 : 0)
    }, 0)
    const total = attendanceRecords.reduce((sum, record) => {
      return sum + (record.records.some(r => r.student.toString() === userId) ? 1 : 0)
    }, 0)
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0

    return {
      stats: [
        { title: 'Attendance Rate', value: `${attendanceRate}%`, trend: '+2.1%', tone: 'green' },
        { title: 'Assignments Done', value: `${assignmentsCount.length}`, trend: 'On track', tone: 'blue' },
        { title: 'Active Classes', value: `${studentClasses.length}`, trend: `${studentClasses.length} enrolled`, tone: 'amber' },
        { title: 'Performance', value: 'A-', trend: 'Improving', tone: 'purple' },
      ],
      overview: [
        { title: 'Attendance', value: `${attendanceRate}%`, detail: `${present}/${total} classes attended`, tone: 'overview-card-1' },
        { title: 'Assignments', value: `${assignmentsCount.length}`, detail: 'Active assignments', tone: 'overview-card-2' },
        { title: 'Performance', value: 'A-', detail: 'Consistent performance', tone: 'overview-card-3' },
      ],
      todaysClasses: studentClasses.slice(0, 3).map(c => ({
        subject: c.subject,
        code: c.code,
        time: c.schedule?.[0]?.time || 'TBA',
        status: 'upcoming',
      })),
      highlights: [
        { title: 'Classes enrolled', value: String(studentClasses.length) },
        { title: 'Attendance Rate', value: `${attendanceRate}%` },
        { title: 'Tasks due', value: String(assignmentsCount.length) },
      ],
    }
  } catch (error) {
    console.error('Error getting student dashboard data:', error)
    return { stats: [], overview: [], todaysClasses: [], highlights: [] }
  }
}

async function getTeacherDashboardData(userId) {
  try {
    const teacherClasses = await Class.find({ teacher: userId }).lean()
    const classIds = teacherClasses.map(c => c._id)
    const assignmentsCount = await Assignment.find({ class: { $in: classIds } })
    const totalStudents = await Promise.all(
      teacherClasses.map(c => Class.findById(c._id).select('students').lean().then(doc => doc?.students?.length || 0))
    )
    const totalStudentsCount = totalStudents.reduce((a, b) => a + b, 0)

    return {
      stats: [
        { title: 'Active Students', value: String(totalStudentsCount), trend: '+5 this week', tone: 'blue' },
        { title: 'Active Classes', value: String(teacherClasses.length), trend: 'Running', tone: 'amber' },
        { title: 'Pending Assignments', value: String(assignmentsCount.length), trend: 'To review', tone: 'green' },
        { title: 'System Load', value: '67.1%', trend: 'Stable', tone: 'purple' },
      ],
      overview: [
        { title: 'Classes', value: String(teacherClasses.length), detail: 'Active this semester', tone: 'overview-card-1' },
        { title: 'Assignments', value: String(assignmentsCount.length), detail: 'Pending evaluations', tone: 'overview-card-2' },
        { title: 'Analytics', value: '92%', detail: 'Overall class engagement', tone: 'overview-card-3' },
      ],
      todaysClasses: teacherClasses.slice(0, 3).map(c => ({
        subject: c.subject,
        code: c.code,
        time: c.schedule?.[0]?.time || 'TBA',
        students: c.students?.length || 0,
      })),
      highlights: [
        { title: 'Students tracked', value: String(totalStudentsCount) },
        { title: 'Assignments set', value: String(assignmentsCount.length) },
        { title: 'Avg. attendance', value: '93%' },
      ],
    }
  } catch (error) {
    console.error('Error getting teacher dashboard data:', error)
    return { stats: [], overview: [], todaysClasses: [], highlights: [] }
  }
}

// ============ API ROUTES ============

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'edutrack-api', mongo: mongoReady })
})

// User Profile Routes
app.get('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const user = await User.findById(userId).select('-passwordHash').lean()
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json(toUserResponse(user))
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch profile', error: error.message })
  }
})

app.put('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const { name, bio, department, year, section, phone, twoFactorEnabled, theme } = req.body

    const updates = {
      name,
      bio,
      department,
      year,
      section,
      phone,
    }

    if (typeof twoFactorEnabled === 'boolean') {
      updates.twoFactorEnabled = twoFactorEnabled
    }

    if (theme === 'light' || theme === 'dark') {
      updates.theme = theme
    }

    const user = await User.findByIdAndUpdate(
      userId,
      updates,
      { new: true }
    ).select('-passwordHash').lean()

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json(toUserResponse(user))
  } catch (error) {
    res.status(500).json({ message: 'Failed to update profile', error: error.message })
  }
})

app.post('/api/profile/:userId/password', async (req, res) => {
  try {
    const { userId } = req.params
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' })
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' })
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (!user.passwordHash) {
      return res.status(400).json({ message: 'Password change is unavailable for this account' })
    }

    const passwordOk = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!passwordOk) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10)
    await user.save()

    res.json({ message: 'Password updated successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to change password', error: error.message })
  }
})

// Dashboard Route
app.get('/api/dashboard/:userId/:role', async (req, res) => {
  try {
    const { userId, role } = req.params
    
    console.log('Dashboard request:', { userId, role })

    const user = await User.findById(userId).lean()

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const effectiveRole = normalizeRole(role, normalizeRole(user.role))

    let dashboardData
    if (effectiveRole === 'teacher') {
      dashboardData = await getTeacherDashboardData(userId)
    } else {
      dashboardData = await getStudentDashboardData(userId)
    }

    res.json({
      role: effectiveRole,
      profile: toUserResponse(user),
      ...dashboardData,
      quickActions: effectiveRole === 'teacher' 
        ? ['Mark Attendance', 'Create Assignment', 'View Reports', 'Grade Submissions']
        : ['View Classes', 'Submit Assignment', 'Check Grades', 'Ask Mentor'],
      announcements: [
        { title: 'Welcome to EduTrack!', message: 'Your platform is ready to use.', time: 'Just now', priority: 'high', category: 'System', icon: '📣' },
        { title: 'New Features Available', message: 'Check out the latest updates.', time: '1 hour ago', priority: 'medium', category: 'System', icon: '✨' },
      ]
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    res.status(500).json({ message: 'Failed to fetch dashboard', error: error.message })
  }
})

// Class Routes
app.get('/api/classes', async (req, res) => {
  try {
    const { role, userId } = req.query

    let classes
    if (role === 'teacher') {
      classes = await Class.find({ teacher: userId }).populate('students', 'name email').lean()
    } else {
      classes = await Class.find({ students: userId }).populate('teacher', 'name email').lean()
    }

    res.json(classes)
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch classes', error: error.message })
  }
})

app.post('/api/classes', async (req, res) => {
  try {
    const { name, code, subject, teacher, credits, description, schedule } = req.body

    const newClass = await Class.create({
      name,
      code,
      subject,
      teacher,
      credits,
      description,
      schedule,
    })

    res.status(201).json(newClass)
  } catch (error) {
    res.status(500).json({ message: 'Failed to create class', error: error.message })
  }
})

app.put('/api/classes/:classId', async (req, res) => {
  try {
    const { classId } = req.params
    const classData = req.body

    const updatedClass = await Class.findByIdAndUpdate(classId, classData, { new: true }).lean()

    if (!updatedClass) {
      return res.status(404).json({ message: 'Class not found' })
    }

    res.json(updatedClass)
  } catch (error) {
    res.status(500).json({ message: 'Failed to update class', error: error.message })
  }
})

app.post('/api/classes/:classId/enroll', async (req, res) => {
  try {
    const { classId } = req.params
    const { studentId } = req.body

    const updatedClass = await Class.findByIdAndUpdate(
      classId,
      { $addToSet: { students: studentId } },
      { new: true }
    ).lean()

    res.json(updatedClass)
  } catch (error) {
    res.status(500).json({ message: 'Failed to enroll student', error: error.message })
  }
})

app.post('/api/classes/join-by-code', async (req, res) => {
  try {
    const { studentId, code } = req.body

    if (!studentId || !code) {
      return res.status(400).json({ message: 'studentId and class code are required' })
    }

    const normalizedCode = String(code).trim().toUpperCase()
    const targetClass = await Class.findOne({ code: normalizedCode })

    if (!targetClass) {
      return res.status(404).json({ message: 'Class not found for this code' })
    }

    targetClass.students = targetClass.students || []
    if (!targetClass.students.some((student) => String(student) === String(studentId))) {
      targetClass.students.push(studentId)
      await targetClass.save()
    }

    const joinedClass = await Class.findById(targetClass._id).populate('teacher', 'name email').lean()
    res.json({ message: 'Joined class successfully', class: joinedClass })
  } catch (error) {
    res.status(500).json({ message: 'Failed to join class', error: error.message })
  }
})

// Assignment Routes
app.get('/api/assignments', async (req, res) => {
  try {
    const { role, userId } = req.query

    let assignments
    if (role === 'teacher') {
      assignments = await Assignment.find({ teacher: userId }).populate('class').lean()
    } else {
      const studentClasses = await Class.find({ students: userId }).select('_id').lean()
      const classIds = studentClasses.map(c => c._id)
      assignments = await Assignment.find({ class: { $in: classIds } }).populate('class').lean()
    }

    res.json(assignments)
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch assignments', error: error.message })
  }
})

app.post('/api/assignments', async (req, res) => {
  try {
    const { title, description, classId, teacher, dueDate, maxScore } = req.body

    const newAssignment = await Assignment.create({
      title,
      description,
      class: classId,
      teacher,
      dueDate,
      maxScore,
    })

    res.status(201).json(newAssignment)
  } catch (error) {
    res.status(500).json({ message: 'Failed to create assignment', error: error.message })
  }
})

app.post('/api/assignments/:assignmentId/submit', async (req, res) => {
  try {
    const { assignmentId } = req.params
    const { studentId, content } = req.body

    const assignment = await Assignment.findById(assignmentId)
    const submission = {
      student: studentId,
      content,
      submittedAt: new Date(),
      isLate: new Date() > assignment.dueDate,
    }

    assignment.submissions.push(submission)
    await assignment.save()

    res.json(assignment)
  } catch (error) {
    res.status(500).json({ message: 'Failed to submit assignment', error: error.message })
  }
})

app.post('/api/assignments/:assignmentId/upload', upload.single('file'), async (req, res) => {
  try {
    const { assignmentId } = req.params
    const { studentId, note } = req.body

    if (!req.file) {
      return res.status(400).json({ message: 'Please select a file to upload' })
    }

    if (!studentId) {
      return res.status(400).json({ message: 'studentId is required' })
    }

    const assignment = await Assignment.findById(assignmentId)
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' })
    }

    const uploadEntry = {
      student: studentId,
      content: note || `File upload: ${req.file.originalname}`,
      submittedAt: new Date(),
      isLate: assignment.dueDate ? new Date() > assignment.dueDate : false,
      fileName: req.file.originalname,
      fileUrl: `/uploads/${req.file.filename}`,
      fileSize: req.file.size,
    }

    assignment.submissions.push(uploadEntry)
    await assignment.save()

    res.status(201).json({
      message: 'Assignment uploaded successfully',
      submission: uploadEntry,
    })
  } catch (error) {
    res.status(500).json({ message: 'Failed to upload assignment', error: error.message })
  }
})

app.put('/api/assignments/:assignmentId/grade', async (req, res) => {
  try {
    const { assignmentId } = req.params
    const { submissionIndex, score, feedback } = req.body

    const assignment = await Assignment.findById(assignmentId)
    if (assignment.submissions[submissionIndex]) {
      assignment.submissions[submissionIndex].score = score
      assignment.submissions[submissionIndex].feedback = feedback
    }
    await assignment.save()

    res.json(assignment)
  } catch (error) {
    res.status(500).json({ message: 'Failed to grade assignment', error: error.message })
  }
})

// Attendance Routes
app.get('/api/attendance', async (req, res) => {
  try {
    const { role, userId } = req.query

    let attendance
    if (role === 'teacher') {
      const teacherClasses = await Class.find({ teacher: userId }).select('_id').lean()
      const classIds = teacherClasses.map(c => c._id)
      attendance = await Attendance.find({ class: { $in: classIds } }).populate('class').lean()
    } else {
      const studentClasses = await Class.find({ students: userId }).select('_id').lean()
      const classIds = studentClasses.map(c => c._id)
      attendance = await Attendance.find({ class: { $in: classIds } }).populate('class').lean()
    }

    res.json(attendance)
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance', error: error.message })
  }
})

app.post('/api/attendance', async (req, res) => {
  try {
    const { classId, date, records } = req.body

    const newAttendance = await Attendance.create({
      class: classId,
      date,
      records,
    })

    res.status(201).json(newAttendance)
  } catch (error) {
    res.status(500).json({ message: 'Failed to create attendance record', error: error.message })
  }
})

// Grade/Performance Routes
app.get('/api/grades', async (req, res) => {
  try {
    const { role, userId } = req.query

    let grades
    if (role === 'teacher') {
      const teacherClasses = await Class.find({ teacher: userId }).select('_id').lean()
      const classIds = teacherClasses.map(c => c._id)
      grades = await Grade.find({ class: { $in: classIds } }).populate('student').populate('class').lean()
    } else {
      grades = await Grade.find({ student: userId }).populate('class').lean()
    }

    res.json(grades)
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch grades', error: error.message })
  }
})

app.post('/api/grades', async (req, res) => {
  try {
    const { studentId, classId, internals, finals } = req.body

    const computeGrade = (internals, finals) => {
      const avg = (internals + finals) / 2
      if (avg >= 90) return 'A'
      if (avg >= 80) return 'A-'
      if (avg >= 70) return 'B'
      if (avg >= 60) return 'B-'
      return 'C'
    }

    const newGrade = await Grade.create({
      student: studentId,
      class: classId,
      internals,
      finals,
      grade: computeGrade(internals, finals),
    })

    res.status(201).json(newGrade)
  } catch (error) {
    res.status(500).json({ message: 'Failed to create grade', error: error.message })
  }
})

app.put('/api/grades/:gradeId', async (req, res) => {
  try {
    const { gradeId } = req.params
    const { internals, finals } = req.body

    const computeGrade = (internals, finals) => {
      const avg = (internals + finals) / 2
      if (avg >= 90) return 'A'
      if (avg >= 80) return 'A-'
      if (avg >= 70) return 'B'
      if (avg >= 60) return 'B-'
      return 'C'
    }

    const updatedGrade = await Grade.findByIdAndUpdate(
      gradeId,
      { internals, finals, grade: computeGrade(internals, finals) },
      { new: true }
    ).lean()

    res.json(updatedGrade)
  } catch (error) {
    res.status(500).json({ message: 'Failed to update grade', error: error.message })
  }
})

// Seed Sample Data Endpoint
app.post('/api/seed', async (req, res) => {
  try {
    if (!mongoReady) {
      return res.status(400).json({ message: 'MongoDB not connected' })
    }

    // Clear existing data
    await User.deleteMany({})
    await Class.deleteMany({})
    await Assignment.deleteMany({})
    await Attendance.deleteMany({})
    await Grade.deleteMany({})

    console.log('🌱 Starting MASSIVE data seed...')

    // ============ CREATE TEACHERS (5 teachers) ============
    const teachers = []
    const teacherNames = [
      'Dr. Ravi Kumar', 'Prof. Anjali Sharma', 'Dr. Vikram Singh',
      'Prof. Neha Verma', 'Dr. Rajesh Patel'
    ]
    const teacherEmails = [
      'teacher@edutrack.com', 'prof_anjali@edutrack.com', 'dr_vikram@edutrack.com',
      'prof_neha@edutrack.com', 'dr_rajesh@edutrack.com'
    ]

    for (let i = 0; i < 5; i++) {
      const teacher = await User.create({
        name: teacherNames[i],
        email: teacherEmails[i],
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'teacher',
        department: 'Computer Science',
        bio: `Experienced faculty member with 10+ years teaching experience`,
        year: 'All years',
        section: 'A, B, C',
      })
      teachers.push(teacher)
    }
    console.log(`✓ Created ${teachers.length} teachers`)

    // ============ CREATE STUDENTS (15 students) ============
    const students = []
    const studentNames = [
      'Aushka v', 'Priya Singh', 'Amit Patel', 'Rahul Kumar', 'Sneha Gupta',
      'Rohan Sharma', 'Ananya Verma', 'Aarjun Desai', 'Zara Khan', 'Vikram Reddy',
      'Nisha Chopra', 'Samir Ansari', 'Divya Nair', 'Karan Singh', 'Maya Iyer'
    ]
    for (let i = 0; i < 15; i++) {
      const student = await User.create({
        name: studentNames[i],
        email: `student${i+1}@edutrack.com`,
        passwordHash: await bcrypt.hash('password123', 10),
        role: 'student',
        department: 'Computer Science',
        year: ['1st Year', '2nd Year', '3rd Year', '4th Year'][Math.floor(Math.random() * 4)],
        section: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
      })
      students.push(student)
    }
    console.log(`✓ Created ${students.length} students`)

    // ============ CREATE CLASSES (10 classes) ============
    const classes = []
    const classData = [
      { name: 'Data Structures and Algorithms', code: 'CSE301', subject: 'Data Structures', credits: 3 },
      { name: 'Database Management Systems', code: 'CSE302', subject: 'DBMS', credits: 4 },
      { name: 'Web Development', code: 'CSE303', subject: 'Web Dev', credits: 3 },
      { name: 'Mobile App Development', code: 'CSE304', subject: 'Mobile Dev', credits: 3 },
      { name: 'Machine Learning Basics', code: 'CSE305', subject: 'ML', credits: 4 },
      { name: 'Cloud Computing', code: 'CSE306', subject: 'Cloud', credits: 3 },
      { name: 'Cybersecurity Fundamentals', code: 'CSE307', subject: 'Security', credits: 3 },
      { name: 'Software Engineering', code: 'CSE308', subject: 'SE', credits: 4 },
      { name: 'Computer Networks', code: 'CSE309', subject: 'Networks', credits: 3 },
      { name: 'Operating Systems', code: 'CSE310', subject: 'OS', credits: 4 },
    ]

    for (let i = 0; i < 10; i++) {
      const classStudents = students.slice(Math.floor(Math.random() * 5), Math.floor(Math.random() * 5) + 8)
      const cls = await Class.create({
        name: classData[i].name,
        code: classData[i].code,
        subject: classData[i].subject,
        teacher: teachers[i % 5]._id,
        students: [...new Set(classStudents.map(s => s._id))],
        credits: classData[i].credits,
        description: `A comprehensive course on ${classData[i].subject}. Learn fundamentals and advanced concepts.`,
        schedule: [
          { day: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'][Math.floor(Math.random() * 5)], time: '09:00 AM - 10:30 AM', room: `${String.fromCharCode(65 + Math.floor(Math.random() * 3))}${Math.floor(Math.random() * 300) + 100}` },
          { day: ['Tuesday', 'Wednesday', 'Thursday', 'Friday'][Math.floor(Math.random() * 4)], time: '02:00 PM - 03:30 PM', room: `${String.fromCharCode(65 + Math.floor(Math.random() * 3))}${Math.floor(Math.random() * 300) + 100}` },
        ]
      })
      classes.push(cls)
    }
    console.log(`✓ Created ${classes.length} classes`)

    // ============ CREATE ASSIGNMENTS (25 assignments with submissions) ============
    let assignmentCount = 0
    for (const cls of classes) {
      const assignmentsPerClass = Math.floor(Math.random() * 3) + 2
      for (let a = 0; a < assignmentsPerClass; a++) {
        const daysFromNow = Math.floor(Math.random() * 60) - 30
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + daysFromNow)

        const submissions = []
        const classStudents = cls.students.slice(0, Math.floor(Math.random() * cls.students.length) + 1)
        for (const studentId of classStudents) {
          submissions.push({
            student: studentId,
            content: 'Assignment submitted and completed',
            score: Math.floor(Math.random() * 30) + 70,
            feedback: ['Excellent work!', 'Good effort', 'Need improvement', 'Well done!', 'Great job!'][Math.floor(Math.random() * 5)],
            submittedAt: new Date(dueDate.getTime() - Math.floor(Math.random() * 86400000 * 3)),
            isLate: Math.random() > 0.8,
          })
        }

        await Assignment.create({
          title: `Assignment ${a + 1}: ${['Problem Solving', 'Project', 'Research', 'Presentation', 'Implementation', 'Analysis'][Math.floor(Math.random() * 6)]}`,
          description: 'Complete the assignment and submit your work',
          class: cls._id,
          teacher: cls.teacher,
          dueDate: dueDate,
          maxScore: 100,
          submissions: submissions
        })
        assignmentCount++
      }
    }
    console.log(`✓ Created ${assignmentCount} assignments with submissions`)

    // ============ CREATE ATTENDANCE RECORDS (50+ records) ============
    let attendanceCount = 0
    for (const cls of classes) {
      const daysBack = 30
      for (let day = 0; day < daysBack; day++) {
        const recordDate = new Date()
        recordDate.setDate(recordDate.getDate() - day)

        const records = []
        for (const studentId of cls.students) {
          records.push({
            student: studentId,
            status: ['present', 'present', 'present', 'present', 'late', 'absent'][Math.floor(Math.random() * 6)]
          })
        }

        await Attendance.create({
          class: cls._id,
          date: recordDate,
          records: records
        })
        attendanceCount++
      }
    }
    console.log(`✓ Created ${attendanceCount} attendance records`)

    // ============ CREATE GRADES (50+ grade records) ============
    let gradeCount = 0
    for (const cls of classes) {
      for (const studentId of cls.students) {
        const internals = Math.floor(Math.random() * 20) + 20
        const finals = Math.floor(Math.random() * 35) + 40
        const total = internals + finals

        let grade = 'A'
        if (total < 40) grade = 'F'
        else if (total < 50) grade = 'D'
        else if (total < 60) grade = 'C'
        else if (total < 70) grade = 'B'
        else if (total < 80) grade = 'B+'
        else if (total < 90) grade = 'A-'

        await Grade.create({
          student: studentId,
          class: cls._id,
          internals: internals,
          finals: finals,
          grade: grade
        })
        gradeCount++
      }
    }
    console.log(`✓ Created ${gradeCount} grade records`)

    // ============ Create login URLs for easy testing ============
    const testAccounts = [
      { email: 'teacher@edutrack.com', role: 'teacher', type: 'Teacher' },
      ...students.slice(0, 5).map((s, idx) => ({
        email: `student${idx+1}@edutrack.com`,
        role: 'student',
        type: `Student ${idx+1}`
      }))
    ]

    console.log('✅ MASSIVE SEED COMPLETE!')

    res.json({
      message: '🌱 Sample data created successfully! (LOTS OF DATA)',
      info: {
        teachers: teachers.length,
        students: students.length,
        classes: classes.length,
        assignments: assignmentCount,
        attendanceRecords: attendanceCount,
        grades: gradeCount,
      },
      testAccounts: testAccounts.map(acc => ({
        email: acc.email,
        password: 'password123',
        type: acc.type
      })),
      stats: {
        totalUsers: teachers.length + students.length,
        totalRecords: classes.length + assignmentCount + attendanceCount + gradeCount
      }
    })
  } catch (error) {
    console.error('Seeding error:', error)
    res.status(500).json({ message: 'Error seeding data', error: error.message })
  }
})
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, role } = req.body

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'All signup fields are required' })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const existingUser = await findUserByEmail(normalizedEmail)
  if (existingUser) {
    return res.status(409).json({ message: 'User already exists, please login' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = {
    name: String(name).trim(),
    email: normalizedEmail,
    role: normalizeRole(role),
    passwordHash,
    authProvider: 'local',
  }

  const storedUser = await saveUser(user)

  const token = createToken(storedUser)
  return res.status(201).json({
    message: 'Signup successful',
    token,
    user: toUserResponse(storedUser),
  })
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const user = await findUserByEmail(normalizedEmail)

  if (!user) {
    return res.status(404).json({ message: 'User not found, please sign up first' })
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash)
  if (!passwordOk) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const token = createToken(user)
  return res.json({
    message: 'Login successful',
    token,
    user: toUserResponse(user),
  })
})

app.post('/api/auth/google', async (_req, res) => {
  const guestUser = {
    name: 'Google User',
    email: 'google-user@edutrack.dev',
    role: 'student',
    passwordHash: '',
    authProvider: 'google',
  }

  const storedUser = (await findUserByEmail(guestUser.email)) || (await saveUser(guestUser))
  const token = createToken(guestUser)
  return res.json({
    message: 'Google verification successful',
    token,
    user: toUserResponse(storedUser),
  })
})

async function startServer() {
  try {
    mongoReady = await connectMongo()
  } catch (error) {
    console.warn(`Mongo connection failed, falling back to in-memory storage: ${error.message}`)
    mongoReady = false
  }

  const listenOnPort = (port, retries = 0) => {
    const server = app.listen(port, () => {
      console.log(`EduTrack backend running on http://localhost:${port}`)
      console.log(`MongoDB: ${mongoReady ? 'Connected' : 'Not connected (using in-memory storage)'}`)
    })

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE' && retries < 5) {
        const nextPort = Number(port) + 1
        console.warn(`Port ${port} is busy, retrying on ${nextPort}...`)
        server.close(() => listenOnPort(nextPort, retries + 1))
        return
      }

      console.error('Failed to start backend server:', error)
      process.exit(1)
    })
  }

  listenOnPort(PORT)
}

startServer()

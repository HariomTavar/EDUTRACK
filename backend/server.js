import dotenv from 'dotenv'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { randomBytes } from 'crypto'
import { fileURLToPath } from 'url'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
const FRONTEND_ORIGINS = String(process.env.FRONTEND_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/edutrack'
const GLOBAL_MULTI_CLASS_CODE = 'BTECH-MULTI-2026'
const AI_API_URL = process.env.AI_API_URL || ''
const AI_API_KEY = process.env.AI_API_KEY || ''
const AUTO_SEED_ON_EMPTY_DB = String(process.env.AUTO_SEED_ON_EMPTY_DB || 'true').toLowerCase() !== 'false'
const REQUIRE_MONGO_IN_PROD = String(process.env.REQUIRE_MONGO_IN_PROD || 'true').toLowerCase() !== 'false'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
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
  ...FRONTEND_ORIGINS,
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
const memoryStore = {
  classes: [],
  assignments: [],
  attendance: [],
  attendanceQrSessions: [],
  grades: [],
  announcements: [],
  notifications: [],
  communications: [],
}

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
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    labTeachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
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

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    category: { type: String, default: 'Announcement' },
  },
  { timestamps: true }
)

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    type: {
      type: String,
      enum: ['class', 'assignment', 'attendance', 'grade', 'announcement', 'submission', 'communication', 'system'],
      default: 'system',
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    metadata: { type: Object, default: {} },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
)

const communicationSchema = new mongoose.Schema(
  {
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    type: { type: String, enum: ['chat', 'doubt'], required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    title: { type: String, default: '' },
    message: { type: String, required: true, trim: true },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['open', 'resolved'], default: 'open' },
    replies: [
      {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        message: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
)

const attendanceQrSessionSchema = new mongoose.Schema(
  {
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true, trim: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    rangeMeters: { type: Number, default: 120 },
    expiresAt: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
)

// ============ ANALYTICS & SMART FEATURES SCHEMAS ============
const courseAnalyticsSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    date: { type: Date, required: true },
    totalStudents: { type: Number, required: true },
    presentCount: { type: Number, default: 0 },
    absentCount: { type: Number, default: 0 },
    attendancePercentage: { type: Number, default: 0 },
    insights: {
      highestAbsent: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      perfectAttendance: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },
  },
  { timestamps: true }
)

const studentPerformanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    attendancePercentage: { type: Number, default: 0 },
    averageGrade: { type: String, default: 'N/A' },
    totalAssignments: { type: Number, default: 0 },
    submittedAssignments: { type: Number, default: 0 },
    performanceIndex: { type: Number, default: 0 },
    monthlyData: [
      {
        month: String,
        attendance: Number,
        grade: String,
        assignments: Number,
      },
    ],
  },
  { timestamps: true }
)

const attendanceReportSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: String, required: true },
    year: { type: Number, required: true },
    reportData: {
      studentAttendance: [
        {
          student: mongoose.Schema.Types.ObjectId,
          name: String,
          daysPresent: Number,
          daysAbsent: Number,
          percentage: Number,
        },
      ],
      summary: {
        totalDays: Number,
        avgAttendance: Number,
        criticalAbsence: Number,
      },
    },
    pdfUrl: { type: String, default: '' },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

const smartScheduleSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    day: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    room: { type: String, required: true },
    capacity: { type: Number, default: 30 },
    isConflictFree: { type: Boolean, default: true },
    conflicts: [{ type: String }],
  },
  { timestamps: true }
)

const User = mongoose.models.User || mongoose.model('User', userSchema)
const Class = mongoose.models.Class || mongoose.model('Class', classSchema)
const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema)
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', attendanceSchema)
const Grade = mongoose.models.Grade || mongoose.model('Grade', gradeSchema)
const Announcement = mongoose.models.Announcement || mongoose.model('Announcement', announcementSchema)
const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema)
const Communication = mongoose.models.Communication || mongoose.model('Communication', communicationSchema)
const AttendanceQrSession = mongoose.models.AttendanceQrSession || mongoose.model('AttendanceQrSession', attendanceQrSessionSchema)
const CourseAnalytics = mongoose.models.CourseAnalytics || mongoose.model('CourseAnalytics', courseAnalyticsSchema)
const StudentPerformance = mongoose.models.StudentPerformance || mongoose.model('StudentPerformance', studentPerformanceSchema)
const AttendanceReport = mongoose.models.AttendanceReport || mongoose.model('AttendanceReport', attendanceReportSchema)
const SmartSchedule = mongoose.models.SmartSchedule || mongoose.model('SmartSchedule', smartScheduleSchema)

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

  const userWithId = {
    ...user,
    id: user.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  }
  users.set(user.email, userWithId)
  return userWithId
}

async function getUserById(userId) {
  if (!userId) {
    return null
  }

  if (mongoReady) {
    return User.findById(userId).select('-passwordHash').lean()
  }

  return Array.from(users.values()).find((item) => String(item.id) === String(userId)) || null
}

function createMemoryId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function cloneRecord(record) {
  return JSON.parse(JSON.stringify(record))
}

function findMemoryClassById(classId) {
  return memoryStore.classes.find((item) => String(item._id) === String(classId)) || null
}

function getStoredUserSummary(userId) {
  const user = Array.from(users.values()).find((item) => String(item.id) === String(userId))
  if (!user) {
    return null
  }

  return {
    _id: user.id,
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
  }
}

function enrichMemoryClass(record) {
  if (!record) {
    return null
  }

  return {
    ...cloneRecord(record),
    teacher: getStoredUserSummary(record.teacher) || record.teacher,
    teachers: resolveClassTeacherSummaries(record),
    labTeachers: uniqueIds(record.labTeachers || []).map((teacherId) => getStoredUserSummary(teacherId)).filter(Boolean),
    students: (record.students || []).map((studentId) => getStoredUserSummary(studentId)).filter(Boolean),
  }
}

function enqueueMemoryRecord(collectionName, record) {
  memoryStore[collectionName].unshift(record)
  return record
}

function updateMemoryRecord(collectionName, recordId, updater) {
  const index = memoryStore[collectionName].findIndex((item) => String(item._id) === String(recordId))
  if (index === -1) {
    return null
  }

  const current = memoryStore[collectionName][index]
  const next = updater(cloneRecord(current))
  memoryStore[collectionName][index] = next
  return next
}

function generateAttendanceQrToken() {
  return `ATD-${randomBytes(3).toString('hex').toUpperCase()}`
}

function toRadians(value) {
  return (value * Math.PI) / 180
}

function distanceInMeters(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371000
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const calc =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const angle = 2 * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc))
  return earthRadius * angle
}

function buildDayWindow(referenceDate) {
  const start = new Date(referenceDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(referenceDate)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function toUserResponse(user) {
  return {
    _id: user._id || user.id,
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

async function ensureBootstrapData() {
  if (!AUTO_SEED_ON_EMPTY_DB) {
    return
  }

  if (mongoReady) {
    const [userCount, classCount] = await Promise.all([
      User.countDocuments(),
      Class.countDocuments(),
    ])

    if (userCount > 0 || classCount > 0) {
      return
    }
  } else if (users.size > 0 || memoryStore.classes.length > 0) {
    return
  }

  const teacherData = [
    { name: 'Arun Kumar', email: 'arun.kumar@edutrack.com', department: 'Computer Science' },
    { name: 'Priya Singh', email: 'priya.singh@edutrack.com', department: 'Mechanical Engineering' },
    { name: 'Vikram Patel', email: 'vikram.patel@edutrack.com', department: 'Electronics Engineering' },
    { name: 'Deepak Sharma', email: 'deepak.sharma@edutrack.com', department: 'Civil Engineering' },
    { name: 'Neha Gupta', email: 'neha.gupta@edutrack.com', department: 'Electrical Engineering' },
  ]

  const courseData = [
    { name: 'Data Structures & Algorithms', code: 'CSE-201', credits: 4 },
    { name: 'Thermodynamics', code: 'ME-204', credits: 4 },
    { name: 'Circuit Analysis', code: 'ECE-202', credits: 4 },
    { name: 'Structural Design', code: 'CE-203', credits: 4 },
    { name: 'Power Systems', code: 'EE-205', credits: 4 },
  ]

  const studentPrefixes = [
    'Arjun', 'Bhavna', 'Chirag', 'Deepika', 'Eshan',
    'Fiona', 'Gaurav', 'Hina', 'Ishaan', 'Jiya',
    'Karan', 'Lakshya', 'Misha', 'Nikhil', 'Olivia',
    'Priya', 'Quintus', 'Rajeev', 'Simran', 'Taran',
  ]

  const passwordHash = await bcrypt.hash('password123', 10)

  const teachers = []
  for (const teacherInfo of teacherData) {
    const teacher = mongoReady
      ? await User.create({
          name: teacherInfo.name,
          email: teacherInfo.email,
          passwordHash,
          role: 'teacher',
          department: teacherInfo.department,
          year: 'All',
          section: 'A, B, C',
        })
      : await saveUser({
          name: teacherInfo.name,
          email: teacherInfo.email,
          passwordHash,
          role: 'teacher',
          authProvider: 'local',
          department: teacherInfo.department,
          year: 'All',
          section: 'A, B, C',
        })
    teachers.push(teacher)
  }

  const students = []
  for (let index = 0; index < studentPrefixes.length; index += 1) {
    const student = mongoReady
      ? await User.create({
          name: `${studentPrefixes[index]} Kumar`,
          email: `student${index + 1}@edutrack.com`,
          passwordHash,
          role: 'student',
          department: 'Multi-Discipline',
          year: '2nd Year',
          section: 'B',
        })
      : await saveUser({
          name: `${studentPrefixes[index]} Kumar`,
          email: `student${index + 1}@edutrack.com`,
          passwordHash,
          role: 'student',
          authProvider: 'local',
          department: 'Multi-Discipline',
          year: '2nd Year',
          section: 'B',
        })
    students.push(student)
  }

  const studentIds = students.map((student) => student._id || student.id)

  for (let index = 0; index < courseData.length; index += 1) {
    const course = courseData[index]
    const teacher = teachers[index]
    const teacherId = teacher._id || teacher.id

    if (mongoReady) {
      await Class.create({
        name: course.name,
        code: course.code,
        subject: course.name,
        teacher: teacherId,
        teachers: [teacherId],
        labTeachers: [],
        students: studentIds,
        credits: course.credits,
        description: `${course.name} - bootstrap dataset`,
        schedule: [
          { day: 'Monday', time: '10:00 AM - 11:30 AM', room: `${course.code}-101` },
          { day: 'Wednesday', time: '2:00 PM - 3:30 PM', room: `${course.code}-101` },
        ],
      })
    } else {
      enqueueMemoryRecord('classes', {
        _id: createMemoryId('class'),
        name: course.name,
        code: course.code,
        subject: course.name,
        teacher: teacherId,
        teachers: [teacherId],
        labTeachers: [],
        students: studentIds,
        credits: course.credits,
        description: `${course.name} - bootstrap dataset`,
        schedule: [
          { day: 'Monday', time: '10:00 AM - 11:30 AM', room: `${course.code}-101` },
          { day: 'Wednesday', time: '2:00 PM - 3:30 PM', room: `${course.code}-101` },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
  }

  console.log('Bootstrap data initialized (5 classes, 5 teachers, 20 students).')
}

async function getBootstrapCounts() {
  if (mongoReady) {
    const [usersCount, classesCount, assignmentsCount, attendanceCount, gradesCount] = await Promise.all([
      User.countDocuments(),
      Class.countDocuments(),
      Assignment.countDocuments(),
      Attendance.countDocuments(),
      Grade.countDocuments(),
    ])

    return {
      users: usersCount,
      classes: classesCount,
      assignments: assignmentsCount,
      attendance: attendanceCount,
      grades: gradesCount,
    }
  }

  return {
    users: users.size,
    classes: memoryStore.classes.length,
    assignments: memoryStore.assignments.length,
    attendance: memoryStore.attendance.length,
    grades: memoryStore.grades.length,
  }
}

function normalizeIdList(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
}

function uniqueIds(values) {
  return Array.from(new Set((values || []).map((item) => String(item)).filter(Boolean)))
}

function classTeacherIds(classDoc) {
  return uniqueIds([
    classDoc?.teacher,
    ...(classDoc?.teachers || []),
    ...(classDoc?.labTeachers || []),
  ])
}

function isTeacherAssociatedWithClass(classDoc, userId) {
  return classTeacherIds(classDoc).some((item) => String(item) === String(userId))
}

function buildTeacherClassQuery(userId) {
  return {
    $or: [
      { teacher: userId },
      { teachers: userId },
      { labTeachers: userId },
    ],
  }
}

function buildMemoryTeacherClassFilter(userId) {
  return (item) => isTeacherAssociatedWithClass(item, userId)
}

async function findClassesByJoinCode(joinCode) {
  const normalizedCode = String(joinCode || '').trim().toUpperCase()
  if (!normalizedCode) {
    return []
  }

  if (normalizedCode === GLOBAL_MULTI_CLASS_CODE) {
    return mongoReady
      ? await Class.find({}).sort({ createdAt: 1 }).lean()
      : memoryStore.classes
  }

  const singleClass = mongoReady
    ? await Class.findOne({ code: normalizedCode }).lean()
    : memoryStore.classes.find((item) => String(item.code).toUpperCase() === normalizedCode) || null

  return singleClass ? [singleClass] : []
}

function resolveClassTeacherSummaries(classDoc) {
  return classTeacherIds(classDoc)
    .map((teacherId) => getStoredUserSummary(teacherId))
    .filter(Boolean)
}

async function resolveUserReferenceList(values) {
  const identifiers = normalizeIdList(values)
  const resolved = []

  for (const identifier of identifiers) {
    if (mongoReady) {
      const emailIdentifier = String(identifier).toLowerCase()
      const orConditions = [{ email: emailIdentifier }]
      if (mongoose.Types.ObjectId.isValid(identifier)) {
        orConditions.push({ _id: identifier })
      }

      const user = (await User.findOne({
        $or: orConditions,
      }).select('_id email role name').lean()) || null
      if (user) {
        resolved.push(String(user._id))
      }
    } else {
      const byEmail = Array.from(users.values()).find((item) => String(item.email).toLowerCase() === String(identifier).toLowerCase())
      if (byEmail) {
        resolved.push(String(byEmail.id))
        continue
      }

      const byId = Array.from(users.values()).find((item) => String(item.id) === String(identifier))
      if (byId) {
        resolved.push(String(byId.id))
      }
    }
  }

  return uniqueIds(resolved)
}

async function createNotifications(notifications) {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return
  }

  const payload = notifications
    .filter((item) => item?.recipient && item?.title && item?.message)
    .map((item) => ({
      recipient: item.recipient,
      actor: item.actor || null,
      type: item.type || 'system',
      title: item.title,
      message: item.message,
      metadata: item.metadata || {},
    }))

  if (payload.length > 0) {
    if (mongoReady) {
      await Notification.insertMany(payload)
      return
    }

    payload.forEach((item) => {
      enqueueMemoryRecord('notifications', {
        _id: createMemoryId('notification'),
        ...item,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    })
  }
}

function timeAgo(inputDate) {
  if (!inputDate) return 'Just now'
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(inputDate).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

async function getExternalAiInsights(payload) {
  if (!AI_API_URL || !AI_API_KEY) {
    return null
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4500)

    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) {
      return null
    }

    const result = await response.json()
    if (Array.isArray(result?.insights) && result.insights.length > 0) {
      return result.insights
    }

    return null
  } catch (_error) {
    return null
  }
}

async function getAiInsights(userId, role) {
  try {
    if (role === 'teacher') {
      const teacherClasses = mongoReady
        ? await Class.find(buildTeacherClassQuery(userId)).select('_id students subject').lean()
        : memoryStore.classes.filter(buildMemoryTeacherClassFilter(userId))
      const classIds = teacherClasses.map((item) => item._id)

      const [assignments, attendanceRows, grades] = mongoReady
        ? await Promise.all([
            Assignment.find({ class: { $in: classIds } }).lean(),
            Attendance.find({ class: { $in: classIds } }).lean(),
            Grade.find({ class: { $in: classIds } }).lean(),
          ])
        : [
            memoryStore.assignments.filter((item) => classIds.some((classId) => String(item.class) === String(classId))),
            memoryStore.attendance.filter((item) => classIds.some((classId) => String(item.class) === String(classId))),
            memoryStore.grades.filter((item) => classIds.some((classId) => String(item.class) === String(classId))),
          ]

      const totalStudents = teacherClasses.reduce((sum, item) => sum + (item.students?.length || 0), 0)
      const avgClassScore = grades.length > 0
        ? Math.round(
          grades.reduce((sum, row) => sum + Math.round((Number(row.internals || 0) + Number(row.finals || 0)) / 2), 0) / grades.length
        )
        : 0

      const attendanceTotals = attendanceRows.reduce(
        (acc, row) => {
          const rows = Array.isArray(row.records) ? row.records : []
          acc.total += rows.length
          acc.present += rows.filter((record) => record.status === 'present').length
          return acc
        },
        { total: 0, present: 0 }
      )
      const avgAttendance = attendanceTotals.total > 0 ? Math.round((attendanceTotals.present / attendanceTotals.total) * 100) : 0
      const weakStudents = grades.filter((row) => Math.round((Number(row.internals || 0) + Number(row.finals || 0)) / 2) < 55).length

      const fallbackInsights = [
        {
          title: 'Class Performance Pulse',
          detail: avgClassScore > 0 ? `Average score is ${avgClassScore}%.` : 'Insufficient grade data for scoring.',
          severity: avgClassScore >= 70 ? 'good' : 'attention',
        },
        {
          title: 'Attendance Intelligence',
          detail: avgAttendance > 0
            ? `Average attendance is ${avgAttendance}% across your classes.`
            : 'Start marking attendance to unlock trend insights.',
          severity: avgAttendance >= 75 ? 'good' : 'attention',
        },
        {
          title: 'Action Suggestion',
          detail: weakStudents > 0
            ? `${weakStudents} student records are below 55%. Schedule mentoring sessions.`
            : `No weak-score alerts right now. Keep momentum for ${totalStudents} learners.`,
          severity: weakStudents > 0 ? 'attention' : 'good',
        },
        {
          title: 'Assignment Load',
          detail: `${assignments.length} assignments tracked. Prioritize feedback on recent submissions.`,
          severity: 'info',
        },
      ]

      const external = await getExternalAiInsights({ userId, role, metrics: { totalStudents, avgClassScore, avgAttendance, weakStudents, assignments: assignments.length } })
      return external || fallbackInsights
    }

    const studentClasses = mongoReady
      ? await Class.find({ students: userId }).select('_id').lean()
      : memoryStore.classes.filter((item) => (item.students || []).some((studentId) => String(studentId) === String(userId)))
    const classIds = studentClasses.map((item) => item._id)

    const [assignments, attendanceRows, grades] = mongoReady
      ? await Promise.all([
          Assignment.find({ class: { $in: classIds } }).lean(),
          Attendance.find({ class: { $in: classIds } }).lean(),
          Grade.find({ student: userId }).lean(),
        ])
      : [
          memoryStore.assignments.filter((item) => classIds.some((classId) => String(item.class) === String(classId))),
          memoryStore.attendance.filter((item) => classIds.some((classId) => String(item.class) === String(classId))),
          memoryStore.grades.filter((item) => String(item.student) === String(userId)),
        ]

    const submittedCount = assignments.reduce((sum, assignment) => {
      const hasSubmission = (assignment.submissions || []).some((entry) => String(entry.student) === String(userId))
      return sum + (hasSubmission ? 1 : 0)
    }, 0)
    const submissionRate = assignments.length > 0 ? Math.round((submittedCount / assignments.length) * 100) : 0

    const attendanceTotals = attendanceRows.reduce(
      (acc, row) => {
        const studentRecord = (row.records || []).find((entry) => String(entry.student) === String(userId))
        if (studentRecord) {
          acc.total += 1
          if (studentRecord.status === 'present') {
            acc.present += 1
          }
        }
        return acc
      },
      { total: 0, present: 0 }
    )
    const attendanceRate = attendanceTotals.total > 0 ? Math.round((attendanceTotals.present / attendanceTotals.total) * 100) : 0

    const averageScore = grades.length > 0
      ? Math.round(grades.reduce((sum, row) => sum + Math.round((Number(row.internals || 0) + Number(row.finals || 0)) / 2), 0) / grades.length)
      : 0

    const weakAreas = []
    if (submissionRate > 0 && submissionRate < 75) weakAreas.push('assignment consistency')
    if (attendanceRate > 0 && attendanceRate < 75) weakAreas.push('attendance discipline')
    if (averageScore > 0 && averageScore < 65) weakAreas.push('exam performance')

    const fallbackInsights = [
      {
        title: 'Performance Snapshot',
        detail: averageScore > 0 ? `Average academic score is ${averageScore}%.` : 'No grade records yet for score analysis.',
        severity: averageScore >= 70 ? 'good' : 'attention',
      },
      {
        title: 'Attendance Trend',
        detail: attendanceRate > 0 ? `Attendance is ${attendanceRate}%.` : 'No attendance records captured yet.',
        severity: attendanceRate >= 75 ? 'good' : 'attention',
      },
      {
        title: 'Submission Intelligence',
        detail: assignments.length > 0
          ? `${submittedCount}/${assignments.length} assignments submitted (${submissionRate}%).`
          : 'No assignments assigned yet.',
        severity: submissionRate >= 80 ? 'good' : 'attention',
      },
      {
        title: 'Personalized Suggestion',
        detail: weakAreas.length > 0
          ? `Focus on ${weakAreas.join(', ')} this week with daily micro-targets.`
          : 'Great momentum. Keep revision and attendance consistency for top results.',
        severity: weakAreas.length > 0 ? 'attention' : 'info',
      },
    ]

    const external = await getExternalAiInsights({ userId, role, metrics: { averageScore, attendanceRate, submissionRate, assignments: assignments.length } })
    return external || fallbackInsights
  } catch (error) {
    console.error('AI insight generation failed:', error)
    return []
  }
}

// ============ HELPER FUNCTIONS ============

async function getStudentDashboardData(userId) {
  try {
    const studentClasses = mongoReady
      ? await Class.find({ students: userId }).lean()
      : memoryStore.classes.filter((item) => (item.students || []).some((studentId) => String(studentId) === String(userId)))
    const classIds = studentClasses.map((item) => item._id)
    const assignmentsCount = mongoReady
      ? await Assignment.find({ class: { $in: classIds } })
      : memoryStore.assignments.filter((item) => classIds.some((classId) => String(item.class) === String(classId)))
    const attendanceRecords = mongoReady
      ? await Attendance.find({ class: { $in: classIds } }).lean()
      : memoryStore.attendance.filter((item) => classIds.some((classId) => String(item.class) === String(classId)))
    
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
    const teacherClasses = mongoReady
      ? await Class.find(buildTeacherClassQuery(userId)).lean()
      : memoryStore.classes.filter(buildMemoryTeacherClassFilter(userId))
    const classIds = teacherClasses.map(c => c._id)
    const assignmentsCount = mongoReady
      ? await Assignment.find({ class: { $in: classIds } })
      : memoryStore.assignments.filter((item) => classIds.some((classId) => String(item.class) === String(classId)))
    const totalStudents = teacherClasses.map((item) => (item.students || []).length)
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

app.get('/', (_req, res) => {
  res.status(200).send(
    'EduTrack backend is running. Use the frontend URL (usually http://localhost:5173) and API health at /api/health.'
  )
})

// User Profile Routes
app.get('/api/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const user = await getUserById(userId)
    
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

    let user
    if (mongoReady) {
      user = await User.findByIdAndUpdate(
        userId,
        updates,
        { new: true }
      ).select('-passwordHash').lean()
    } else {
      const existingUser = Array.from(users.values()).find((item) => String(item.id) === String(userId))
      if (existingUser) {
        user = await saveUser({ ...existingUser, ...updates, id: existingUser.id })
      }
    }

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

    const user = mongoReady ? await User.findById(userId) : Array.from(users.values()).find((item) => String(item.id) === String(userId))
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (!user.passwordHash) {
      return res.status(400).json({ message: 'Password change is unavailable for this account' })
    }

    const passwordOk = mongoReady ? await bcrypt.compare(currentPassword, user.passwordHash) : currentPassword === user.passwordHash
    if (!passwordOk) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    if (mongoReady) {
      user.passwordHash = await bcrypt.hash(newPassword, 10)
      await user.save()
    } else {
      const nextUser = { ...user, passwordHash: newPassword }
      await saveUser(nextUser)
    }

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

    const user = mongoReady ? await User.findById(userId).lean() : await getUserById(userId)

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

    let announcements = []
    let notifications = []
    let communicationEntries = []
    let relevantClassIds = []
    if (mongoReady) {
      if (effectiveRole === 'teacher') {
        const teacherClasses = await Class.find(buildTeacherClassQuery(userId)).select('_id').lean()
        const classIds = teacherClasses.map((item) => item._id)
        relevantClassIds = classIds
        announcements = await Announcement.find({
          $or: [{ teacher: userId }, { class: { $in: classIds } }, { class: null }],
        })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean()
      } else {
        const studentClasses = await Class.find({ students: userId }).select('_id').lean()
        const classIds = studentClasses.map((item) => item._id)
        relevantClassIds = classIds
        announcements = await Announcement.find({
          $or: [{ class: { $in: classIds } }, { class: null }],
        })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean()
      }

      notifications = await Notification.find({ recipient: userId })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean()

      communicationEntries = await Communication.find({ class: { $in: relevantClassIds } })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
    } else {
      if (effectiveRole === 'teacher') {
        const teacherClasses = memoryStore.classes.filter(buildMemoryTeacherClassFilter(userId))
        const classIds = teacherClasses.map((item) => item._id)
        relevantClassIds = classIds
        announcements = memoryStore.announcements
          .filter((item) => !item.class || classIds.some((classId) => String(item.class) === String(classId)) || String(item.teacher) === String(userId))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 8)
      } else {
        const studentClasses = memoryStore.classes.filter((item) => (item.students || []).some((studentId) => String(studentId) === String(userId)))
        const classIds = studentClasses.map((item) => item._id)
        relevantClassIds = classIds
        announcements = memoryStore.announcements
          .filter((item) => !item.class || classIds.some((classId) => String(item.class) === String(classId)))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 8)
      }

      notifications = memoryStore.notifications
        .filter((item) => String(item.recipient) === String(userId))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 12)

      communicationEntries = memoryStore.communications
        .filter((item) => relevantClassIds.some((classId) => String(item.class) === String(classId)))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 100)
    }

    const aiInsights = await getAiInsights(userId, effectiveRole)

    const chatCount = communicationEntries.filter((item) => item.type === 'chat').length
    const doubtCount = communicationEntries.filter((item) => item.type === 'doubt').length
    const openDoubts = communicationEntries.filter((item) => item.type === 'doubt' && item.status !== 'resolved').length

    res.json({
      role: effectiveRole,
      profile: toUserResponse(user),
      ...dashboardData,
      quickActions: effectiveRole === 'teacher' 
        ? ['Mark Attendance', 'Create Assignment', 'View Reports', 'Grade Submissions']
        : ['View Classes', 'Submit Assignment', 'Check Grades', 'Ask Mentor'],
      announcements: announcements.map((item) => ({
        id: item._id,
        title: item.title,
        message: item.message,
        time: timeAgo(item.createdAt),
        priority: item.priority || 'medium',
        category: item.category || 'Announcement',
        icon: item.priority === 'high' ? '📣' : '🔔',
      })),
      notifications: notifications.map((item) => ({
        id: item._id,
        title: item.title,
        message: item.message,
        time: timeAgo(item.createdAt),
        read: Boolean(item.readAt),
        type: item.type,
      })),
      communicationSummary: {
        announcements: announcements.length,
        chats: chatCount,
        doubts: doubtCount,
        unresolvedDoubts: openDoubts,
      },
      moduleBoard: [
        { title: 'User Management', status: 'live', detail: 'Signup/login, role access, profile updates' },
        { title: 'Class Management', status: 'live', detail: 'Class creation, roster, class-code enrollment' },
        { title: 'Assignments', status: 'live', detail: 'Create, submit, review, and grading flow' },
        { title: 'Attendance', status: 'live', detail: 'Track presence and class-level trends' },
        { title: 'Communication', status: 'live', detail: 'Announcements, chat, and doubt threads' },
      ],
      smartFeatureBoard: [
        { title: 'Low Attendance Alerts', detail: 'Flags students below attendance threshold', status: 'active' },
        { title: 'Deadline Reminders', detail: 'Highlights upcoming assignment deadlines', status: 'active' },
        { title: 'Exam Alerts', detail: 'Signals schedule pressure and pending prep windows', status: 'active' },
        { title: 'Weak Student Identification', detail: 'Detects low score and low participation patterns', status: 'active' },
        { title: 'Personalized Suggestions', detail: 'AI-backed recommendations for next actions', status: AI_API_URL && AI_API_KEY ? 'ai-live' : 'heuristic' },
      ],
      aiInsights,
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    res.status(500).json({ message: 'Failed to fetch dashboard', error: error.message })
  }
})

app.get('/api/announcements', async (req, res) => {
  try {
    const { role, userId } = req.query

    const effectiveRole = normalizeRole(role)
    let announcements
    if (mongoReady) {
      let query = { class: null }

      if (effectiveRole === 'teacher') {
        const teacherClasses = await Class.find(buildTeacherClassQuery(userId)).select('_id').lean()
        const classIds = teacherClasses.map((item) => item._id)
        query = { $or: [{ teacher: userId }, { class: { $in: classIds } }, { class: null }] }
      } else {
        const studentClasses = await Class.find({ students: userId }).select('_id').lean()
        const classIds = studentClasses.map((item) => item._id)
        query = { $or: [{ class: { $in: classIds } }, { class: null }] }
      }

      announcements = await Announcement.find(query)
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
    } else {
      const classIds = effectiveRole === 'teacher'
        ? memoryStore.classes.filter(buildMemoryTeacherClassFilter(userId)).map((item) => item._id)
        : memoryStore.classes.filter((item) => (item.students || []).some((studentId) => String(studentId) === String(userId))).map((item) => item._id)
      announcements = memoryStore.announcements.filter((item) => !item.class || classIds.some((classId) => String(item.class) === String(classId)) || String(item.teacher) === String(userId))
    }

    res.json(announcements)
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch announcements', error: error.message })
  }
})

app.post('/api/announcements', async (req, res) => {
  try {
    const { teacherId, classId, title, message, priority, category } = req.body
    if (!teacherId || !title || !message) {
      return res.status(400).json({ message: 'teacherId, title and message are required' })
    }

    const payload = {
      teacher: teacherId,
      class: classId || null,
      title,
      message,
      priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
      category: category || 'Announcement',
    }

    const created = mongoReady
      ? await Announcement.create(payload)
      : enqueueMemoryRecord('announcements', {
          _id: createMemoryId('announcement'),
          ...payload,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })

    if (classId) {
      const targetClass = mongoReady ? await Class.findById(classId).select('students').lean() : findMemoryClassById(classId)
      const recipients = (targetClass?.students || []).map((studentId) => ({
        recipient: studentId,
        actor: teacherId,
        type: 'announcement',
        title: `New announcement: ${title}`,
        message,
        metadata: { classId, announcementId: created._id },
      }))
      await createNotifications(recipients)
    }

    res.status(201).json(created)
  } catch (error) {
    res.status(500).json({ message: 'Failed to create announcement', error: error.message })
  }
})

app.get('/api/notifications', async (req, res) => {
  try {
    const { userId } = req.query
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' })
    }

    const notifications = mongoReady
      ? await Notification.find({ recipient: userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean()
      : memoryStore.notifications.filter((item) => String(item.recipient) === String(userId))

    res.json(notifications)
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch notifications', error: error.message })
  }
})

app.post('/api/notifications/mark-read', async (req, res) => {
  try {
    const { userId, notificationId } = req.body
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' })
    }

    if (!mongoReady) {
      if (notificationId) {
        const updated = updateMemoryRecord('notifications', notificationId, (current) => ({
          ...current,
          readAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))
        return res.json({ message: updated ? 'Notification marked as read' : 'Notification not found' })
      }

      memoryStore.notifications = memoryStore.notifications.map((item) => (
        String(item.recipient) === String(userId) && !item.readAt
          ? { ...item, readAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
          : item
      ))
      return res.json({ message: 'All notifications marked as read' })
    }

    if (notificationId) {
      await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { readAt: new Date() }
      )
      return res.json({ message: 'Notification marked as read' })
    }

    await Notification.updateMany(
      { recipient: userId, readAt: null },
      { readAt: new Date() }
    )
    res.json({ message: 'All notifications marked as read' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark notification(s) as read', error: error.message })
  }
})

app.get('/api/communication', async (req, res) => {
  try {
    const { userId, role, classId } = req.query
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' })
    }

    let scopedClassIds = []
    if (classId) {
      scopedClassIds = [classId]
    } else if (mongoReady) {
      const classes = normalizeRole(role) === 'teacher'
        ? await Class.find(buildTeacherClassQuery(userId)).select('_id').lean()
        : await Class.find({ students: userId }).select('_id').lean()
      scopedClassIds = classes.map((item) => item._id)
    } else {
      const classes = normalizeRole(role) === 'teacher'
        ? memoryStore.classes.filter(buildMemoryTeacherClassFilter(userId))
        : memoryStore.classes.filter((item) => (item.students || []).some((studentId) => String(studentId) === String(userId)))
      scopedClassIds = classes.map((item) => item._id)
    }

    const entries = mongoReady
      ? await Communication.find({ class: { $in: scopedClassIds } })
        .populate('class', 'code subject name')
        .populate('sender', 'name email role')
        .populate('recipient', 'name email role')
        .populate('replies.sender', 'name email role')
        .sort({ createdAt: -1 })
        .limit(200)
        .lean()
      : memoryStore.communications
        .filter((item) => scopedClassIds.some((current) => String(current) === String(item.class)))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 200)

    res.json(entries)
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch communication feed', error: error.message })
  }
})

app.post('/api/communication/chat', async (req, res) => {
  try {
    const { classId, senderId, recipientId, message, priority } = req.body
    if (!classId || !senderId || !message) {
      return res.status(400).json({ message: 'classId, senderId and message are required' })
    }

    const normalizedPriority = ['low', 'medium', 'high'].includes(String(priority || '').toLowerCase())
      ? String(priority).toLowerCase()
      : 'medium'

    const payload = {
      class: classId,
      type: 'chat',
      sender: senderId,
      recipient: recipientId || null,
      title: recipientId ? 'Direct chat' : 'Class chat',
      message: String(message).trim(),
      priority: normalizedPriority,
      status: 'open',
      replies: [],
    }

    const created = mongoReady
      ? await Communication.create(payload)
      : enqueueMemoryRecord('communications', {
          _id: createMemoryId('communication'),
          ...payload,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })

    if (recipientId) {
      await createNotifications([
        {
          recipient: recipientId,
          actor: senderId,
          type: 'communication',
          title: 'New chat message',
          message: String(message).trim(),
          metadata: { classId, communicationId: created._id, channel: 'direct', priority: normalizedPriority },
        },
      ])
    } else {
      const classDoc = mongoReady ? await Class.findById(classId).lean() : findMemoryClassById(classId)
      const classMemberIds = classDoc
        ? uniqueIds([...(classDoc.students || []), ...classTeacherIds(classDoc)])
        : []

      const recipients = classMemberIds
        .filter((memberId) => String(memberId) !== String(senderId))
        .map((memberId) => ({
          recipient: memberId,
          actor: senderId,
          type: 'communication',
          title: 'Class chat update',
          message: String(message).trim(),
          metadata: { classId, communicationId: created._id, channel: 'class', priority: normalizedPriority },
        }))

      await createNotifications(recipients)
    }

    res.status(201).json(created)
  } catch (error) {
    res.status(500).json({ message: 'Failed to send chat message', error: error.message })
  }
})

app.post('/api/communication/doubt', async (req, res) => {
  try {
    const { classId, senderId, title, message } = req.body
    if (!classId || !senderId || !title || !message) {
      return res.status(400).json({ message: 'classId, senderId, title and message are required' })
    }

    const payload = {
      class: classId,
      type: 'doubt',
      sender: senderId,
      recipient: null,
      title: String(title).trim(),
      message: String(message).trim(),
      status: 'open',
      replies: [],
    }

    const created = mongoReady
      ? await Communication.create(payload)
      : enqueueMemoryRecord('communications', {
          _id: createMemoryId('communication'),
          ...payload,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })

    const targetClass = mongoReady ? await Class.findById(classId).lean() : findMemoryClassById(classId)
    const recipients = classTeacherIds(targetClass).map((teacherId) => ({
      recipient: teacherId,
      actor: senderId,
      type: 'communication',
      title: `New doubt: ${title}`,
      message: String(message).trim(),
      metadata: { classId, communicationId: created._id, channel: 'doubt' },
    }))
    await createNotifications(recipients)

    res.status(201).json(created)
  } catch (error) {
    res.status(500).json({ message: 'Failed to create doubt thread', error: error.message })
  }
})

app.post('/api/communication/:id/reply', async (req, res) => {
  try {
    const { id } = req.params
    const { senderId, message, markResolved } = req.body

    if (!senderId || !message) {
      return res.status(400).json({ message: 'senderId and message are required' })
    }

    let updated
    if (mongoReady) {
      const reply = {
        sender: senderId,
        message: String(message).trim(),
        createdAt: new Date(),
      }
      updated = await Communication.findByIdAndUpdate(
        id,
        {
          $push: { replies: reply },
          ...(markResolved ? { status: 'resolved' } : {}),
        },
        { new: true }
      ).lean()
    } else {
      updated = updateMemoryRecord('communications', id, (current) => ({
        ...current,
        replies: [...(current.replies || []), {
          sender: senderId,
          message: String(message).trim(),
          createdAt: new Date().toISOString(),
        }],
        status: markResolved ? 'resolved' : current.status,
        updatedAt: new Date().toISOString(),
      }))
    }

    if (!updated) {
      return res.status(404).json({ message: 'Communication thread not found' })
    }

    res.json(updated)
  } catch (error) {
    res.status(500).json({ message: 'Failed to reply in communication thread', error: error.message })
  }
})

app.get('/api/ai/insights/:userId/:role', async (req, res) => {
  try {
    const { userId, role } = req.params
    const insights = await getAiInsights(userId, normalizeRole(role))
    res.json({ insights })
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate AI insights', error: error.message })
  }
})

// Class Routes
app.get('/api/classes', async (req, res) => {
  try {
    const { role, userId } = req.query

    let classes
    if (mongoReady) {
      if (role === 'teacher') {
        classes = await Class.find(buildTeacherClassQuery(userId))
          .populate('students', 'name email role department year section')
          .populate('teacher', 'name email role department year section')
          .populate('teachers', 'name email role department year section')
          .populate('labTeachers', 'name email role department year section')
          .lean()
      } else {
        classes = await Class.find({ students: userId })
          .populate('teacher', 'name email role department year section')
          .populate('teachers', 'name email role department year section')
          .populate('labTeachers', 'name email role department year section')
          .lean()
      }
    } else {
      const matchedClasses = role === 'teacher'
        ? memoryStore.classes.filter(buildMemoryTeacherClassFilter(userId))
        : memoryStore.classes.filter((item) => (item.students || []).some((studentId) => String(studentId) === String(userId)))
      classes = matchedClasses.map((item) => enrichMemoryClass(item))
    }

    res.json(classes)
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch classes', error: error.message })
  }
})

app.post('/api/classes', async (req, res) => {
  try {
    const { name, code, subject, teacher, teachers, labTeachers, credits, description, schedule } = req.body
    const normalizedCode = String(code || '').trim().toUpperCase()
    const firstSlot = Array.isArray(schedule) ? schedule[0] : null
    const primaryTeacherIds = await resolveUserReferenceList([teacher])
    const mainTeacherId = primaryTeacherIds[0]
    const autoEnrolledStudentIds = mongoReady
      ? uniqueIds([
          ...(await User.find({ role: { $regex: /^student$/i } }).select('_id').lean()).map((item) => item._id),
          ...(await Class.distinct('students')).flat(),
        ])
      : uniqueIds([
          ...Array.from(users.values())
            .filter((item) => normalizeRole(item.role) === 'student')
            .map((item) => item.id),
          ...memoryStore.classes.flatMap((item) => item.students || []),
        ])

    if (!mainTeacherId) {
      return res.status(400).json({ message: 'A valid primary teacher is required' })
    }

    const collaboratorTeacherIds = uniqueIds([mainTeacherId, ...(await resolveUserReferenceList(teachers))])
    const labTeacherIds = uniqueIds(await resolveUserReferenceList(labTeachers)).filter((item) => !collaboratorTeacherIds.includes(item))

    const duplicateCode = mongoReady
      ? await Class.findOne({ code: normalizedCode }).lean()
      : memoryStore.classes.find((item) => String(item.code).toUpperCase() === normalizedCode)
    if (duplicateCode) {
      return res.status(409).json({ message: 'This class code already exists' })
    }

    const teacherConflict = mongoReady
      ? await Class.findOne({
          teacher,
          'schedule.day': firstSlot?.day,
          'schedule.time': firstSlot?.time,
        }).lean()
      : memoryStore.classes.find((item) =>
          String(item.teacher) === String(teacher) &&
          item.schedule?.[0]?.day === firstSlot?.day &&
          item.schedule?.[0]?.time === firstSlot?.time
        )
    if (teacherConflict) {
      return res.status(409).json({ message: 'Timetable clash detected for this teacher and time slot' })
    }

    let newClass
    if (mongoReady) {
      newClass = await Class.create({
        name,
        code: normalizedCode,
        subject,
        teacher: mainTeacherId,
        teachers: collaboratorTeacherIds,
        labTeachers: labTeacherIds,
        students: autoEnrolledStudentIds,
        credits,
        description,
        schedule,
      })
    } else {
      newClass = enqueueMemoryRecord('classes', {
        _id: createMemoryId('class'),
        name,
        code: normalizedCode,
        subject,
        teacher: mainTeacherId,
        teachers: collaboratorTeacherIds,
        labTeachers: labTeacherIds,
        students: autoEnrolledStudentIds,
        credits,
        description,
        schedule: Array.isArray(schedule) ? schedule : [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    await createNotifications([
      ...collaboratorTeacherIds.map((teacherId) => ({
        recipient: teacherId,
        actor: mainTeacherId,
        type: 'class',
        title: 'Class created successfully',
        message: `${name} (${code}) has been created and scheduled.`,
        metadata: { classId: newClass._id },
      })),
      ...labTeacherIds.map((teacherId) => ({
        recipient: teacherId,
        actor: mainTeacherId,
        type: 'class',
        title: 'Lab teacher assigned',
        message: `You were assigned as a lab teacher for ${name}.`,
        metadata: { classId: newClass._id },
      })),
    ])

    res.status(201).json(newClass)
  } catch (error) {
    res.status(500).json({ message: 'Failed to create class', error: error.message })
  }
})

app.put('/api/classes/:classId', async (req, res) => {
  try {
    const { classId } = req.params
    const classData = req.body

    let updatedClass
    if (mongoReady) {
      updatedClass = await Class.findByIdAndUpdate(classId, classData, { new: true }).lean()
    } else {
      updatedClass = updateMemoryRecord('classes', classId, (current) => ({
        ...current,
        ...classData,
        updatedAt: new Date().toISOString(),
      }))
    }

    if (!updatedClass) {
      return res.status(404).json({ message: 'Class not found' })
    }

    res.json(updatedClass)
  } catch (error) {
    res.status(500).json({ message: 'Failed to update class', error: error.message })
  }
})

app.delete('/api/classes/:classId', async (req, res) => {
  try {
    const { classId } = req.params
    const classDoc = mongoReady ? await Class.findById(classId).lean() : findMemoryClassById(classId)

    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' })
    }

    if (mongoReady) {
      await Promise.all([
        Assignment.deleteMany({ class: classId }),
        Attendance.deleteMany({ class: classId }),
        Grade.deleteMany({ class: classId }),
        CourseAnalytics.deleteMany({ course: classId }),
        StudentPerformance.deleteMany({ course: classId }),
        AttendanceReport.deleteMany({ course: classId }),
        SmartSchedule.deleteMany({ course: classId }),
        AttendanceQrSession.deleteMany({ class: classId }),
        Announcement.deleteMany({ class: classId }),
        Communication.deleteMany({ class: classId }),
        Class.findByIdAndDelete(classId),
      ])
    } else {
      memoryStore.assignments = memoryStore.assignments.filter((item) => String(item.class) !== String(classId))
      memoryStore.attendance = memoryStore.attendance.filter((item) => String(item.class) !== String(classId))
      memoryStore.grades = memoryStore.grades.filter((item) => String(item.class) !== String(classId))
      memoryStore.attendanceQrSessions = memoryStore.attendanceQrSessions.filter((item) => String(item.class) !== String(classId))
      memoryStore.announcements = memoryStore.announcements.filter((item) => String(item.class) !== String(classId))
      memoryStore.communications = memoryStore.communications.filter((item) => String(item.class) !== String(classId))
      memoryStore.classes = memoryStore.classes.filter((item) => String(item._id) !== String(classId))
    }

    res.json({ message: 'Class removed successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove class', error: error.message })
  }
})

app.post('/api/classes/:classId/enroll', async (req, res) => {
  try {
    const { classId } = req.params
    const { studentId } = req.body

    let updatedClass
    if (mongoReady) {
      updatedClass = await Class.findByIdAndUpdate(
        classId,
        { $addToSet: { students: studentId } },
        { new: true }
      ).lean()
    } else {
      updatedClass = updateMemoryRecord('classes', classId, (current) => ({
        ...current,
        students: Array.from(new Set([...(current.students || []), studentId])),
        updatedAt: new Date().toISOString(),
      }))
    }

    res.json(updatedClass)
  } catch (error) {
    res.status(500).json({ message: 'Failed to enroll student', error: error.message })
  }
})

app.get('/api/classes/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params

    if (mongoReady) {
      const classDoc = await Class.findById(classId).populate('students', 'name email role department year section').lean()
      if (!classDoc) {
        return res.status(404).json({ message: 'Class not found' })
      }

      return res.json(classDoc.students || [])
    }

    const classDoc = findMemoryClassById(classId)
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' })
    }

    const students = (classDoc.students || [])
      .map((studentId) => getStoredUserSummary(studentId))
      .filter(Boolean)

    res.json(students)
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch class students', error: error.message })
  }
})

app.post('/api/classes/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params
    const { studentId, studentEmail } = req.body

    let resolvedStudent = null
    if (studentId) {
      resolvedStudent = mongoReady ? await User.findById(studentId).select('-passwordHash').lean() : getStoredUserSummary(studentId)
    } else if (studentEmail) {
      resolvedStudent = await findUserByEmail(studentEmail)
      if (!mongoReady && resolvedStudent) {
        resolvedStudent = getStoredUserSummary(resolvedStudent.id)
      }
    }

    if (!resolvedStudent) {
      return res.status(404).json({ message: 'Student not found' })
    }

    const classDoc = mongoReady ? await Class.findById(classId) : findMemoryClassById(classId)
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' })
    }

    if (mongoReady) {
      await Class.findByIdAndUpdate(classId, { $addToSet: { students: resolvedStudent._id || resolvedStudent.id } }, { new: true })
    } else {
      classDoc.students = Array.from(new Set([...(classDoc.students || []), resolvedStudent.id]))
      classDoc.updatedAt = new Date().toISOString()
    }

    await createNotifications([
      {
        recipient: resolvedStudent._id || resolvedStudent.id,
        actor: classDoc.teacher,
        type: 'class',
        title: 'Added to class roster',
        message: `You were added to ${classDoc.subject || classDoc.name}.`,
        metadata: { classId },
      },
    ])

    const updatedClass = mongoReady
      ? await Class.findById(classId).populate('students', 'name email role department year section').lean()
      : enrichMemoryClass(classDoc)

    res.status(201).json({ message: 'Student added successfully', class: updatedClass })
  } catch (error) {
    res.status(500).json({ message: 'Failed to add student to class', error: error.message })
  }
})

app.delete('/api/classes/:classId/students/:studentId', async (req, res) => {
  try {
    const { classId, studentId } = req.params

    const classDoc = mongoReady ? await Class.findById(classId) : findMemoryClassById(classId)
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' })
    }

    if (mongoReady) {
      await Class.findByIdAndUpdate(classId, { $pull: { students: studentId } }, { new: true })
    } else {
      classDoc.students = (classDoc.students || []).filter((item) => String(item) !== String(studentId))
      classDoc.updatedAt = new Date().toISOString()
    }

    await createNotifications([
      {
        recipient: studentId,
        actor: classDoc.teacher,
        type: 'class',
        title: 'Removed from class roster',
        message: `You were removed from ${classDoc.subject || classDoc.name}.`,
        metadata: { classId },
      },
    ])

    res.json({ message: 'Student removed successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove student from class', error: error.message })
  }
})

app.post('/api/classes/:classId/students/sync-all', async (req, res) => {
  try {
    const { classId } = req.params
    const classDoc = mongoReady ? await Class.findById(classId).lean() : findMemoryClassById(classId)
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' })
    }

    const allStudentIds = mongoReady
      ? uniqueIds([
          ...(await User.find({ role: { $regex: /^student$/i } }).select('_id').lean()).map((item) => item._id),
          ...(await Class.distinct('students')).flat(),
        ])
      : uniqueIds([
          ...Array.from(users.values())
            .filter((item) => normalizeRole(item.role) === 'student')
            .map((item) => item.id),
          ...memoryStore.classes.flatMap((item) => item.students || []),
        ])

    if (mongoReady) {
      await Class.findByIdAndUpdate(
        classId,
        { $addToSet: { students: { $each: allStudentIds } } },
        { new: true }
      )
    } else {
      const targetClass = findMemoryClassById(classId)
      targetClass.students = uniqueIds([...(targetClass.students || []), ...allStudentIds])
      targetClass.updatedAt = new Date().toISOString()
    }

    const updatedClass = mongoReady
      ? await Class.findById(classId).populate('students', 'name email role department year section').lean()
      : enrichMemoryClass(findMemoryClassById(classId))

    res.json({
      message: `Synced ${updatedClass?.students?.length || 0} students into this class`,
      class: updatedClass,
    })
  } catch (error) {
    res.status(500).json({ message: 'Failed to sync class students', error: error.message })
  }
})

app.post('/api/classes/join-by-code', async (req, res) => {
  try {
    const { studentId, userId, role, code } = req.body
    const targetUserId = userId || studentId
    const joinRole = normalizeRole(role, studentId ? 'student' : 'student')

    if (!targetUserId || !code) {
      return res.status(400).json({ message: 'userId and class code are required' })
    }

    const normalizedCode = String(code).trim().toUpperCase()
    const targetClasses = await findClassesByJoinCode(normalizedCode)

    if (targetClasses.length === 0) {
      return res.status(404).json({ message: 'Class not found for this code' })
    }

    for (const resolvedClass of targetClasses) {
      if (joinRole === 'teacher') {
        if (mongoReady) {
          await Class.findByIdAndUpdate(
            resolvedClass._id,
            { $addToSet: { teachers: targetUserId } },
            { new: true }
          )
        } else {
          resolvedClass.teachers = resolvedClass.teachers || []
          if (!resolvedClass.teachers.some((teacher) => String(teacher) === String(targetUserId))) {
            resolvedClass.teachers.push(targetUserId)
          }
        }
      } else {
        if (mongoReady) {
          await Class.findByIdAndUpdate(
            resolvedClass._id,
            { $addToSet: { students: targetUserId } },
            { new: true }
          )
        } else {
          resolvedClass.students = resolvedClass.students || []
          if (!resolvedClass.students.some((student) => String(student) === String(targetUserId))) {
            resolvedClass.students.push(targetUserId)
          }
        }
      }

      if (joinRole === 'teacher') {
        await createNotifications([
          {
            recipient: targetUserId,
            actor: resolvedClass.teacher,
            type: 'class',
            title: 'Class join confirmed',
            message: `You joined ${resolvedClass.subject} (${resolvedClass.code}) as teacher.`,
            metadata: { classId: resolvedClass._id },
          },
          ...(resolvedClass.students || []).map((currentStudentId) => ({
            recipient: currentStudentId,
            actor: targetUserId,
            type: 'class',
            title: 'Teacher joined class',
            message: `A teacher joined ${resolvedClass.subject} via class code.`,
            metadata: { classId: resolvedClass._id, teacherId: targetUserId },
          })),
        ])
      } else {
        await createNotifications([
          {
            recipient: targetUserId,
            actor: resolvedClass.teacher,
            type: 'class',
            title: 'Class join confirmed',
            message: `You joined ${resolvedClass.subject} (${resolvedClass.code}).`,
            metadata: { classId: resolvedClass._id },
          },
          ...classTeacherIds(resolvedClass).map((teacherId) => ({
            recipient: teacherId,
            actor: targetUserId,
            type: 'class',
            title: 'New student joined class',
            message: `A student joined ${resolvedClass.subject} via class code.`,
            metadata: { classId: resolvedClass._id, studentId: targetUserId },
          })),
        ])
      }
    }

    const joinedClasses = await Promise.all(
      targetClasses.map(async (classItem) => (
        mongoReady
          ? await Class.findById(classItem._id)
            .populate('teacher', 'name email role department year section')
            .populate('teachers', 'name email role department year section')
            .populate('labTeachers', 'name email role department year section')
            .lean()
          : enrichMemoryClass(classItem)
      ))
    )

    if (normalizedCode === GLOBAL_MULTI_CLASS_CODE) {
      const roleMessage = joinRole === 'teacher' ? 'Teacher linked to all courses successfully' : 'Joined all courses successfully'
      return res.json({ message: roleMessage, classes: joinedClasses, classCount: joinedClasses.length })
    }

    if (joinRole === 'teacher') {
      return res.json({ message: 'Teacher linked to class successfully', class: joinedClasses[0] })
    }

    res.json({ message: 'Joined class successfully', class: joinedClasses[0] })
  } catch (error) {
    res.status(500).json({ message: 'Failed to join class', error: error.message })
  }
})

// Assignment Routes
app.get('/api/assignments', async (req, res) => {
  try {
    const { role, userId } = req.query

    let assignments
    if (mongoReady) {
      if (role === 'teacher') {
        const teacherClasses = await Class.find(buildTeacherClassQuery(userId)).select('_id').lean()
        const classIds = teacherClasses.map((item) => item._id)
        assignments = await Assignment.find({ class: { $in: classIds } }).populate('class').lean()
      } else {
        const studentClasses = await Class.find({ students: userId }).select('_id').lean()
        const classIds = studentClasses.map(c => c._id)
        assignments = await Assignment.find({ class: { $in: classIds } }).populate('class').lean()
      }
    } else {
      const classIds = role === 'teacher'
        ? memoryStore.classes.filter(buildMemoryTeacherClassFilter(userId)).map((item) => item._id)
        : memoryStore.classes.filter((item) => (item.students || []).some((studentId) => String(studentId) === String(userId))).map((item) => item._id)
      assignments = memoryStore.assignments.filter((item) =>
        role === 'teacher'
          ? classIds.some((classId) => String(item.class) === String(classId))
          : classIds.some((classId) => String(item.class) === String(classId))
      )
    }

    res.json(assignments)
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch assignments', error: error.message })
  }
})

app.post('/api/assignments', async (req, res) => {
  try {
    const { title, description, classId, teacher, dueDate, maxScore } = req.body
    let newAssignment
    if (mongoReady) {
      newAssignment = await Assignment.create({
        title,
        description,
        class: classId,
        teacher,
        dueDate,
        maxScore,
      })
    } else {
      newAssignment = enqueueMemoryRecord('assignments', {
        _id: createMemoryId('assignment'),
        title,
        description,
        class: classId,
        teacher,
        dueDate,
        maxScore,
        submissions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    const targetClass = mongoReady
      ? await Class.findById(classId).select('students subject code').lean()
      : findMemoryClassById(classId)
    await createNotifications(
      (targetClass?.students || []).map((studentId) => ({
        recipient: studentId,
        actor: teacher,
        type: 'assignment',
        title: 'New assignment posted',
        message: `${title} has been assigned for ${targetClass?.subject || 'your class'}.`,
        metadata: { assignmentId: newAssignment._id, classId },
      }))
    )

    res.status(201).json(newAssignment)
  } catch (error) {
    res.status(500).json({ message: 'Failed to create assignment', error: error.message })
  }
})

app.post('/api/assignments/:assignmentId/submit', async (req, res) => {
  try {
    const { assignmentId } = req.params
    const { studentId, content } = req.body

    const assignment = mongoReady ? await Assignment.findById(assignmentId) : memoryStore.assignments.find((item) => String(item._id) === String(assignmentId))
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' })
    }
    const submission = {
      student: studentId,
      content,
      submittedAt: new Date(),
      isLate: new Date() > assignment.dueDate,
    }

    if (mongoReady) {
      assignment.submissions.push(submission)
      await assignment.save()
    } else {
      assignment.submissions = assignment.submissions || []
      assignment.submissions.push(submission)
      assignment.updatedAt = new Date().toISOString()
    }

    await createNotifications([
      {
        recipient: assignment.teacher,
        actor: studentId,
        type: 'submission',
        title: 'Assignment submitted',
        message: `A student submitted work for ${assignment.title}.`,
        metadata: { assignmentId: assignment._id, studentId },
      },
    ])

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

    const assignment = mongoReady ? await Assignment.findById(assignmentId) : memoryStore.assignments.find((item) => String(item._id) === String(assignmentId))
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

    if (mongoReady) {
      assignment.submissions.push(uploadEntry)
      await assignment.save()
    } else {
      assignment.submissions = assignment.submissions || []
      assignment.submissions.push(uploadEntry)
      assignment.updatedAt = new Date().toISOString()
    }

    await createNotifications([
      {
        recipient: assignment.teacher,
        actor: studentId,
        type: 'submission',
        title: 'File submission received',
        message: `A file was uploaded for ${assignment.title}.`,
        metadata: { assignmentId: assignment._id, studentId },
      },
    ])

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

    const assignment = mongoReady ? await Assignment.findById(assignmentId) : memoryStore.assignments.find((item) => String(item._id) === String(assignmentId))
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' })
    }
    if (assignment.submissions?.[submissionIndex]) {
      assignment.submissions[submissionIndex].score = score
      assignment.submissions[submissionIndex].feedback = feedback
    }
    if (mongoReady) {
      await assignment.save()
    } else {
      assignment.updatedAt = new Date().toISOString()
    }

    res.json(assignment)
  } catch (error) {
    res.status(500).json({ message: 'Failed to grade assignment', error: error.message })
  }
})

app.delete('/api/assignments/:assignmentId', async (req, res) => {
  try {
    const { assignmentId } = req.params
    const assignment = mongoReady
      ? await Assignment.findByIdAndDelete(assignmentId).lean()
      : memoryStore.assignments.find((item) => String(item._id) === String(assignmentId))

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' })
    }

    if (!mongoReady) {
      memoryStore.assignments = memoryStore.assignments.filter((item) => String(item._id) !== String(assignmentId))
    }

    res.json({ message: 'Assignment removed successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove assignment', error: error.message })
  }
})

// Attendance Routes
app.get('/api/attendance', async (req, res) => {
  try {
    const { role, userId } = req.query

    let attendance
    if (mongoReady) {
      if (role === 'teacher') {
        const teacherClasses = await Class.find(buildTeacherClassQuery(userId)).select('_id').lean()
        const classIds = teacherClasses.map(c => c._id)
        attendance = await Attendance.find({ class: { $in: classIds } }).populate('class').lean()
      } else {
        const studentClasses = await Class.find({ students: userId }).select('_id').lean()
        const classIds = studentClasses.map(c => c._id)
        attendance = await Attendance.find({ class: { $in: classIds } }).populate('class').lean()
      }
    } else {
      const classIds = role === 'teacher'
        ? memoryStore.classes.filter(buildMemoryTeacherClassFilter(userId)).map((item) => item._id)
        : memoryStore.classes.filter((item) => (item.students || []).some((studentId) => String(studentId) === String(userId))).map((item) => item._id)
      attendance = memoryStore.attendance.filter((item) => classIds.some((classId) => String(item.class) === String(classId)))
    }

    res.json(attendance)
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance', error: error.message })
  }
})

app.post('/api/attendance', async (req, res) => {
  try {
    const { classId, date, records } = req.body

    let newAttendance
    if (mongoReady) {
      newAttendance = await Attendance.create({
        class: classId,
        date,
        records,
      })
    } else {
      newAttendance = enqueueMemoryRecord('attendance', {
        _id: createMemoryId('attendance'),
        class: classId,
        date,
        records,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    const classDoc = mongoReady ? await Class.findById(classId).select('students subject teacher').lean() : findMemoryClassById(classId)
    await createNotifications(
      (classDoc?.students || []).map((studentId) => ({
        recipient: studentId,
        actor: classDoc?.teacher || null,
        type: 'attendance',
        title: 'Attendance updated',
        message: `Attendance recorded for ${classDoc?.subject || 'your class'}.`,
        metadata: { classId, attendanceId: newAttendance._id },
      }))
    )

    res.status(201).json(newAttendance)
  } catch (error) {
    res.status(500).json({ message: 'Failed to create attendance record', error: error.message })
  }
})

app.delete('/api/attendance/:attendanceId', async (req, res) => {
  try {
    const { attendanceId } = req.params
    const attendanceRow = mongoReady
      ? await Attendance.findByIdAndDelete(attendanceId).lean()
      : memoryStore.attendance.find((item) => String(item._id) === String(attendanceId))

    if (!attendanceRow) {
      return res.status(404).json({ message: 'Attendance record not found' })
    }

    if (!mongoReady) {
      memoryStore.attendance = memoryStore.attendance.filter((item) => String(item._id) !== String(attendanceId))
    }

    res.json({ message: 'Attendance record removed successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove attendance record', error: error.message })
  }
})

app.post('/api/attendance/qr/create', async (req, res) => {
  try {
    const { classId, teacherId, latitude, longitude, rangeMeters, expiresMinutes } = req.body

    if (!classId || !teacherId) {
      return res.status(400).json({ message: 'classId and teacherId are required' })
    }

    const lat = Number(latitude)
    const lng = Number(longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required' })
    }

    const classDoc = mongoReady ? await Class.findById(classId).lean() : findMemoryClassById(classId)
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' })
    }

    if (!isTeacherAssociatedWithClass(classDoc, teacherId)) {
      return res.status(403).json({ message: 'Only assigned teachers can generate class attendance QR' })
    }

    const token = generateAttendanceQrToken()
    const safeRangeMeters = Math.max(10, Math.min(1000, Number(rangeMeters) || 120))
    const safeExpiryMinutes = Math.max(1, Math.min(60, Number(expiresMinutes) || 15))
    const expiresAt = new Date(Date.now() + safeExpiryMinutes * 60 * 1000)

    if (mongoReady) {
      await AttendanceQrSession.updateMany({ class: classId, active: true }, { active: false })
    } else {
      memoryStore.attendanceQrSessions = memoryStore.attendanceQrSessions.map((item) =>
        String(item.class) === String(classId) && item.active ? { ...item, active: false, updatedAt: new Date().toISOString() } : item
      )
    }

    const session = mongoReady
      ? await AttendanceQrSession.create({
          class: classId,
          teacher: teacherId,
          token,
          latitude: lat,
          longitude: lng,
          rangeMeters: safeRangeMeters,
          expiresAt,
          active: true,
        })
      : enqueueMemoryRecord('attendanceQrSessions', {
          _id: createMemoryId('attendance-qr'),
          class: classId,
          teacher: teacherId,
          token,
          latitude: lat,
          longitude: lng,
          rangeMeters: safeRangeMeters,
          expiresAt: expiresAt.toISOString(),
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })

    const payload = JSON.stringify({ token, classCode: classDoc.code, expiresAt })
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(payload)}`

    res.status(201).json({
      sessionId: session._id,
      token,
      classCode: classDoc.code,
      className: classDoc.subject || classDoc.name,
      rangeMeters: safeRangeMeters,
      expiresAt,
      qrImageUrl,
    })
  } catch (error) {
    res.status(500).json({ message: 'Failed to create attendance QR', error: error.message })
  }
})

app.get('/api/attendance/qr/active', async (req, res) => {
  try {
    const { classId } = req.query
    if (!classId) {
      return res.status(400).json({ message: 'classId is required' })
    }

    let session = null
    if (mongoReady) {
      session = await AttendanceQrSession.findOne({ class: classId, active: true }).sort({ createdAt: -1 }).lean()
    } else {
      session = memoryStore.attendanceQrSessions
        .filter((item) => String(item.class) === String(classId) && item.active)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null
    }

    if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
      return res.json({ active: false })
    }

    const classDoc = mongoReady ? await Class.findById(classId).lean() : findMemoryClassById(classId)
    const payload = JSON.stringify({ token: session.token, classCode: classDoc?.code || '', expiresAt: session.expiresAt })

    res.json({
      active: true,
      token: session.token,
      rangeMeters: session.rangeMeters,
      expiresAt: session.expiresAt,
      qrImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(payload)}`,
    })
  } catch (error) {
    res.status(500).json({ message: 'Failed to get active QR session', error: error.message })
  }
})

app.post('/api/attendance/qr/submit', async (req, res) => {
  try {
    const { token, studentId, latitude, longitude } = req.body
    if (!token || !studentId) {
      return res.status(400).json({ message: 'token and studentId are required' })
    }

    const lat = Number(latitude)
    const lng = Number(longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required' })
    }

    const session = mongoReady
      ? await AttendanceQrSession.findOne({ token: String(token).trim(), active: true }).lean()
      : memoryStore.attendanceQrSessions.find((item) => String(item.token) === String(token).trim() && item.active) || null

    if (!session) {
      return res.status(404).json({ message: 'Attendance QR session not found or inactive' })
    }

    const expiry = new Date(session.expiresAt).getTime()
    if (expiry < Date.now()) {
      return res.status(410).json({ message: 'Attendance QR expired. Ask teacher for a new QR.' })
    }

    const classDoc = mongoReady ? await Class.findById(session.class).lean() : findMemoryClassById(session.class)
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found for this attendance session' })
    }

    if (!(classDoc.students || []).some((item) => String(item) === String(studentId))) {
      return res.status(403).json({ message: 'You are not enrolled in this class' })
    }

    const distanceMeters = distanceInMeters(lat, lng, Number(session.latitude), Number(session.longitude))
    if (distanceMeters > Number(session.rangeMeters || 120)) {
      return res.status(403).json({
        message: `Out of class range. Move within ${Math.round(session.rangeMeters)} meters to mark attendance.`,
        meta: { distanceMeters: Math.round(distanceMeters), allowedMeters: Number(session.rangeMeters || 120) },
      })
    }

    const { start, end } = buildDayWindow(new Date())
    let attendanceRecord

    const enrolledStudentIds = uniqueIds(classDoc.students || [])

    if (mongoReady) {
      attendanceRecord = await Attendance.findOne({ class: session.class, date: { $gte: start, $lte: end } })
      if (!attendanceRecord) {
        attendanceRecord = await Attendance.create({
          class: session.class,
          date: new Date(),
          records: enrolledStudentIds.map((id) => ({
            student: id,
            status: String(id) === String(studentId) ? 'present' : 'absent',
          })),
        })
      }

      const existing = attendanceRecord.records.find((item) => String(item.student) === String(studentId))
      if (existing) {
        existing.status = 'present'
      } else {
        attendanceRecord.records.push({ student: studentId, status: 'present' })
      }
      await attendanceRecord.save()
    } else {
      const existingRecord = memoryStore.attendance.find((item) => {
        const date = new Date(item.date)
        return String(item.class) === String(session.class) && date >= start && date <= end
      })

      if (existingRecord) {
        const existing = (existingRecord.records || []).find((item) => String(item.student) === String(studentId))
        if (existing) {
          existing.status = 'present'
        } else {
          existingRecord.records.push({ student: studentId, status: 'present' })
        }
        existingRecord.updatedAt = new Date().toISOString()
        attendanceRecord = existingRecord
      } else {
        attendanceRecord = enqueueMemoryRecord('attendance', {
          _id: createMemoryId('attendance'),
          class: session.class,
          date: new Date().toISOString(),
          records: enrolledStudentIds.map((id) => ({
            student: id,
            status: String(id) === String(studentId) ? 'present' : 'absent',
          })),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
    }

    await createNotifications([
      {
        recipient: session.teacher,
        actor: studentId,
        type: 'attendance',
        title: 'QR attendance marked',
        message: 'A student marked attendance via QR in allowed class range.',
        metadata: { classId: session.class, token: session.token },
      },
      {
        recipient: studentId,
        actor: session.teacher,
        type: 'attendance',
        title: 'Attendance marked',
        message: 'Your QR attendance was recorded successfully.',
        metadata: { classId: session.class, token: session.token },
      },
    ])

    res.json({
      message: 'Attendance marked successfully via QR',
      classId: session.class,
      attendanceId: attendanceRecord._id,
      distanceMeters: Math.round(distanceMeters),
      allowedMeters: Number(session.rangeMeters || 120),
    })
  } catch (error) {
    res.status(500).json({ message: 'Failed to mark QR attendance', error: error.message })
  }
})

// Grade/Performance Routes
app.get('/api/grades', async (req, res) => {
  try {
    const { role, userId } = req.query

    let grades
    if (mongoReady) {
      if (role === 'teacher') {
        const teacherClasses = await Class.find(buildTeacherClassQuery(userId)).select('_id').lean()
        const classIds = teacherClasses.map(c => c._id)
        grades = await Grade.find({ class: { $in: classIds } }).populate('student').populate('class').lean()
      } else {
        grades = await Grade.find({ student: userId }).populate('class').lean()
      }
    } else {
      const classIds = role === 'teacher'
        ? memoryStore.classes.filter(buildMemoryTeacherClassFilter(userId)).map((item) => item._id)
        : memoryStore.classes.filter((item) => (item.students || []).some((studentId) => String(studentId) === String(userId))).map((item) => item._id)
      grades = role === 'teacher'
        ? memoryStore.grades.filter((item) => classIds.some((classId) => String(item.class) === String(classId)))
        : memoryStore.grades.filter((item) => String(item.student) === String(userId))
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

    const computedGrade = computeGrade(internals, finals)
    const newGrade = mongoReady
      ? await Grade.create({
          student: studentId,
          class: classId,
          internals,
          finals,
          grade: computedGrade,
        })
      : enqueueMemoryRecord('grades', {
          _id: createMemoryId('grade'),
          student: studentId,
          class: classId,
          internals,
          finals,
          grade: computedGrade,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })

    await createNotifications([
      {
        recipient: studentId,
        type: 'grade',
        title: 'New grade published',
        message: `Your grade has been updated to ${newGrade.grade}.`,
        metadata: { classId, gradeId: newGrade._id },
      },
    ])

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

    const updatedGrade = mongoReady
      ? await Grade.findByIdAndUpdate(
          gradeId,
          { internals, finals, grade: computeGrade(internals, finals) },
          { new: true }
        ).lean()
      : updateMemoryRecord('grades', gradeId, (current) => ({
          ...current,
          internals,
          finals,
          grade: computeGrade(internals, finals),
          updatedAt: new Date().toISOString(),
        }))

    if (updatedGrade?.student) {
      await createNotifications([
        {
          recipient: updatedGrade.student,
          type: 'grade',
          title: 'Grade revised',
          message: `Your updated grade is ${updatedGrade.grade}.`,
          metadata: { classId: updatedGrade.class, gradeId: updatedGrade._id },
        },
      ])
    }

    res.json(updatedGrade)
  } catch (error) {
    res.status(500).json({ message: 'Failed to update grade', error: error.message })
  }
})

app.delete('/api/grades/:gradeId', async (req, res) => {
  try {
    const { gradeId } = req.params
    const grade = mongoReady
      ? await Grade.findByIdAndDelete(gradeId).lean()
      : memoryStore.grades.find((item) => String(item._id) === String(gradeId))

    if (!grade) {
      return res.status(404).json({ message: 'Grade not found' })
    }

    if (!mongoReady) {
      memoryStore.grades = memoryStore.grades.filter((item) => String(item._id) !== String(gradeId))
    }

    res.json({ message: 'Grade removed successfully' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove grade', error: error.message })
  }
})

// Seed Sample Data Endpoint
app.post('/api/setup/single-class', async (req, res) => {
  try {
    const requestedCode = String(req.body?.classCode || 'SVVV1').trim().toUpperCase()
    const classCode = requestedCode || 'SVVV1'
    const className = String(req.body?.className || 'SVVV Smart ERP Classroom').trim()
    const classSubject = String(req.body?.subject || 'Integrated Classroom Management').trim()

    if (mongoReady) {
      await Communication.deleteMany({})
      await Notification.deleteMany({})
      await Announcement.deleteMany({})
      await Grade.deleteMany({})
      await Attendance.deleteMany({})
      await Assignment.deleteMany({})
      await Class.deleteMany({})
      await User.deleteMany({})
      await AttendanceQrSession.deleteMany({})
    } else {
      users.clear()
      memoryStore.classes = []
      memoryStore.assignments = []
      memoryStore.attendance = []
      memoryStore.attendanceQrSessions = []
      memoryStore.grades = []
      memoryStore.announcements = []
      memoryStore.notifications = []
      memoryStore.communications = []
    }

    const teacherNames = [
      'Teacher One',
      'Teacher Two',
      'Teacher Three',
      'Teacher Four',
      'Teacher Five',
    ]
    const studentNames = Array.from({ length: 20 }).map((_, index) => `Student ${index + 1}`)

    const teachers = []
    for (let index = 0; index < teacherNames.length; index += 1) {
      const passwordHash = await bcrypt.hash('password123', 10)
      if (mongoReady) {
        const created = await User.create({
          name: teacherNames[index],
          email: `teacher${index + 1}@edutrack.com`,
          passwordHash,
          role: 'teacher',
          department: 'Computer Science',
          year: 'All',
          section: 'A',
        })
        teachers.push(created)
      } else {
        const created = await saveUser({
          name: teacherNames[index],
          email: `teacher${index + 1}@edutrack.com`,
          passwordHash,
          role: 'teacher',
          authProvider: 'local',
          department: 'Computer Science',
          year: 'All',
          section: 'A',
        })
        teachers.push(created)
      }
    }

    const students = []
    for (let index = 0; index < studentNames.length; index += 1) {
      const passwordHash = await bcrypt.hash('password123', 10)
      if (mongoReady) {
        const created = await User.create({
          name: studentNames[index],
          email: `student${index + 1}@edutrack.com`,
          passwordHash,
          role: 'student',
          department: 'Computer Science',
          year: '2nd Year',
          section: 'A',
        })
        students.push(created)
      } else {
        const created = await saveUser({
          name: studentNames[index],
          email: `student${index + 1}@edutrack.com`,
          passwordHash,
          role: 'student',
          authProvider: 'local',
          department: 'Computer Science',
          year: '2nd Year',
          section: 'A',
        })
        students.push(created)
      }
    }

    let singleClass
    if (mongoReady) {
      singleClass = await Class.create({
        name: className,
        code: classCode,
        subject: classSubject,
        teacher: teachers[0]._id,
        teachers: teachers.map((item) => item._id),
        labTeachers: [],
        students: students.map((item) => item._id),
        credits: 4,
        description: 'Single-class ERP setup with all teachers and students connected through class code.',
        schedule: [{ day: 'Monday', time: '10:00 AM - 11:30 AM', room: 'A-101' }],
      })
    } else {
      singleClass = enqueueMemoryRecord('classes', {
        _id: createMemoryId('class'),
        name: className,
        code: classCode,
        subject: classSubject,
        teacher: teachers[0].id,
        teachers: teachers.map((item) => item.id),
        labTeachers: [],
        students: students.map((item) => item.id),
        credits: 4,
        description: 'Single-class ERP setup with all teachers and students connected through class code.',
        schedule: [{ day: 'Monday', time: '10:00 AM - 11:30 AM', room: 'A-101' }],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    const assignmentDue = new Date()
    assignmentDue.setDate(assignmentDue.getDate() + 5)
    if (mongoReady) {
      await Assignment.create({
        title: 'ERP Starter Task',
        description: 'Submit a short intro and expectations for this smart classroom.',
        class: singleClass._id,
        teacher: teachers[0]._id,
        dueDate: assignmentDue,
        maxScore: 100,
      })
    } else {
      enqueueMemoryRecord('assignments', {
        _id: createMemoryId('assignment'),
        title: 'ERP Starter Task',
        description: 'Submit a short intro and expectations for this smart classroom.',
        class: singleClass._id,
        teacher: teachers[0].id,
        dueDate: assignmentDue.toISOString(),
        maxScore: 100,
        submissions: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    const todayRecords = students.map((student, index) => ({
      student: mongoReady ? student._id : student.id,
      status: index < 16 ? 'present' : index < 18 ? 'late' : 'absent',
    }))

    if (mongoReady) {
      await Attendance.create({
        class: singleClass._id,
        date: new Date(),
        records: todayRecords,
      })
    } else {
      enqueueMemoryRecord('attendance', {
        _id: createMemoryId('attendance'),
        class: singleClass._id,
        date: new Date().toISOString(),
        records: todayRecords,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }

    res.json({
      message: 'Single-class ERP setup complete',
      class: { code: classCode, name: className, subject: classSubject },
      credentials: {
        password: 'password123',
        teachers: teachers.map((_, index) => `teacher${index + 1}@edutrack.com`),
        students: students.map((_, index) => `student${index + 1}@edutrack.com`),
      },
      counts: {
        teachers: teachers.length,
        students: students.length,
        classes: 1,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Failed to prepare single-class setup', error: error.message })
  }
})

// ============ MULTI-SUBJECT B.TECH SETUP ENDPOINT ============
app.post('/api/setup/multi-subject', async (req, res) => {
  try {
    // Clear existing data
    if (mongoReady) {
      await Communication.deleteMany({})
      await Notification.deleteMany({})
      await Announcement.deleteMany({})
      await StudentPerformance.deleteMany({})
      await CourseAnalytics.deleteMany({})
      await SmartSchedule.deleteMany({})
      await AttendanceReport.deleteMany({})
      await Grade.deleteMany({})
      await Attendance.deleteMany({})
      await Assignment.deleteMany({})
      await Class.deleteMany({})
      await User.deleteMany({})
      await AttendanceQrSession.deleteMany({})
    } else {
      users.clear()
      memoryStore.classes = []
      memoryStore.assignments = []
      memoryStore.attendance = []
      memoryStore.attendanceQrSessions = []
      memoryStore.grades = []
      memoryStore.announcements = []
      memoryStore.notifications = []
      memoryStore.communications = []
    }

    // 5 B.Tech Subjects with Real Teachers
    const subjects = [
      { name: 'Data Structures & Algorithms', code: 'CSE-201', dept: 'Computer Science', teacher: 'Arun Kumar', email: 'arun.kumar@edutrack.com' },
      { name: 'Thermodynamics', code: 'ME-204', dept: 'Mechanical Engineering', teacher: 'Priya Singh', email: 'priya.singh@edutrack.com' },
      { name: 'Circuit Analysis', code: 'ECE-202', dept: 'Electronics Engineering', teacher: 'Vikram Patel', email: 'vikram.patel@edutrack.com' },
      { name: 'Structural Design', code: 'CE-203', dept: 'Civil Engineering', teacher: 'Deepak Sharma', email: 'deepak.sharma@edutrack.com' },
      { name: 'Power Systems', code: 'EE-205', dept: 'Electrical Engineering', teacher: 'Neha Gupta', email: 'neha.gupta@edutrack.com' },
    ]

    const createdClasses = []
    const teachers = []

    // Create teachers for each subject
    for (let i = 0; i < subjects.length; i += 1) {
      const subject = subjects[i]
      const passwordHash = await bcrypt.hash('password123', 10)
      let teacher
      if (mongoReady) {
        teacher = await User.create({
          name: subject.teacher,
          email: subject.email,
          passwordHash,
          role: 'teacher',
          department: subject.dept,
          year: 'All',
          section: 'A, B, C',
          bio: `Expert in ${subject.name}`,
        })
      } else {
        teacher = await saveUser({
          name: subject.teacher,
          email: subject.email,
          passwordHash,
          role: 'teacher',
          authProvider: 'local',
          department: subject.dept,
          year: 'All',
          section: 'A, B, C',
        })
      }
      teachers.push({ teacher, subject })
    }

    // Create 20 students
    const students = []
    const studentNamePrefixes = [
      'Arjun', 'Bhavna', 'Chirag', 'Deepika', 'Eshan',
      'Fiona', 'Gaurav', 'Hina', 'Ishaan', 'Jiya',
      'Karan', 'Lakshya', 'Misha', 'Nikhil', 'Olivia',
      'Priya', 'Quintus', 'Rajeev', 'Simran', 'Taran',
    ]

    for (let i = 0; i < studentNamePrefixes.length; i += 1) {
      const passwordHash = await bcrypt.hash('password123', 10)
      let student
      if (mongoReady) {
        student = await User.create({
          name: `${studentNamePrefixes[i]} Kumar`,
          email: `student${i + 1}@edutrack.com`,
          passwordHash,
          role: 'student',
          department: 'Multi-Discipline',
          year: '2nd Year',
          section: 'B',
        })
      } else {
        student = await saveUser({
          name: `${studentNamePrefixes[i]} Kumar`,
          email: `student${i + 1}@edutrack.com`,
          passwordHash,
          role: 'student',
          authProvider: 'local',
          department: 'Multi-Discipline',
          year: '2nd Year',
          section: 'B',
        })
      }
      students.push(student)
    }

    // Create 5 courses, each with their teacher and all 20 students
    for (let i = 0; i < subjects.length; i += 1) {
      const subject = subjects[i]
      const teacherObj = teachers[i].teacher
      let classRecord
      if (mongoReady) {
        classRecord = await Class.create({
          name: subject.name,
          code: subject.code,
          subject: subject.name,
          teacher: teacherObj._id,
          teachers: [teacherObj._id],
          labTeachers: [],
          students: students.map((s) => s._id || s.id),
          credits: 4,
          description: `${subject.name} - ${subject.dept} Department. All 20 students enrolled.`,
          schedule: [
            { day: 'Monday', time: '10:00 AM - 11:30 AM', room: `${subject.code}-101` },
            { day: 'Wednesday', time: '2:00 PM - 3:30 PM', room: `${subject.code}-101` },
          ],
        })
      } else {
        classRecord = enqueueMemoryRecord('classes', {
          _id: createMemoryId('class'),
          name: subject.name,
          code: subject.code,
          subject: subject.name,
          teacher: teacherObj.id,
          teachers: [teacherObj.id],
          labTeachers: [],
          students: students.map((s) => s.id),
          credits: 4,
          description: `${subject.name} - ${subject.dept} Department`,
          schedule: [
            { day: 'Monday', time: '10:00 AM - 11:30 AM', room: `${subject.code}-101` },
            { day: 'Wednesday', time: '2:00 PM - 3:30 PM', room: `${subject.code}-101` },
          ],
          createdAt: new Date().toISOString(),
        })
      }
      createdClasses.push(classRecord)

      // Create smart schedule for each course
      const schedules = [
        { day: 'Monday', startTime: '10:00 AM', endTime: '11:30 AM', room: `${subject.code}-101` },
        { day: 'Wednesday', startTime: '2:00 PM', endTime: '3:30 PM', room: `${subject.code}-101` },
        { day: 'Friday', startTime: '11:00 AM', endTime: '12:30 PM', room: `${subject.code}-LAB` },
      ]

      for (const sched of schedules) {
        if (mongoReady) {
          await SmartSchedule.create({
            course: classRecord._id,
            day: sched.day,
            startTime: sched.startTime,
            endTime: sched.endTime,
            room: sched.room,
            capacity: 30,
            isConflictFree: true,
            conflicts: [],
          })
        }
      }

      // Create attendance records for the past 60 days (2 months) in the expected records[] format
      const today = new Date()
      const studentAttendanceTotals = new Map()

      for (const student of students) {
        studentAttendanceTotals.set(String(student._id || student.id), { present: 0, total: 0 })
      }

      for (let d = 0; d < 60; d += 1) {
        const attendanceDate = new Date(today)
        attendanceDate.setDate(today.getDate() - d)

        const records = students.map((student) => {
          const studentId = student._id || student.id
          const random = Math.random()
          const status = random > 0.2 ? 'present' : random > 0.1 ? 'late' : 'absent'

          const stat = studentAttendanceTotals.get(String(studentId))
          if (stat) {
            stat.total += 1
            if (status === 'present') {
              stat.present += 1
            }
          }

          return {
            student: studentId,
            status,
          }
        })

        if (mongoReady) {
          await Attendance.create({
            class: classRecord._id,
            date: attendanceDate,
            records,
          })
        } else {
          enqueueMemoryRecord('attendance', {
            _id: createMemoryId('attendance'),
            class: classRecord._id,
            date: attendanceDate.toISOString(),
            records,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        }
      }

      // Create course analytics snapshots for last 60 days
      if (mongoReady) {
        for (let d = 0; d < 60; d += 1) {
          const analyticDate = new Date(today)
          analyticDate.setDate(today.getDate() - d)
          const dayAttendance = 72 + Math.floor(Math.random() * 23) // 72% - 94%
          const dayPresentCount = Math.round((dayAttendance / 100) * students.length)

          await CourseAnalytics.create({
            course: classRecord._id,
            date: analyticDate,
            totalStudents: students.length,
            presentCount: dayPresentCount,
            absentCount: students.length - dayPresentCount,
            attendancePercentage: dayAttendance,
            insights: {
              highestAbsent: students.slice(0, 3).map((s) => s._id),
              perfectAttendance: students.slice(15, 20).map((s) => s._id),
            },
          })
        }
      }

      // Create student performance records with monthly breakdown for last 2 months
      for (let s = 0; s < students.length; s += 1) {
        const student = students[s]
        const studentId = student._id || student.id
        const attendanceStats = studentAttendanceTotals.get(String(studentId)) || { present: 0, total: 0 }
        const attendancePerc = attendanceStats.total > 0
          ? Math.round((attendanceStats.present / attendanceStats.total) * 100)
          : 0
        const performance = Math.max(55, Math.min(98, Math.round((attendancePerc * 0.6) + (Math.random() * 40))))
        const grade = performance > 85 ? 'A' : performance > 75 ? 'B' : performance > 65 ? 'C' : 'D'

        if (mongoReady) {
          await StudentPerformance.create({
            student: studentId,
            course: classRecord._id,
            attendancePercentage: attendancePerc,
            averageGrade: grade,
            totalAssignments: 8,
            submittedAssignments: Math.floor(5 + Math.random() * 4),
            performanceIndex: performance,
            monthlyData: [
              {
                month: 'March 2026',
                attendance: Math.max(60, attendancePerc - Math.floor(Math.random() * 8)),
                grade,
                assignments: Math.floor(3 + Math.random() * 3),
              },
              {
                month: 'April 2026',
                attendance: attendancePerc,
                grade,
                assignments: Math.floor(4 + Math.random() * 4),
              },
            ],
          })
        }
      }
    }

    // Create assignments for each course
    for (let i = 0; i < createdClasses.length; i += 1) {
      const classRecord = createdClasses[i]
      for (let a = 1; a <= 2; a += 1) {
        const assignment = {
          class: classRecord._id || classRecord.id,
          teacher: teachers[i].teacher._id || teachers[i].teacher.id,
          title: `Assignment ${a} - ${subjects[i].name}`,
          description: `Complete this assignment on ${subjects[i].name}`,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          maxScore: 100,
          submissions: [],
        }

        if (mongoReady) {
          await Assignment.create(assignment)
        } else {
          enqueueMemoryRecord('assignments', {
            _id: createMemoryId('assignment'),
            ...assignment,
            dueDate: assignment.dueDate.toISOString(),
            createdAt: new Date().toISOString(),
          })
        }
      }
    }

    res.json({
      success: true,
      message: 'Multi-subject B.Tech setup completed successfully!',
      setupDetails: {
        courses: subjects.map((s) => s.name),
        teachers: teachers.map((t) => ({ name: t.teacher.name, subject: t.subject.name, email: t.teacher.email })),
        students: studentNamePrefixes.length,
        classCode: 'BTECH-MULTI-2026',
        credentials: {
          teachers: 'Each teacher has same email/password123',
          students: 'Each student has same password123',
        },
        features: [
          'Multi-subject enrollment for all students',
          'QR geofenced attendance per course',
          'Course analytics and performance tracking',
          'Smart schedule conflict detection',
          'Automated monthly reports',
          'Student performance insights',
        ],
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Failed to setup multi-subject courses', error: error.message })
  }
})

app.post('/api/setup/bootstrap', async (_req, res) => {
  try {
    const before = await getBootstrapCounts()
    await ensureBootstrapData()
    const after = await getBootstrapCounts()

    res.json({
      success: true,
      message: 'Bootstrap setup processed successfully',
      mongoConnected: mongoReady,
      before,
      after,
      notes: {
        behavior: 'Sample data is added only when user/class data is empty.',
        disableFlag: 'Set AUTO_SEED_ON_EMPTY_DB=false to disable startup auto-bootstrap.',
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Failed to run bootstrap setup', error: error.message })
  }
})

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
  const { name, email, password, role, classCode } = req.body

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'All signup fields are required' })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  const existingUser = await findUserByEmail(normalizedEmail)
  if (existingUser) {
    return res.status(409).json({ message: 'User already exists, please login' })
  }

  const normalizedSignupRole = normalizeRole(role)
  const normalizedCode = String(classCode || '').trim().toUpperCase()
  let targetClasses = []

  if (normalizedSignupRole === 'student' || normalizedSignupRole === 'teacher') {
    if (normalizedCode) {
      targetClasses = await findClassesByJoinCode(normalizedCode)

      if (targetClasses.length === 0) {
        if (normalizedCode === GLOBAL_MULTI_CLASS_CODE) {
          return res.status(404).json({
            message: 'Class setup not found. Please run multi-subject setup first, then use BTECH-MULTI-2026.',
          })
        }
        return res.status(404).json({ message: 'Invalid class code. Please verify and try again.' })
      }
    } else if (normalizedSignupRole === 'student') {
      if (mongoReady) {
        const availableClasses = await Class.find({}).sort({ createdAt: 1 }).limit(2)
        if (availableClasses.length === 1) {
          targetClasses = [availableClasses[0]]
        }
      } else if (memoryStore.classes.length === 1) {
        targetClasses = [memoryStore.classes[0]]
      }
    }
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

  if (normalizedSignupRole === 'student' || normalizedSignupRole === 'teacher') {
    if (targetClasses.length > 0) {
      for (const targetClass of targetClasses) {
      if (normalizedSignupRole === 'student') {
        if (mongoReady) {
          await Class.findByIdAndUpdate(targetClass._id, { $addToSet: { students: storedUser._id } }, { new: true })
        } else {
          targetClass.students = targetClass.students || []
          if (!targetClass.students.some((studentId) => String(studentId) === String(storedUser._id))) {
            targetClass.students.push(storedUser._id)
          }
        }

        const teacherRecipients = classTeacherIds(targetClass)
        await createNotifications([
          {
            recipient: storedUser._id,
            actor: targetClass.teacher,
            type: 'class',
            title: 'Class enrollment complete',
            message: `You were added to ${targetClass.subject} (${targetClass.code}).`,
            metadata: { classId: targetClass._id },
          },
          ...teacherRecipients.map((teacherId) => ({
            recipient: teacherId,
            actor: storedUser._id,
            type: 'class',
            title: 'New student enrollment',
            message: `${storedUser.name} joined ${targetClass.subject}.`,
            metadata: { classId: targetClass._id, studentId: storedUser._id },
          })),
        ])
      } else {
        if (mongoReady) {
          await Class.findByIdAndUpdate(targetClass._id, { $addToSet: { teachers: storedUser._id } }, { new: true })
        } else {
          targetClass.teachers = targetClass.teachers || []
          if (!targetClass.teachers.some((teacherId) => String(teacherId) === String(storedUser._id))) {
            targetClass.teachers.push(storedUser._id)
          }
        }

        const studentRecipients = (targetClass.students || []).map((studentId) => String(studentId))
        await createNotifications([
          {
            recipient: storedUser._id,
            actor: targetClass.teacher,
            type: 'class',
            title: 'Teacher class link complete',
            message: `You are now linked to ${targetClass.subject} (${targetClass.code}).`,
            metadata: { classId: targetClass._id },
          },
          ...studentRecipients.map((studentId) => ({
            recipient: studentId,
            actor: storedUser._id,
            type: 'class',
            title: 'Teacher joined your class',
            message: `${storedUser.name} is now connected to ${targetClass.subject}.`,
            metadata: { classId: targetClass._id, teacherId: storedUser._id },
          })),
        ])
      }
      }
    }
  }

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

// ============ ANALYTICS & SMART FEATURES ENDPOINTS ============

// Get course analytics
app.get('/api/analytics/course/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params
    
    if (mongoReady) {
      const analytics = await CourseAnalytics.findOne({ course: courseId }).populate('course')
      if (!analytics) {
        return res.status(404).json({ message: 'Analytics not found' })
      }
      return res.json(analytics)
    }

    return res.status(400).json({ message: 'Analytics feature requires MongoDB' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch course analytics', error: error.message })
  }
})

// Get student performance data
app.get('/api/analytics/student-performance/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params

    if (mongoReady) {
      const performances = await StudentPerformance.find({ student: studentId }).populate('course')
      return res.json(performances)
    }

    return res.status(400).json({ message: 'Performance analytics requires MongoDB' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch student performance', error: error.message })
  }
})

// Get dashboard analytics (teacher overview)
app.get('/api/analytics/dashboard/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params

    if (mongoReady) {
      // Get all courses taught by this teacher
      const courses = await Class.find({ teacher: teacherId })
      
      const dashboardData = []
      for (const course of courses) {
        const analytics = await CourseAnalytics.findOne({ course: course._id })
        const performances = await StudentPerformance.find({ course: course._id })
        
        const avgAttendance = performances.length > 0
          ? performances.reduce((sum, p) => sum + p.attendancePercentage, 0) / performances.length
          : 0

        dashboardData.push({
          course: course.name,
          courseCode: course.code,
          students: course.students.length,
          attendance: analytics?.attendancePercentage || 0,
          avgAttendance,
          performance: performances,
        })
      }

      return res.json(dashboardData)
    }

    return res.status(400).json({ message: 'Dashboard analytics requires MongoDB' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch dashboard analytics', error: error.message })
  }
})

// Get smart schedule recommendations
app.get('/api/schedule/smart/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params

    if (mongoReady) {
      const schedules = await SmartSchedule.find({ course: courseId })
      
      // Check for conflicts
      for (let i = 0; i < schedules.length; i += 1) {
        for (let j = i + 1; j < schedules.length; j += 1) {
          const sched1 = schedules[i]
          const sched2 = schedules[j]
          
          if (sched1.day === sched2.day) {
            const start1 = new Date(`2026-01-01 ${sched1.startTime}`)
            const end1 = new Date(`2026-01-01 ${sched1.endTime}`)
            const start2 = new Date(`2026-01-01 ${sched2.startTime}`)
            const end2 = new Date(`2026-01-01 ${sched2.endTime}`)

            if ((start1 < end2 && end1 > start2)) {
              schedules[i].conflicts.push(`Conflict with ${sched2.room}`)
              schedules[j].conflicts.push(`Conflict with ${sched1.room}`)
              schedules[i].isConflictFree = false
              schedules[j].isConflictFree = false
            }
          }
        }
      }

      return res.json(schedules)
    }

    return res.status(400).json({ message: 'Smart schedule requires MongoDB' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch smart schedule', error: error.message })
  }
})

// Generate monthly attendance report
app.post('/api/reports/generate-monthly', async (req, res) => {
  try {
    const { courseId, teacherId, month, year } = req.body

    if (!mongoReady) {
      return res.status(400).json({ message: 'Report generation requires MongoDB' })
    }

    const course = await Class.findById(courseId)
    if (!course) {
      return res.status(404).json({ message: 'Course not found' })
    }

    // Get attendance data for the month
    const startDate = new Date(year, parseInt(month) - 1, 1)
    const endDate = new Date(year, parseInt(month), 0)

    const attendanceRecords = await Attendance.find({
      class: courseId,
      date: { $gte: startDate, $lte: endDate },
    }).populate('student')

    // Build report data
    const studentAttendance = {}
    for (const record of attendanceRecords) {
      const studentId = record.student._id.toString()
      if (!studentAttendance[studentId]) {
        studentAttendance[studentId] = {
          student: record.student,
          present: 0,
          absent: 0,
        }
      }
      if (record.status === 'present') {
        studentAttendance[studentId].present += 1
      } else {
        studentAttendance[studentId].absent += 1
      }
    }

    const reportData = {
      studentAttendance: Object.values(studentAttendance).map((data) => ({
        student: data.student._id,
        name: data.student.name,
        daysPresent: data.present,
        daysAbsent: data.absent,
        percentage: (data.present / (data.present + data.absent)) * 100 || 0,
      })),
      summary: {
        totalDays: endDate.getDate(),
        avgAttendance: 0,
        criticalAbsence: 0,
      },
    }

    reportData.summary.avgAttendance = reportData.reportData.studentAttendance.reduce((sum, data) => sum + data.percentage, 0) / reportData.reportData.studentAttendance.length || 0
    reportData.summary.criticalAbsence = reportData.reportData.studentAttendance.filter((data) => data.percentage < 75).length

    // Save report
    const report = await AttendanceReport.create({
      course: courseId,
      teacher: teacherId,
      month: `${month}/${year}`,
      year,
      reportData,
      pdfUrl: `/reports/${courseId}-${month}-${year}.pdf`,
    })

    res.json({
      message: 'Report generated successfully',
      report,
    })
  } catch (error) {
    res.status(500).json({ message: 'Failed to generate report', error: error.message })
  }
})

// Get attendance trends
app.get('/api/analytics/attendance-trends/:courseId', async (req, res) => {
  try {
    const { courseId } = req.params

    if (mongoReady) {
      const attendance = await Attendance.find({ class: courseId })
        .sort({ date: -1 })
        .limit(30)

      // Group by date
      const trends = {}
      for (const record of attendance) {
        const dateStr = record.date.toISOString().split('T')[0]
        if (!trends[dateStr]) {
          trends[dateStr] = { present: 0, absent: 0 }
        }
        if (record.status === 'present') {
          trends[dateStr].present += 1
        } else {
          trends[dateStr].absent += 1
        }
      }

      return res.json(trends)
    }

    return res.status(400).json({ message: 'Attendance trends require MongoDB' })
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch attendance trends', error: error.message })
  }
})

async function startServer() {
  try {
    mongoReady = await connectMongo()
  } catch (error) {
    console.warn(`Mongo connection failed, falling back to in-memory storage: ${error.message}`)
    mongoReady = false
  }

  if (IS_PRODUCTION && REQUIRE_MONGO_IN_PROD && !mongoReady) {
    console.error('MongoDB connection is required in production. Refusing to start without persistent database.')
    process.exit(1)
  }

  try {
    await ensureBootstrapData()
  } catch (error) {
    console.warn(`Bootstrap data initialization skipped: ${error.message}`)
  }

  const listenOnPort = (port) => {
    const server = app.listen(port, () => {
      console.log(`EduTrack backend running on http://localhost:${port}`)
      console.log(`MongoDB: ${mongoReady ? 'Connected' : 'Not connected (using in-memory storage)'}`)
    })

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is busy. Stop the process using that port and restart EduTrack backend on the same port.`)
        console.error('Mac/Linux quick fix: lsof -i :5000 && kill -9 <PID>')
        return
      }

      console.error('Failed to start backend server:', error)
      process.exit(1)
    })
  }

  listenOnPort(PORT)
}

startServer()

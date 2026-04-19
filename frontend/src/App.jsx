import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '' : 'http://localhost:5000')
const TOKEN_KEY = 'edutrack_token'
const USER_KEY = 'edutrack_user'
const THEME_KEY = 'edutrack_theme'

const normalizeRole = (value) => (value === 'teacher' ? 'teacher' : 'student')
const gradeScoreMap = { 'A': 10, 'A-': 9, 'B+': 8, 'B': 7, 'B-': 6, 'C': 5, 'F': 0 }

const navItems = ['Home', 'Features', 'About']
const livePhrases = ['Assignments updated instantly', 'Attendance insights in real time', 'Performance trends are live now']


const emptyDashboardData = {
  stats: [],
  overview: [],
  todaysClasses: [],
  highlights: [],
  quickActions: [],
  announcements: [],
  communicationSummary: null,
  moduleBoard: [],
  smartFeatureBoard: [],
  aiInsights: [],
}

const buildProfileFromUser = (user) => ({
  ...user,
  bio: user.bio || '',
  department: user.department || '',
  year: user.year || '',
  section: user.section || '',
  twoFactorEnabled: Boolean(user.twoFactorEnabled),
  theme: user.theme || 'light',
})

const weekdayLookup = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function buildCalendarGrid(referenceDate) {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []

  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - firstDay + 1
    const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth
    const cellDate = new Date(year, month, inMonth ? dayNumber : 1)

    cells.push({
      key: `${year}-${month}-${index}`,
      dayNumber: inMonth ? dayNumber : '',
      date: cellDate,
      inMonth,
      isToday:
        inMonth &&
        cellDate.getDate() === new Date().getDate() &&
        cellDate.getMonth() === new Date().getMonth() &&
        cellDate.getFullYear() === new Date().getFullYear(),
    })
  }

  return cells
}

function buildCalendarEvents(referenceDate, classes, assignments, attendance) {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const eventsByDay = {}

  const pushEvent = (date, event) => {
    if (date.getFullYear() !== year || date.getMonth() !== month) {
      return
    }

    const dayKey = String(date.getDate())
    if (!eventsByDay[dayKey]) {
      eventsByDay[dayKey] = []
    }

    eventsByDay[dayKey].push(event)
  }

  classes.forEach((course) => {
    course.schedule?.forEach((slot) => {
      const weekdayKey = String(slot.day || '').toLowerCase()
      const weekday = weekdayLookup[weekdayKey]

      if (weekday === undefined) {
        return
      }

      for (let day = 1; day <= daysInMonth; day += 1) {
        const date = new Date(year, month, day)
        if (date.getDay() === weekday) {
          pushEvent(date, {
            title: `${course.code} · ${course.subject}`,
            meta: slot.time || 'TBA',
            tone: 'class',
          })
        }
      }
    })
  })

  assignments.forEach((assignment) => {
    if (!assignment.dueDate) {
      return
    }

    const dueDate = new Date(assignment.dueDate)
    pushEvent(dueDate, {
      title: assignment.title,
      meta: 'Assignment due',
      tone: 'assignment',
    })
  })

  attendance.forEach((record) => {
    if (!record.date) {
      return
    }

    const attendanceDate = new Date(record.date)
    pushEvent(attendanceDate, {
      title: record.class?.subject || 'Attendance',
      meta: `${record.records?.length || 0} records`,
      tone: 'attendance',
    })
  })

  return eventsByDay
}

const features = [
  {
    title: 'Assignment Tracking',
    description: 'Create, assign, and review classwork from one clean dashboard.',
  },
  {
    title: 'Attendance Monitoring',
    description: 'Automate attendance logs and identify trends in minutes.',
  },
  {
    title: 'Performance Analytics',
    description: 'Monitor student progress with focused visual summaries.',
  },
  {
    title: 'Smart Notifications',
    description: 'Send reminders and alerts to keep classes on schedule.',
  },
]

const studentSidebar = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'classes', label: 'Classes' },
  { key: 'assignments', label: 'Assignments', badge: '3' },
  { key: 'attendance', label: 'Attendance', badge: '2' },
  { key: 'communication', label: 'Communication' },
  { key: 'performance', label: 'Performance' },
  { key: 'settings', label: 'Settings' },
]

const teacherSidebar = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'classes', label: 'Classes' },
  { key: 'assignments', label: 'Assignments', badge: '3' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'communication', label: 'Communication' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings', label: 'Settings' },
]

function App() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [liveIndex, setLiveIndex] = useState(0)
  const [currentPath, setCurrentPath] = useState(() =>
    window.location.pathname === '/dashboard' ? '/dashboard' : '/'
  )
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('signup')
  const [role, setRole] = useState('student')
  const [formData, setFormData] = useState({ name: '', email: '', password: '', classCode: '' })
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [session, setSession] = useState(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)

    if (!storedToken || !storedUser) {
      return null
    }

    try {
      const parsedUser = JSON.parse(storedUser)
      return { token: storedToken, user: { ...parsedUser, role: normalizeRole(parsedUser.role) } }
    } catch {
      return null
    }
  })

  const activeRole = normalizeRole(session?.user?.role)
  const activeUser = session ? { ...session.user, role: activeRole } : null
  const dashboardItems = activeRole === 'teacher' ? teacherSidebar : studentSidebar

  const navigateTo = useCallback((path, { replace = false } = {}) => {
    const nextPath = path === '/dashboard' ? '/dashboard' : '/'
    const method = replace ? 'replaceState' : 'pushState'
    window.history[method]({}, '', nextPath)
    setCurrentPath(nextPath)
  }, [])

  const dashboardHighlights = useMemo(() => {
    if (activeRole === 'teacher') {
      return [
        { title: 'Classes running', value: '08' },
        { title: 'Students tracked', value: '214' },
        { title: 'Alerts today', value: '06' },
      ]
    }

    return [
      { title: 'Classes enrolled', value: '06' },
      { title: 'Tasks due', value: '04' },
      { title: 'Attendance', value: '96%' },
    ]
  }, [activeRole])

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 6)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLiveIndex((prev) => (prev + 1) % livePhrases.length)
    }, 2200)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname === '/dashboard' ? '/dashboard' : '/')
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!session && currentPath === '/dashboard') {
      navigateTo('/', { replace: true })
    }
  }, [session, currentPath, navigateTo])

  useEffect(() => {
    if (!authOpen) {
      return
    }

    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setAuthOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onEscape)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onEscape)
    }
  }, [authOpen])

  const openAuth = (mode) => {
    setAuthMode(mode)
    setAuthError('')
    setAuthSuccess('')
    setAuthOpen(true)
  }

  const enterDashboard = (data) => {
    persistSession({ token: data.token, user: data.user })
    setAuthOpen(false)
    setAuthError('')
    navigateTo('/dashboard')
  }

  const updateField = (event) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'classCode' ? value.toUpperCase() : value,
    }))
  }

  const persistSession = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token)
    const normalizedUser = { ...data.user, role: normalizeRole(data.user?.role) }
    localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser))
    setSession({ token: data.token, user: normalizedUser })
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    setAuthLoading(true)

    const endpoint = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
    const payload =
      authMode === 'signup'
        ? { ...formData, role }
        : { email: formData.email, password: formData.password }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed')
      }

      enterDashboard(data)
    } catch (error) {
      setAuthError(error.message || 'Could not connect to backend')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleGoogleAuth = async () => {
    setAuthError('')
    setAuthSuccess('')
    setAuthLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Google verification failed')
      }

      enterDashboard(data)
    } catch (error) {
      setAuthError(error.message || 'Could not connect to backend')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSetupSingleClass = async () => {
    setAuthError('')
    setAuthSuccess('')
    setAuthLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/setup/single-class`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classCode: 'SVVV1' }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create single-class setup')
      }

      setAuthMode('login')
      setAuthSuccess('Single class setup ready. Use teacher1@edutrack.com or student1@edutrack.com with password123 and class code SVVV1.')
    } catch (error) {
      setAuthError(error.message || 'Failed to create single-class setup')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleSetupMultiSubject = async () => {
    setAuthError('')
    setAuthSuccess('')
    setAuthLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/setup/multi-subject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create multi-subject setup')
      }

      setAuthMode('login')
      const courseList = data.setupDetails.courses.join(', ')
      setAuthSuccess(`🎓 Multi-Subject B.Tech Setup Created!\n✅ 5 Courses: ${courseList}\n✅ 20 Students enrolled in all courses\n✅ Test credentials: teacher name@edutrack.com or student1-20@edutrack.com with password123`)
    } catch (error) {
      setAuthError(error.message || 'Failed to create multi-subject setup')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setSession(null)
    setAuthMode('login')
    setAuthOpen(false)
    navigateTo('/')
  }

  if (session && currentPath === '/dashboard') {
    return (
      <DashboardShell
        user={activeUser}
        token={session.token}
        dashboardItems={dashboardItems}
        dashboardHighlights={dashboardHighlights}
        onLogout={handleLogout}
        onGoLanding={() => navigateTo('/')}
      />
    )
  }

  return (
    <div className="page-shell">
      <header className={`topbar ${isScrolled ? 'topbar-scrolled' : ''}`}>
        <a className="brand" href="#home" aria-label="EduTrack home">
          <span className="brand-mark" aria-hidden="true">ET</span>
          <span className="brand-copy">
            <strong>EduTrack</strong>
            <span>Smart classroom management</span>
          </span>
        </a>

        <nav className="nav" aria-label="Primary">
          {navItems.map((item) => (
            <a key={item} href={`#${item.toLowerCase()}`}>{item}</a>
          ))}
        </nav>

        <div className="topbar-actions">
          <button
            className="button button-secondary button-small login-icon-button"
            type="button"
            onClick={() => openAuth('login')}
            aria-label="Open login popup"
            title="Login"
          >
            <span className="login-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.31 0-6 1.79-6 4v1h12v-1c0-2.21-2.69-4-6-4Z" />
              </svg>
            </span>
            <span className="login-text">Login</span>
          </button>
          <button className="button button-dark button-small" type="button" onClick={() => openAuth('signup')}>
            Get Started
          </button>
        </div>
      </header>

      <main>
        <section className="hero" id="home">
          <article className="hero-copy">
            <span className="eyebrow">Built for modern learning communities</span>
            <div className="live-chip" aria-live="polite">
              <span className="live-dot" aria-hidden="true" />
              <span className="live-label">Live</span>
              <strong key={livePhrases[liveIndex]} className="live-value">{livePhrases[liveIndex]}</strong>
            </div>
            <h1>Smart Learning Hub for Students, Teachers, and Institutions</h1>
            <p>
              Track classes, assignments, attendance, and performance in one focused workspace designed for every type of learner.
            </p>
            <div className="hero-actions">
              <button className="button button-dark" type="button" onClick={() => openAuth('signup')}>
                Get Started
              </button>
              <a className="button button-secondary" href="#features">Learn More</a>
            </div>
            <div className="hero-tags" aria-label="Platform highlights">
              <span className="hero-tag float-soft">Project Tracking</span>
              <span className="hero-tag float-soft">Attendance Insights</span>
              <span className="hero-tag float-soft">Career Growth</span>
            </div>
            <div className="stats-grid" aria-label="Quick statistics">
              <div className="stat-card stat-green fade-soft">
                <span>Attendance</span>
                <strong>96%</strong>
              </div>
              <div className="stat-card stat-neutral fade-soft">
                <span>Assignments</span>
                <strong>24 Active</strong>
              </div>
              <div className="stat-card stat-purple fade-soft">
                <span>Alerts</span>
                <strong>12 New</strong>
              </div>
            </div>
          </article>

          <article className="hero-preview" aria-label="Dashboard preview">
            <aside className="preview-sidebar">
              <h3>EduTrack</h3>
              <nav>
                <a className="active" href="#home">Dashboard</a>
                <a href="#features">Tasks</a>
                <a href="#about">Reports</a>
                <a href="#cta">Notes</a>
              </nav>
            </aside>
            <div className="preview-main">
              <div className="preview-panel preview-tasks">
                <div className="panel-header">
                  <h3>My tasks</h3>
                  <span>4 active</span>
                </div>
                <div className="task-item"><p>Read poem & answer questions</p><strong>In progress</strong></div>
                <div className="task-item"><p>Create a comic strip with a story</p><strong>To do</strong></div>
                <div className="task-item"><p>Prepare for the math test</p><strong>Done</strong></div>
              </div>
              <div className="preview-panel preview-notes">
                <div className="panel-header">
                  <h3>My notes</h3>
                  <span>2 saved</span>
                </div>
                <div className="note-grid">
                  <div className="note-card note-green">
                    <strong>Math note</strong>
                    <p>Revision summary for equations and constants.</p>
                  </div>
                  <div className="note-card note-purple">
                    <strong>Biology note</strong>
                    <p>Cell structure and key terminology updates.</p>
                  </div>
                </div>
              </div>
              <div className="preview-panel preview-schedule">
                <div className="panel-header">
                  <h3>My schedule</h3>
                  <span>May 14</span>
                </div>
                <div className="schedule-row"><span>8:30 AM</span><strong>Math</strong></div>
                <div className="schedule-row"><span>10:00 AM</span><strong>English</strong></div>
                <div className="schedule-row"><span>11:30 AM</span><strong>Science</strong></div>
              </div>
            </div>
          </article>
        </section>

        <section className="section" id="features">
          <div className="section-heading">
            <span className="eyebrow">Designed for clarity</span>
            <h2>Core Features</h2>
          </div>
          <div className="feature-grid">
            {features.map((item) => (
              <article className="feature-card fade-soft" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section about-section" id="about">
          <div className="about-grid">
            <article className="about-copy">
              <span className="eyebrow">About EduTrack</span>
              <h2>One platform for classes, progress, and communication</h2>
              <p>
                EduTrack is built for schools, colleges, and training programs that need a clean workflow between teaching, learning, and progress tracking.
              </p>
              <ul className="about-list" aria-label="EduTrack advantages">
                <li>Structured learning roadmap with subject tracking</li>
                <li>Attendance, tasks, and marks in one place</li>
                <li>Feedback, reminders, and class notices in real time</li>
              </ul>
            </article>
            <article className="about-panel">
              <h3>Why students choose EduTrack</h3>
              <div className="about-metrics">
                <div>
                  <strong>94%</strong>
                  <span>On-time assignment submissions</span>
                </div>
                <div>
                  <strong>3.2x</strong>
                  <span>Faster class coordination</span>
                </div>
                <div>
                  <strong>8 hrs</strong>
                  <span>Saved weekly for mentors</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="section cta" id="cta">
          <div className="cta-box">
            <div>
              <span className="eyebrow">Start now</span>
              <h2>Start managing your classroom efficiently today</h2>
            </div>
            <button className="button button-dark" type="button" onClick={() => openAuth('signup')}>
              Get Started
            </button>
          </div>
        </section>

        <footer className="landing-footer">
          <div className="footer-brand">
            <span className="brand-mark" aria-hidden="true">ET</span>
            <div>
              <strong>EduTrack</strong>
              <span>Smart classroom management for modern learners</span>
            </div>
          </div>
          <div className="footer-links" aria-label="Footer links">
            <a href="#home">Home</a>
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <a href="#cta">Get Started</a>
          </div>
          <p className="footer-note">© {new Date().getFullYear()} EduTrack. Built for campus excellence.</p>
        </footer>
      </main>

      {authOpen && (
        <div className="auth-overlay" onClick={() => setAuthOpen(false)}>
          <section className="auth-modal" onClick={(event) => event.stopPropagation()} aria-modal="true" role="dialog" aria-label="Authentication popup">
            <button className="auth-close" type="button" onClick={() => setAuthOpen(false)} aria-label="Close popup">×</button>
            <header className="auth-header">
              <h3>Welcome to EduTrack</h3>
              <p>Continue with Google or use your email to access your student or teacher workspace.</p>
            </header>
            <div className="auth-tabs">
              <button className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`} type="button" onClick={() => setAuthMode('signup')}>
                Sign Up
              </button>
              <button className={`auth-tab ${authMode === 'login' ? 'active' : ''}`} type="button" onClick={() => setAuthMode('login')}>
                Login
              </button>
            </div>
            <button className="google-button" type="button" onClick={handleGoogleAuth} disabled={authLoading}>
              <span className="google-mark" aria-hidden="true">G</span>
              Continue with Google
            </button>
            {authError && <p className="auth-feedback auth-error">{authError}</p>}
            {authSuccess && <p className="auth-feedback auth-success">{authSuccess}</p>}
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === 'signup' && (
                <label>
                  Full Name
                  <input name="name" type="text" placeholder="Enter your full name" value={formData.name} onChange={updateField} required />
                </label>
              )}
              <label>
                Email
                <input name="email" type="email" placeholder="name@example.com" value={formData.email} onChange={updateField} required />
              </label>
              <label>
                Password
                <input name="password" type="password" placeholder="Enter your password" value={formData.password} onChange={updateField} required />
              </label>
              {authMode === 'signup' && (
                <div className="role-select" role="radiogroup" aria-label="Select role">
                  <button className={`role-pill ${role === 'student' ? 'active' : ''}`} type="button" onClick={() => setRole('student')} role="radio" aria-checked={role === 'student'}>
                    Student
                  </button>
                  <button className={`role-pill ${role === 'teacher' ? 'active' : ''}`} type="button" onClick={() => setRole('teacher')} role="radio" aria-checked={role === 'teacher'}>
                    Teacher
                  </button>
                </div>
              )}
              {authMode === 'signup' && (
                <label>
                  Class Code (optional)
                  <input name="classCode" type="text" placeholder="Enter class code (e.g. CSE301)" value={formData.classCode || ''} onChange={updateField} />
                </label>
              )}
              <button className="button button-primary auth-submit" type="submit" disabled={authLoading}>
                {authLoading ? 'Please wait...' : authMode === 'signup' ? 'Create Account' : 'Login'}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

function DashboardShell({ user, token, dashboardItems, dashboardHighlights, onLogout, onGoLanding }) {
  const [activePage, setActivePage] = useState('dashboard')
  const [pageData, setPageData] = useState(() => emptyDashboardData)
  const [pageLoading, setPageLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [classesData, setClassesData] = useState([])
  const [assignmentsData, setAssignmentsData] = useState([])
  const [attendanceData, setAttendanceData] = useState([])
  const [gradesData, setGradesData] = useState([])
  const [communicationFeed, setCommunicationFeed] = useState([])
  const [chatForm, setChatForm] = useState({ message: '' })
  const [doubtForm, setDoubtForm] = useState({ title: '', message: '' })
  const [profileData, setProfileData] = useState(() => buildProfileFromUser(user))
  const [editingProfile, setEditingProfile] = useState(false)
  const [formData, setFormData] = useState(() => buildProfileFromUser(user))
  const [actionModal, setActionModal] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [submissionModalAssignment, setSubmissionModalAssignment] = useState(null)
  const [submissionForm, setSubmissionForm] = useState(() => ({
    note: '',
    file: null,
    fileName: '',
  }))
  const [assignmentForm, setAssignmentForm] = useState(() => ({
    title: '',
    description: '',
    classId: '',
    dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    maxScore: 100,
  }))
  const [announcementForm, setAnnouncementForm] = useState(() => ({
    title: '',
    message: '',
    classId: '',
    priority: 'medium',
    category: 'Class Update',
  }))
  const [classForm, setClassForm] = useState(() => ({
    name: '',
    code: '',
    subject: '',
    teachers: '',
    labTeachers: '',
    credits: 3,
    day: 'Monday',
    time: '09:00 AM - 10:30 AM',
    room: 'A101',
    description: '',
  }))
  const [attendanceForm, setAttendanceForm] = useState(() => ({
    classId: '',
    date: new Date().toISOString().slice(0, 10),
    statuses: {},
  }))
  const [qrAttendanceForm, setQrAttendanceForm] = useState(() => ({
    classId: '',
    rangeMeters: 120,
    expiresMinutes: 15,
    latitude: '',
    longitude: '',
  }))
  const [activeQrSession, setActiveQrSession] = useState(null)
  const [studentQrForm, setStudentQrForm] = useState(() => ({
    token: '',
    latitude: '',
    longitude: '',
  }))
  const [selectedClassId, setSelectedClassId] = useState('')
  const [studentRosterForm, setStudentRosterForm] = useState({ email: '' })
  const [rosterActionState, setRosterActionState] = useState({ loading: false, error: '', success: '' })
  const [joinClassForm, setJoinClassForm] = useState({ code: '' })
  const [securityState, setSecurityState] = useState({
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    passwordCurrent: '',
    passwordNew: '',
    passwordConfirm: '',
    message: '',
    error: '',
  })
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem(THEME_KEY) || user.theme || 'light')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())

  useEffect(() => {
    setActivePage('dashboard')
  }, [user.role])

  useEffect(() => {
    setPageError('')
  }, [activePage])

  useEffect(() => {
    const nextProfile = buildProfileFromUser(user)
    setProfileData(nextProfile)
    setFormData(nextProfile)
    setPageData(emptyDashboardData)
    setSecurityState((current) => ({
      ...current,
      twoFactorEnabled: Boolean(nextProfile.twoFactorEnabled),
      message: '',
      error: '',
    }))
    if (nextProfile.theme === 'light' || nextProfile.theme === 'dark') {
      setThemeMode(nextProfile.theme)
    }
  }, [user])

  useEffect(() => {
    if (classesData.length > 0 && !selectedClassId) {
      setSelectedClassId(classesData[0]._id)
    }
    if (classesData.length === 0) {
      setSelectedClassId('')
    }
  }, [classesData, selectedClassId])

  useEffect(() => {
    if (classesData.length === 0) {
      setQrAttendanceForm((current) => ({ ...current, classId: '' }))
      return
    }

    setQrAttendanceForm((current) => (
      current.classId ? current : { ...current, classId: classesData[0]._id }
    ))
  }, [classesData])

  useEffect(() => {
    const normalizedTheme = themeMode === 'dark' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', normalizedTheme)
    localStorage.setItem(THEME_KEY, normalizedTheme)
  }, [themeMode])

  const parseJsonResponse = async (response) => {
    const contentType = response.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      return response.json()
    }

    const rawText = await response.text()
    throw new Error(rawText || 'Unexpected server response')
  }

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const loadAllData = async () => {
      setPageLoading(true)
      setPageError('')

      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const fallbackProfile = buildProfileFromUser(user)

      try {
        const [dashboardResponse, classesResponse, assignmentsResponse, attendanceResponse, gradesResponse, profileResponse, communicationResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/api/dashboard/${user.id}/${user.role}`, { headers, signal: controller.signal }),
          fetch(`${API_BASE_URL}/api/classes?role=${user.role}&userId=${user.id}`, { headers, signal: controller.signal }),
          fetch(`${API_BASE_URL}/api/assignments?role=${user.role}&userId=${user.id}`, { headers, signal: controller.signal }),
          fetch(`${API_BASE_URL}/api/attendance?role=${user.role}&userId=${user.id}`, { headers, signal: controller.signal }),
          fetch(`${API_BASE_URL}/api/grades?role=${user.role}&userId=${user.id}`, { headers, signal: controller.signal }),
          fetch(`${API_BASE_URL}/api/profile/${user.id}`, { headers, signal: controller.signal }),
          fetch(`${API_BASE_URL}/api/communication?role=${user.role}&userId=${user.id}`, { headers, signal: controller.signal }),
        ])

        const [dashboardResult, classesResult, assignmentsResult, attendanceResult, gradesResult, profileResult, communicationResult] = await Promise.all([
          parseJsonResponse(dashboardResponse),
          parseJsonResponse(classesResponse),
          parseJsonResponse(assignmentsResponse),
          parseJsonResponse(attendanceResponse),
          parseJsonResponse(gradesResponse),
          parseJsonResponse(profileResponse),
          parseJsonResponse(communicationResponse),
        ])

        if (cancelled) {
          return
        }

        setPageData(dashboardResponse.ok && dashboardResult?.stats ? dashboardResult : emptyDashboardData)
        setClassesData(classesResponse.ok && Array.isArray(classesResult) ? classesResult : [])
        setAssignmentsData(assignmentsResponse.ok && Array.isArray(assignmentsResult) ? assignmentsResult : [])
        setAttendanceData(attendanceResponse.ok && Array.isArray(attendanceResult) ? attendanceResult : [])
        setGradesData(gradesResponse.ok && Array.isArray(gradesResult) ? gradesResult : [])
        setCommunicationFeed(communicationResponse.ok && Array.isArray(communicationResult) ? communicationResult : [])
        const resolvedProfile = profileResponse.ok && profileResult?.name ? profileResult : fallbackProfile
        setProfileData(resolvedProfile)
        setFormData(resolvedProfile)
        setSecurityState((current) => ({
          ...current,
          twoFactorEnabled: Boolean(resolvedProfile.twoFactorEnabled),
        }))
        if (resolvedProfile.theme === 'light' || resolvedProfile.theme === 'dark') {
          setThemeMode(resolvedProfile.theme)
        }
      } catch (error) {
        if (error.name !== 'AbortError' && !cancelled) {
          console.error('Failed to load dashboard bundle:', error)
          setPageData(emptyDashboardData)
          setClassesData([])
          setAssignmentsData([])
          setAttendanceData([])
          setGradesData([])
          setCommunicationFeed([])
          const fallbackProfile = buildProfileFromUser(user)
          setProfileData(fallbackProfile)
          setFormData(fallbackProfile)
          setSecurityState((current) => ({
            ...current,
            twoFactorEnabled: Boolean(fallbackProfile.twoFactorEnabled),
          }))
          setPageError('Live data could not be loaded. Please check backend and database connectivity.')
        }
      } finally {
        if (!cancelled && !controller.signal.aborted) {
          setPageLoading(false)
        }
      }
    }

    loadAllData()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [user.id, user.role, user.name, user.email, user.department, user.year, user.section, token])

  const refreshAllData = async () => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const fallbackProfile = buildProfileFromUser(user)

    try {
      const [dashboardResponse, classesResponse, assignmentsResponse, attendanceResponse, gradesResponse, profileResponse, communicationResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/dashboard/${user.id}/${user.role}`, { headers }),
        fetch(`${API_BASE_URL}/api/classes?role=${user.role}&userId=${user.id}`, { headers }),
        fetch(`${API_BASE_URL}/api/assignments?role=${user.role}&userId=${user.id}`, { headers }),
        fetch(`${API_BASE_URL}/api/attendance?role=${user.role}&userId=${user.id}`, { headers }),
        fetch(`${API_BASE_URL}/api/grades?role=${user.role}&userId=${user.id}`, { headers }),
        fetch(`${API_BASE_URL}/api/profile/${user.id}`, { headers }),
        fetch(`${API_BASE_URL}/api/communication?role=${user.role}&userId=${user.id}`, { headers }),
      ])

      const [dashboardResult, classesResult, assignmentsResult, attendanceResult, gradesResult, profileResult, communicationResult] = await Promise.all([
        parseJsonResponse(dashboardResponse),
        parseJsonResponse(classesResponse),
        parseJsonResponse(assignmentsResponse),
        parseJsonResponse(attendanceResponse),
        parseJsonResponse(gradesResponse),
        parseJsonResponse(profileResponse),
        parseJsonResponse(communicationResponse),
      ])

      setPageData(dashboardResponse.ok && dashboardResult?.stats ? dashboardResult : emptyDashboardData)
      setClassesData(classesResponse.ok && Array.isArray(classesResult) ? classesResult : [])
      setAssignmentsData(assignmentsResponse.ok && Array.isArray(assignmentsResult) ? assignmentsResult : [])
      setAttendanceData(attendanceResponse.ok && Array.isArray(attendanceResult) ? attendanceResult : [])
      setGradesData(gradesResponse.ok && Array.isArray(gradesResult) ? gradesResult : [])
      setCommunicationFeed(communicationResponse.ok && Array.isArray(communicationResult) ? communicationResult : [])
      const resolvedProfile = profileResponse.ok && profileResult?.name ? profileResult : fallbackProfile
      setProfileData(resolvedProfile)
      setFormData(resolvedProfile)
      setSecurityState((current) => ({
        ...current,
        twoFactorEnabled: Boolean(resolvedProfile.twoFactorEnabled),
      }))
      if (resolvedProfile.theme === 'light' || resolvedProfile.theme === 'dark') {
        setThemeMode(resolvedProfile.theme)
      }
    } catch (error) {
      console.error('Refresh failed:', error)
    }
  }

  const handleProfileUpdate = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/profile/${user.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(formData),
        }
      )
      const result = await parseJsonResponse(response)
      setProfileData(result && result.name ? result : { ...profileData, ...formData })
      setFormData(result && result.name ? result : { ...profileData, ...formData })
      setEditingProfile(false)
      setPageError('')
    } catch (error) {
      const fallbackProfile = { ...profileData, ...formData }
      setProfileData(fallbackProfile)
      setFormData(fallbackProfile)
      setEditingProfile(false)
      setPageError('')
    }
  }

  const handleSaveSecuritySettings = async () => {
    setSecurityState((current) => ({ ...current, message: '', error: '' }))

    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...formData,
          twoFactorEnabled: securityState.twoFactorEnabled,
          theme: themeMode,
        }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to save security settings')
      }

      setProfileData(result)
      setFormData(result)
      setSecurityState((current) => ({ ...current, message: 'Security settings saved', error: '' }))
    } catch (error) {
      setSecurityState((current) => ({ ...current, error: error.message || 'Failed to save security settings', message: '' }))
    }
  }

  const handlePasswordChange = async () => {
    setSecurityState((current) => ({ ...current, message: '', error: '' }))

    if (!securityState.passwordCurrent || !securityState.passwordNew) {
      setSecurityState((current) => ({ ...current, error: 'Enter current and new password' }))
      return
    }

    if (securityState.passwordNew !== securityState.passwordConfirm) {
      setSecurityState((current) => ({ ...current, error: 'New passwords do not match' }))
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/${user.id}/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentPassword: securityState.passwordCurrent,
          newPassword: securityState.passwordNew,
        }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to change password')
      }

      setSecurityState((current) => ({
        ...current,
        passwordCurrent: '',
        passwordNew: '',
        passwordConfirm: '',
        message: 'Password updated successfully',
        error: '',
      }))
    } catch (error) {
      setSecurityState((current) => ({ ...current, error: error.message || 'Failed to change password', message: '' }))
    }
  }

  const handleJoinClassByCode = async (event) => {
    event.preventDefault()
    setActionLoading(true)
    setActionError('')
    setActionSuccess('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/classes/join-by-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ userId: user.id, role: user.role, code: joinClassForm.code }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to join class')
      }

      setActionSuccess(user.role === 'teacher' ? 'Class linked successfully' : 'Class joined successfully')
      setJoinClassForm({ code: '' })
      await refreshAllData()
    } catch (error) {
      setActionError(error.message || 'Failed to join class')
    } finally {
      setActionLoading(false)
    }
  }

  const activeTeacherClasses = classesData

  const openAssignmentModal = () => {
    const defaultClassId = selectedTeacherClass?._id || activeTeacherClasses[0]?._id || ''
    setAssignmentForm({
      title: '',
      description: '',
      classId: defaultClassId,
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      maxScore: 100,
    })
    setActionError('')
    setActionSuccess('')
    setActionModal('assignment')
  }

  const openSubmissionModal = (assignment) => {
    setSubmissionModalAssignment(assignment)
    setSubmissionForm({ note: '', file: null, fileName: '' })
    setActionError('')
    setActionSuccess('')
    setActionModal('submission')
  }

  const openClassModal = () => {
    const firstClassCode = `CLS-${String(new Date().getFullYear()).slice(-2)}-${String(Date.now()).slice(-4)}`
    setClassForm({
      name: '',
      code: firstClassCode,
      subject: '',
      teachers: '',
      labTeachers: '',
      credits: 3,
      day: 'Monday',
      time: '09:00 AM - 10:30 AM',
      room: 'A101',
      description: '',
    })
    setActionError('')
    setActionSuccess('')
    setActionModal('class')
  }

  const openAnnouncementModal = () => {
    setAnnouncementForm({
      title: '',
      message: '',
      classId: activeTeacherClasses[0]?._id || '',
      priority: 'medium',
      category: 'Class Update',
    })
    setActionError('')
    setActionSuccess('')
    setActionModal('announcement')
  }

  const selectedTeacherClass = useMemo(
    () => classesData.find((item) => item._id === selectedClassId) || classesData[0] || null,
    [classesData, selectedClassId]
  )

  useEffect(() => {
    const targetClassId = selectedTeacherClass?._id || qrAttendanceForm.classId
    if (!targetClassId) {
      setActiveQrSession(null)
      return
    }

    let cancelled = false
    const loadActiveSession = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/attendance/qr/active?classId=${targetClassId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const result = await parseJsonResponse(response)
        if (!cancelled) {
          setActiveQrSession(result?.active ? result : null)
        }
      } catch {
        if (!cancelled) {
          setActiveQrSession(null)
        }
      }
    }

    loadActiveSession()
    return () => {
      cancelled = true
    }
  }, [selectedTeacherClass?._id, qrAttendanceForm.classId, token])

  const handleAddStudentToClass = async (event) => {
    event.preventDefault()
    if (!selectedTeacherClass?._id || !studentRosterForm.email) {
      return
    }

    setRosterActionState({ loading: true, error: '', success: '' })
    try {
      const response = await fetch(`${API_BASE_URL}/api/classes/${selectedTeacherClass._id}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ studentEmail: studentRosterForm.email }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to add student')
      }

      setRosterActionState({ loading: false, error: '', success: 'Student added to class' })
      setStudentRosterForm({ email: '' })
      await refreshAllData()
    } catch (error) {
      setRosterActionState({ loading: false, error: error.message || 'Failed to add student', success: '' })
    }
  }

  const handleRemoveStudentFromClass = async (studentId) => {
    if (!selectedTeacherClass?._id || !studentId) {
      return
    }

    setRosterActionState({ loading: true, error: '', success: '' })
    try {
      const response = await fetch(`${API_BASE_URL}/api/classes/${selectedTeacherClass._id}/students/${studentId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to remove student')
      }

      setRosterActionState({ loading: false, error: '', success: 'Student removed from class' })
      await refreshAllData()
    } catch (error) {
      setRosterActionState({ loading: false, error: error.message || 'Failed to remove student', success: '' })
    }
  }

  const handleSendClassChat = async (event) => {
    event.preventDefault()
    if (!selectedTeacherClass?._id || !chatForm.message.trim()) {
      return
    }

    setActionLoading(true)
    setActionError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/communication/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          classId: selectedTeacherClass._id,
          senderId: user.id,
          message: chatForm.message.trim(),
        }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to send chat message')
      }

      setChatForm({ message: '' })
      await refreshAllData()
    } catch (error) {
      setActionError(error.message || 'Failed to send chat message')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateDoubt = async (event) => {
    event.preventDefault()
    if (!selectedTeacherClass?._id || !doubtForm.title.trim() || !doubtForm.message.trim()) {
      return
    }

    setActionLoading(true)
    setActionError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/communication/doubt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          classId: selectedTeacherClass._id,
          senderId: user.id,
          title: doubtForm.title.trim(),
          message: doubtForm.message.trim(),
        }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create doubt thread')
      }

      setDoubtForm({ title: '', message: '' })
      await refreshAllData()
    } catch (error) {
      setActionError(error.message || 'Failed to create doubt thread')
    } finally {
      setActionLoading(false)
    }
  }

  const openAttendanceModal = () => {
    const defaultClassId = selectedTeacherClass?._id || activeTeacherClasses[0]?._id || ''
    const defaultClass = activeTeacherClasses.find((item) => item._id === defaultClassId) || selectedTeacherClass || activeTeacherClasses[0]
    const statuses = (defaultClass?.students || []).reduce((accumulator, student) => {
      accumulator[student._id] = 'present'
      return accumulator
    }, {})

    setAttendanceForm({
      classId: defaultClassId,
      date: new Date().toISOString().slice(0, 10),
      statuses,
    })
    setActionError('')
    setActionSuccess('')
    setActionModal('attendance')
  }

  const closeActionModal = () => {
    setActionModal('')
    setSubmissionModalAssignment(null)
    setSubmissionForm({ note: '', file: null, fileName: '' })
    setActionError('')
    setActionSuccess('')
    setActionLoading(false)
  }

  const handleCreateAssignment = async (event) => {
    event.preventDefault()
    setActionLoading(true)
    setActionError('')
    setActionSuccess('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/assignments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: assignmentForm.title,
          description: assignmentForm.description,
          classId: assignmentForm.classId,
          teacher: user.id,
          dueDate: assignmentForm.dueDate,
          maxScore: Number(assignmentForm.maxScore) || 100,
        }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create assignment')
      }

      setAssignmentsData((current) => [result, ...current])
      setActionSuccess('Assignment created successfully')
      await refreshAllData()
    } catch (error) {
      setActionError(error.message || 'Failed to create assignment')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateClass = async (event) => {
    event.preventDefault()
    setActionLoading(true)
    setActionError('')
    setActionSuccess('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: classForm.name,
          code: classForm.code?.trim().toUpperCase(),
          subject: classForm.subject,
          teacher: user.id,
          teachers: classForm.teachers,
          labTeachers: classForm.labTeachers,
          credits: Number(classForm.credits) || 3,
          description: classForm.description,
          schedule: [{ day: classForm.day, time: classForm.time, room: classForm.room }],
        }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create class')
      }

      setClassesData((current) => [result, ...current])
      setActionSuccess('Class created successfully')
      await refreshAllData()
    } catch (error) {
      setActionError(error.message || 'Failed to create class')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault()
    setActionLoading(true)
    setActionError('')
    setActionSuccess('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          teacherId: user.id,
          classId: announcementForm.classId || null,
          title: announcementForm.title,
          message: announcementForm.message,
          priority: announcementForm.priority,
          category: announcementForm.category,
        }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create announcement')
      }

      setActionSuccess('Announcement posted successfully')
      await refreshAllData()
    } catch (error) {
      setActionError(error.message || 'Failed to create announcement')
    } finally {
      setActionLoading(false)
    }
  }

  const handleMarkAttendance = async (event) => {
    event.preventDefault()
    setActionLoading(true)
    setActionError('')
    setActionSuccess('')

    const selectedClass = activeTeacherClasses.find((item) => item._id === attendanceForm.classId) || activeTeacherClasses[0]
    const records = (selectedClass?.students || []).map((student) => ({
      student: student._id,
      status: attendanceForm.statuses[student._id] || 'present',
    }))

    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          classId: attendanceForm.classId,
          date: attendanceForm.date,
          records,
        }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to mark attendance')
      }

      setAttendanceData((current) => [result, ...current])
      setActionSuccess('Attendance saved successfully')
      await refreshAllData()
    } catch (error) {
      setActionError(error.message || 'Failed to mark attendance')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCaptureTeacherLocation = () => {
    if (!navigator.geolocation) {
      setActionError('Geolocation is not supported in this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setQrAttendanceForm((current) => ({
          ...current,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }))
      },
      () => setActionError('Unable to capture teacher location. Please allow location access.')
    )
  }

  const handleCreateAttendanceQr = async (event) => {
    event.preventDefault()
    setActionLoading(true)
    setActionError('')
    setActionSuccess('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance/qr/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          classId: qrAttendanceForm.classId || selectedTeacherClass?._id,
          teacherId: user.id,
          latitude: qrAttendanceForm.latitude,
          longitude: qrAttendanceForm.longitude,
          rangeMeters: Number(qrAttendanceForm.rangeMeters) || 120,
          expiresMinutes: Number(qrAttendanceForm.expiresMinutes) || 15,
        }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to create attendance QR')
      }

      setActiveQrSession(result)
      setActionSuccess(`QR created for ${result.classCode}. Students within ${result.rangeMeters}m can mark attendance.`)
    } catch (error) {
      setActionError(error.message || 'Failed to create attendance QR')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCaptureStudentLocation = () => {
    if (!navigator.geolocation) {
      setActionError('Geolocation is not supported in this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStudentQrForm((current) => ({
          ...current,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }))
      },
      () => setActionError('Unable to capture your location. Please allow location access.')
    )
  }

  const handleSubmitQrAttendance = async (event) => {
    event.preventDefault()
    setActionLoading(true)
    setActionError('')
    setActionSuccess('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/attendance/qr/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          token: studentQrForm.token.trim(),
          studentId: user.id,
          latitude: Number(studentQrForm.latitude),
          longitude: Number(studentQrForm.longitude),
        }),
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to mark attendance via QR')
      }

      setActionSuccess(`Attendance marked. Distance ${result.distanceMeters}m of ${result.allowedMeters}m allowed range.`)
      setStudentQrForm((current) => ({ ...current, token: '' }))
      await refreshAllData()
    } catch (error) {
      setActionError(error.message || 'Failed to mark attendance via QR')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSubmitAssignment = async (event) => {
    event.preventDefault()
    if (!submissionModalAssignment?._id) {
      setActionError('Select an assignment first.')
      return
    }

    setActionLoading(true)
    setActionError('')
    setActionSuccess('')

    try {
      const uploadData = new FormData()
      uploadData.append('studentId', user.id)
      uploadData.append('note', submissionForm.note || '')
      if (submissionForm.file) {
        uploadData.append('file', submissionForm.file)
      }

      const response = await fetch(`${API_BASE_URL}/api/assignments/${submissionModalAssignment._id}/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: uploadData,
      })

      const result = await parseJsonResponse(response)
      if (!response.ok) {
        throw new Error(result.message || 'Failed to upload assignment')
      }

      await refreshAllData()
      setActionSuccess('Assignment uploaded successfully')
      setTimeout(() => {
        closeActionModal()
      }, 600)
    } catch (error) {
      setActionError(error.message || 'Failed to upload assignment')
    } finally {
      setActionLoading(false)
    }
  }

  const mainNavItems = dashboardItems.filter((item) => item.key !== 'settings')
  const settingsNavItem = dashboardItems.find((item) => item.key === 'settings')

  const pageTitles = {
    dashboard: 'Dashboard',
    classes: 'Classes',
    assignments: 'Assignments',
    attendance: 'Attendance',
    calendar: 'Calendar',
    performance: 'Performance',
    analytics: 'Analytics',
    profile: 'Profile',
    settings: 'Settings',
  }

  const pageTitle = pageTitles[activePage] || 'Dashboard'
  const userLabel = 'Profile'
  const topbarTitle = pageTitle

  const calendarGrid = useMemo(() => buildCalendarGrid(calendarMonth), [calendarMonth])
  const calendarEvents = useMemo(
    () => buildCalendarEvents(calendarMonth, classesData, assignmentsData, attendanceData),
    [calendarMonth, classesData, assignmentsData, attendanceData]
  )

  const metricsByClass = useMemo(() => {
    return (classesData || []).map((cls) => {
      const classRecords = (attendanceData || []).filter((record) => (record.class?._id || record.class) === cls._id)
      const totals = classRecords.reduce(
        (acc, record) => {
          const rows = Array.isArray(record.records) ? record.records : []
          acc.total += rows.length
          acc.present += rows.filter((item) => item.status === 'present').length
          return acc
        },
        { total: 0, present: 0 }
      )
      const attendanceRate = totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0

      return {
        ...cls,
        sessions: classRecords.length,
        attendanceRate,
      }
    })
  }, [classesData, attendanceData])

  const submittedByCurrentUser = (assignment) => {
    const rows = Array.isArray(assignment?.submissions) ? assignment.submissions : []
    return rows.some((entry) => String(entry?.student?._id || entry?.student) === String(user.id))
  }

  const assignmentOverview = useMemo(() => {
    const now = new Date()
    const upcomingLimit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3)
    const total = assignmentsData.length
    const submitted = assignmentsData.filter((item) => submittedByCurrentUser(item)).length
    const dueSoon = assignmentsData.filter((item) => {
      if (!item?.dueDate) return false
      const due = new Date(item.dueDate)
      return due >= now && due <= upcomingLimit
    }).length
    const teacherSubmissions = assignmentsData.reduce((sum, item) => sum + (item.submissions?.length || 0), 0)

    return {
      total,
      submitted,
      dueSoon,
      teacherSubmissions,
      completion: total > 0 ? Math.round((submitted / total) * 100) : 0,
    }
  }, [assignmentsData])

  const courseDashboardRows = useMemo(() => {
    return (classesData || []).map((cls) => {
      const classId = String(cls?._id || '')
      const teacherList = [...(Array.isArray(cls?.teachers) ? cls.teachers : []), cls?.teacher]
        .filter(Boolean)
        .map((teacher) => teacher?.name || teacher?.email || 'Teacher')
      const uniqueTeacherNames = Array.from(new Set(teacherList))

      const classAssignments = (assignmentsData || []).filter(
        (item) => String(item?.class?._id || item?.class || '') === classId
      )
      const classAttendanceRecords = (attendanceData || []).filter(
        (record) => String(record?.class?._id || record?.class || '') === classId
      )
      const classGrades = (gradesData || []).filter(
        (grade) => String(grade?.class?._id || grade?.class || '') === classId
      )

      const attendanceAggregate = classAttendanceRecords.reduce(
        (accumulator, record) => {
          const rows = Array.isArray(record.records) ? record.records : []
          accumulator.total += rows.length
          accumulator.present += rows.filter((entry) => entry.status === 'present').length
          return accumulator
        },
        { total: 0, present: 0 }
      )

      const classAttendanceRate = attendanceAggregate.total > 0
        ? Math.round((attendanceAggregate.present / attendanceAggregate.total) * 100)
        : 0

      const submissionsCount = classAssignments.reduce(
        (sum, assignment) => sum + (assignment?.submissions?.length || 0),
        0
      )

      const studentAttendance = classAttendanceRecords.reduce(
        (accumulator, record) => {
          const rows = Array.isArray(record.records) ? record.records : []
          const studentRow = rows.find((entry) => String(entry?.student?._id || entry?.student) === String(user.id))
          if (studentRow) {
            accumulator.total += 1
            if (studentRow.status === 'present') {
              accumulator.present += 1
            }
          }
          return accumulator
        },
        { total: 0, present: 0 }
      )

      const studentAttendanceRate = studentAttendance.total > 0
        ? Math.round((studentAttendance.present / studentAttendance.total) * 100)
        : 0

      const studentSubmittedAssignments = classAssignments.filter((assignment) => {
        const rows = Array.isArray(assignment?.submissions) ? assignment.submissions : []
        return rows.some((entry) => String(entry?.student?._id || entry?.student) === String(user.id))
      }).length

      const studentGradeRows = classGrades.filter(
        (grade) => String(grade?.student?._id || grade?.student) === String(user.id)
      )
      const studentAverageScore = studentGradeRows.length > 0
        ? Math.round(
            studentGradeRows.reduce((sum, grade) => sum + Math.round((Number(grade?.internals || 0) + Number(grade?.finals || 0)) / 2), 0) /
              studentGradeRows.length
          )
        : 0
      const latestGrade = studentGradeRows[0]?.grade || 'N/A'

      return {
        classId,
        classCode: cls?.code || 'N/A',
        className: cls?.name || cls?.subject || 'Class',
        subject: cls?.subject || cls?.name || 'Subject',
        teachers: uniqueTeacherNames,
        studentCount: Array.isArray(cls?.students) ? cls.students.length : 0,
        totalAssignments: classAssignments.length,
        submissionsCount,
        attendanceSessions: classAttendanceRecords.length,
        classAttendanceRate,
        studentAttendanceRate,
        studentSubmittedAssignments,
        studentAverageScore,
        latestGrade,
      }
    })
  }, [classesData, assignmentsData, attendanceData, gradesData, user.id])

  const teacherStudentProgressRows = useMemo(() => {
    if (user.role !== 'teacher' || !selectedTeacherClass?._id) {
      return []
    }

    const classId = String(selectedTeacherClass._id)
    const classAssignments = assignmentsData.filter(
      (item) => String(item?.class?._id || item?.class || '') === classId
    )
    const classAttendanceRecords = attendanceData.filter(
      (record) => String(record?.class?._id || record?.class || '') === classId
    )

    return (selectedTeacherClass.students || []).map((student) => {
      const studentId = String(student?._id || student?.id || '')
      const attendanceTotals = classAttendanceRecords.reduce(
        (accumulator, record) => {
          const rows = Array.isArray(record.records) ? record.records : []
          const row = rows.find((entry) => String(entry?.student?._id || entry?.student) === studentId)
          if (row) {
            accumulator.total += 1
            if (row.status === 'present') {
              accumulator.present += 1
            }
          }
          return accumulator
        },
        { total: 0, present: 0 }
      )
      const attendanceRate = attendanceTotals.total > 0
        ? Math.round((attendanceTotals.present / attendanceTotals.total) * 100)
        : 0

      const submittedAssignments = classAssignments.filter((assignment) => {
        const rows = Array.isArray(assignment?.submissions) ? assignment.submissions : []
        return rows.some((entry) => String(entry?.student?._id || entry?.student) === studentId)
      }).length

      const gradeRows = gradesData.filter(
        (grade) => String(grade?.class?._id || grade?.class || '') === classId && String(grade?.student?._id || grade?.student) === studentId
      )
      const averageScore = gradeRows.length > 0
        ? Math.round(
            gradeRows.reduce((sum, grade) => sum + Math.round((Number(grade?.internals || 0) + Number(grade?.finals || 0)) / 2), 0) / gradeRows.length
          )
        : 0
      const latestGrade = gradeRows[0]?.grade || 'N/A'

      return {
        studentId,
        name: student?.name || 'Student',
        email: student?.email || 'N/A',
        attendanceRate,
        attendanceSummary: `${attendanceTotals.present}/${attendanceTotals.total}`,
        submittedAssignments,
        totalAssignments: classAssignments.length,
        averageScore,
        latestGrade,
      }
    })
  }, [user.role, selectedTeacherClass, assignmentsData, attendanceData, gradesData])

  const attendanceOverview = useMemo(() => {
    const totals = attendanceData.reduce(
      (acc, row) => {
        const records = Array.isArray(row.records) ? row.records : []
        acc.total += records.length
        acc.present += records.filter((item) => item.status === 'present').length
        acc.late += records.filter((item) => item.status === 'late').length
        acc.absent += records.filter((item) => item.status === 'absent').length
        return acc
      },
      { total: 0, present: 0, late: 0, absent: 0 }
    )

    return {
      ...totals,
      rate: totals.total > 0 ? Math.round((totals.present / totals.total) * 100) : 0,
    }
  }, [attendanceData])

  const gradeOverview = useMemo(() => {
    const totals = gradesData.reduce(
      (acc, grade) => {
        const internals = Number(grade?.internals || 0)
        const finals = Number(grade?.finals || 0)
        const score = Math.round((internals + finals) / 2)
        const letter = grade?.grade || 'N/A'
        acc.sum += score
        acc.count += 1
        acc.distribution[letter] = (acc.distribution[letter] || 0) + 1
        return acc
      },
      { sum: 0, count: 0, distribution: {} }
    )

    return {
      average: totals.count > 0 ? Math.round(totals.sum / totals.count) : 0,
      distribution: totals.distribution,
    }
  }, [gradesData])

  const inferPercentFromValue = (value, index = 0) => {
    if (typeof value === 'string') {
      const match = value.match(/\d+/)
      if (match) {
        return Math.max(8, Math.min(100, Number(match[0])))
      }
    }

    if (typeof value === 'number') {
      return Math.max(8, Math.min(100, value))
    }

    return [68, 82, 57, 76][index % 4]
  }

  const renderDashboardSkeleton = () => (
    <section className="dashboard-overview dashboard-skeleton-wrap">
      <div className="stats-grid-modern">
        {[1, 2, 3, 4].map((item) => (
          <article className="dashboard-panel metric-card" key={`skeleton-metric-${item}`}>
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-value"></div>
          </article>
        ))}
      </div>
    </section>
  )

  const renderDashboardOverview = () => (
    <section className="dashboard-overview">
      <div className="stats-grid-modern">
        {(pageData?.stats || []).map((item) => (
          <article className="dashboard-panel metric-card" key={item.title}>
            <div className="metric-row">
              <p>{item.title}</p>
              <span className={`metric-wave wave-${item.tone || 'blue'}`}></span>
            </div>
            <strong>{item.value}</strong>
            <span className="metric-trend">{item.trend}</span>
          </article>
        ))}
      </div>

      {user.role === 'teacher' && (
        <div className="dashboard-row dashboard-home-row">
          <article className="dashboard-panel section-card">
            <div className="panel-header panel-header-strong">
              <h3>Teacher Control Center</h3>
              <span className="pill progress">Live control</span>
            </div>
            <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
              Create classes, publish updates, and manage attendance without leaving the dashboard.
            </p>
            <div className="teacher-control-grid">
              <button className="button button-dark" type="button" onClick={openClassModal}>Create Class</button>
              <button className="button button-dark" type="button" onClick={openAssignmentModal}>Create Assignment</button>
              <button className="button button-dark" type="button" onClick={openAttendanceModal}>Mark Attendance</button>
              <button className="button button-dark" type="button" onClick={openAnnouncementModal}>Post Update</button>
            </div>
          </article>
        </div>
      )}

      {user.role === 'teacher' && (
        <div className="dashboard-row dashboard-home-row">
          <article className="dashboard-panel section-card">
            <div className="panel-header panel-header-strong">
              <h3>Subject-Wise Operations</h3>
              <span className="pill progress">{courseDashboardRows.length} courses</span>
            </div>
            <div className="dashboard-list">
              {courseDashboardRows.length > 0 ? (
                courseDashboardRows.map((course) => (
                  <div className="dashboard-list-item" key={course.classId || course.classCode}>
                    <div>
                      <h4>{course.classCode} · {course.subject}</h4>
                      <p>
                        {course.studentCount} students · {course.attendanceSessions} sessions · {course.classAttendanceRate}% attendance · {course.totalAssignments} assignments ({course.submissionsCount} submissions)
                      </p>
                      <small className="small-muted">Teachers: {course.teachers.length > 0 ? course.teachers.join(', ') : 'Not assigned'}</small>
                    </div>
                    <button className="panel-add" type="button" onClick={() => setSelectedClassId(course.classId)}>
                      Open Class
                    </button>
                  </div>
                ))
              ) : (
                <div className="dashboard-list-item">
                  <div>
                    <h4>No subject data yet</h4>
                    <p>Create classes and attendance to view course-wise operations.</p>
                  </div>
                  <span className="pill todo">Empty</span>
                </div>
              )}
            </div>
          </article>

          <article className="dashboard-panel section-card">
            <div className="panel-header panel-header-strong">
              <h3>Student Progress In {selectedTeacherClass?.code || 'Selected Class'}</h3>
              <span className="pill pending">{teacherStudentProgressRows.length} students</span>
            </div>
            {classesData.length > 0 && (
              <div className="class-switcher">
                {classesData.map((cls) => (
                  <button
                    key={cls._id}
                    type="button"
                    className={`class-switcher-pill ${selectedClassId === cls._id ? 'active' : ''}`}
                    onClick={() => setSelectedClassId(cls._id)}
                  >
                    {cls.code}
                  </button>
                ))}
              </div>
            )}
            <div className="dashboard-list" style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {teacherStudentProgressRows.length > 0 ? (
                teacherStudentProgressRows.map((student) => (
                  <div className="dashboard-list-item" key={student.studentId || student.email}>
                    <div>
                      <h4>{student.name}</h4>
                      <p>{student.email}</p>
                      <small className="small-muted">
                        Attendance {student.attendanceRate}% ({student.attendanceSummary}) · Assignments {student.submittedAssignments}/{student.totalAssignments} · Score {student.averageScore || 'N/A'}% · Grade {student.latestGrade}
                      </small>
                    </div>
                    <span className={`pill ${student.attendanceRate >= 75 ? 'progress' : 'pending'}`}>
                      {student.attendanceRate}%
                    </span>
                  </div>
                ))
              ) : (
                <div className="dashboard-list-item">
                  <div>
                    <h4>No student progress yet</h4>
                    <p>Once attendance and assignments are recorded, student-wise progress will appear here.</p>
                  </div>
                  <span className="pill todo">Waiting</span>
                </div>
              )}
            </div>
          </article>
        </div>
      )}

      {user.role === 'student' && (
        <div className="dashboard-row dashboard-home-row">
          <article className="dashboard-panel section-card">
            <div className="panel-header panel-header-strong">
              <h3>My 5 Subjects And Teachers</h3>
              <span className="pill progress">{courseDashboardRows.length} courses</span>
            </div>
            <div className="dashboard-list">
              {courseDashboardRows.length > 0 ? (
                courseDashboardRows.map((course) => (
                  <div className="dashboard-list-item" key={course.classId || course.classCode}>
                    <div>
                      <h4>{course.classCode} · {course.subject}</h4>
                      <p>Teacher: {course.teachers.length > 0 ? course.teachers.join(', ') : 'Not assigned'}</p>
                      <small className="small-muted">
                        Attendance {course.studentAttendanceRate}% · Assignments {course.studentSubmittedAssignments}/{course.totalAssignments} · Latest grade {course.latestGrade}
                      </small>
                    </div>
                    <span className={`pill ${course.studentAttendanceRate >= 75 ? 'progress' : 'pending'}`}>
                      {course.studentAttendanceRate}%
                    </span>
                  </div>
                ))
              ) : (
                <div className="dashboard-list-item">
                  <div>
                    <h4>No enrolled subjects</h4>
                    <p>Your subjects and teachers will appear here after enrollment.</p>
                  </div>
                  <span className="pill todo">Empty</span>
                </div>
              )}
            </div>
          </article>

          <article className="dashboard-panel section-card">
            <div className="panel-header panel-header-strong">
              <h3>My Course Progress</h3>
            </div>
            <div className="highlight-grid">
              {courseDashboardRows.length > 0 ? (
                courseDashboardRows.map((course) => (
                  <div className="highlight-card rich-highlight-card" key={`progress-${course.classId || course.classCode}`}>
                    <div className="highlight-meta-row">
                      <span>{course.classCode}</span>
                      <em className="highlight-dot dot-1"></em>
                    </div>
                    <strong>{course.subject}</strong>
                    <small className="small-muted">Score: {course.studentAverageScore || 'N/A'}% · Grade: {course.latestGrade}</small>
                    <div className="mini-progress-track">
                      <span style={{ width: `${Math.max(course.studentAttendanceRate, 8)}%` }}></span>
                    </div>
                    <small>Attendance {course.studentAttendanceRate}%</small>
                  </div>
                ))
              ) : (
                <div className="dashboard-list-item">
                  <div>
                    <h4>No progress data</h4>
                    <p>Add attendance/grades to view your course progress cards.</p>
                  </div>
                  <span className="pill todo">Waiting</span>
                </div>
              )}
            </div>
          </article>
        </div>
      )}

      <div className="dashboard-row dashboard-home-row">
        <article className="dashboard-panel section-card">
          <div className="panel-header panel-header-strong">
            <h3>Your Classes</h3>
          </div>
          <div className="class-list-modern">
            {(pageData?.todaysClasses || []).map((session) => (
              <div className="class-item-modern" key={`${session.code}-${session.subject}`}>
                <div>
                  <strong>{session.subject}</strong>
                  <p>{session.code} · {session.time}</p>
                </div>
                <span className={`status-chip status-${session.status || 'upcoming'}`}>{session.status || 'upcoming'}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel section-card">
          <div className="panel-header panel-header-strong">
            <h3>Calendar</h3>
            <button className="panel-add" type="button" onClick={() => setActivePage('calendar')}>Open Calendar</button>
          </div>
          <div className="calendar-mini-panel">
            <div className="calendar-mini-header">
              <strong>{monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</strong>
              <span>{calendarUpcomingEvents.length} items</span>
            </div>
            <div className="calendar-mini-list">
              {calendarUpcomingEvents.slice(0, 4).map((event, index) => (
                <div className="calendar-mini-item" key={`${event.title}-${event.day}-${index}`}>
                  <strong>{event.title}</strong>
                  <p>{monthNames[calendarMonth.getMonth()]} {event.day} · {event.meta}</p>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <div className="dashboard-row dashboard-home-row">
        <article className="dashboard-panel section-card">
          <div className="panel-header panel-header-strong">
            <h3>Highlights</h3>
          </div>
          <div className="highlight-grid">
            {(pageData?.highlights || []).map((item, index) => (
              <div className="highlight-card rich-highlight-card" key={item.title}>
                <div className="highlight-meta-row">
                  <span>{item.title}</span>
                  <em className={`highlight-dot dot-${index % 3}`}></em>
                </div>
                <strong>{item.value}</strong>
                <div className="mini-progress-track">
                  <span style={{ width: `${inferPercentFromValue(item.value, index)}%` }}></span>
                </div>
                <small>{index % 2 === 0 ? 'On track this week' : 'Improving trend'}</small>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel section-card">
          <div className="panel-header panel-header-strong">
            <h3>Overview</h3>
          </div>
          <div className="overview-cards">
            {(pageData?.overview || []).map((item, index) => (
              <div className={`overview-card ${item.tone} rich-overview-card`} key={item.title}>
                <div className="overview-top-row">
                  <span className="overview-icon">{['◉', '◎', '◌', '◍'][index % 4]}</span>
                  <span className="overview-chip">{index % 2 === 0 ? 'Stable' : 'Focus'}</span>
                </div>
                <strong>{item.value}</strong>
                <p>{item.detail}</p>
                <div className="overview-bars">
                  {[28, 45, 36, 58, 42, 65].map((height, barIndex) => (
                    <span key={`${item.title}-${barIndex}`} style={{ height: `${height + ((index * 5) % 12)}%` }}></span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="dashboard-row dashboard-home-row">
        <article className="dashboard-panel section-card">
          <div className="panel-header panel-header-strong">
            <h3>Live Announcements</h3>
          </div>
          <div className="dashboard-list">
            {(pageData?.announcements || []).length > 0 ? (
              (pageData?.announcements || []).slice(0, 4).map((item) => (
                <div className="dashboard-list-item" key={item.id || `${item.title}-${item.time}`}>
                  <div>
                    <h4>{item.icon || '📣'} {item.title}</h4>
                    <p>{item.message}</p>
                  </div>
                  <span className="pill progress">{item.time || 'now'}</span>
                </div>
              ))
            ) : (
              <div className="dashboard-list-item">
                <div>
                  <h4>No announcements yet</h4>
                  <p>Teacher/class announcements will appear here in real time.</p>
                </div>
                <span className="pill todo">Empty</span>
              </div>
            )}
          </div>
        </article>

        <article className="dashboard-panel section-card">
          <div className="panel-header panel-header-strong">
            <h3>AI Insights</h3>
          </div>
          <div className="dashboard-list">
            {(pageData?.aiInsights || []).length > 0 ? (
              (pageData?.aiInsights || []).slice(0, 4).map((item) => (
                <div className="dashboard-list-item" key={`${item.title}-${item.severity}`}>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.detail}</p>
                  </div>
                  <span className={`pill ${item.severity === 'good' ? 'progress' : item.severity === 'attention' ? 'pending' : 'todo'}`}>
                    {item.severity || 'info'}
                  </span>
                </div>
              ))
            ) : (
              <div className="dashboard-list-item">
                <div>
                  <h4>No insight data yet</h4>
                  <p>Insights appear once attendance, grades, and assignments are recorded.</p>
                </div>
                <span className="pill todo">Waiting</span>
              </div>
            )}
          </div>
        </article>
      </div>

      <div className="dashboard-row dashboard-home-row">
        <article className="dashboard-panel section-card">
          <div className="panel-header panel-header-strong">
            <h3>Smart Notifications</h3>
          </div>
          <div className="dashboard-list">
            {(pageData?.notifications || []).length > 0 ? (
              (pageData?.notifications || []).slice(0, 5).map((item) => (
                <div className="dashboard-list-item" key={item.id || `${item.title}-${item.time}`}>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.message}</p>
                  </div>
                  <span className={`pill ${item.read ? 'todo' : 'pending'}`}>{item.time || 'now'}</span>
                </div>
              ))
            ) : (
              <div className="dashboard-list-item">
                <div>
                  <h4>No notifications yet</h4>
                  <p>Assignment, grade, attendance and class updates will appear here.</p>
                </div>
                <span className="pill todo">Empty</span>
              </div>
            )}
          </div>
        </article>

        <article className="dashboard-panel section-card">
          <div className="panel-header panel-header-strong">
            <h3>Communication System</h3>
            <button className="panel-add" type="button" onClick={() => setActivePage('communication')}>Open</button>
          </div>
          <div className="overview-cards">
            <div className="overview-card info rich-overview-card">
              <strong>{pageData?.communicationSummary?.announcements || 0}</strong>
              <p>Announcements</p>
            </div>
            <div className="overview-card success rich-overview-card">
              <strong>{pageData?.communicationSummary?.chats || 0}</strong>
              <p>Chat messages</p>
            </div>
            <div className="overview-card warning rich-overview-card">
              <strong>{pageData?.communicationSummary?.doubts || 0}</strong>
              <p>Doubt threads</p>
            </div>
          </div>
          <p style={{ marginBottom: 0, color: 'var(--text-secondary)' }}>
            Open doubts: {pageData?.communicationSummary?.unresolvedDoubts || 0}
          </p>
        </article>
      </div>

      <div className="dashboard-row dashboard-home-row">
        <article className="dashboard-panel section-card">
          <div className="panel-header panel-header-strong">
            <h3>Platform Modules</h3>
          </div>
          <div className="dashboard-list">
            {(pageData?.moduleBoard || []).map((item) => (
              <div className="dashboard-list-item" key={item.title}>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.detail}</p>
                </div>
                <span className="pill progress">{item.status}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-panel section-card">
          <div className="panel-header panel-header-strong">
            <h3>Smart Features + AI</h3>
          </div>
          <div className="dashboard-list">
            {(pageData?.smartFeatureBoard || []).map((item) => (
              <div className="dashboard-list-item" key={item.title}>
                <div>
                  <h4>{item.title}</h4>
                  <p>{item.detail}</p>
                </div>
                <span className={`pill ${item.status === 'ai-live' || item.status === 'active' ? 'progress' : 'pending'}`}>{item.status}</span>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  )

  const renderCommunicationPage = () => (
    <section className="work-page-grid pro-page-grid">
      <article className="dashboard-panel work-main">
        <div className="panel-header panel-header-strong">
          <h3>Communication Feed</h3>
          <span className="pill progress">{communicationFeed.length} updates</span>
        </div>
        <div className="dashboard-list">
          {communicationFeed.length > 0 ? (
            communicationFeed.slice(0, 40).map((entry) => (
              <div className="dashboard-list-item" key={entry._id || `${entry.title}-${entry.message}-${entry.createdAt}`}>
                <div>
                  <h4>{entry.type === 'doubt' ? 'Doubt Thread' : 'Chat'} {entry.title ? `· ${entry.title}` : ''}</h4>
                  <p>{entry.message}</p>
                </div>
                <span className={`pill ${entry.type === 'doubt' && entry.status !== 'resolved' ? 'pending' : 'progress'}`}>
                  {entry.status || entry.type}
                </span>
              </div>
            ))
          ) : (
            <div className="dashboard-list-item">
              <div>
                <h4>No communication records yet</h4>
                <p>Post a class chat or create a doubt thread to start collaboration.</p>
              </div>
              <span className="pill todo">Empty</span>
            </div>
          )}
        </div>
      </article>

      <aside className="dashboard-panel work-side">
        <div className="panel-header panel-header-strong">
          <h3>Start Discussion</h3>
        </div>
        <form className="settings-form compact-settings-form" onSubmit={handleSendClassChat}>
          <label>
            Class Chat Message
            <textarea
              value={chatForm.message}
              onChange={(event) => setChatForm({ message: event.target.value })}
              rows={3}
              placeholder="Share quick class update"
              required
            />
          </label>
          <button className="button button-dark" type="submit" disabled={actionLoading || !selectedTeacherClass?._id}>
            Send Chat
          </button>
        </form>

        <form className="settings-form compact-settings-form" onSubmit={handleCreateDoubt}>
          <label>
            Doubt Title
            <input
              type="text"
              value={doubtForm.title}
              onChange={(event) => setDoubtForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Topic or concept"
              required
            />
          </label>
          <label>
            Doubt Details
            <textarea
              value={doubtForm.message}
              onChange={(event) => setDoubtForm((current) => ({ ...current, message: event.target.value }))}
              rows={4}
              placeholder="Explain your doubt"
              required
            />
          </label>
          <button className="button button-primary" type="submit" disabled={actionLoading || !selectedTeacherClass?._id}>
            Create Doubt Thread
          </button>
        </form>
      </aside>
    </section>
  )

  const renderClassesPage = () => (
    <section className="work-page-grid pro-page-grid">
      <article className="dashboard-panel work-main">
        <div className="panel-header panel-header-strong">
          <h3>Classes</h3>
          {user.role === 'teacher' && <button className="panel-add" type="button" onClick={openClassModal}>+ New Class</button>}
        </div>
        {user.role === 'teacher' && classesData.length > 0 && (
          <div className="class-switcher">
            {classesData.map((cls) => (
              <button
                key={cls._id}
                type="button"
                className={`class-switcher-pill ${selectedClassId === cls._id ? 'active' : ''}`}
                onClick={() => setSelectedClassId(cls._id)}
              >
                {cls.code}
              </button>
            ))}
          </div>
        )}
        <div className="pro-cards-grid">
          {metricsByClass.length > 0 ? (
            metricsByClass.map((cls) => (
              <div className="pro-class-card" key={cls._id || cls.code}>
                <div className="pro-card-head">
                  <div>
                    <h4>{cls.name}</h4>
                    <p>{cls.code} · {cls.subject}</p>
                  </div>
                  <span className="pill progress">{cls.credits} cr</span>
                </div>
                {user.role === 'teacher' && (
                  <div className="class-teacher-summary">
                    <span>{(cls.teachers || [cls.teacher]).length} teachers</span>
                    <span>{(cls.labTeachers || []).length} lab teachers</span>
                  </div>
                )}
                <div className="pro-card-stats">
                  <span>{cls.schedule?.[0]?.day || 'Schedule pending'}</span>
                  <strong>{user.role === 'teacher' ? `${cls.students?.length || 0} students` : 'Enrolled'}</strong>
                </div>
                <div className="progress-track compact">
                  <span style={{ width: `${Math.max(cls.attendanceRate, 8)}%` }}></span>
                </div>
                <small>{cls.sessions} sessions tracked · {cls.attendanceRate}% engagement</small>
              </div>
            ))
          ) : (
            <div className="dashboard-list-item">
              <div>
                <h4>No classes yet</h4>
                <p>Classes will appear here once you enroll or create them.</p>
              </div>
              <span className="pill todo">Empty</span>
            </div>
          )}
        </div>
      </article>

      <article className="dashboard-panel work-side">
        <div className="panel-header panel-header-strong">
          <h3>Class Summary</h3>
        </div>
        <div className="compact-kpi-list">
          <div className="compact-kpi-item">
            <span>Total Classes</span>
            <strong>{classesData.length}</strong>
          </div>
          <div className="compact-kpi-item">
            <span>Total Credits</span>
            <strong>{classesData.reduce((sum, c) => sum + (c.credits || 0), 0)}</strong>
          </div>
          <div className="compact-kpi-item">
            <span>Attendance Pulse</span>
            <strong>{attendanceOverview.rate}%</strong>
          </div>
        </div>

        {user.role === 'teacher' && activeTeacherClasses.length > 0 && (
          <div className="teacher-invite-panel">
            <h4>Invite Students</h4>
            <p>Share a class code or copy it directly from the card below.</p>
            <div className="teacher-invite-list">
              {activeTeacherClasses.slice(0, 3).map((item) => (
                <div className="teacher-invite-item" key={item._id}>
                  <div>
                    <strong>{item.subject}</strong>
                    <p>{item.code}</p>
                  </div>
                  <button className="panel-add" type="button" onClick={() => navigator.clipboard?.writeText(item.code)}>
                    Copy Code
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {user.role === 'teacher' && selectedTeacherClass && (
          <div className="teacher-roster-panel">
            <h4>Selected Class</h4>
            <strong>{selectedTeacherClass.subject}</strong>
            <p>{selectedTeacherClass.code} · {selectedTeacherClass.schedule?.[0]?.day || 'No schedule'}</p>
            <div className="roster-stats">
              <span>{selectedTeacherClass.students?.length || 0} students</span>
              <span>{selectedTeacherClass.attendanceRate || 0}% attendance</span>
            </div>

            <div className="teacher-role-list">
              <strong>Teachers</strong>
              <p>{(selectedTeacherClass.teachers || [selectedTeacherClass.teacher]).map((teacher) => teacher?.name || teacher?.email || 'Teacher').join(', ')}</p>
              <strong>Lab Teachers</strong>
              <p>{(selectedTeacherClass.labTeachers || []).length > 0 ? selectedTeacherClass.labTeachers.map((teacher) => teacher?.name || teacher?.email || 'Lab Teacher').join(', ') : 'None assigned'}</p>
            </div>

            <form className="settings-form compact-settings-form" onSubmit={handleAddStudentToClass}>
              <label>
                Add Student by Email
                <input
                  type="email"
                  value={studentRosterForm.email}
                  onChange={(event) => setStudentRosterForm({ email: event.target.value })}
                  placeholder="student@email.com"
                />
              </label>
              <button className="button button-dark" type="submit" disabled={rosterActionState.loading}>
                {rosterActionState.loading ? 'Adding...' : 'Add Student'}
              </button>
            </form>

            {rosterActionState.error && <p className="auth-feedback auth-error">{rosterActionState.error}</p>}
            {rosterActionState.success && <p className="auth-feedback auth-success">{rosterActionState.success}</p>}

            <div className="teacher-student-list">
              {(selectedTeacherClass.students || []).length > 0 ? (
                selectedTeacherClass.students.map((student) => (
                  <div className="teacher-student-item" key={student._id || student.id}>
                    <div>
                      <strong>{student.name || 'Student'}</strong>
                      <p>{student.email}</p>
                      <small>{student.department || student.year || student.section || 'Student profile'}</small>
                    </div>
                    <button className="panel-add" type="button" onClick={() => handleRemoveStudentFromClass(student._id || student.id)}>
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No students enrolled yet.</p>
              )}
            </div>
          </div>
        )}

        {(user.role === 'student' || user.role === 'teacher') && (
          <form className="settings-form" style={{ marginTop: '1.25rem' }} onSubmit={handleJoinClassByCode}>
            <label>
              {user.role === 'teacher' ? 'Link Class With Code' : 'Join With Class Code'}
              <input
                type="text"
                value={joinClassForm.code}
                onChange={(event) => setJoinClassForm({ code: event.target.value.toUpperCase() })}
                placeholder="Enter class code (e.g. SVVV1)"
                required
              />
            </label>
            <button className="button button-dark" type="submit" disabled={actionLoading}>
              {actionLoading ? 'Linking...' : user.role === 'teacher' ? 'Link Class' : 'Join Class'}
            </button>
          </form>
        )}
      </article>
    </section>
  )

  const renderAssignmentsPage = () => (
    <section className="work-page-grid pro-page-grid">
      <article className="dashboard-panel work-main">
        <div className="panel-header panel-header-strong">
          <h3>Assignments</h3>
          {user.role === 'teacher' && <button className="panel-add" type="button" onClick={openAssignmentModal}>+ Create Assignment</button>}
        </div>
        <div className="pro-cards-grid">
          {assignmentsData.length > 0 ? (
            assignmentsData.map((assignment) => (
              <div className="pro-assignment-card" key={assignment._id || assignment.title}>
                <div className="pro-card-head">
                  <div>
                    <h4>{assignment.title}</h4>
                    <p>{assignment.class?.subject || 'General'} · {assignment.dueDate ? `Due ${new Date(assignment.dueDate).toLocaleDateString()}` : 'No due date'}</p>
                  </div>
                  <span className="pill pending">{assignment.maxScore || 100} pts</span>
                </div>
                <small>{assignment.submissions?.length || 0} submissions tracked</small>
                <div className="pro-card-actions">
                  {user.role === 'teacher' ? (
                    <span className="pill progress">{assignment.submissions?.length || 0} Submitted</span>
                  ) : (
                    <button className="panel-add" type="button" onClick={() => openSubmissionModal(assignment)}>
                      {submittedByCurrentUser(assignment) ? 'Update Upload' : 'Upload'}
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="dashboard-list-item">
              <div>
                <h4>No assignments</h4>
                <p>Assignments will appear here once they are created.</p>
              </div>
              <span className="pill todo">Empty</span>
            </div>
          )}
        </div>
      </article>

      <article className="dashboard-panel work-side">
        <div className="panel-header panel-header-strong">
          <h3>Assignment Summary</h3>
        </div>
        <div className="compact-kpi-list">
          <div className="compact-kpi-item">
            <span>Total</span>
            <strong>{assignmentOverview.total}</strong>
          </div>
          <div className="compact-kpi-item">
            <span>{user.role === 'teacher' ? 'All Submissions' : 'Submitted'}</span>
            <strong>{user.role === 'teacher' ? assignmentOverview.teacherSubmissions : assignmentOverview.submitted}</strong>
          </div>
          <div className="compact-kpi-item">
            <span>Due Soon</span>
            <strong>{assignmentOverview.dueSoon}</strong>
          </div>
        </div>
        {user.role !== 'teacher' && (
          <div className="progress-summary-card">
            <p>Completion Progress</p>
            <div className="progress-track">
              <span style={{ width: `${Math.max(assignmentOverview.completion, 8)}%` }}></span>
            </div>
            <strong>{assignmentOverview.completion}% complete</strong>
          </div>
        )}
        {user.role === 'teacher' && (
          <div className="progress-summary-card">
            <p>Submission Velocity</p>
            <div className="progress-track">
              <span style={{ width: `${Math.min(100, Math.max(12, assignmentOverview.total > 0 ? Math.round((assignmentOverview.teacherSubmissions / (assignmentOverview.total * 10)) * 100) : 0))}%` }}></span>
            </div>
            <strong>{assignmentOverview.teacherSubmissions} entries received</strong>
          </div>
        )}
      </article>
    </section>
  )

  const renderAttendancePage = () => (
    <section className="work-page-grid pro-page-grid">
      <article className="dashboard-panel work-main">
        <div className="panel-header panel-header-strong">
          <h3>Attendance Records</h3>
          {user.role === 'teacher' && <button className="panel-add" type="button" onClick={openAttendanceModal}>+ Mark Attendance</button>}
        </div>
        <div className="pro-cards-grid">
          {attendanceData.length > 0 ? (
            attendanceData.map((record) => (
              <div className="pro-attendance-card" key={record._id || record.date}>
                <div className="pro-card-head">
                  <div>
                    <h4>{record.class?.subject || 'Class'}</h4>
                    <p>{new Date(record.date).toLocaleDateString()}</p>
                  </div>
                  <span className="pill progress">{record.records?.length || 0} learners</span>
                </div>
                <div className="attendance-row-stats">
                  <small>P: {record.records?.filter((r) => r.status === 'present').length || 0}</small>
                  <small>L: {record.records?.filter((r) => r.status === 'late').length || 0}</small>
                  <small>A: {record.records?.filter((r) => r.status === 'absent').length || 0}</small>
                </div>
              </div>
            ))
          ) : (
            <div className="dashboard-list-item">
              <div>
                <h4>No attendance records</h4>
                <p>Attendance records will appear here.</p>
              </div>
              <span className="pill todo">Empty</span>
            </div>
          )}
        </div>
      </article>

      <article className="dashboard-panel work-side">
        <div className="panel-header panel-header-strong">
          <h3>Attendance Stats</h3>
        </div>
        <div className="compact-kpi-list">
          <div className="compact-kpi-item">
            <span>Total Sessions</span>
            <strong>{attendanceData.length}</strong>
          </div>
          <div className="compact-kpi-item">
            <span>Present</span>
            <strong>{attendanceOverview.present}</strong>
          </div>
          <div className="compact-kpi-item">
            <span>Rate</span>
            <strong>{attendanceOverview.rate}%</strong>
          </div>
        </div>
        <div className="progress-summary-card">
          <p>Live Attendance Ratio</p>
          <div className="progress-track">
            <span style={{ width: `${Math.max(attendanceOverview.rate, 8)}%` }}></span>
          </div>
          <strong>{attendanceOverview.present} / {attendanceOverview.total} present</strong>
        </div>

        {user.role === 'teacher' ? (
          <>
            <form className="settings-form compact-settings-form" style={{ marginTop: '1rem' }} onSubmit={handleCreateAttendanceQr}>
              <label>
                QR Class
                <select
                  value={qrAttendanceForm.classId}
                  onChange={(event) => setQrAttendanceForm((current) => ({ ...current, classId: event.target.value }))}
                >
                  {activeTeacherClasses.map((item) => (
                    <option key={item._id} value={item._id}>{item.code} - {item.subject}</option>
                  ))}
                </select>
              </label>
              <label>
                Range (meters)
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={qrAttendanceForm.rangeMeters}
                  onChange={(event) => setQrAttendanceForm((current) => ({ ...current, rangeMeters: event.target.value }))}
                />
              </label>
              <label>
                Expires In (minutes)
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={qrAttendanceForm.expiresMinutes}
                  onChange={(event) => setQrAttendanceForm((current) => ({ ...current, expiresMinutes: event.target.value }))}
                />
              </label>
              <button className="button button-dark" type="button" onClick={handleCaptureTeacherLocation}>
                Use My Class Location
              </button>
              <button className="button button-primary" type="submit" disabled={actionLoading || !qrAttendanceForm.latitude || !qrAttendanceForm.longitude}>
                {actionLoading ? 'Generating QR...' : 'Generate Attendance QR'}
              </button>
            </form>

            {activeQrSession && (
              <div className="progress-summary-card" style={{ marginTop: '1rem' }}>
                <p>Active QR Session</p>
                <img src={activeQrSession.qrImageUrl} alt="Attendance QR" style={{ width: '100%', maxWidth: '240px', borderRadius: '12px' }} />
                <strong>Token: {activeQrSession.token}</strong>
                <small className="small-muted">Valid till {new Date(activeQrSession.expiresAt).toLocaleTimeString()}</small>
              </div>
            )}
          </>
        ) : (
          <form className="settings-form compact-settings-form" style={{ marginTop: '1rem' }} onSubmit={handleSubmitQrAttendance}>
            <label>
              QR Token
              <input
                type="text"
                value={studentQrForm.token}
                onChange={(event) => setStudentQrForm((current) => ({ ...current, token: event.target.value.toUpperCase() }))}
                placeholder="Enter token from class QR"
                required
              />
            </label>
            <button className="button button-dark" type="button" onClick={handleCaptureStudentLocation}>
              Capture My Location
            </button>
            <button className="button button-primary" type="submit" disabled={actionLoading || !studentQrForm.latitude || !studentQrForm.longitude}>
              {actionLoading ? 'Marking...' : 'Mark Attendance via QR'}
            </button>
          </form>
        )}

        {actionError && <p className="auth-feedback auth-error">{actionError}</p>}
        {actionSuccess && <p className="auth-feedback auth-success">{actionSuccess}</p>}
      </article>
    </section>
  )

  const renderPerformancePage = () => (
    <section className="work-page-grid pro-page-grid">
      <article className="dashboard-panel work-main">
        <div className="panel-header panel-header-strong">
          <h3>{user.role === 'teacher' ? 'Class Analytics' : 'Your Grades'}</h3>
        </div>
        <div className="pro-cards-grid">
          {gradesData.length > 0 ? (
            gradesData.map((grade) => (
              <div className="pro-grade-card" key={grade._id || grade.class}>
                <div className="pro-card-head">
                  <div>
                    <h4>{grade.class?.subject || 'Class'}</h4>
                    <p>Internals: {grade.internals} · Finals: {grade.finals}</p>
                  </div>
                  <span className={`pill ${grade.grade === 'A' ? 'progress' : grade.grade === 'B' ? 'todo' : 'pending'}`}>Grade {grade.grade}</span>
                </div>
                <div className="progress-track compact">
                  <span style={{ width: `${Math.max(Math.round((Number(grade.internals || 0) + Number(grade.finals || 0)) / 2), 8)}%` }}></span>
                </div>
              </div>
            ))
          ) : (
            <div className="dashboard-list-item">
              <div>
                <h4>No grades yet</h4>
                <p>Grades will appear once they are assigned.</p>
              </div>
              <span className="pill todo">Empty</span>
            </div>
          )}
        </div>
      </article>

      <article className="dashboard-panel work-side">
        <div className="panel-header panel-header-strong">
          <h3>{user.role === 'teacher' ? 'Performance Summary' : 'Student Insights'}</h3>
        </div>
        <div className="compact-kpi-list">
          <div className="compact-kpi-item">
            <span>Tracked Classes</span>
            <strong>{gradesData.length}</strong>
          </div>
          <div className="compact-kpi-item">
            <span>Average Score</span>
            <strong>{gradesData.length > 0 ? `${gradeOverview.average}%` : 'N/A'}</strong>
          </div>
          <div className="compact-kpi-item">
            <span>Attendance Link</span>
            <strong>{attendanceOverview.rate}%</strong>
          </div>
        </div>
        <div className="distribution-list">
          {Object.entries(gradeOverview.distribution).length > 0 ? Object.entries(gradeOverview.distribution).map(([label, value]) => (
            <div className="distribution-item" key={label}>
              <span>{label}</span>
              <div className="progress-track compact">
                <span style={{ width: `${Math.max(Math.round((value / gradesData.length) * 100), 6)}%` }}></span>
              </div>
              <strong>{value}</strong>
            </div>
          )) : (
            <p className="small-muted">Grade distribution will appear after evaluations.</p>
          )}
        </div>
        <div className="progress-summary-card">
          <p>Real-life Progress Signal</p>
          <div className="progress-track">
            <span style={{ width: `${Math.max(Math.round((gradeOverview.average + attendanceOverview.rate) / 2), 10)}%` }}></span>
          </div>
          <strong>{Math.max(Math.round((gradeOverview.average + attendanceOverview.rate) / 2), 0)}% blended growth</strong>
          <small className="small-muted">Score + attendance weighted for practical progress visibility.</small>
        </div>
      </article>
    </section>
  )

  const profileActions = user.role === 'teacher'
    ? [
        { label: 'Create Assignment', page: 'assignments' },
        { label: 'Mark Attendance', page: 'attendance' },
        { label: 'Open Calendar', page: 'calendar' },
        { label: 'View Analytics', page: 'analytics' },
      ]
    : [
        { label: 'Open Classes', page: 'classes' },
        { label: 'Check Assignments', page: 'assignments' },
        { label: 'Open Calendar', page: 'calendar' },
        { label: 'View Grades', page: 'performance' },
      ]

  const calendarUpcomingEvents = useMemo(() => {
    return Object.entries(calendarEvents)
      .flatMap(([day, events]) => events.map((event) => ({ ...event, day: Number(day) })))
      .sort((left, right) => left.day - right.day)
      .slice(0, 12)
  }, [calendarEvents])

  const renderProfilePage = () => (
    <section className="work-page-grid profile-page-grid">
      <article className="dashboard-panel work-main">
        <div className="panel-header panel-header-strong">
          <h3>Profile</h3>
          <button className="panel-add" type="button" onClick={() => setActivePage('settings')}>Edit Profile</button>
        </div>

        <div className="profile-summary-grid">
          <div className="profile-hero-card">
            <img alt={profileData.name} src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.name)}&background=111827&color=ffffff&size=140`} />
            <div>
              <strong>{profileData.name}</strong>
              <p>{profileData.department || 'Computer Science'}</p>
              <span>{profileData.role === 'teacher' ? 'Faculty profile' : 'Learner profile'}</span>
            </div>
          </div>

          <div className="profile-detail-grid">
            <div className="profile-item">
              <span>Email</span>
              <strong>{profileData.email}</strong>
            </div>
            <div className="profile-item">
              <span>Role</span>
              <strong>{profileData.role}</strong>
            </div>
            <div className="profile-item">
              <span>Department</span>
              <strong>{profileData.department || 'Computer Science'}</strong>
            </div>
            <div className="profile-item">
              <span>Section</span>
              <strong>{profileData.section || 'A'}</strong>
            </div>
            <div className="profile-item profile-bio-card">
              <span>Bio</span>
              <strong>{profileData.bio || (profileData.role === 'teacher' ? 'Faculty mentor and coordinator' : 'Active learner focusing on project work')}</strong>
            </div>
            <div className="profile-item profile-stat-card">
              <span>{profileData.role === 'teacher' ? 'Classes' : 'Assignments'}</span>
              <strong>{profileData.role === 'teacher' ? classesData.length : assignmentsData.length}</strong>
            </div>
            <div className="profile-item profile-stat-card">
              <span>{profileData.role === 'teacher' ? 'Students' : 'Attendance'}</span>
              <strong>{profileData.role === 'teacher' ? attendanceData.reduce((sum, record) => sum + (record.records?.length || 0), 0) : '96%'}</strong>
            </div>
          </div>
        </div>
      </article>

      <article className="dashboard-panel work-side">
        <div className="panel-header panel-header-strong">
          <h3>{profileData.role === 'teacher' ? 'Teacher Tools' : 'Student Tools'}</h3>
        </div>
        <div className="dashboard-list profile-action-list">
          {profileActions.map((item) => (
            <button key={item.label} className="dashboard-list-item profile-action-button" type="button" onClick={() => setActivePage(item.page)}>
              <div>
                <h4>{item.label}</h4>
                <p>Open the working page for this task</p>
              </div>
              <span className="pill progress">Open</span>
            </button>
          ))}
        </div>
      </article>
    </section>
  )

  const renderCalendarPage = () => (
    <section className="work-page-grid calendar-page-grid">
      <article className="dashboard-panel work-main">
        <div className="panel-header panel-header-strong">
          <h3>Calendar</h3>
          <div className="calendar-nav">
            <button className="panel-add" type="button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
              Prev
            </button>
            <button className="panel-add" type="button" onClick={() => setCalendarMonth(new Date())}>
              Today
            </button>
            <button className="panel-add" type="button" onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
              Next
            </button>
          </div>
        </div>

        <div className="calendar-heading">
          <strong>{monthNames[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</strong>
          <span>{Object.values(calendarEvents).reduce((sum, events) => sum + events.length, 0)} scheduled items</span>
        </div>

        <div className="calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarGrid.map((cell) => {
            const cellEvents = cell.inMonth ? calendarEvents[String(cell.dayNumber)] || [] : []

            return (
              <div key={cell.key} className={`calendar-cell ${cell.inMonth ? '' : 'calendar-cell-muted'} ${cell.isToday ? 'calendar-cell-today' : ''}`}>
                <div className="calendar-cell-top">
                  <strong>{cell.dayNumber}</strong>
                  {cell.isToday && <span>Today</span>}
                </div>
                <div className="calendar-event-list">
                  {cellEvents.slice(0, 3).map((event, index) => (
                    <div className={`calendar-event tone-${event.tone}`} key={`${cell.key}-${event.title}-${index}`}>
                      <strong>{event.title}</strong>
                      <span>{event.meta}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </article>

      <article className="dashboard-panel work-side">
        <div className="panel-header panel-header-strong">
          <h3>Upcoming</h3>
        </div>
        <div className="dashboard-list calendar-upcoming-list">
          {calendarUpcomingEvents.length > 0 ? (
            calendarUpcomingEvents.map((event, index) => (
              <div className="dashboard-list-item" key={`${event.title}-${event.day}-${index}`}>
                <div>
                  <h4>{event.title}</h4>
                  <p>{monthNames[calendarMonth.getMonth()]} {event.day}</p>
                </div>
                <span className="pill progress">{event.meta}</span>
              </div>
            ))
          ) : (
            <div className="dashboard-list-item">
              <div>
                <h4>No events found</h4>
                <p>Calendar events will appear here.</p>
              </div>
              <span className="pill todo">Empty</span>
            </div>
          )}
        </div>
      </article>
    </section>
  )

  const renderSettingsPage = () => (
    <section className="work-page-grid settings-page-single settings-pro-page">
      <article className="dashboard-panel work-main">
        <div className="panel-header panel-header-strong">
          <h3>Account Settings</h3>
          <button className="panel-add" type="button" onClick={() => setEditingProfile(!editingProfile)}>
            {editingProfile ? 'Cancel' : 'Edit'}
          </button>
        </div>
        <div className="settings-form compact-settings-form">
          {editingProfile ? (
            <div className="settings-edit-grid">
              <label>
                Full Name
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Enter your full name"
                />
              </label>
              <label>
                Bio
                <textarea
                  value={formData.bio || ''}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  placeholder="Tell us about yourself"
                />
              </label>
              <label>
                Department
                <input
                  type="text"
                  value={formData.department || ''}
                  onChange={(e) => setFormData({...formData, department: e.target.value})}
                  placeholder="Department"
                />
              </label>
              <label>
                Year/Level
                <input
                  type="text"
                  value={formData.year || ''}
                  onChange={(e) => setFormData({...formData, year: e.target.value})}
                  placeholder="Year or Level"
                />
              </label>
              <label>
                Section
                <input
                  type="text"
                  value={formData.section || ''}
                  onChange={(e) => setFormData({...formData, section: e.target.value})}
                  placeholder="Section"
                />
              </label>
              <div className="settings-edit-actions">
                <button className="button button-dark" type="button" onClick={handleProfileUpdate}>
                  Save Profile
                </button>
                <button className="panel-add" type="button" onClick={() => setEditingProfile(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="profile-display profile-display-compact">
              <div className="profile-item profile-mini-item">
                <span>Name</span>
                <strong>{profileData.name}</strong>
              </div>
              <div className="profile-item profile-mini-item">
                <span>Email</span>
                <strong>{profileData.email}</strong>
              </div>
              <div className="profile-item profile-mini-item">
                <span>Role</span>
                <strong>{profileData.role}</strong>
              </div>
              <div className="profile-item profile-mini-item">
                <span>Department</span>
                <strong>{profileData.department || 'Not set'}</strong>
              </div>
              <div className="profile-item profile-mini-item">
                <span>Year/Level</span>
                <strong>{profileData.year || 'Not set'}</strong>
              </div>
              <div className="profile-item profile-mini-item">
                <span>Section</span>
                <strong>{profileData.section || 'Not set'}</strong>
              </div>
            </div>
          )}
        </div>

        <div className="settings-quick-strip">
          <div className="settings-quick-tile">
            <span>Theme</span>
            <strong>{themeMode}</strong>
          </div>
          <div className="settings-quick-tile">
            <span>2FA</span>
            <strong>{securityState.twoFactorEnabled ? 'Enabled' : 'Disabled'}</strong>
          </div>
          <div className="settings-quick-tile">
            <span>Role</span>
            <strong>{profileData.role}</strong>
          </div>
        </div>

        <div className="settings-panel-grid">

        <div className="settings-actions-panel clean-settings-block">
          <h4>Security & Theme</h4>
          <p className="small-muted">Quick controls only. Compact and practical.</p>

          {securityState.error && <p className="auth-feedback auth-error">{securityState.error}</p>}
          {securityState.message && <p className="auth-feedback auth-success">{securityState.message}</p>}

          <div className="settings-form compact-settings-form">
            <label>
              Theme
              <select
                value={themeMode}
                onChange={(event) => setThemeMode(event.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>

            <label className="settings-toggle-row">
              <input
                type="checkbox"
                checked={securityState.twoFactorEnabled}
                onChange={(event) => setSecurityState((current) => ({ ...current, twoFactorEnabled: event.target.checked, message: '', error: '' }))}
              />
              Enable 2-way authentication (2FA)
            </label>

            <button className="button button-dark" type="button" onClick={handleSaveSecuritySettings}>
              Save Security Settings
            </button>

            <label>
              Current Password
              <input
                type="password"
                value={securityState.passwordCurrent}
                onChange={(event) => setSecurityState((current) => ({ ...current, passwordCurrent: event.target.value, message: '', error: '' }))}
                placeholder="Current password"
              />
            </label>
            <label>
              New Password
              <input
                type="password"
                value={securityState.passwordNew}
                onChange={(event) => setSecurityState((current) => ({ ...current, passwordNew: event.target.value, message: '', error: '' }))}
                placeholder="New password"
              />
            </label>
            <label>
              Confirm New Password
              <input
                type="password"
                value={securityState.passwordConfirm}
                onChange={(event) => setSecurityState((current) => ({ ...current, passwordConfirm: event.target.value, message: '', error: '' }))}
                placeholder="Confirm new password"
              />
            </label>
            <button className="button button-dark" type="button" onClick={handlePasswordChange}>
              Change Password
            </button>
          </div>
        </div>

        <div className="settings-actions-panel clean-settings-block">
          <h4>Account Actions</h4>
          <p className="small-muted">Current device session only.</p>
          <button className="settings-logout-button" type="button" onClick={onLogout}>
            Logout from this device
          </button>
        </div>

        </div>
      </article>
    </section>
  )

  return (
    <div className="dashboard-shell compact-dashboard-ui">
      <aside className="dashboard-sidebar">
        <button className="dashboard-brand dashboard-brand-button" type="button" onClick={onGoLanding}>
          <span className="brand-mark dashboard-mark" aria-hidden="true">ET</span>
          <div className="brand-copy">
            <strong>EduTrack</strong>
            <span>{user.role === 'teacher' ? 'Faculty Command Center' : 'Student Workspace'}</span>
          </div>
        </button>

        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          {mainNavItems.map((item) => (
            <button
              key={item.key}
              className={`dashboard-nav-item ${activePage === item.key ? 'active' : ''}`}
              type="button"
              onClick={() => setActivePage(item.key)}
            >
              <span>{item.label}</span>
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>

        {settingsNavItem && (
          <div className="dashboard-nav-bottom">
            <button
              className={`dashboard-nav-item ${activePage === settingsNavItem.key ? 'active' : ''}`}
              type="button"
              onClick={() => setActivePage(settingsNavItem.key)}
            >
              <span>{settingsNavItem.label}</span>
            </button>
          </div>
        )}
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <h1>{topbarTitle}</h1>
            {pageError && <p className="dashboard-fetch-error">{pageError}</p>}
          </div>

          <div className="dashboard-topbar-actions">
            <button className="dashboard-profile dashboard-profile-button" type="button" aria-label="Open profile" title="Open profile" onClick={() => setActivePage('profile')}>
              <img alt={profileData.name} src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.name)}&background=111827&color=ffffff`} />
            </button>
          </div>
        </header>

        {activePage === 'dashboard' && pageLoading && !pageData
          ? renderDashboardSkeleton()
          : activePage === 'dashboard'
            ? renderDashboardOverview()
            : activePage === 'classes'
              ? renderClassesPage()
              : activePage === 'assignments'
                ? renderAssignmentsPage()
                : activePage === 'attendance'
                  ? renderAttendancePage()
                  : activePage === 'communication'
                    ? renderCommunicationPage()
                  : activePage === 'calendar'
                    ? renderCalendarPage()
                  : activePage === 'performance' || activePage === 'analytics'
                    ? renderPerformancePage()
                    : activePage === 'profile'
                      ? renderProfilePage()
                      : activePage === 'settings'
                        ? renderSettingsPage()
                      : renderDashboardSkeleton()}
      </main>

          {actionModal && (user.role === 'teacher' || actionModal === 'submission') && (
            <div className="auth-overlay" onClick={closeActionModal}>
              <section className="auth-modal action-modal-shell" style={{ width: 'min(980px, calc(100% - 1rem))' }} onClick={(event) => event.stopPropagation()}>
                <button className="auth-close" type="button" onClick={closeActionModal} aria-label="Close dialog">×</button>
                <header className="auth-header">
                  <h3>{actionModal === 'class' ? 'Create Class' : actionModal === 'assignment' ? 'Create Assignment' : actionModal === 'announcement' ? 'Post Class Update' : actionModal === 'submission' ? 'Submit Assignment' : 'Mark Attendance'}</h3>
                  <p>{actionModal === 'class' ? 'Create a new class card with schedule and room information.' : actionModal === 'assignment' ? 'Create a live assignment and attach it to a class.' : actionModal === 'announcement' ? 'Send a visible update to selected students and classes.' : actionModal === 'submission' ? 'Upload your assignment file and include a short note.' : 'Save attendance for a class and update the records.'}</p>
                </header>

                {actionError && <p className="auth-feedback auth-error">{actionError}</p>}
                {actionSuccess && <p className="auth-feedback auth-success">{actionSuccess}</p>}

                {actionModal === 'class' ? (
                  <form className="settings-form action-form-grid" onSubmit={handleCreateClass}>
                    <label className="field-span-2">
                      Class Name
                      <input
                        type="text"
                        value={classForm.name}
                        onChange={(event) => setClassForm((current) => ({ ...current, name: event.target.value }))}
                        placeholder="Data Structures and Algorithms"
                        required
                      />
                    </label>
                    <label>
                      Code
                      <input
                        type="text"
                        value={classForm.code}
                        onChange={(event) => setClassForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                        placeholder="CSE301"
                        required
                      />
                    </label>
                    <label>
                      Subject
                      <input
                        type="text"
                        value={classForm.subject}
                        onChange={(event) => setClassForm((current) => ({ ...current, subject: event.target.value }))}
                        placeholder="Data Structures"
                        required
                      />
                    </label>
                    <label className="field-span-2">
                      Teachers (emails, comma separated)
                      <textarea
                        value={classForm.teachers}
                        onChange={(event) => setClassForm((current) => ({ ...current, teachers: event.target.value }))}
                        placeholder="teacher1@edutrack.com, teacher2@edutrack.com"
                      />
                    </label>
                    <label className="field-span-2">
                      Lab Teachers (emails, comma separated)
                      <textarea
                        value={classForm.labTeachers}
                        onChange={(event) => setClassForm((current) => ({ ...current, labTeachers: event.target.value }))}
                        placeholder="lab1@edutrack.com, lab2@edutrack.com"
                      />
                    </label>
                    <label>
                      Credits
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={classForm.credits}
                        onChange={(event) => setClassForm((current) => ({ ...current, credits: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Day
                      <select value={classForm.day} onChange={(event) => setClassForm((current) => ({ ...current, day: event.target.value }))}>
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Time
                      <input
                        type="text"
                        value={classForm.time}
                        onChange={(event) => setClassForm((current) => ({ ...current, time: event.target.value }))}
                        placeholder="09:00 AM - 10:30 AM"
                        required
                      />
                    </label>
                    <label>
                      Room
                      <input
                        type="text"
                        value={classForm.room}
                        onChange={(event) => setClassForm((current) => ({ ...current, room: event.target.value }))}
                        placeholder="A101"
                        required
                      />
                    </label>
                    <label className="field-span-2">
                      Description
                      <textarea
                        value={classForm.description}
                        onChange={(event) => setClassForm((current) => ({ ...current, description: event.target.value }))}
                        placeholder="What will students learn in this class?"
                      />
                    </label>
                    <button className="button button-dark field-span-2" type="submit" disabled={actionLoading}>
                      {actionLoading ? 'Saving...' : 'Save Class'}
                    </button>
                  </form>
                ) : actionModal === 'announcement' ? (
                  <form className="settings-form action-form-grid" onSubmit={handleCreateAnnouncement}>
                    <label>
                      Class
                      <select
                        value={announcementForm.classId}
                        onChange={(event) => setAnnouncementForm((current) => ({ ...current, classId: event.target.value }))}
                      >
                        <option value="">All my classes</option>
                        {activeTeacherClasses.map((item) => (
                          <option key={item._id} value={item._id}>{item.code} - {item.subject}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Title
                      <input
                        type="text"
                        value={announcementForm.title}
                        onChange={(event) => setAnnouncementForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Class update title"
                        required
                      />
                    </label>
                    <label className="field-span-2">
                      Message
                      <textarea
                        value={announcementForm.message}
                        onChange={(event) => setAnnouncementForm((current) => ({ ...current, message: event.target.value }))}
                        placeholder="Share homework, schedule changes, reminders, or class notes"
                        required
                      />
                    </label>
                    <label>
                      Category
                      <input
                        type="text"
                        value={announcementForm.category}
                        onChange={(event) => setAnnouncementForm((current) => ({ ...current, category: event.target.value }))}
                        placeholder="Class Update"
                      />
                    </label>
                    <label>
                      Priority
                      <select
                        value={announcementForm.priority}
                        onChange={(event) => setAnnouncementForm((current) => ({ ...current, priority: event.target.value }))}
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </label>
                    <button className="button button-dark field-span-2" type="submit" disabled={actionLoading}>
                      {actionLoading ? 'Posting...' : 'Post Update'}
                    </button>
                  </form>
                ) : actionModal === 'assignment' ? (
                  <form className="settings-form action-form-grid" onSubmit={handleCreateAssignment}>
                    <label>
                      Class
                      <select
                        value={assignmentForm.classId}
                        onChange={(event) => setAssignmentForm((current) => ({ ...current, classId: event.target.value }))}
                      >
                        {activeTeacherClasses.map((item) => (
                          <option key={item._id} value={item._id}>{item.code} - {item.subject}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field-span-2">
                      Title
                      <input
                        type="text"
                        value={assignmentForm.title}
                        onChange={(event) => setAssignmentForm((current) => ({ ...current, title: event.target.value }))}
                        placeholder="Assignment title"
                        required
                      />
                    </label>
                    <label className="field-span-2">
                      Description
                      <textarea
                        value={assignmentForm.description}
                        onChange={(event) => setAssignmentForm((current) => ({ ...current, description: event.target.value }))}
                        placeholder="Describe the work"
                        required
                      />
                    </label>
                    <label>
                      Due Date
                      <input
                        type="date"
                        value={assignmentForm.dueDate}
                        onChange={(event) => setAssignmentForm((current) => ({ ...current, dueDate: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Max Score
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={assignmentForm.maxScore}
                        onChange={(event) => setAssignmentForm((current) => ({ ...current, maxScore: event.target.value }))}
                        required
                      />
                    </label>
                    <button className="button button-dark field-span-2" type="submit" disabled={actionLoading}>
                      {actionLoading ? 'Saving...' : 'Save Assignment'}
                    </button>
                  </form>
                ) : actionModal === 'attendance' ? (
                  <form className="settings-form action-form-grid" onSubmit={handleMarkAttendance}>
                    <label>
                      Class
                      <select
                        value={attendanceForm.classId}
                        onChange={(event) => {
                          const nextClassId = event.target.value
                          const nextClass = activeTeacherClasses.find((item) => item._id === nextClassId) || activeTeacherClasses[0]
                          const nextStatuses = (nextClass?.students || []).reduce((accumulator, student) => {
                            accumulator[student._id] = 'present'
                            return accumulator
                          }, {})

                          setAttendanceForm((current) => ({ ...current, classId: nextClassId, statuses: nextStatuses }))
                        }}
                      >
                        {activeTeacherClasses.map((item) => (
                          <option key={item._id} value={item._id}>{item.code} - {item.subject}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Date
                      <input
                        type="date"
                        value={attendanceForm.date}
                        onChange={(event) => setAttendanceForm((current) => ({ ...current, date: event.target.value }))}
                        required
                      />
                    </label>

                    <div className="field-span-2" style={{ display: 'grid', gap: '0.75rem' }}>
                      {(activeTeacherClasses.find((item) => item._id === attendanceForm.classId) || activeTeacherClasses[0])?.students?.length > 0 ? (
                        (activeTeacherClasses.find((item) => item._id === attendanceForm.classId) || activeTeacherClasses[0]).students.map((student) => (
                          <div
                            key={student._id}
                            style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: '0.75rem', alignItems: 'center' }}
                          >
                            <div>
                              <strong>{student.name}</strong>
                              <p style={{ margin: '0.25rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{student.email}</p>
                            </div>
                            <select
                              value={attendanceForm.statuses[student._id] || 'present'}
                              onChange={(event) =>
                                setAttendanceForm((current) => ({
                                  ...current,
                                  statuses: { ...current.statuses, [student._id]: event.target.value },
                                }))
                              }
                            >
                              <option value="present">Present</option>
                              <option value="late">Late</option>
                              <option value="absent">Absent</option>
                            </select>
                          </div>
                        ))
                      ) : (
                        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No students found for this class.</p>
                      )}
                    </div>

                    <button className="button button-dark field-span-2" type="submit" disabled={actionLoading}>
                      {actionLoading ? 'Saving...' : 'Save Attendance'}
                    </button>
                  </form>
                ) : (
                  <form className="settings-form action-form-grid" onSubmit={handleSubmitAssignment}>
                    <label className="field-span-2">
                      Assignment
                      <input type="text" value={submissionModalAssignment?.title || ''} readOnly />
                    </label>
                    <label className="field-span-2">
                      Submission Note
                      <textarea
                        value={submissionForm.note}
                        onChange={(event) => setSubmissionForm((current) => ({ ...current, note: event.target.value }))}
                        placeholder="Add a short summary of your work"
                      />
                    </label>
                    <label className="field-span-2">
                      Upload File
                      <input
                        type="file"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null
                          setSubmissionForm((current) => ({ ...current, file, fileName: file?.name || '' }))
                        }}
                      />
                    </label>
                    {submissionForm.fileName && <p className="field-span-2" style={{ margin: 0, color: 'var(--text-secondary)' }}>Selected: {submissionForm.fileName}</p>}
                    <button className="button button-dark field-span-2" type="submit" disabled={actionLoading}>
                      {actionLoading ? 'Uploading...' : 'Upload Assignment'}
                    </button>
                  </form>
                )}
              </section>
            </div>
          )}
    </div>
  )
}

export default App

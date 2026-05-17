require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const cookieParser = require('cookie-parser');
const db = require('./db');
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const roomRoutes = require('./routes/rooms');
const userRoutes = require('./routes/users');
const { ensureAuthenticated } = require('./middleware/auth');

const app = express();
const dataDir = path.join(__dirname, 'data');

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    store: new SQLiteStore({ db: 'sessions.db', dir: dataDir }),
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  if (req.session?.user) {
    return res.redirect('/dashboard');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/patients', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/rooms', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.use('/api', authRoutes);
app.use('/api/patients', ensureAuthenticated, patientRoutes);
app.use('/api/rooms', ensureAuthenticated, roomRoutes);
app.use('/api/users', ensureAuthenticated, userRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', pid: process.pid });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

db.init().catch((error) => {
  console.error('Unable to initialize database:', error);
  process.exit(1);
});

module.exports = app;

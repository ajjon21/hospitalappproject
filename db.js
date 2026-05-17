const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'hospital.db');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-32-byte-key-123456789012';
const IV_LENGTH = 16;

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function encrypt(value) {
  if (!value) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8').slice(0, 32), iv);
  let encrypted = cipher.update(value, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return `${iv.toString('base64')}:${encrypted}`;
}

function decrypt(value) {
  if (!value) return '';
  const [ivBase64, encrypted] = value.split(':');
  if (!ivBase64 || !encrypted) return '';
  const iv = Buffer.from(ivBase64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8').slice(0, 32), iv);
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function init() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    roomNumber TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    status TEXT NOT NULL,
    isolation INTEGER NOT NULL DEFAULT 0,
    updatedAt TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS patients (
    id TEXT PRIMARY KEY,
    fullName TEXT NOT NULL,
    encryptedNotes TEXT,
    age INTEGER NOT NULL,
    conditionStatus TEXT NOT NULL,
    infectionRisk TEXT NOT NULL,
    assignedRoomId INTEGER,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY(assignedRoomId) REFERENCES rooms(id)
  )`);

  const admin = await get('SELECT id FROM users WHERE email = ?', ['admin@hospital.local']);
  if (!admin) {
    const passwordHash = await bcrypt.hash('AdminPass!23', 10);
    await run(
      'INSERT INTO users (id, name, email, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), 'Hospital Administrator', 'admin@hospital.local', passwordHash, 'admin', new Date().toISOString()]
    );
  }

  const countRooms = await get('SELECT COUNT(*) as count FROM rooms');
  if (countRooms.count === 0) {
    const rooms = [
      ['101', 'General', 1, 'available', 0],
      ['102', 'General', 1, 'available', 0],
      ['103', 'Isolation', 1, 'available', 1],
      ['104', 'General', 1, 'available', 0],
      ['105', 'ICU', 1, 'available', 1],
      ['201', 'General', 1, 'available', 0],
      ['202', 'General', 1, 'available', 0],
      ['203', 'Isolation', 1, 'available', 1],
      ['204', 'ICU', 1, 'available', 1],
      ['205', 'General', 1, 'available', 0],
    ];
    for (const [roomNumber, type, capacity, status, isolation] of rooms) {
      await run(
        'INSERT INTO rooms (roomNumber, type, capacity, status, isolation, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        [roomNumber, type, capacity, status, isolation, new Date().toISOString()]
      );
    }
  }
}

function sanitizePatientRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: decrypt(row.fullName),
    notes: decrypt(row.encryptedNotes),
    age: row.age,
    conditionStatus: row.conditionStatus,
    infectionRisk: row.infectionRisk,
    assignedRoomId: row.assignedRoomId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

module.exports = {
  run,
  get,
  all,
  init,
  encrypt,
  decrypt,
  sanitizePatientRow,
  hashPassword: (password) => bcrypt.hash(password, 10),
};

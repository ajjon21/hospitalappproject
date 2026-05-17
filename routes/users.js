const express = require('express');
const router = express.Router();
const db = require('../db');
const { body, validationResult } = require('express-validator');
const { authorizeRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.get('/', authorizeRole('admin'), async (req, res) => {
  try {
    const users = await db.all('SELECT id, name, email, role, createdAt FROM users ORDER BY createdAt DESC');
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load users' });
  }
});

router.post(
  '/',
  authorizeRole('admin'),
  body('name').trim().notEmpty().escape(),
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['admin', 'staff']),
  body('password').isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, role, password } = req.body;
    try {
      const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existing) {
        return res.status(400).json({ error: 'User email already exists' });
      }
      const passwordHash = await db.hashPassword(password);
      await db.run(
        'INSERT INTO users (id, name, email, passwordHash, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), name, email, passwordHash, role, new Date().toISOString()]
      );
      const users = await db.all('SELECT id, name, email, role, createdAt FROM users ORDER BY createdAt DESC');
      res.status(201).json({ users });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to create user' });
    }
  }
);

module.exports = router;

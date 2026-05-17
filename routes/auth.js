const express = require('express');
const router = express.Router();
const db = require('../db');
const { body, validationResult } = require('express-validator');

router.post(
  '/login',
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    try {
      const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await require('bcrypt').compare(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };
      return res.json({ success: true, redirect: '/dashboard' });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Login failed' });
    }
  }
);

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true, redirect: '/login' });
  });
});

router.get('/profile', (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ user: req.session.user });
});

module.exports = router;

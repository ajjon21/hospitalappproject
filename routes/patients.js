const express = require('express');
const router = express.Router();
const db = require('../db');
const { body, validationResult } = require('express-validator');
const { authorizeRole } = require('../middleware/auth');

function isolationPriority(patient) {
  if (patient.infectionRisk === 'High' || patient.conditionStatus === 'Critical') {
    return 'Critical Isolation';
  }
  if (patient.infectionRisk === 'Medium' || patient.age >= 65 || patient.conditionStatus === 'Severe') {
    return 'High Priority';
  }
  return 'Standard';
}

async function fetchPatients() {
  const rows = await db.all('SELECT * FROM patients');
  return rows.map((row) => {
    const patient = db.sanitizePatientRow(row);
    return {
      ...patient,
      isolationPriority: isolationPriority(patient),
    };
  });
}

router.get('/', async (req, res) => {
  try {
    const patients = await fetchPatients();
    res.json({ patients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load patients' });
  }
});

router.post(
  '/',
  body('fullName').trim().notEmpty().escape(),
  body('age').isInt({ min: 0, max: 120 }),
  body('conditionStatus').isIn(['Stable', 'Severe', 'Critical']),
  body('infectionRisk').isIn(['Low', 'Medium', 'High']),
  body('notes').optional().trim().escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullName, age, conditionStatus, infectionRisk, notes, assignedRoomId } = req.body;
    const patientId = require('uuid').v4();

    try {
      if (assignedRoomId) {
        const room = await db.get('SELECT * FROM rooms WHERE id = ? AND status = ?', [assignedRoomId, 'available']);
        if (!room) {
          return res.status(400).json({ error: 'Selected room is not available' });
        }
        await db.run('UPDATE rooms SET status = ?, updatedAt = ? WHERE id = ?', ['occupied', new Date().toISOString(), assignedRoomId]);
      }

      await db.run(
        'INSERT INTO patients (id, fullName, encryptedNotes, age, conditionStatus, infectionRisk, assignedRoomId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          patientId,
          db.encrypt(fullName),
          db.encrypt(notes || ''),
          age,
          conditionStatus,
          infectionRisk,
          assignedRoomId || null,
          new Date().toISOString(),
          new Date().toISOString(),
        ]
      );

      const patients = await fetchPatients();
      res.status(201).json({ patients });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to create patient' });
    }
  }
);

router.put(
  '/:id',
  body('fullName').trim().notEmpty().escape(),
  body('age').isInt({ min: 0, max: 120 }),
  body('conditionStatus').isIn(['Stable', 'Severe', 'Critical']),
  body('infectionRisk').isIn(['Low', 'Medium', 'High']),
  body('notes').optional().trim().escape(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { fullName, age, conditionStatus, infectionRisk, notes, assignedRoomId } = req.body;

    try {
      const patient = await db.get('SELECT * FROM patients WHERE id = ?', [id]);
      if (!patient) {
        return res.status(404).json({ error: 'Patient not found' });
      }

      if (assignedRoomId && patient.assignedRoomId !== assignedRoomId) {
        const newRoom = await db.get('SELECT * FROM rooms WHERE id = ? AND status = ?', [assignedRoomId, 'available']);
        if (!newRoom) {
          return res.status(400).json({ error: 'Selected room is not available' });
        }
        if (patient.assignedRoomId) {
          await db.run('UPDATE rooms SET status = ?, updatedAt = ? WHERE id = ?', ['available', new Date().toISOString(), patient.assignedRoomId]);
        }
        await db.run('UPDATE rooms SET status = ?, updatedAt = ? WHERE id = ?', ['occupied', new Date().toISOString(), assignedRoomId]);
      }

      await db.run(
        'UPDATE patients SET fullName = ?, encryptedNotes = ?, age = ?, conditionStatus = ?, infectionRisk = ?, assignedRoomId = ?, updatedAt = ? WHERE id = ?',
        [
          db.encrypt(fullName),
          db.encrypt(notes || ''),
          age,
          conditionStatus,
          infectionRisk,
          assignedRoomId || null,
          new Date().toISOString(),
          id,
        ]
      );

      const patients = await fetchPatients();
      res.json({ patients });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Unable to update patient' });
    }
  }
);

router.delete('/:id', authorizeRole('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const patient = await db.get('SELECT * FROM patients WHERE id = ?', [id]);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (patient.assignedRoomId) {
      await db.run('UPDATE rooms SET status = ?, updatedAt = ? WHERE id = ?', ['available', new Date().toISOString(), patient.assignedRoomId]);
    }
    await db.run('DELETE FROM patients WHERE id = ?', [id]);
    const patients = await fetchPatients();
    res.json({ patients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to delete patient' });
  }
});

module.exports = router;

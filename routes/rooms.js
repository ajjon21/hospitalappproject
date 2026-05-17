const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const rooms = await db.all('SELECT * FROM rooms ORDER BY roomNumber');
    const patients = await db.all('SELECT id, assignedRoomId, fullName FROM patients WHERE assignedRoomId IS NOT NULL');
    const roomLookup = new Map(patients.map((patient) => [patient.assignedRoomId, { id: patient.id, fullName: db.decrypt(patient.fullName) }]));
    const payload = rooms.map((room) => {
      const assignedData = roomLookup.get(room.id);
      return {
        id: room.id,
        roomNumber: room.roomNumber,
        type: room.type,
        capacity: room.capacity,
        status: room.status,
        isolation: Boolean(room.isolation),
        assignedPatientId: assignedData?.id || null,
        assignedPatientName: assignedData?.fullName || null,
        updatedAt: room.updatedAt,
      };
    });
    res.json({ rooms: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to load room data' });
  }
});

router.put('/:id/release', async (req, res) => {
  const { id } = req.params;
  try {
    const patients = await db.all('SELECT * FROM patients WHERE assignedRoomId = ?', [id]);
    await Promise.all(patients.map((patient) => db.run('UPDATE patients SET assignedRoomId = NULL, updatedAt = ? WHERE id = ?', [new Date().toISOString(), patient.id])));
    await db.run('UPDATE rooms SET status = ?, updatedAt = ? WHERE id = ?', ['available', new Date().toISOString(), id]);
    const rooms = await db.all('SELECT * FROM rooms ORDER BY roomNumber');
    res.json({ rooms });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to release room' });
  }
});

router.put('/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { patientId } = req.body;
  try {
    const room = await db.get('SELECT * FROM rooms WHERE id = ? AND status = ?', [id, 'available']);
    if (!room) {
      return res.status(400).json({ error: 'Room is not available' });
    }
    const patient = await db.get('SELECT * FROM patients WHERE id = ?', [patientId]);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (patient.assignedRoomId) {
      await db.run('UPDATE rooms SET status = ?, updatedAt = ? WHERE id = ?', ['available', new Date().toISOString(), patient.assignedRoomId]);
    }
    await db.run('UPDATE patients SET assignedRoomId = ?, updatedAt = ? WHERE id = ?', [id, new Date().toISOString(), patientId]);
    await db.run('UPDATE rooms SET status = ?, updatedAt = ? WHERE id = ?', ['occupied', new Date().toISOString(), id]);
    const rooms = await db.all('SELECT * FROM rooms ORDER BY roomNumber');
    res.json({ rooms });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to assign room' });
  }
});

module.exports = router;

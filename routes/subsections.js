const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/subsections - List all subsections (optional filter ?section_id=)
router.get('/', (req, res) => {
  try {
    const { section_id } = req.query;
    let query = `
      SELECT 
        sub.id, 
        sub.name, 
        sub.section_id,
        s.name AS section_name,
        (SELECT COUNT(*) FROM documents d WHERE d.subsection_id = sub.id) AS document_count
      FROM subsections sub
      JOIN sections s ON sub.section_id = s.id
    `;
    const params = [];

    if (section_id) {
      query += ' WHERE sub.section_id = ?';
      params.push(section_id);
    }

    query += ' ORDER BY s.name ASC, sub.name ASC';
    const subsections = db.prepare(query).all(...params);

    res.json(subsections);
  } catch (err) {
    console.error('Error fetching subsections:', err);
    res.status(500).json({ error: 'Failed to retrieve subsections' });
  }
});

// GET /api/subsections/:id - Get single subsection
router.get('/:id', (req, res) => {
  try {
    const subsection = db.prepare(`
      SELECT sub.id, sub.name, sub.section_id, s.name AS section_name
      FROM subsections sub
      JOIN sections s ON sub.section_id = s.id
      WHERE sub.id = ?
    `).get(req.params.id);

    if (!subsection) {
      return res.status(404).json({ error: 'Subsection not found' });
    }
    res.json(subsection);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve subsection' });
  }
});

// POST /api/subsections - Create subsection (Admin only)
router.post('/', authMiddleware, (req, res) => {
  try {
    const { section_id, name } = req.body;
    if (!section_id) {
      return res.status(400).json({ error: 'Section ID is required' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Subsection name is required' });
    }

    const trimmed = name.trim();
    const section = db.prepare('SELECT id FROM sections WHERE id = ?').get(section_id);
    if (!section) {
      return res.status(400).json({ error: 'Specified section does not exist' });
    }

    const existing = db.prepare('SELECT id FROM subsections WHERE section_id = ? AND LOWER(name) = LOWER(?)').get(section_id, trimmed);
    if (existing) {
      return res.status(409).json({ error: 'A subsection with this name already exists in this section' });
    }

    const result = db.prepare('INSERT INTO subsections (section_id, name) VALUES (?, ?)').run(section_id, trimmed);
    const newSub = db.prepare(`
      SELECT sub.id, sub.name, sub.section_id, s.name AS section_name
      FROM subsections sub
      JOIN sections s ON sub.section_id = s.id
      WHERE sub.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newSub);
  } catch (err) {
    console.error('Error creating subsection:', err);
    res.status(500).json({ error: 'Failed to create subsection' });
  }
});

// PUT /api/subsections/:id - Rename/edit subsection (Admin only)
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { name, section_id } = req.body;
    const subId = req.params.id;

    const sub = db.prepare('SELECT * FROM subsections WHERE id = ?').get(subId);
    if (!sub) {
      return res.status(404).json({ error: 'Subsection not found' });
    }

    const targetSectionId = section_id ? parseInt(section_id, 10) : sub.section_id;
    const targetName = name ? name.trim() : sub.name;

    if (!targetName) {
      return res.status(400).json({ error: 'Subsection name cannot be empty' });
    }

    // Verify target section exists
    const sec = db.prepare('SELECT id FROM sections WHERE id = ?').get(targetSectionId);
    if (!sec) {
      return res.status(400).json({ error: 'Target section does not exist' });
    }

    // Check duplicate
    const duplicate = db.prepare('SELECT id FROM subsections WHERE section_id = ? AND LOWER(name) = LOWER(?) AND id != ?')
      .get(targetSectionId, targetName, subId);
    if (duplicate) {
      return res.status(409).json({ error: 'Another subsection with this name already exists in this section' });
    }

    db.prepare('UPDATE subsections SET name = ?, section_id = ? WHERE id = ?').run(targetName, targetSectionId, subId);

    const updated = db.prepare(`
      SELECT sub.id, sub.name, sub.section_id, s.name AS section_name
      FROM subsections sub
      JOIN sections s ON sub.section_id = s.id
      WHERE sub.id = ?
    `).get(subId);

    res.json(updated);
  } catch (err) {
    console.error('Error updating subsection:', err);
    res.status(500).json({ error: 'Failed to update subsection' });
  }
});

// DELETE /api/subsections/:id - Delete subsection (Admin only)
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const subId = req.params.id;
    const sub = db.prepare('SELECT id, name FROM subsections WHERE id = ?').get(subId);
    if (!sub) {
      return res.status(404).json({ error: 'Subsection not found' });
    }

    // Delete associated physical files
    const docs = db.prepare('SELECT file_path FROM documents WHERE subsection_id = ?').all(subId);
    for (const doc of docs) {
      try {
        const fullPath = path.isAbsolute(doc.file_path) ? doc.file_path : path.join(__dirname, '..', doc.file_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (fileErr) {
        console.warn('Could not remove file during subsection deletion:', doc.file_path);
      }
    }

    db.prepare('DELETE FROM subsections WHERE id = ?').run(subId);
    res.json({ message: `Subsection "${sub.name}" and its documents were deleted successfully` });
  } catch (err) {
    console.error('Error deleting subsection:', err);
    res.status(500).json({ error: 'Failed to delete subsection' });
  }
});

module.exports = router;


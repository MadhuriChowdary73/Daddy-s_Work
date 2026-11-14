const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /api/sections - List sections (optional filter ?panel=main or ?panel=bills)
router.get('/', (req, res) => {
  try {
    const { panel } = req.query;
    let query = `
      SELECT 
        s.id, 
        s.name,
        s.panel,
        (SELECT COUNT(*) FROM subsections sub WHERE sub.section_id = s.id) AS subsection_count,
        (SELECT COUNT(*) FROM documents d 
         JOIN subsections sub ON d.subsection_id = sub.id 
         WHERE sub.section_id = s.id) AS document_count
      FROM sections s
    `;
    const params = [];

    if (panel) {
      query += ` WHERE s.panel = ?`;
      params.push(panel);
    }

    query += ` ORDER BY s.id ASC`;
    const sections = db.prepare(query).all(...params);

    res.json(sections);
  } catch (err) {
    console.error('Error fetching sections:', err);
    res.status(500).json({ error: 'Failed to retrieve sections' });
  }
});

// GET /api/sections/:id - Get single section
router.get('/:id', (req, res) => {
  try {
    const section = db.prepare('SELECT id, name, panel FROM sections WHERE id = ?').get(req.params.id);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }
    res.json(section);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve section' });
  }
});

// GET /api/sections/:id/subsections - List subsections for a section
router.get('/:id/subsections', (req, res) => {
  try {
    const sectionId = req.params.id;
    const section = db.prepare('SELECT id, name, panel FROM sections WHERE id = ?').get(sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    const subsections = db.prepare(`
      SELECT 
        sub.id, 
        sub.name, 
        sub.section_id,
        (SELECT COUNT(*) FROM documents d WHERE d.subsection_id = sub.id) AS document_count
      FROM subsections sub
      WHERE sub.section_id = ?
      ORDER BY sub.id ASC
    `).all(sectionId);

    res.json(subsections);
  } catch (err) {
    console.error('Error fetching subsections for section:', err);
    res.status(500).json({ error: 'Failed to retrieve subsections' });
  }
});

// POST /api/sections - Create section (Admin only)
router.post('/', authMiddleware, (req, res) => {
  try {
    const { name, panel } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Section name is required' });
    }

    const targetPanel = panel && (panel === 'bills' || panel === 'main') ? panel : 'main';
    const trimmed = name.trim();

    // Check duplicate within the same panel
    const existing = db.prepare('SELECT id FROM sections WHERE LOWER(name) = LOWER(?) AND panel = ?').get(trimmed, targetPanel);
    if (existing) {
      return res.status(409).json({ error: `A section with this name already exists in the ${targetPanel} panel` });
    }

    const result = db.prepare('INSERT INTO sections (name, panel) VALUES (?, ?)').run(trimmed, targetPanel);
    const newSection = db.prepare(`
      SELECT 
        s.id, 
        s.name, 
        s.panel,
        0 AS subsection_count,
        0 AS document_count
      FROM sections s
      WHERE s.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newSection);
  } catch (err) {
    console.error('Error creating section:', err);
    res.status(500).json({ error: 'Failed to create section' });
  }
});

// POST /api/sections/:id/subsections - Add subsection under section :id (Admin only)
router.post('/:id/subsections', authMiddleware, (req, res) => {
  try {
    const sectionId = req.params.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Subsection name is required' });
    }

    const section = db.prepare('SELECT id, name, panel FROM sections WHERE id = ?').get(sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Parent section not found' });
    }

    const trimmed = name.trim();
    const existing = db.prepare('SELECT id FROM subsections WHERE section_id = ? AND LOWER(name) = LOWER(?)').get(sectionId, trimmed);
    if (existing) {
      return res.status(409).json({ error: 'A subsection with this name already exists in this section' });
    }

    const result = db.prepare('INSERT INTO subsections (section_id, name) VALUES (?, ?)').run(sectionId, trimmed);
    const newSub = db.prepare(`
      SELECT sub.id, sub.name, sub.section_id, 0 AS document_count
      FROM subsections sub
      WHERE sub.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(newSub);
  } catch (err) {
    console.error('Error creating subsection under section:', err);
    res.status(500).json({ error: 'Failed to create subsection' });
  }
});

// PUT /api/sections/:id - Rename section (Admin only)
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { name, panel } = req.body;
    const sectionId = req.params.id;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Section name is required' });
    }

    const trimmed = name.trim();
    const section = db.prepare('SELECT id, name, panel FROM sections WHERE id = ?').get(sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    const targetPanel = panel && (panel === 'bills' || panel === 'main') ? panel : section.panel;

    const duplicate = db.prepare('SELECT id FROM sections WHERE LOWER(name) = LOWER(?) AND panel = ? AND id != ?')
      .get(trimmed, targetPanel, sectionId);
    if (duplicate) {
      return res.status(409).json({ error: `Another section with this name already exists in the ${targetPanel} panel` });
    }

    db.prepare('UPDATE sections SET name = ?, panel = ? WHERE id = ?').run(trimmed, targetPanel, sectionId);
    const updated = db.prepare(`
      SELECT 
        s.id, 
        s.name, 
        s.panel,
        (SELECT COUNT(*) FROM subsections sub WHERE sub.section_id = s.id) AS subsection_count,
        (SELECT COUNT(*) FROM documents d 
         JOIN subsections sub ON d.subsection_id = sub.id 
         WHERE sub.section_id = s.id) AS document_count
      FROM sections s
      WHERE s.id = ?
    `).get(sectionId);

    res.json(updated);
  } catch (err) {
    console.error('Error updating section:', err);
    res.status(500).json({ error: 'Failed to update section' });
  }
});

// DELETE /api/sections/:id - Delete section (Admin only)
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const sectionId = req.params.id;
    const section = db.prepare('SELECT id, name, panel FROM sections WHERE id = ?').get(sectionId);
    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    // Find all files belonging to documents in this section to delete from disk
    const docs = db.prepare(`
      SELECT d.file_path FROM documents d
      JOIN subsections sub ON d.subsection_id = sub.id
      WHERE sub.section_id = ?
    `).all(sectionId);

    for (const doc of docs) {
      try {
        const fullPath = path.isAbsolute(doc.file_path) ? doc.file_path : path.join(__dirname, '..', doc.file_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (fileErr) {
        console.warn('Could not remove file during section deletion:', doc.file_path);
      }
    }

    db.prepare('DELETE FROM sections WHERE id = ?').run(sectionId);
    res.json({ message: `Section "${section.name}" and all its contents were deleted successfully` });
  } catch (err) {
    console.error('Error deleting section:', err);
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

module.exports = router;

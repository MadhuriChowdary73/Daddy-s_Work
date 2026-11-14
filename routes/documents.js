const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage with safe unique filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    cb(null, `doc_${timestamp}_${randomSuffix}.pdf`);
  }
});

// PDF file filter - validates MIME type and extension
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (ext === '.pdf' && (mime === 'application/pdf' || mime === 'application/x-pdf')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF files (.pdf) are allowed.'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB limit
  },
  fileFilter
});

// Helper to sanitize title for filename in Content-Disposition
function sanitizeFilename(title) {
  // Replace illegal filename characters with underscores
  const clean = title.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return clean || 'document';
}

// Helper to verify PDF magic bytes (%PDF)
function verifyPdfMagicBytes(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(4);
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    return buffer.toString('utf8') === '%PDF';
  } catch (err) {
    return false;
  }
}

// GET /api/documents - Public listing with filters (section, subsection, search)
router.get('/', (req, res) => {
  try {
    const { section_id, subsection_id, search } = req.query;

    let query = `
      SELECT 
        d.id,
        d.title,
        d.description,
        d.file_size,
        d.uploaded_at,
        sub.id AS subsection_id,
        sub.name AS subsection_name,
        s.id AS section_id,
        s.name AS section_name
      FROM documents d
      JOIN subsections sub ON d.subsection_id = sub.id
      JOIN sections s ON sub.section_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (subsection_id && subsection_id !== 'all' && subsection_id !== '') {
      query += ' AND d.subsection_id = ?';
      params.push(subsection_id);
    } else if (section_id && section_id !== 'all' && section_id !== '') {
      query += ' AND sub.section_id = ?';
      params.push(section_id);
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      query += ' AND (LOWER(d.title) LIKE ? OR LOWER(d.description) LIKE ?)';
      params.push(term, term);
    }

    query += ' ORDER BY d.uploaded_at DESC, d.id DESC';

    const documents = db.prepare(query).all(...params);
    res.json(documents);
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
});

// GET /api/documents/:id - Single document details
router.get('/:id', (req, res) => {
  try {
    const document = db.prepare(`
      SELECT 
        d.id,
        d.title,
        d.description,
        d.file_size,
        d.uploaded_at,
        sub.id AS subsection_id,
        sub.name AS subsection_name,
        s.id AS section_id,
        s.name AS section_name
      FROM documents d
      JOIN subsections sub ON d.subsection_id = sub.id
      JOIN sections s ON sub.section_id = s.id
      WHERE d.id = ?
    `).get(req.params.id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve document details' });
  }
});

// GET /api/documents/:id/download - Download PDF with admin-given title
router.get('/:id/download', (req, res) => {
  try {
    const doc = db.prepare('SELECT id, title, file_path FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const fullPath = path.isAbsolute(doc.file_path) ? doc.file_path : path.join(__dirname, '..', doc.file_path);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File on disk could not be located' });
    }

    const safeFilename = `${sanitizeFilename(doc.title)}.pdf`;
    const encodedFilename = encodeURIComponent(safeFilename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`);

    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// GET /api/documents/:id/view - Inline view / preview PDF in browser
router.get('/:id/view', (req, res) => {
  try {
    const doc = db.prepare('SELECT id, title, file_path FROM documents WHERE id = ?').get(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const fullPath = path.isAbsolute(doc.file_path) ? doc.file_path : path.join(__dirname, '..', doc.file_path);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File on disk could not be located' });
    }

    const safeFilename = `${sanitizeFilename(doc.title)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);

    const fileStream = fs.createReadStream(fullPath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('View error:', err);
    res.status(500).json({ error: 'Failed to view document' });
  }
});

// POST /api/documents - Admin Upload document
router.post('/', authMiddleware, (req, res) => {
  upload.single('pdf')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum limit of 10 MB' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'A PDF file is required' });
    }

    const { title, description, subsection_id } = req.body;

    if (!title || !title.trim()) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Document title is required' });
    }

    if (!subsection_id) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Subsection is required' });
    }

    // Verify subsection exists
    const sub = db.prepare('SELECT id FROM subsections WHERE id = ?').get(subsection_id);
    if (!sub) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Selected subsection does not exist' });
    }

    // Check magic bytes
    if (!verifyPdfMagicBytes(req.file.path)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Corrupt or invalid PDF file format' });
    }

    const relativePath = path.relative(path.join(__dirname, '..'), req.file.path);
    const fileSize = req.file.size;

    try {
      const result = db.prepare(`
        INSERT INTO documents (title, description, subsection_id, file_path, file_size)
        VALUES (?, ?, ?, ?, ?)
      `).run(title.trim(), (description || '').trim(), subsection_id, relativePath, fileSize);

      const created = db.prepare(`
        SELECT 
          d.id,
          d.title,
          d.description,
          d.file_size,
          d.uploaded_at,
          sub.id AS subsection_id,
          sub.name AS subsection_name,
          s.id AS section_id,
          s.name AS section_name
        FROM documents d
        JOIN subsections sub ON d.subsection_id = sub.id
        JOIN sections s ON sub.section_id = s.id
        WHERE d.id = ?
      `).get(result.lastInsertRowid);

      return res.status(201).json(created);
    } catch (insertErr) {
      console.error('Error saving document to database:', insertErr);
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Database error while saving document' });
    }
  });
});

// PUT /api/documents/:id - Admin Edit document (can also replace file optionally)
router.put('/:id', authMiddleware, (req, res) => {
  upload.single('pdf')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum limit of 10 MB' });
      }
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    const docId = req.params.id;
    const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    if (!existing) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Document not found' });
    }

    const { title, description, subsection_id } = req.body;

    const newTitle = title ? title.trim() : existing.title;
    const newDesc = description !== undefined ? description.trim() : existing.description;
    const newSubId = subsection_id ? parseInt(subsection_id, 10) : existing.subsection_id;

    if (!newTitle) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Document title cannot be empty' });
    }

    const sub = db.prepare('SELECT id FROM subsections WHERE id = ?').get(newSubId);
    if (!sub) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Selected subsection does not exist' });
    }

    let filePath = existing.file_path;
    let fileSize = existing.file_size;

    if (req.file) {
      if (!verifyPdfMagicBytes(req.file.path)) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Corrupt or invalid PDF file format' });
      }

      // Delete old file
      try {
        const oldFullPath = path.isAbsolute(existing.file_path) ? existing.file_path : path.join(__dirname, '..', existing.file_path);
        if (fs.existsSync(oldFullPath)) {
          fs.unlinkSync(oldFullPath);
        }
      } catch (fErr) {
        console.warn('Could not remove old file during replacement:', existing.file_path);
      }

      filePath = path.relative(path.join(__dirname, '..'), req.file.path);
      fileSize = req.file.size;
    }

    try {
      db.prepare(`
        UPDATE documents 
        SET title = ?, description = ?, subsection_id = ?, file_path = ?, file_size = ?
        WHERE id = ?
      `).run(newTitle, newDesc, newSubId, filePath, fileSize, docId);

      const updated = db.prepare(`
        SELECT 
          d.id,
          d.title,
          d.description,
          d.file_size,
          d.uploaded_at,
          sub.id AS subsection_id,
          sub.name AS subsection_name,
          s.id AS section_id,
          s.name AS section_name
        FROM documents d
        JOIN subsections sub ON d.subsection_id = sub.id
        JOIN sections s ON sub.section_id = s.id
        WHERE d.id = ?
      `).get(docId);

      return res.json(updated);
    } catch (updateErr) {
      console.error('Error updating document:', updateErr);
      return res.status(500).json({ error: 'Database error while updating document' });
    }
  });
});

// DELETE /api/documents/:id - Admin Delete document
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const docId = req.params.id;
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Remove file from disk
    try {
      const fullPath = path.isAbsolute(doc.file_path) ? doc.file_path : path.join(__dirname, '..', doc.file_path);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (fErr) {
      console.warn('Could not remove file on document deletion:', doc.file_path);
    }

    db.prepare('DELETE FROM documents WHERE id = ?').run(docId);
    res.json({ message: `Document "${doc.title}" deleted successfully` });
  } catch (err) {
    console.error('Error deleting document:', err);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;


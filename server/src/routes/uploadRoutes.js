const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { errorResponse } = require('../utils/apiResponse');
const { uploadDir } = require('../middleware/upload');

/**
 * GET /api/v1/uploads/:filename
 * Download or view a saved uploaded file (PDF/image)
 * Only authenticated users can access
 */
router.get('/:filename', authenticate, (req, res) => {
  try {
    const filename = req.params.filename;

    // Security: prevent path traversal
    // Only allow alphanumeric, dash, underscore, dot
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(filename)) {
      return errorResponse(res, 'Invalid filename.', 400);
    }

    // Only allow known extensions
    const ext = path.extname(filename).toLowerCase();
    if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
      return errorResponse(res, 'File type not allowed.', 400);
    }

    const filePath = path.join(uploadDir, filename);

    // Check file exists
    if (!fs.existsSync(filePath)) {
      return errorResponse(res, 'File not found.', 404);
    }

    // Set correct content type
    const mimeTypes = {
      '.pdf':  'application/pdf',
      '.jpg':  'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png':  'image/png',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // inline = view in browser, attachment = force download
    const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', () => {
      if (!res.headersSent) {
        errorResponse(res, 'Error reading file.', 500);
      }
    });
  } catch (error) {
    errorResponse(res, 'Could not retrieve file.', 500);
  }
});

/**
 * DELETE /api/v1/uploads/:filename
 * Manually delete a saved file if needed
 */
router.delete('/:filename', authenticate, (req, res) => {
  try {
    const filename = req.params.filename;

    if (!/^[a-zA-Z0-9_\-\.]+$/.test(filename)) {
      return errorResponse(res, 'Invalid filename.', 400);
    }

    const filePath = path.join(uploadDir, filename);

    if (!fs.existsSync(filePath)) {
      return errorResponse(res, 'File not found.', 404);
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'File deleted successfully.' });
  } catch (error) {
    errorResponse(res, 'Could not delete file.', 500);
  }
});

module.exports = router;

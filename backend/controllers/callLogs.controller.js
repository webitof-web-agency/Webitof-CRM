const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { query } = require('../config/db');
const { createId, nowIso } = require('../utils/format');
const { broadcastEvent } = require('../services/socketHub.service');

const RECORDINGS_DIR = path.join(__dirname, '..', 'uploads', 'recordings');
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

// Ensure demo WAV audio sample exists
const SAMPLE_AUDIO_PATH = path.join(RECORDINGS_DIR, 'demo-sample-call.wav');
if (!fs.existsSync(SAMPLE_AUDIO_PATH)) {
  try {
    const sampleRate = 8000;
    const durationSeconds = 6;
    const numSamples = sampleRate * durationSeconds;
    const dataSize = numSamples * 2;
    const buffer = Buffer.alloc(44 + dataSize);
    
    // RIFF identifier
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
    buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
    buffer.writeUInt32LE(sampleRate, 24); // SampleRate
    buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
    buffer.writeUInt16LE(2, 32);  // BlockAlign
    buffer.writeUInt16LE(16, 34); // BitsPerSample
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Write pleasant sine wave tone (440Hz / 880Hz cadence)
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const freq = t % 1.5 < 0.75 ? 440 : 554;
      const sample = Math.sin(2 * Math.PI * freq * t) * 0.25 * 32767;
      buffer.writeInt16LE(Math.round(sample), 44 + i * 2);
    }
    fs.writeFileSync(SAMPLE_AUDIO_PATH, buffer);
  } catch (err) {
    console.error('Could not create sample audio file:', err.message);
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, RECORDINGS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '.mp3') || '.mp3';
    const cleanName = path.basename(file.originalname || 'rec', ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `call-rec-${Date.now()}-${cleanName.slice(0, 30)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.amr', '.3gp', '.flac', '.webm', '.caf'];
    if (mime.startsWith('audio/') || mime.startsWith('video/') || allowedExts.includes(ext) || mime === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(null, true); // Allow upload flexibly for mobile device recordings
    }
  }
});

function normalizePhone(val) {
  if (!val) return '';
  return String(val).replace(/[^0-9+]/g, '').trim();
}

// Map db row to clean JSON
function formatCallRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    staffName: row.staff_name || 'Staff Member',
    staffPhone: row.staff_phone || '',
    staffEmail: row.staff_email || '',
    customerPhone: row.customer_phone,
    customerName: row.customer_name || 'Customer',
    leadId: row.lead_id,
    leadName: row.lead_name || null,
    clientId: row.client_id,
    clientName: row.client_company_name || row.client_name || null,
    callType: row.call_type, // 'outgoing', 'incoming', 'missed', 'rejected'
    callStatus: row.call_status, // 'completed', 'busy', 'no_answer', etc.
    durationSeconds: Number(row.duration_seconds || 0),
    startedAt: row.started_at,
    endedAt: row.ended_at,
    outcome: row.outcome || '',
    notes: row.notes || '',
    recordingUrl: row.recording_url || (row.recording_file_name ? `/api/call-logs/recordings/${row.recording_file_name}` : null),
    recordingFileName: row.recording_file_name || null,
    recordingFileSize: Number(row.recording_file_size || 0),
    recordingDuration: Number(row.recording_duration || 0),
    recordingMimeType: row.recording_mime_type || 'audio/mp3',
    source: row.source || 'mobile_app',
    deviceId: row.device_id || null,
    deviceModel: row.device_model || null,
    syncStatus: row.sync_status || 'synced',
    payload: row.payload || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  uploadMiddleware: upload.single('recording'),

  list: async (req, res, next) => {
    try {
      const {
        search = '',
        userId = '',
        staffId = '',
        callType = '',
        callStatus = '',
        hasRecording = '',
        dateRange = '',
        startDate = '',
        endDate = '',
        page = 1,
        limit = 30
      } = req.query;

      const effectiveUserId = userId || staffId;
      const conditions = [];
      const values = [];

      if (search.trim()) {
        values.push(`%${search.trim()}%`);
        const idx = values.length;
        conditions.push(`(
          c.customer_phone ILIKE $${idx} OR
          c.customer_name ILIKE $${idx} OR
          c.staff_name ILIKE $${idx} OR
          c.notes ILIKE $${idx} OR
          c.outcome ILIKE $${idx} OR
          u.full_name ILIKE $${idx}
        )`);
      }

      if (effectiveUserId) {
        values.push(effectiveUserId);
        conditions.push(`c.user_id = $${values.length}`);
      }

      if (callType && callType !== 'all') {
        values.push(callType.toLowerCase());
        conditions.push(`LOWER(c.call_type) = $${values.length}`);
      }

      if (callStatus && callStatus !== 'all') {
        values.push(callStatus.toLowerCase());
        conditions.push(`LOWER(c.call_status) = $${values.length}`);
      }

      if (hasRecording === 'true') {
        conditions.push(`(c.recording_file_name IS NOT NULL AND c.recording_file_name != '' OR c.recording_url IS NOT NULL AND c.recording_url != '')`);
      } else if (hasRecording === 'false') {
        conditions.push(`((c.recording_file_name IS NULL OR c.recording_file_name = '') AND (c.recording_url IS NULL OR c.recording_url = ''))`);
      }

      // Date range filtering
      if (dateRange === 'today') {
        conditions.push(`c.started_at >= CURRENT_DATE AND c.started_at < CURRENT_DATE + INTERVAL '1 day'`);
      } else if (dateRange === 'yesterday') {
        conditions.push(`c.started_at >= CURRENT_DATE - INTERVAL '1 day' AND c.started_at < CURRENT_DATE`);
      } else if (dateRange === 'this_week' || dateRange === 'week') {
        conditions.push(`c.started_at >= DATE_TRUNC('week', CURRENT_DATE)`);
      } else if (dateRange === 'this_month' || dateRange === 'month') {
        conditions.push(`c.started_at >= DATE_TRUNC('month', CURRENT_DATE)`);
      } else if (startDate || endDate) {
        if (startDate) {
          values.push(startDate);
          conditions.push(`c.started_at >= $${values.length}::timestamptz`);
        }
        if (endDate) {
          values.push(endDate);
          conditions.push(`c.started_at <= $${values.length}::timestamptz + INTERVAL '1 day'`);
        }
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count & KPI aggregates
      const statsSql = `
        SELECT
          COUNT(*) as total_calls,
          COUNT(*) FILTER (WHERE LOWER(c.call_type) = 'outgoing') as outgoing_calls,
          COUNT(*) FILTER (WHERE LOWER(c.call_type) = 'incoming') as incoming_calls,
          COUNT(*) FILTER (WHERE LOWER(c.call_type) = 'missed') as missed_calls,
          COUNT(*) FILTER (WHERE LOWER(c.call_type) = 'rejected') as rejected_calls,
          COALESCE(SUM(c.duration_seconds), 0) as total_duration_seconds,
          COUNT(*) FILTER (WHERE (c.recording_file_name IS NOT NULL AND c.recording_file_name != '') OR (c.recording_url IS NOT NULL AND c.recording_url != '')) as with_recording_count
        FROM call_logs c
        LEFT JOIN users u ON u.id = c.user_id
        ${whereClause}
      `;
      const statsRes = await query(statsSql, values);
      const stats = statsRes.rows[0] || {};

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
      const offset = (pageNum - 1) * limitNum;

      const listSql = `
        SELECT
          c.*,
          u.full_name as user_full_name,
          u.avatar_url as user_avatar_url,
          l.name as lead_name,
          cl.company_name as client_company_name,
          cl.name as client_name
        FROM call_logs c
        LEFT JOIN users u ON u.id = c.user_id
        LEFT JOIN leads l ON l.id = c.lead_id
        LEFT JOIN clients cl ON cl.id = c.client_id
        ${whereClause}
        ORDER BY c.started_at DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `;
      const listRes = await query(listSql, values);

      res.json({
        success: true,
        data: listRes.rows.map(formatCallRow),
        stats: {
          totalCalls: Number(stats.total_calls || 0),
          outgoingCalls: Number(stats.outgoing_calls || 0),
          incomingCalls: Number(stats.incoming_calls || 0),
          missedCalls: Number(stats.missed_calls || 0),
          rejectedCalls: Number(stats.rejected_calls || 0),
          totalDurationSeconds: Number(stats.total_duration_seconds || 0),
          withRecordingCount: Number(stats.with_recording_count || 0)
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: Number(stats.total_calls || 0),
          totalPages: Math.ceil(Number(stats.total_calls || 0) / limitNum)
        }
      });
    } catch (error) {
      next(error);
    }
  },

  stats: async (req, res, next) => {
    try {
      // Overall and per-staff breakdown
      const staffStatsSql = `
        SELECT
          c.user_id,
          COALESCE(u.full_name, c.staff_name, 'Unassigned Staff') as staff_name,
          COALESCE(u.phone, c.staff_phone, '') as staff_phone,
          COALESCE(u.email, c.staff_email, '') as staff_email,
          u.avatar_url,
          COUNT(*) as total_calls,
          COUNT(*) FILTER (WHERE LOWER(c.call_type) = 'outgoing') as outgoing_calls,
          COUNT(*) FILTER (WHERE LOWER(c.call_type) = 'incoming') as incoming_calls,
          COUNT(*) FILTER (WHERE LOWER(c.call_type) = 'missed') as missed_calls,
          COUNT(*) FILTER (WHERE (c.recording_file_name IS NOT NULL AND c.recording_file_name != '') OR (c.recording_url IS NOT NULL AND c.recording_url != '')) as recording_calls,
          COALESCE(SUM(c.duration_seconds), 0) as total_duration_seconds,
          MAX(c.started_at) as last_call_at
        FROM call_logs c
        LEFT JOIN users u ON u.id = c.user_id
        GROUP BY c.user_id, u.full_name, c.staff_name, u.phone, c.staff_phone, u.email, c.staff_email, u.avatar_url
        ORDER BY total_calls DESC
      `;
      const staffRes = await query(staffStatsSql);

      const overallSql = `
        SELECT
          COUNT(*) as total_calls,
          COUNT(*) FILTER (WHERE LOWER(c.call_type) = 'outgoing') as outgoing_calls,
          COUNT(*) FILTER (WHERE LOWER(c.call_type) = 'incoming') as incoming_calls,
          COUNT(*) FILTER (WHERE LOWER(c.call_type) = 'missed') as missed_calls,
          COUNT(*) FILTER (WHERE LOWER(c.call_type) = 'rejected') as rejected_calls,
          COALESCE(SUM(c.duration_seconds), 0) as total_duration_seconds,
          COUNT(*) FILTER (WHERE (c.recording_file_name IS NOT NULL AND c.recording_file_name != '') OR (c.recording_url IS NOT NULL AND c.recording_url != '')) as recording_calls
        FROM call_logs c
      `;
      const overallRes = await query(overallSql);
      const overall = overallRes.rows[0] || {};

      res.json({
        success: true,
        data: {
          overall: {
            totalCalls: Number(overall.total_calls || 0),
            outgoingCalls: Number(overall.outgoing_calls || 0),
            incomingCalls: Number(overall.incoming_calls || 0),
            missedCalls: Number(overall.missed_calls || 0),
            rejectedCalls: Number(overall.rejected_calls || 0),
            totalDurationSeconds: Number(overall.total_duration_seconds || 0),
            withRecordingCount: Number(overall.recording_calls || 0)
          },
          staff: staffRes.rows.map((r) => ({
            userId: r.user_id,
            staffName: r.staff_name,
            staffPhone: r.staff_phone,
            staffEmail: r.staff_email,
            avatarUrl: r.avatar_url,
            totalCalls: Number(r.total_calls || 0),
            outgoingCalls: Number(r.outgoing_calls || 0),
            incomingCalls: Number(r.incoming_calls || 0),
            missedCalls: Number(r.missed_calls || 0),
            recordingCalls: Number(r.recording_calls || 0),
            totalDurationSeconds: Number(r.total_duration_seconds || 0),
            lastCallAt: r.last_call_at
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  },

  getById: async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await query(
        `SELECT c.*, u.full_name as user_full_name, l.name as lead_name, cl.company_name as client_company_name
         FROM call_logs c
         LEFT JOIN users u ON u.id = c.user_id
         LEFT JOIN leads l ON l.id = c.lead_id
         LEFT JOIN clients cl ON cl.id = c.client_id
         WHERE c.id = $1`,
        [id]
      );
      if (!result.rows[0]) {
        return res.status(404).json({ success: false, message: 'Call log not found' });
      }
      res.json({ success: true, data: formatCallRow(result.rows[0]) });
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const body = req.body || {};
      const id = body.id || body.clientReferenceId || createId('call');
      const userId = body.userId || body.user_id || req.user?.id || null;
      const staffName = body.staffName || body.staff_name || req.user?.fullName || req.user?.username || 'Staff';
      const staffPhone = body.staffPhone || body.staff_phone || req.user?.phone || '';
      const staffEmail = body.staffEmail || body.staff_email || req.user?.email || '';
      
      const customerPhone = normalizePhone(body.customerPhone || body.phone || body.customer_phone);
      if (!customerPhone) {
        return res.status(400).json({ success: false, message: 'Customer phone number is required' });
      }

      let customerName = String(body.customerName || body.name || body.customer_name || '').trim();
      let leadId = body.leadId || body.lead_id || null;
      let clientId = body.clientId || body.client_id || null;

      // Auto-lookup matching lead or client by phone if not explicitly passed
      if (!leadId && !clientId) {
        const leadMatch = await query(
          `SELECT id, name FROM leads WHERE phone ILIKE $1 OR phone ILIKE $2 LIMIT 1`,
          [`%${customerPhone.slice(-10)}%`, customerPhone]
        );
        if (leadMatch.rows[0]) {
          leadId = leadMatch.rows[0].id;
          if (!customerName) customerName = leadMatch.rows[0].name;
        } else {
          const clientMatch = await query(
            `SELECT id, name, company_name FROM clients WHERE mobile ILIKE $1 OR phone ILIKE $1 LIMIT 1`,
            [`%${customerPhone.slice(-10)}%`]
          );
          if (clientMatch.rows[0]) {
            clientId = clientMatch.rows[0].id;
            if (!customerName) customerName = clientMatch.rows[0].company_name || clientMatch.rows[0].name;
          }
        }
      }

      const callType = String(body.callType || body.type || 'outgoing').toLowerCase();
      const callStatus = String(body.callStatus || body.status || 'completed').toLowerCase();
      const durationSeconds = Number(body.durationSeconds || body.duration_seconds || 0);
      const startedAt = body.startedAt || body.started_at ? new Date(body.startedAt || body.started_at) : new Date();
      const outcome = body.outcome || body.callOutcome || '';
      const notes = body.notes || body.callNotes || '';
      const recordingUrl = body.recordingUrl || body.recording_url || null;
      const recordingFileName = body.recordingFileName || body.recording_file_name || null;
      const source = body.source || 'mobile_app';
      const deviceId = body.deviceId || body.device_id || null;
      const deviceModel = body.deviceModel || body.device_model || null;

      const insertSql = `
        INSERT INTO call_logs (
          id, user_id, staff_name, staff_phone, staff_email,
          customer_phone, customer_name, lead_id, client_id,
          call_type, call_status, duration_seconds, started_at,
          outcome, notes, recording_url, recording_file_name,
          source, device_id, device_model, sync_status, payload,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20, 'synced', $21::jsonb,
          now(), now()
        )
        ON CONFLICT (id) DO UPDATE SET
          duration_seconds = EXCLUDED.duration_seconds,
          outcome = COALESCE(EXCLUDED.outcome, call_logs.outcome),
          notes = COALESCE(EXCLUDED.notes, call_logs.notes),
          recording_url = COALESCE(EXCLUDED.recording_url, call_logs.recording_url),
          recording_file_name = COALESCE(EXCLUDED.recording_file_name, call_logs.recording_file_name),
          updated_at = now()
        RETURNING *
      `;

      const values = [
        id, userId, staffName, staffPhone, staffEmail,
        customerPhone, customerName || 'Customer', leadId, clientId,
        callType, callStatus, durationSeconds, startedAt,
        outcome, notes, recordingUrl, recordingFileName,
        source, deviceId, deviceModel, JSON.stringify(body.payload || {})
      ];

      const result = await query(insertSql, values);
      const savedCall = formatCallRow(result.rows[0]);

      // Emit real-time notification to all connected CRM clients
      broadcastEvent('call:created', savedCall);

      res.status(201).json({ success: true, data: savedCall });
    } catch (error) {
      next(error);
    }
  },

  uploadRecording: async (req, res, next) => {
    try {
      const file = req.file;
      const body = req.body || {};

      if (!file && !body.recordingUrl) {
        return res.status(400).json({ success: false, message: 'Audio recording file or recordingUrl is required' });
      }

      const fileName = file ? file.filename : (body.recordingFileName || '');
      const fileSize = file ? file.size : Number(body.recordingFileSize || 0);
      const mimeType = file ? file.mimetype : (body.recordingMimeType || 'audio/mp3');
      const recordingUrl = file ? `/api/call-logs/recordings/${fileName}` : body.recordingUrl;
      const durationSeconds = Number(body.durationSeconds || body.duration_seconds || 0);

      const callId = body.callId || body.call_id || body.clientReferenceId;

      let callRow;
      if (callId) {
        // Update existing call log
        const updateSql = `
          UPDATE call_logs
          SET
            recording_url = $1,
            recording_file_name = $2,
            recording_file_size = $3,
            recording_mime_type = $4,
            recording_duration = GREATEST(recording_duration, $5),
            duration_seconds = CASE WHEN duration_seconds > 0 THEN duration_seconds ELSE $5 END,
            updated_at = now()
          WHERE id = $6
          RETURNING *
        `;
        const updateRes = await query(updateSql, [recordingUrl, fileName, fileSize, mimeType, durationSeconds, callId]);
        if (updateRes.rows[0]) {
          callRow = updateRes.rows[0];
        }
      }

      if (!callRow) {
        // Create new call log with recording
        const id = callId || createId('call');
        const userId = body.userId || body.user_id || req.user?.id || null;
        const staffName = body.staffName || body.staff_name || req.user?.fullName || 'Staff';
        const staffPhone = body.staffPhone || body.staff_phone || req.user?.phone || '';
        const customerPhone = normalizePhone(body.customerPhone || body.phone || 'Unknown');
        const customerName = body.customerName || body.name || 'Customer';
        const callType = String(body.callType || body.type || 'outgoing').toLowerCase();
        const outcome = body.outcome || 'Recording Uploaded';
        const notes = body.notes || 'Recorded mobile phone call';

        const insertSql = `
          INSERT INTO call_logs (
            id, user_id, staff_name, staff_phone,
            customer_phone, customer_name, call_type, call_status,
            duration_seconds, started_at, outcome, notes,
            recording_url, recording_file_name, recording_file_size,
            recording_duration, recording_mime_type, source, sync_status,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, 'completed',
            $8, now(), $9, $10,
            $11, $12, $13,
            $8, $14, 'mobile_app', 'synced',
            now(), now()
          ) RETURNING *
        `;
        const insertRes = await query(insertSql, [
          id, userId, staffName, staffPhone,
          customerPhone || 'Direct Call', customerName, callType,
          durationSeconds, outcome, notes,
          recordingUrl, fileName, fileSize,
          mimeType
        ]);
        callRow = insertRes.rows[0];
      }

      const formatted = formatCallRow(callRow);
      broadcastEvent('call:updated', formatted);

      res.status(201).json({ success: true, data: formatted });
    } catch (error) {
      next(error);
    }
  },

  streamRecording: (req, res) => {
    try {
      const { filename } = req.params;
      const safeFilename = path.basename(filename);
      const filePath = path.join(RECORDINGS_DIR, safeFilename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'Recording file not found' });
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      const ext = path.extname(safeFilename).toLowerCase();
      const mimeTypes = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.ogg': 'audio/ogg',
        '.amr': 'audio/amr',
        '.3gp': 'audio/3gpp',
        '.webm': 'audio/webm'
      };
      const contentType = mimeTypes[ext] || 'audio/mpeg';

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = end - start + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType
        });
        fileStream.pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Length': fileSize,
          'Accept-Ranges': 'bytes',
          'Content-Type': contentType
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  downloadRecording: (req, res) => {
    try {
      const { filename } = req.params;
      const safeFilename = path.basename(filename);
      const filePath = path.join(RECORDINGS_DIR, safeFilename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'Recording file not found' });
      }

      res.download(filePath, safeFilename);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  update: async (req, res, next) => {
    try {
      const { id } = req.params;
      const body = req.body || {};

      const fields = [];
      const values = [];

      if (body.notes !== undefined) {
        values.push(body.notes);
        fields.push(`notes = $${values.length}`);
      }
      if (body.outcome !== undefined) {
        values.push(body.outcome);
        fields.push(`outcome = $${values.length}`);
      }
      if (body.leadId !== undefined) {
        values.push(body.leadId || null);
        fields.push(`lead_id = $${values.length}`);
      }
      if (body.clientId !== undefined) {
        values.push(body.clientId || null);
        fields.push(`client_id = $${values.length}`);
      }
      if (body.customerName !== undefined) {
        values.push(body.customerName);
        fields.push(`customer_name = $${values.length}`);
      }

      if (!fields.length) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      values.push(id);
      const updateSql = `
        UPDATE call_logs
        SET ${fields.join(', ')}, updated_at = now()
        WHERE id = $${values.length}
        RETURNING *
      `;
      const result = await query(updateSql, values);
      if (!result.rows[0]) {
        return res.status(404).json({ success: false, message: 'Call log not found' });
      }

      const updated = formatCallRow(result.rows[0]);
      broadcastEvent('call:updated', updated);

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      const { id } = req.params;
      const findRes = await query('SELECT recording_file_name FROM call_logs WHERE id = $1', [id]);
      if (findRes.rows[0]?.recording_file_name) {
        const filePath = path.join(RECORDINGS_DIR, findRes.rows[0].recording_file_name);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (_) {}
        }
      }

      await query('DELETE FROM call_logs WHERE id = $1', [id]);
      broadcastEvent('call:deleted', { id });

      res.json({ success: true, message: 'Call log deleted successfully', id });
    } catch (error) {
      next(error);
    }
  }
};

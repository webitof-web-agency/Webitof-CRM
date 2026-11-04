const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { query } = require('../config/db');
const { createId, nowIso } = require('../utils/format');
const { hasPermission } = require('../middlewares/auth');
const { emitToPermission } = require('../services/socketHub.service');
const { AUDIO_TYPES, removeFileByRef, saveUpload } = require('../services/file.service');

const MAX_RECORDING_BYTES = 100 * 1024 * 1024;

const RECORDINGS_DIR = path.join(__dirname, '..', 'uploads', 'recordings');
const RECORDING_URL_TTL_SECONDS = 12 * 60 * 60;
const LOCAL_RECORDING_URL = /^\/api\/(?:call-logs|calls)\/recordings\/([^/?#]+)/;
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

// Recordings are stored through the active storage provider (local disk or Google Drive).
// Recordings saved before that stay in RECORDINGS_DIR and keep streaming from there.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECORDING_BYTES }
});

function normalizePhone(val) {
  if (!val) return '';
  return String(val).replace(/[^0-9+]/g, '').trim();
}

function safeRecordingFileName(value) {
  if (!value) return null;
  return path.basename(String(value)) || null;
}

// Recordings are fetched by <audio>/<a> tags that cannot send the Bearer header,
// so the API hands out short-lived HMAC-signed URLs instead of public paths.
function recordingSignature(fileName, expiresAt) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is missing in environment configuration.');
  }
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(`call-recording:${fileName}:${expiresAt}`)
    .digest('hex');
}

function signedRecordingUrl(fileName) {
  const safeName = safeRecordingFileName(fileName);
  const expiresAt = Math.floor(Date.now() / 1000) + RECORDING_URL_TTL_SECONDS;
  return `/api/call-logs/recordings/${encodeURIComponent(safeName)}?expires=${expiresAt}&signature=${recordingSignature(safeName, expiresAt)}`;
}

function hasValidRecordingSignature(fileName, params = {}) {
  const expiresAt = Number(params.expires);
  const signature = String(params.signature || '');
  if (!Number.isInteger(expiresAt) || expiresAt < Date.now() / 1000) return false;
  const expected = recordingSignature(fileName, expiresAt);
  return signature.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function recordingUrlFor(row) {
  const storedUrl = String(row.recording_url || '');
  const localMatch = storedUrl.match(LOCAL_RECORDING_URL);
  let fileName = row.recording_file_name || '';
  if (!fileName && localMatch) {
    try { fileName = decodeURIComponent(localMatch[1]); } catch (_) { fileName = localMatch[1]; }
  }
  if (fileName && (!storedUrl || localMatch)) return signedRecordingUrl(fileName);
  return storedUrl || null;
}

function canViewRecordings(user) {
  return hasPermission(user, 'calls.recording_view');
}

// Callers log calls as themselves; only super admins may attribute a call to another user.
function resolveCallOwner(req, body) {
  const requestedUserId = body.userId || body.user_id || null;
  if (req.user?.isSuperAdmin && requestedUserId && requestedUserId !== req.user.id) {
    return {
      userId: requestedUserId,
      staffName: body.staffName || body.staff_name || 'Staff',
      staffPhone: body.staffPhone || body.staff_phone || '',
      staffEmail: body.staffEmail || body.staff_email || ''
    };
  }
  return {
    userId: req.user?.id || null,
    staffName: req.user?.fullName || req.user?.username || 'Staff',
    staffPhone: req.user?.phone || '',
    staffEmail: req.user?.email || ''
  };
}

function canModifyCall(user, ownerId) {
  return Boolean(user?.isSuperAdmin) || String(ownerId || '') === String(user?.id || '');
}

// Matches on the last 10 digits (or the exact digits when shorter) so formatting
// differences like '+91 98765 43210' vs '+919876543210' still link the call.
async function findContactByPhone(customerPhone) {
  const digits = customerPhone.replace(/\D/g, '');
  if (!digits) return {};
  const useSuffix = digits.length >= 10;
  const key = useSuffix ? digits.slice(-10) : digits;
  const digitsExpr = (column) => {
    const cleaned = `regexp_replace(COALESCE(${column}, ''), '\\D', '', 'g')`;
    return useSuffix ? `RIGHT(${cleaned}, 10)` : cleaned;
  };

  const leadMatch = await query(
    `SELECT id, name FROM leads
     WHERE ${digitsExpr('phone')} = $1 OR ${digitsExpr('alternate_phone')} = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [key]
  );
  if (leadMatch.rows[0]) {
    return { leadId: leadMatch.rows[0].id, name: leadMatch.rows[0].name };
  }

  const clientMatch = await query(
    `SELECT id, name, company_name FROM clients
     WHERE ${digitsExpr('mobile')} = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [key]
  );
  if (clientMatch.rows[0]) {
    return { clientId: clientMatch.rows[0].id, name: clientMatch.rows[0].company_name || clientMatch.rows[0].name };
  }
  return {};
}

function emitCallEvent(eventName, row) {
  emitToPermission('calls.recording_view', eventName, formatCallRow(row, { canViewRecording: true }));
  emitToPermission('calls.read', eventName, formatCallRow(row, { canViewRecording: false }), {
    except: 'calls.recording_view'
  });
}

// Returns the on-disk path for a signed recording request, or sends the error response and returns null.
function resolveSignedRecording(req, res) {
  const safeFilename = safeRecordingFileName(req.params.filename);
  if (!safeFilename || !hasValidRecordingSignature(safeFilename, req.query)) {
    res.status(403).json({ success: false, message: 'Recording link is invalid or has expired' });
    return null;
  }

  const filePath = path.join(RECORDINGS_DIR, safeFilename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ success: false, message: 'Recording file not found' });
    return null;
  }
  return { filePath, safeFilename };
}

// Map db row to clean JSON
function formatCallRow(row, { canViewRecording = false } = {}) {
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
    recordingUrl: canViewRecording ? recordingUrlFor(row) : null,
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
      const canViewRecording = canViewRecordings(req.user);

      res.json({
        success: true,
        data: listRes.rows.map((row) => formatCallRow(row, { canViewRecording })),
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
      res.json({ success: true, data: formatCallRow(result.rows[0], { canViewRecording: canViewRecordings(req.user) }) });
    } catch (error) {
      next(error);
    }
  },

  create: async (req, res, next) => {
    try {
      const body = req.body || {};
      const id = body.id || body.clientReferenceId || createId('call');
      const { userId, staffName, staffPhone, staffEmail } = resolveCallOwner(req, body);

      const customerPhone = normalizePhone(body.customerPhone || body.phone || body.customer_phone);
      if (!customerPhone) {
        return res.status(400).json({ success: false, message: 'Customer phone number is required' });
      }

      let customerName = String(body.customerName || body.name || body.customer_name || '').trim();
      let leadId = body.leadId || body.lead_id || null;
      let clientId = body.clientId || body.client_id || null;

      // Auto-lookup matching lead or client by phone if not explicitly passed
      if (!leadId && !clientId) {
        const match = await findContactByPhone(customerPhone);
        leadId = match.leadId || null;
        clientId = match.clientId || null;
        if (!customerName && match.name) customerName = match.name;
      }

      const callType = String(body.callType || body.type || 'outgoing').toLowerCase();
      const callStatus = String(body.callStatus || body.status || 'completed').toLowerCase();
      const durationSeconds = Number(body.durationSeconds || body.duration_seconds || 0);
      const startedAt = body.startedAt || body.started_at ? new Date(body.startedAt || body.started_at) : new Date();
      // null (not '') so the ON CONFLICT COALESCE keeps existing values on re-sync.
      const outcome = body.outcome || body.callOutcome || null;
      const notes = body.notes || body.callNotes || null;
      const recordingUrl = body.recordingUrl || body.recording_url || null;
      const recordingFileName = safeRecordingFileName(body.recordingFileName || body.recording_file_name);
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
        WHERE call_logs.user_id IS NOT DISTINCT FROM EXCLUDED.user_id
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
      if (!result.rows[0]) {
        // The id already belongs to another user's call; the upsert's WHERE kept it untouched.
        return res.status(409).json({ success: false, message: 'A call with this id already exists for another user' });
      }

      emitCallEvent('call:created', result.rows[0]);

      res.status(201).json({
        success: true,
        data: formatCallRow(result.rows[0], { canViewRecording: canViewRecordings(req.user) })
      });
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

      const callId = body.callId || body.call_id || body.clientReferenceId;
      const targetCallId = callId || createId('call');

      // Check ownership before storing anything, so a rejected upload leaves no file behind.
      let previousAssetId = null;
      if (callId) {
        const existingRes = await query('SELECT user_id, recording_file_asset_id FROM call_logs WHERE id = $1', [callId]);
        if (existingRes.rows[0] && !canModifyCall(req.user, existingRes.rows[0].user_id)) {
          return res.status(403).json({ success: false, message: 'You can only attach recordings to your own calls' });
        }
        previousAssetId = existingRes.rows[0]?.recording_file_asset_id || null;
      }

      let stored = null;
      if (file) {
        stored = await saveUpload({
          buffer: file.buffer,
          originalName: file.originalname || 'recording.mp3',
          moduleName: 'calls',
          entityId: targetCallId,
          types: AUDIO_TYPES,
          maxBytes: MAX_RECORDING_BYTES
        });
      }

      const fileName = stored ? stored.storedName : (safeRecordingFileName(body.recordingFileName) || '');
      const fileSize = stored ? stored.sizeBytes : Number(body.recordingFileSize || 0);
      const mimeType = stored ? stored.mimeType : (body.recordingMimeType || 'audio/mp3');
      const recordingUrl = stored ? `${(process.env.API_PREFIX || '/api').replace(/\/+$/, '')}${stored.viewUrl}` : body.recordingUrl;
      const recordingFileAssetId = stored ? stored.id : null;
      const durationSeconds = Number(body.durationSeconds || body.duration_seconds || 0);

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
            recording_file_asset_id = $7,
            updated_at = now()
          WHERE id = $6
          RETURNING *
        `;
        const updateRes = await query(updateSql, [recordingUrl, fileName, fileSize, mimeType, durationSeconds, callId, recordingFileAssetId]);
        if (updateRes.rows[0]) {
          callRow = updateRes.rows[0];
          // The new recording replaced an earlier stored one.
          if (stored && previousAssetId && previousAssetId !== stored.id) {
            await removeFileByRef(previousAssetId);
          }
        }
      }

      if (!callRow) {
        // Create new call log with recording
        const id = targetCallId;
        const { userId, staffName, staffPhone } = resolveCallOwner(req, body);
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
            recording_file_asset_id, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, 'completed',
            $8, now(), $9, $10,
            $11, $12, $13,
            $8, $14, 'mobile_app', 'synced',
            $15, now(), now()
          ) RETURNING *
        `;
        const insertRes = await query(insertSql, [
          id, userId, staffName, staffPhone,
          customerPhone || 'Direct Call', customerName, callType,
          durationSeconds, outcome, notes,
          recordingUrl, fileName, fileSize,
          mimeType, recordingFileAssetId
        ]);
        callRow = insertRes.rows[0];
      }

      emitCallEvent('call:updated', callRow);

      res.status(201).json({
        success: true,
        data: formatCallRow(callRow, { canViewRecording: canViewRecordings(req.user) })
      });
    } catch (error) {
      next(error);
    }
  },

  streamRecording: (req, res) => {
    try {
      const recording = resolveSignedRecording(req, res);
      if (!recording) return undefined;
      const { filePath, safeFilename } = recording;

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
      const recording = resolveSignedRecording(req, res);
      if (!recording) return undefined;
      res.download(recording.filePath, recording.safeFilename);
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

      emitCallEvent('call:updated', result.rows[0]);

      res.json({
        success: true,
        data: formatCallRow(result.rows[0], { canViewRecording: canViewRecordings(req.user) })
      });
    } catch (error) {
      next(error);
    }
  },

  remove: async (req, res, next) => {
    try {
      const { id } = req.params;
      const findRes = await query('SELECT recording_file_name, recording_file_asset_id FROM call_logs WHERE id = $1', [id]);
      const storedFileName = findRes.rows[0]?.recording_file_name;
      if (findRes.rows[0]?.recording_file_asset_id) {
        await removeFileByRef(findRes.rows[0].recording_file_asset_id);
      } else if (storedFileName) {
        // recording_file_name can come from client input, so never let it escape RECORDINGS_DIR.
        const safeFileName = path.basename(String(storedFileName));
        const filePath = path.join(RECORDINGS_DIR, safeFileName);
        const sharedRes = await query(
          'SELECT 1 FROM call_logs WHERE recording_file_name = $1 AND id <> $2 LIMIT 1',
          [storedFileName, id]
        );
        if (!sharedRes.rows.length && fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (_) {}
        }
      }

      await query('DELETE FROM call_logs WHERE id = $1', [id]);
      emitToPermission('calls.read', 'call:deleted', { id });

      res.json({ success: true, message: 'Call log deleted successfully', id });
    } catch (error) {
      next(error);
    }
  }
};

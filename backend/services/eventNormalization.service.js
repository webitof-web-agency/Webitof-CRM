function normalizeIdList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalizeIdList(parsed);
    } catch {
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }

  return [];
}

function normalizeAttachmentList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const driveFileId = String(item.driveFileId || item.id || '').trim();
        if (!driveFileId) return null;
        return {
          id: item.id || driveFileId,
          driveFileId,
          name: item.name || item.originalName || 'File',
          originalName: item.originalName || item.name || 'File',
          driveWebViewLink: item.driveWebViewLink || item.webViewLink || '',
          mimeType: item.mimeType || ''
        };
      })
      .filter(Boolean);
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? normalizeAttachmentList(parsed) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeVisibility(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'only_me' || raw === 'onlyme') return 'only_me';
  if (raw === 'specific' || raw === 'specific_members' || raw === 'specific_members_and_teams') return 'specific';
  return 'all_team';
}

function normalizeScope(payload = {}, defaults = {}) {
  const defaultScopeType = String(defaults.defaultScopeType || '').trim().toLowerCase();
  const defaultScopeId = String(defaults.defaultScopeId || '').trim();

  const scopeType = String(payload.scopeType || '').trim().toLowerCase();
  const scopeId = String(payload.scopeId || '').trim();
  const leadId = String(payload.leadId || '').trim();
  const clientId = String(payload.clientId || '').trim();
  const projectId = String(payload.projectId || '').trim();

  const resolvedId = scopeId || leadId || clientId || projectId || defaultScopeId;
  const resolvedType = scopeType || defaultScopeType || 'global';

  if (resolvedType === 'lead' || leadId || defaultScopeType === 'lead') {
    return {
      scopeType: 'lead',
      scopeId: resolvedId,
      leadId: resolvedId,
      clientId: '',
      projectId: ''
    };
  }

  if (resolvedType === 'client' || clientId || defaultScopeType === 'client') {
    return {
      scopeType: 'client',
      scopeId: resolvedId,
      leadId: '',
      clientId: resolvedId,
      projectId: ''
    };
  }

  if (resolvedType === 'project' || projectId || defaultScopeType === 'project') {
    return {
      scopeType: 'project',
      scopeId: resolvedId,
      leadId: '',
      clientId: '',
      projectId: resolvedId
    };
  }

  return {
    scopeType: 'global',
    scopeId: '',
    leadId: '',
    clientId: '',
    projectId: ''
  };
}

function normalizeEventPayload(payload = {}, req, defaults = {}) {
  const {
    attachmentEntityId,
    uploadEntityId,
    ...rest
  } = payload || {};

  const scope = normalizeScope(payload, defaults);
  const visibility = normalizeVisibility(payload.visibility || payload.shareWith);
  const allowedUserIds = normalizeIdList(payload.allowedUserIds || payload.userIds || payload.memberIds);
  const allowedTeamIds = normalizeIdList(payload.allowedTeamIds || payload.teamIds);

  return {
    ...rest,
    leadId: scope.leadId || null,
    clientId: scope.clientId || null,
    projectId: scope.projectId || null,
    scopeType: scope.scopeType,
    scopeId: scope.scopeId || null,
    ownerUserId: String(payload.ownerUserId || req?.user?.id || '').trim() || null,
    visibility,
    allowedUserIds: visibility === 'specific' ? allowedUserIds : [],
    allowedTeamIds: visibility === 'specific' ? allowedTeamIds : [],
    eventType: String(payload.eventType || defaults.defaultEventType || 'event').trim().toLowerCase() || 'event',
    title: String(payload.title || '').trim(),
    description: String(payload.description || '').trim(),
    location: String(payload.location || '').trim(),
    labels: Array.isArray(payload.labels) ? payload.labels : [],
    attachments: normalizeAttachmentList(payload.attachments),
    color: String(payload.color || '#3b82f6').trim()
  };
}

function isVisibleToUser(event, user) {
  if (!event || !user) return false;
  if (user.isSuperAdmin) return true;
  if (String(event.ownerUserId || '') === String(user.id || '')) return true;

  const visibility = String(event.visibility || 'all_team').trim().toLowerCase();
  if (visibility === 'only_me') return false;
  if (visibility === 'all_team') return true;

  const allowedUsers = Array.isArray(event.allowedUserIds) ? event.allowedUserIds.map((item) => String(item)) : [];
  if (allowedUsers.includes(String(user.id || ''))) return true;

  const allowedTeams = Array.isArray(event.allowedTeamIds) ? event.allowedTeamIds.map((item) => String(item)) : [];
  if (allowedTeams.length) {
    const userRoles = Array.isArray(user.roles) ? user.roles : [];
    const userTeamTokens = [
      ...userRoles.map((role) => String(role.id || '').trim()).filter(Boolean),
      ...userRoles.map((role) => String(role.code || '').trim()).filter(Boolean),
      ...userRoles.map((role) => String(role.name || '').trim()).filter(Boolean)
    ];
    if (userTeamTokens.some((token) => allowedTeams.includes(token))) {
      return true;
    }
  }

  return false;
}

function isEventRecord(event) {
  return String(event?.eventType || '').toLowerCase() === 'event';
}

function getEventAttachmentContext(event = {}) {
  const scopeType = String(event.scopeType || '').toLowerCase();
  const scopeId = String(event.scopeId || event.leadId || event.clientId || event.projectId || event.id || '').trim();
  if (scopeType === 'lead') return { moduleName: 'leads', entityId: scopeId };
  if (scopeType === 'client') return { moduleName: 'clients', entityId: scopeId };
  if (scopeType === 'project') return { moduleName: 'projects', entityId: scopeId };
  return { moduleName: 'events', entityId: String(event.id || event.attachmentEntityId || scopeId || '').trim() };
}

module.exports = {
  getEventAttachmentContext,
  isEventRecord,
  isVisibleToUser,
  normalizeAttachmentList,
  normalizeEventPayload,
  normalizeIdList,
  normalizeScope,
  normalizeVisibility
};

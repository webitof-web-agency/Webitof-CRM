const { toIdList } = require('./leadPipelineAccess.service');

// Same idea as leads.view_all: without clients.view_all a user sees only the clients they are
// assigned to or manage. Inline permission check, like leadPipelineAccess, to stay off middlewares/auth.
function userCanViewAllClients(user) {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return Array.isArray(user.permissions) && user.permissions.includes('clients.view_all');
}

function isClientParticipant(user, client) {
  const userId = String(user?.id || '').trim();
  if (!userId || !client) return false;
  const ids = [client.assignedTo ?? client.assigned_to, ...toIdList(client.managers)];
  return ids.some((id) => String(id || '').trim() === userId);
}

function canAccessClient(user, client) {
  if (!user || !client) return false;
  return userCanViewAllClients(user) || isClientParticipant(user, client);
}

function filterClientsByAccess(rows = [], user = null) {
  if (userCanViewAllClients(user)) return rows;
  return rows.filter((row) => isClientParticipant(user, row));
}

module.exports = {
  canAccessClient,
  filterClientsByAccess,
  isClientParticipant,
  userCanViewAllClients
};

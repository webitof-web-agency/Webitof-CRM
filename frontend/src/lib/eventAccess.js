// Team-visible events can be seen by everyone, but the API only lets the owner (or a super admin)
// change them, so the edit and delete buttons are shown only to those people.
export function canModifyEvent(event, user) {
  if (!event || !user) return false;
  if (user.isSuperAdmin) return true;
  return String(event.ownerUserId || '') === String(user.id || '');
}

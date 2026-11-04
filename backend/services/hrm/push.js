// Firebase Cloud Messaging (HTTP v1) sender for the employee app.
// Optional: when FIREBASE_SERVICE_ACCOUNT_PATH is unset, pushes are skipped and
// the in-app notification row remains the source of truth.
const fs = require("node:fs");
const { query } = require("../../config/db");
let client = null;
let projectId = null;
let disabledReason = null;
function credentials() {
  if (client || disabledReason) return client;
  const file = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "").trim();
  if (!file || !fs.existsSync(file)) {
    disabledReason = "FIREBASE_SERVICE_ACCOUNT_PATH is not configured";
    return null;
  }
  const key = JSON.parse(fs.readFileSync(file, "utf8"));
  projectId = key.project_id;
  const { google } = require("googleapis");
  client = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });
  return client;
}
async function send(token, { title, body, data = {}, tag }) {
  const auth = credentials();
  if (!auth) return { sent: false, reason: disabledReason };
  const accessToken = await auth.getAccessToken();
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, String(v ?? "")]),
          ),
          android: {
            priority: "high",
            notification: {
              channel_id: "hrm_alerts",
              ...(tag ? { tag } : {}),
            },
          },
        },
      }),
    },
  );
  if (response.ok) return { sent: true };
  const error = await response.json().catch(() => ({}));
  const status = error?.error?.details?.[0]?.errorCode || error?.error?.status;
  // Uninstalled apps / rotated tokens: forget the device.
  if (["UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"].includes(status))
    await query("DELETE FROM hrm_devices WHERE token=$1", [token]);
  return { sent: false, reason: status || response.statusText };
}
async function pushToUser(userId, message) {
  if (!userId || !credentials()) return [];
  const devices = (
    await query("SELECT token FROM hrm_devices WHERE user_id=$1", [userId])
  ).rows;
  return Promise.all(
    devices.map((d) =>
      send(d.token, message).catch((e) => ({ sent: false, reason: e.message })),
    ),
  );
}
module.exports = { pushToUser, send };

// HRM app pushes go through the shared FCM sender (services/notify/push.service), which signs its
// own token, so the googleapis package is no longer needed. HRM notifications go to the HRM app only.
const push = require("../notify/push.service");

async function pushToUser(userId, message) {
  return push.pushToUser(userId, message, { apps: ["hrm"] });
}

async function send(token, message) {
  return push.sendToToken(token, { ...message, app: "hrm" });
}

module.exports = { pushToUser, send };

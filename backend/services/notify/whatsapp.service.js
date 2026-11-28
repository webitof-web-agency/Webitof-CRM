// WhatsApp Business messages through Meta's WhatsApp Cloud API (no middleman provider).
// Messages the business starts must use a template Meta has approved. One utility template serves
// every notification; set it up in WhatsApp Manager with 4 body variables, for example:
//   Name: erp_notification   Category: Utility   Language: English
//   Body: Hello {{1}}, {{2}}
//         {{3}}
//         Open: {{4}}
// Env (server): WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN (permanent system-user token),
// optional WHATSAPP_TEMPLATE_NAME (erp_notification), WHATSAPP_TEMPLATE_LANG (en),
// WHATSAPP_API_VERSION (v21.0), WHATSAPP_DEFAULT_COUNTRY_CODE (91).
// Until the number is added, every send is skipped with reason "not configured".

function config() {
  return {
    phoneNumberId: String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim(),
    accessToken: String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim(),
    templateName: String(process.env.WHATSAPP_TEMPLATE_NAME || 'erp_notification').trim(),
    templateLang: String(process.env.WHATSAPP_TEMPLATE_LANG || 'en').trim(),
    apiVersion: String(process.env.WHATSAPP_API_VERSION || 'v21.0').trim(),
    countryCode: String(process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '') || '91'
  };
}

function isConfigured() {
  const c = config();
  return Boolean(c.phoneNumberId && c.accessToken && c.templateName);
}

function status() {
  const c = config();
  const problems = [];
  if (!c.phoneNumberId) problems.push('WHATSAPP_PHONE_NUMBER_ID is not set');
  if (!c.accessToken) problems.push('WHATSAPP_ACCESS_TOKEN is not set');
  return { configured: problems.length === 0, problems, templateName: c.templateName, templateLang: c.templateLang };
}

// "98765 43210" / "+91 98765-43210" / "098765..." → "919876543210" ('' when it cannot be a phone number).
function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const { countryCode } = config();
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `${countryCode}${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : '';
}

// Template variables may not contain new lines, tabs or more than 4 spaces in a row.
function cleanParam(value, max = 900) {
  const text = String(value ?? '').replace(/[\r\n\t]+/g, ' | ').replace(/ {2,}/g, ' ').trim();
  return (text || '-').slice(0, max);
}

async function sendTemplate({ to, params = [] }) {
  if (!isConfigured()) return { sent: false, reason: 'WhatsApp is not configured' };
  const number = normalizePhone(to);
  if (!number) return { sent: false, reason: 'No valid WhatsApp number' };
  const c = config();
  const response = await fetch(`https://graph.facebook.com/${c.apiVersion}/${c.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: number,
      type: 'template',
      template: {
        name: c.templateName,
        language: { code: c.templateLang },
        components: [{
          type: 'body',
          parameters: params.slice(0, 4).map((value) => ({ type: 'text', text: cleanParam(value) }))
        }]
      }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { sent: false, reason: String(data?.error?.message || response.statusText || 'WhatsApp send failed').slice(0, 300) };
  }
  return { sent: true, messageId: data?.messages?.[0]?.id || '', to: number };
}

// The four template variables from a notification: greeting name, headline, details, link.
function notificationParams({ name, title, message, details = [], link = '' }) {
  const detailText = [message, ...details.map((row) => `${row.label}: ${row.value}`)].filter(Boolean).join(' | ');
  return [name || 'there', title, detailText, link || '-'];
}

module.exports = { cleanParam, isConfigured, normalizePhone, notificationParams, sendTemplate, status };

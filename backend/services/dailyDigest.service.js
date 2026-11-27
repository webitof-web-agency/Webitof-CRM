// Morning summary email for admins: yesterday's money, what is late, today's list and the health
// score, built from the same business dashboard the page shows. Sent once per IST day at or after
// DAILY_DIGEST_HOUR_IST (default 9) from the noreply mailbox; DAILY_DIGEST_ENABLED=false turns it off.
const { getSetting, setSetting } = require('../models/systemSetting.model');
const { businessDate } = require('../utils/format');

const STATE_KEY = 'daily_digest';
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const inr = (value) => {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
};
const ok = (block) => block && !block.error;

function dashboardUrl() {
  const base = [process.env.FRONTEND_URL, process.env.APP_PUBLIC_URL, process.env.PUBLIC_APP_URL].map((v) => String(v || '').trim()).find(Boolean);
  return base ? `${base.replace(/\/$/, '')}/#/app/dashboard` : '';
}

function tile(label, value, note = '', tone = '#0f172a') {
  return `<td style="padding:6px;width:25%;vertical-align:top"><div style="border:1px solid #e2e8f0;border-radius:12px;padding:12px">
    <div style="font-size:11px;color:#64748b">${esc(label)}</div>
    <div style="font-size:18px;font-weight:700;color:${tone};margin-top:4px">${esc(value)}</div>
    ${note ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${esc(note)}</div>` : ''}
  </div></td>`;
}

function section(title, rows) {
  if (!rows.length) return '';
  return `<h3 style="font-size:14px;margin:20px 0 8px;color:#0f172a">${esc(title)}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px">${rows
      .map(([left, right]) => `<tr><td style="padding:6px 0;border-bottom:1px solid #f1f5f9;color:#0f172a">${left}</td><td style="padding:6px 0;border-bottom:1px solid #f1f5f9;text-align:right;color:#475569;white-space:nowrap">${right}</td></tr>`)
      .join('')}</table>`;
}

// The email for one admin. Exported for tests and the preview route.
function buildDigest(data, user) {
  const m = ok(data.money) ? data.money : null;
  const f = ok(data.followUps) ? data.followUps : null;
  const leads = ok(data.leads) ? data.leads : null;
  const hrm = ok(data.hrm) ? data.hrm : null;
  const health = data.health;
  const date = new Date(`${data.today}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  const tiles = [
    m ? tile('Received this month', inr(m.receivedThisMonth), `Today ${inr(m.receivedToday)}`) : '',
    m ? tile('Profit this month', inr(m.profitThisMonth), `Revenue ${inr(m.revenueThisMonth)}`, m.profitThisMonth < 0 ? '#dc2626' : '#16a34a') : '',
    m ? tile('Outstanding', inr(m.outstanding), `${inr(m.overdueOutstanding)} overdue`, m.overdueOutstanding ? '#d97706' : '#0f172a') : '',
    leads ? tile('New leads', String(leads.newThisMonth), `${leads.newToday} today · ${leads.open} open`) : '',
    f ? tile('Late follow-ups', String(f.overdue), `${f.dueToday} due today`, f.overdue ? '#dc2626' : '#16a34a') : '',
    hrm?.attendance ? tile('Present today', `${hrm.attendance.counts?.present || 0} / ${hrm.attendance.total || 0}`, `${hrm.attendance.counts?.late || 0} late`) : '',
    m?.dueThisWeek ? tile('Due this week', inr(m.dueThisWeek.total), `${m.dueThisWeek.count} invoices`) : '',
    health?.score != null ? tile('Health score', `${health.score}/100`, health.grade, health.score >= 80 ? '#16a34a' : health.score >= 60 ? '#d97706' : '#dc2626') : ''
  ].filter(Boolean);
  const tileRows = [];
  for (let i = 0; i < tiles.length; i += 4) tileRows.push(`<tr>${tiles.slice(i, i + 4).join('')}</tr>`);

  const todayRows = (data.todayList || []).map((item) => [`<b>${esc(item.kind)}</b> · ${esc(item.title)}${item.sub ? `<br><span style="color:#64748b;font-size:12px">${esc(item.sub)}</span>` : ''}`, esc(item.time || '')]);
  const lateRows = (f?.overdueItems || []).map((item) => [`${esc(item.title)}<br><span style="color:#64748b;font-size:12px">${esc([item.related, item.assignedTo].filter(Boolean).join(' · '))}</span>`, esc(new Date(item.dueAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }))]);
  const attention = [];
  if (hrm?.approvals?.total) attention.push([`${hrm.approvals.total} HR request(s) waiting for approval`, '']);
  if (hrm?.alerts?.total) attention.push([`${hrm.alerts.total} attendance alert(s) open`, '']);
  if (ok(data.sales) && data.sales.noNextStep?.count) attention.push([`${data.sales.noNextStep.count} open lead(s) with no next follow-up`, '']);
  if (m?.gst && m.gst.net > 0 && m.gst.daysLeft <= 10) attention.push([`GST ${inr(m.gst.net)} for ${esc(m.gst.month)} due on ${esc(m.gst.dueDate)}`, `${m.gst.daysLeft} days`]);
  if (ok(data.system) && data.system.backup && !data.system.backup.healthy) attention.push([`Database backup needs attention: ${esc(data.system.backup.problem || 'last backup failed')}`, '']);
  (health?.parts || []).filter((part) => part.score < 60).forEach((part) => attention.push([`Low: ${esc(part.label)}`, `${part.score}/100`]));

  const link = dashboardUrl();
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:680px;margin:0 auto;color:#0f172a">
    <div style="background:linear-gradient(135deg,#4f46e5,#0ea5e9);border-radius:16px;padding:20px;color:#fff">
      <div style="font-size:13px;opacity:.9">${esc(date)}</div>
      <div style="font-size:20px;font-weight:700;margin-top:4px">Good morning${user?.fullName ? `, ${esc(user.fullName.split(' ')[0])}` : ''}</div>
      <div style="font-size:13px;opacity:.9;margin-top:2px">Here is your business at a glance.</div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:10px">${tileRows.join('')}</table>
    ${section('Needs your attention', attention)}
    ${section("Today's list", todayRows)}
    ${section('Late follow-ups', lateRows)}
    ${link ? `<p style="margin-top:24px"><a href="${esc(link)}" style="background:#4f46e5;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none;font-weight:600">Open the dashboard</a></p>` : ''}
    <p style="font-size:11px;color:#94a3b8;margin-top:24px">Sent every morning to admins. Turn it off with DAILY_DIGEST_ENABLED=false.</p>
  </div>`;
  const text = [
    `Business summary · ${date}`,
    m ? `Received this month ${inr(m.receivedThisMonth)} · profit ${inr(m.profitThisMonth)} · outstanding ${inr(m.outstanding)}` : '',
    leads ? `New leads this month ${leads.newThisMonth}` : '',
    f ? `Late follow-ups ${f.overdue}, due today ${f.dueToday}` : '',
    ...attention.map(([left]) => `• ${left.replace(/<[^>]+>/g, '')}`),
    link
  ].filter(Boolean).join('\n');
  return { subject: `Business summary · ${date}`, html, text };
}

async function adminUsers() {
  const { listUsers } = require('./auth.service');
  const users = await listUsers();
  return users.filter((user) => user?.isActive !== false && user.email && (user.isSuperAdmin || (user.roles || []).some((role) => String(role.code).toLowerCase() === 'admin')));
}

async function sendDigest({ users = null, force = false } = {}) {
  const { businessDashboard } = require('./businessDashboard.service');
  const { sendMail } = require('./mailer.service');
  const recipients = users || (await adminUsers());
  let sent = 0;
  const failed = [];
  for (const user of recipients) {
    try {
      const data = await businessDashboard(user, { period: 'month' });
      const mail = buildDigest(data, user);
      const result = await sendMail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text, mailType: 'staff_notification' });
      if (result?.sent === false) failed.push(user.email);
      else sent += 1;
    } catch (error) {
      console.error(`Daily summary to ${user.email} failed:`, error.message);
      failed.push(user.email);
    }
  }
  if (!force) await setSetting(STATE_KEY, { lastSentDate: businessDate(), sent, failed: failed.length });
  return { sent, failed };
}

// Called every 15 minutes by the scheduler: sends once per IST day after the configured hour.
async function runDigestIfDue(now = new Date()) {
  if (String(process.env.DAILY_DIGEST_ENABLED || 'true').toLowerCase() === 'false') return { status: 'DISABLED' };
  const hour = Number(process.env.DAILY_DIGEST_HOUR_IST || 9);
  const istHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(now));
  if (istHour < hour) return { status: 'WAITING' };
  const state = await getSetting(STATE_KEY, {});
  if (state.lastSentDate === businessDate()) return { status: 'ALREADY_SENT' };
  // Record first so two server instances (or a slow send) never mail twice.
  await setSetting(STATE_KEY, { ...state, lastSentDate: businessDate(), startedAt: now.toISOString() });
  const result = await sendDigest({ force: true });
  await setSetting(STATE_KEY, { lastSentDate: businessDate(), sent: result.sent, failed: result.failed.length });
  return { status: 'SENT', ...result };
}

module.exports = { buildDigest, sendDigest, runDigestIfDue };

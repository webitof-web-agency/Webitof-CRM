import { useEffect, useState } from 'react';
import { BellRing, Loader2, Mail, MessageCircle, Save, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const CHANNELS = [
  { key: 'push', label: 'App', icon: Smartphone, statusKey: 'push', off: 'Phone push is not set up on the server yet (Firebase).' },
  { key: 'email', label: 'Email', icon: Mail, statusKey: 'email', off: 'Email is not set up on the server yet (SMTP).' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, statusKey: 'whatsapp', off: 'WhatsApp Business number is not added on the server yet; messages start once it is.' }
];

// Profile → which channels each kind of notification reaches me on. The in-app bell always gets it.
export function NotificationPreferencesCard() {
  const { token, user } = useAuth();
  const [data, setData] = useState(null);
  const [channels, setChannels] = useState({});
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;
    api.notificationPreferences.get(token)
      .then((response) => {
        if (!active) return;
        setData(response.data);
        setChannels(response.data.channels || {});
        setWhatsappNumber(response.data.whatsappNumber || '');
      })
      .catch((error) => toast.error(error.message || 'Could not load notification settings'));
    return () => { active = false; };
  }, [token]);

  function toggle(category, channel) {
    setDirty(true);
    setChannels((current) => ({
      ...current,
      [category]: { ...(current[category] || {}), [channel]: !current?.[category]?.[channel] }
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await api.notificationPreferences.save(token, { channels, whatsappNumber });
      setData(response.data);
      setChannels(response.data.channels || {});
      setDirty(false);
      toast.success('Notification settings saved');
    } catch (error) {
      toast.error(error.message || 'Could not save notification settings');
    } finally {
      setSaving(false);
    }
  }

  const status = data?.channelStatus || {};
  const notReady = CHANNELS.filter((channel) => status[channel.statusKey] && !status[channel.statusKey].configured);

  return (
    <Card className="p-6 shadow-sm h-full flex flex-col">
      <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="flex h-10 w-10 items-center justify-center bg-violet-50 text-violet-600" style={{ borderRadius: 'var(--radius-button, 0.5rem)' }}>
          <BellRing size={20} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Notifications</h3>
          <p className="text-sm text-slate-500">Choose where each kind of update reaches you. The bell in the ERP always shows everything.</p>
        </div>
      </div>

      {!data ? (
        <div className="flex flex-1 items-center justify-center py-8 text-sm text-slate-500"><Loader2 size={16} className="mr-2 animate-spin" /> Loading…</div>
      ) : (
        <div className="flex flex-1 flex-col gap-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="pb-2 font-semibold">Kind of update</th>
                  {CHANNELS.map((channel) => {
                    const Icon = channel.icon;
                    return (
                      <th key={channel.key} className="pb-2 text-center font-semibold">
                        <span className="inline-flex items-center gap-1"><Icon size={13} /> {channel.label}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(data.categories || []).map((category) => (
                  <tr key={category.key} className="border-t border-slate-100">
                    <td className="py-2.5 pr-3">
                      <span className="block font-semibold text-slate-800">{category.label}</span>
                      <span className="block text-xs text-slate-500">{category.description}</span>
                    </td>
                    {CHANNELS.map((channel) => (
                      <td key={channel.key} className="py-2.5 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
                          checked={Boolean(channels?.[category.key]?.[channel.key])}
                          onChange={() => toggle(category.key, channel.key)}
                          aria-label={`${category.label} on ${channel.label}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">WhatsApp number</label>
            <Input
              type="tel"
              value={whatsappNumber}
              onChange={(event) => { setWhatsappNumber(event.target.value); setDirty(true); }}
              placeholder={user?.phone ? `Profile phone is used: ${user.phone}` : '+91 98765 43210'}
            />
            <p className="text-xs text-slate-500">Leave empty to use the phone number in your profile.</p>
          </div>

          {notReady.length ? (
            <ul className="space-y-1 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-800">
              {notReady.map((channel) => <li key={channel.key}>• {channel.off}</li>)}
            </ul>
          ) : null}

          <div className="mt-auto flex justify-end pt-2">
            <Button onClick={save} loading={saving} disabled={!dirty} className="gap-2">
              <Save size={16} /> Save notification settings
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

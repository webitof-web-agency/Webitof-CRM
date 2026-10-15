import { useEffect, useState, useRef, useMemo } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Play,
  Pause,
  Download,
  Search,
  Clock,
  Headphones,
  MessageSquare,
  Copy,
  Check,
  Trash2,
  Plus,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  UsersRound,
  LayoutList,
  Mic
} from 'lucide-react';
import { toast } from 'sonner';
import { api, API_BASE_URL } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { cn } from '../../lib/cn';

function formatDuration(seconds = 0) {
  const s = Math.max(0, parseInt(seconds, 10) || 0);
  if (s === 0) return '0s';
  const mins = Math.floor(s / 60);
  const remSecs = s % 60;
  if (mins === 0) return `${remSecs}s`;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }
  return `${mins}m ${remSecs > 0 ? `${remSecs}s` : ''}`.trim();
}

function formatClockTime(seconds = 0) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
}

function formatExactDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getPageNumbers(current, total) {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('...');
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push('...');
  pages.push(total);
  return pages;
}

// Compact Custom Inline Audio Player that fits comfortably inside 130px
function CompactAudioPlayer({ url, fileName, durationSeconds = 0 }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef(null);
  const progressBarRef = useRef(null);

  const fullAudioUrl = useMemo(() => {
    if (!url) return '';
    return url.startsWith('http')
      ? url
      : `${API_BASE_URL.replace(/\/api\/?$/, '')}${url}`;
  }, [url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const handleError = () => {
      setHasError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const togglePlay = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setHasError(true);
          toast.error('Unable to play recording');
        });
    }
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const audio = audioRef.current;
    const bar = progressBarRef.current;
    if (!audio || !bar) return;
    const rect = bar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const targetRatio = Math.max(0, Math.min(1, clickX / width));
    const seekTime = targetRatio * (duration || 1);
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  if (hasError) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">
        <AlertCircle size={10} className="shrink-0" />
        Audio error
      </span>
    );
  }

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] shadow-2xs hover:border-[var(--primary)]/30 transition-all select-none max-w-full"
    >
      <audio ref={audioRef} src={fullAudioUrl} preload="metadata" />

      {/* Mini Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-xs",
          isPlaying
            ? "bg-amber-500 hover:bg-amber-600 text-white animate-pulse"
            : "bg-[var(--primary)] hover:brightness-110 text-white"
        )}
        title={isPlaying ? "Pause" : "Play recording"}
      >
        {isPlaying ? <Pause size={9} /> : <Play size={9} className="ml-0.5" />}
      </button>

      {/* Interactive Slim Progress Bar */}
      <div
        ref={progressBarRef}
        onClick={handleSeek}
        className="w-12 sm:w-14 h-1.5 bg-slate-200 dark:bg-slate-700/80 rounded-full cursor-pointer relative overflow-hidden group shrink-0"
        title="Click to seek"
      >
        <div
          className="h-full bg-[var(--primary)] rounded-full transition-[width] duration-75 group-hover:brightness-110"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Clean Monospace Time */}
      <span className="text-[9px] font-mono font-medium text-[var(--text-muted)] whitespace-nowrap">
        {formatClockTime(currentTime)}/{formatClockTime(duration)}
      </span>

      {/* Download Action */}
      <a
        href={fullAudioUrl}
        download={fileName || 'call-recording.wav'}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-0.5 rounded transition-colors shrink-0"
        title="Download recording"
      >
        <Download size={11} />
      </a>
    </div>
  );
}

export function CallHistoryPage() {
  const { token } = useAuth();
  const { socket } = useNotifications();

  // State
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState({
    totalCalls: 0,
    outgoingCalls: 0,
    incomingCalls: 0,
    missedCalls: 0,
    rejectedCalls: 0,
    totalDurationSeconds: 0,
    withRecordingCount: 0
  });
  const [staffStats, setStaffStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('calls'); // 'calls' | 'staff'

  // Filters & Pagination
  const [search, setSearch] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  const [callType, setCallType] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [recordingOnly, setRecordingOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // UI helpers
  const [copiedPhone, setCopiedPhone] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);

  // New call modal form
  const [formData, setFormData] = useState({
    customerPhone: '',
    customerName: '',
    callType: 'outgoing',
    durationSeconds: 120,
    outcome: 'Connected',
    notes: '',
    recordingFile: null
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch calls data
  const fetchCalls = async (showSpinner = true) => {
    if (!token) return;
    if (showSpinner) setLoading(true);
    try {
      const queryParams = {
        search,
        userId: selectedStaff,
        callType: callType === 'all' ? '' : callType,
        dateRange: dateRange === 'all' ? '' : dateRange,
        hasRecording: recordingOnly ? 'true' : '',
        page,
        limit: pageSize
      };

      const [res, statsRes] = await Promise.all([
        api.callLogs.list(token, queryParams),
        api.callLogs.stats(token)
      ]);

      if (res?.success) {
        setCalls(res.data || []);
        if (res.stats) setStats(res.stats);
        if (res.pagination) setPagination(res.pagination);
      }

      if (statsRes?.success && statsRes.data) {
        setStaffStats(statsRes.data.staff || []);
      }
    } catch (err) {
      console.error('Failed to load call history:', err);
      toast.error('Failed to load call history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [token, selectedStaff, callType, dateRange, recordingOnly, page, pageSize]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchCalls();
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Real-time socket events
  useEffect(() => {
    if (!socket) return;

    const handleCallCreated = (newCall) => {
      if (!newCall?.id) return;
      toast.info(`📞 New ${newCall.callType} call from ${newCall.staffName || 'Staff'}`, {
        description: `${newCall.customerName || 'Customer'} (${newCall.customerPhone})`
      });
      setCalls((prev) => [newCall, ...prev.filter((c) => c.id !== newCall.id)]);
      setStats((prev) => ({
        ...prev,
        totalCalls: prev.totalCalls + 1,
        outgoingCalls: newCall.callType === 'outgoing' ? prev.outgoingCalls + 1 : prev.outgoingCalls,
        incomingCalls: newCall.callType === 'incoming' ? prev.incomingCalls + 1 : prev.incomingCalls,
        missedCalls: newCall.callType === 'missed' ? prev.missedCalls + 1 : prev.missedCalls,
        totalDurationSeconds: prev.totalDurationSeconds + (newCall.durationSeconds || 0),
        withRecordingCount: newCall.recordingUrl ? prev.withRecordingCount + 1 : prev.withRecordingCount
      }));
    };

    const handleCallUpdated = (updatedCall) => {
      if (!updatedCall?.id) return;
      setCalls((prev) =>
        prev.map((c) => (c.id === updatedCall.id ? { ...c, ...updatedCall } : c))
      );
    };

    const handleCallDeleted = ({ id }) => {
      if (!id) return;
      setCalls((prev) => prev.filter((c) => c.id !== id));
    };

    socket.on('call:created', handleCallCreated);
    socket.on('call:updated', handleCallUpdated);
    socket.on('call:deleted', handleCallDeleted);

    return () => {
      socket.off('call:created', handleCallCreated);
      socket.off('call:updated', handleCallUpdated);
      socket.off('call:deleted', handleCallDeleted);
    };
  }, [socket]);

  // Copy phone helper
  const copyToClipboard = (phone) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    toast.success('Phone copied to clipboard');
    setTimeout(() => setCopiedPhone(null), 1800);
  };

  // CSV export
  const handleExportCsv = () => {
    if (!calls.length) {
      toast.error('No calls to export');
      return;
    }
    const headers = [
      'Call ID',
      'Staff',
      'Staff Phone',
      'Customer',
      'Customer Phone',
      'Type',
      'Duration (sec)',
      'Talk Time',
      'Started At',
      'Outcome',
      'Notes',
      'Has Recording'
    ];
    const rows = calls.map((c) => [
      `"${c.id}"`,
      `"${c.staffName || ''}"`,
      `"${c.staffPhone || ''}"`,
      `"${c.customerName || ''}"`,
      `"${c.customerPhone || ''}"`,
      `"${c.callType || ''}"`,
      c.durationSeconds || 0,
      `"${formatDuration(c.durationSeconds)}"`,
      `"${c.startedAt || ''}"`,
      `"${c.outcome || ''}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
      c.recordingUrl ? 'Yes' : 'No'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Webitof_Call_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported to CSV');
  };

  // Create call log modal submission
  const handleCreateCall = async (e) => {
    e.preventDefault();
    if (!formData.customerPhone.trim()) {
      toast.error('Customer phone number is required');
      return;
    }

    setSubmitting(true);
    try {
      if (formData.recordingFile) {
        const data = new FormData();
        data.append('recording', formData.recordingFile);
        data.append('customerPhone', formData.customerPhone);
        data.append('customerName', formData.customerName || 'Customer');
        data.append('callType', formData.callType);
        data.append('durationSeconds', formData.durationSeconds);
        data.append('outcome', formData.outcome);
        data.append('notes', formData.notes);
        await api.callLogs.uploadRecording(token, data);
      } else {
        await api.callLogs.create(token, {
          customerPhone: formData.customerPhone,
          customerName: formData.customerName,
          callType: formData.callType,
          durationSeconds: Number(formData.durationSeconds || 0),
          outcome: formData.outcome,
          notes: formData.notes
        });
      }

      toast.success('Call log saved & synced');
      setShowLogModal(false);
      setFormData({
        customerPhone: '',
        customerName: '',
        callType: 'outgoing',
        durationSeconds: 120,
        outcome: 'Connected',
        notes: '',
        recordingFile: null
      });
      fetchCalls(false);
    } catch (err) {
      toast.error(err.message || 'Failed to save call');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete call log
  const handleDeleteCall = async (id) => {
    if (!window.confirm('Delete this call log?')) return;
    try {
      await api.callLogs.remove(token, id);
      toast.success('Call log deleted');
      setCalls((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      toast.error('Failed to delete call log');
    }
  };

  // Render call type badge micro pill
  const renderCallTypeBadge = (type) => {
    const t = String(type || '').toLowerCase();
    if (t === 'outgoing') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/25 whitespace-nowrap">
          <PhoneOutgoing size={10} className="shrink-0" />
          Outgoing
        </span>
      );
    }
    if (t === 'incoming') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 whitespace-nowrap">
          <PhoneIncoming size={10} className="shrink-0" />
          Incoming
        </span>
      );
    }
    if (t === 'missed') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 whitespace-nowrap">
          <PhoneMissed size={10} className="shrink-0" />
          Missed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/25 whitespace-nowrap">
        <PhoneOff size={10} className="shrink-0" />
        Rejected
      </span>
    );
  };

  const hasActiveFilters = Boolean(
    search || selectedStaff || (callType && callType !== 'all') || (dateRange && dateRange !== 'all') || recordingOnly
  );

  const clearFilters = () => {
    setSearch('');
    setSelectedStaff('');
    setCallType('all');
    setDateRange('all');
    setRecordingOnly(false);
    setPage(1);
  };

  const totalPages = Math.max(1, pagination.totalPages || 1);
  const startItem = pagination.total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, pagination.total);

  return (
    <div className="space-y-3.5">
      {/* 1. Top Row: 6 KPI Cards on Left + Action Buttons on Right (Exact CRM Pattern) */}
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        {/* 6 Compact KPI Cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:items-center xl:gap-2 flex-1">
          {/* Total Calls */}
          <div
            onClick={() => { setCallType('all'); setRecordingOnly(false); setPage(1); }}
            className={cn(
              "group relative flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-2.5 py-1.5 transition-all duration-150 hover:shadow-xs cursor-pointer select-none",
              callType === 'all' && !recordingOnly
                ? "border-[var(--primary)]/40 ring-2 ring-[var(--primary)]/15 bg-[var(--primary)]/5"
                : "border-[var(--border)] hover:border-slate-300 dark:hover:border-slate-700"
            )}
            title="Show all calls"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform shrink-0">
              <PhoneCall size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">Total</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-black tracking-tight text-[var(--text-main)]">{stats.totalCalls}</span>
                <span className="text-[9px] text-slate-400 font-medium truncate">calls</span>
              </div>
            </div>
          </div>

          {/* Outgoing */}
          <div
            onClick={() => { setCallType('outgoing'); setPage(1); }}
            className={cn(
              "group relative flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-2.5 py-1.5 transition-all duration-150 hover:shadow-xs cursor-pointer select-none",
              callType === 'outgoing'
                ? "border-sky-500/40 ring-2 ring-sky-500/15 bg-sky-500/5"
                : "border-[var(--border)] hover:border-sky-200 dark:hover:border-sky-900/50"
            )}
            title="Filter outgoing calls"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform shrink-0">
              <PhoneOutgoing size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">Outgoing</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-black tracking-tight text-sky-600 dark:text-sky-400">{stats.outgoingCalls}</span>
                <span className="text-[9px] text-slate-400 font-medium truncate">dialed</span>
              </div>
            </div>
          </div>

          {/* Incoming */}
          <div
            onClick={() => { setCallType('incoming'); setPage(1); }}
            className={cn(
              "group relative flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-2.5 py-1.5 transition-all duration-150 hover:shadow-xs cursor-pointer select-none",
              callType === 'incoming'
                ? "border-emerald-500/40 ring-2 ring-emerald-500/15 bg-emerald-500/5"
                : "border-[var(--border)] hover:border-emerald-200 dark:hover:border-emerald-900/50"
            )}
            title="Filter incoming calls"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
              <PhoneIncoming size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">Incoming</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-black tracking-tight text-emerald-600 dark:text-emerald-400">{stats.incomingCalls}</span>
                <span className="text-[9px] text-slate-400 font-medium truncate">received</span>
              </div>
            </div>
          </div>

          {/* Missed */}
          <div
            onClick={() => { setCallType('missed'); setPage(1); }}
            className={cn(
              "group relative flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-2.5 py-1.5 transition-all duration-150 hover:shadow-xs cursor-pointer select-none",
              callType === 'missed'
                ? "border-rose-500/40 ring-2 ring-rose-500/15 bg-rose-500/5"
                : "border-[var(--border)] hover:border-rose-200 dark:hover:border-rose-900/50"
            )}
            title="Filter missed calls"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform shrink-0">
              <PhoneMissed size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">Missed</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-black tracking-tight text-rose-600 dark:text-rose-400">{stats.missedCalls}</span>
                <span className="text-[9px] text-slate-400 font-medium truncate">lost</span>
              </div>
            </div>
          </div>

          {/* Talk Time */}
          <div
            className="group relative flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 transition-all duration-150 hover:shadow-xs select-none"
            title="Total staff call duration"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform shrink-0">
              <Clock size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">Talk Time</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-black tracking-tight text-amber-600 dark:text-amber-400 truncate">
                  {formatDuration(stats.totalDurationSeconds)}
                </span>
              </div>
            </div>
          </div>

          {/* Recordings */}
          <div
            onClick={() => { setRecordingOnly((v) => !v); setPage(1); }}
            className={cn(
              "group relative flex items-center gap-2 rounded-2xl border bg-[var(--surface)] px-2.5 py-1.5 transition-all duration-150 hover:shadow-xs cursor-pointer select-none",
              recordingOnly
                ? "border-indigo-500/40 ring-2 ring-indigo-500/15 bg-indigo-500/5"
                : "border-[var(--border)] hover:border-indigo-200 dark:hover:border-indigo-900/50"
            )}
            title="Filter calls with audio recording"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform shrink-0">
              <Headphones size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-muted)] truncate leading-tight">Recordings</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-black tracking-tight text-indigo-600 dark:text-indigo-400">{stats.withRecordingCount}</span>
                <span className="text-[9px] text-slate-400 font-medium truncate">audios</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons on Right in Same Row */}
        <div className="flex items-center gap-1.5 shrink-0 self-end xl:self-center">
          {/* Live Sync Badge */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 select-none">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>Live Sync</span>
          </div>

          {/* Refresh Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshing(true);
              fetchCalls(false);
            }}
            disabled={refreshing}
            className="!rounded-xl h-8 px-2.5 gap-1.5 text-xs text-[var(--text-main)] hover:bg-[var(--surface-2)] cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw size={13} className={cn(refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {/* Export CSV Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            className="!rounded-xl h-8 px-2.5 gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer"
            title="Export calls to CSV"
          >
            <FileSpreadsheet size={13} />
            <span className="hidden sm:inline">Export</span>
          </Button>

          {/* Log Call Button */}
          <Button
            type="button"
            size="sm"
            onClick={() => setShowLogModal(true)}
            className="!rounded-xl h-8 px-3 gap-1.5 text-xs font-bold shadow-2xs bg-[var(--primary)] text-white hover:brightness-105 transition-all cursor-pointer"
            title="Manually log call or upload recording"
          >
            <Plus size={14} />
            <span>Log Call</span>
          </Button>
        </div>
      </div>

      {/* 3. Compact Filter & Search Toolbar */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-2xs backdrop-blur-xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
          {/* Tab Switcher */}
          <div className="flex bg-[var(--surface-2)] p-0.5 border border-[var(--border)] h-8 rounded-xl items-center shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('calls')}
              className={cn(
                'h-7 px-2.5 text-xs font-semibold transition-all flex items-center gap-1.5 rounded-lg cursor-pointer select-none',
                activeTab === 'calls'
                  ? 'bg-[var(--surface)] text-[var(--primary)] font-bold shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              )}
            >
              <LayoutList size={13} />
              <span>Calls ({pagination.total})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('staff')}
              className={cn(
                'h-7 px-2.5 text-xs font-semibold transition-all flex items-center gap-1.5 rounded-lg cursor-pointer select-none',
                activeTab === 'staff'
                  ? 'bg-[var(--surface)] text-[var(--primary)] font-bold shadow-2xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              )}
            >
              <UsersRound size={13} />
              <span>Staff ({staffStats.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[150px] sm:min-w-[190px] flex-1 max-w-xs">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search phone, name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-6 h-8 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Staff Filter Dropdown */}
          <select
            value={selectedStaff}
            onChange={(e) => {
              setSelectedStaff(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer"
          >
            <option value="">All Staff</option>
            {staffStats.map((s) => (
              <option key={s.userId || s.staffName} value={s.userId || ''}>
                {s.staffName} ({s.totalCalls})
              </option>
            ))}
          </select>

          {/* Call Type Dropdown */}
          <select
            value={callType}
            onChange={(e) => {
              setCallType(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="outgoing">Outgoing</option>
            <option value="incoming">Incoming</option>
            <option value="missed">Missed</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Date Range Dropdown */}
          <select
            value={dateRange}
            onChange={(e) => {
              setDateRange(e.target.value);
              setPage(1);
            }}
            className="h-8 px-2 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 cursor-pointer"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
          </select>

          {/* Recordings Only Toggle */}
          <button
            type="button"
            onClick={() => {
              setRecordingOnly(!recordingOnly);
              setPage(1);
            }}
            className={cn(
              "h-8 px-2.5 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer shrink-0 select-none",
              recordingOnly
                ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/15"
                : "bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
            )}
            title="Show only calls with recordings"
          >
            <Mic size={12} className={recordingOnly ? "text-indigo-500" : "text-[var(--text-muted)]"} />
            <span>Recordings</span>
          </button>
        </div>

        {/* Clear Filters (if active) */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-rose-500 transition-colors cursor-pointer px-1 shrink-0"
          >
            <X size={12} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* 4. Calls Table View: Fits 100% On Screen, No Horizontal Scroll */}
      {activeTab === 'calls' && (
        <div className="liquid-glass-card relative rounded-[22px] border border-white/80 dark:border-white/10 shadow-[var(--shadow-card)] backdrop-blur-xl transition-all overflow-hidden">
          {/* Top Specular Light Highlight */}
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/90 dark:via-white/20 to-transparent pointer-events-none z-20" />

          <div className="w-full overflow-x-auto lg:overflow-x-visible">
            <table className="w-full text-left border-separate border-spacing-0 table-auto lg:table-fixed">
              <thead className="bg-white/60 dark:bg-white/[0.03] backdrop-blur-md">
                <tr>
                  <th className="border-b border-[var(--border)] px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] w-[10%] min-w-[78px]">
                    Type
                  </th>
                  <th className="border-b border-[var(--border)] px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] w-[16%] min-w-[115px]">
                    Staff Member
                  </th>
                  <th className="border-b border-[var(--border)] px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] w-[20%] min-w-[130px]">
                    Customer / Client
                  </th>
                  <th className="border-b border-[var(--border)] px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] w-[15%] min-w-[110px]">
                    Duration & Time
                  </th>
                  <th className="border-b border-[var(--border)] px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] w-[17%] min-w-[115px]">
                    Outcome & Notes
                  </th>
                  <th className="border-b border-[var(--border)] px-2.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] w-[16%] min-w-[130px]">
                    Audio Recording
                  </th>
                  <th className="border-b border-[var(--border)] px-2.5 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] w-[6%] min-w-[50px]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-3 py-12 text-center text-[var(--text-muted)]">
                      <div className="inline-flex items-center gap-2 text-xs font-medium">
                        <RefreshCw className="w-4 h-4 animate-spin text-[var(--primary)]" />
                        <span>Loading call records...</span>
                      </div>
                    </td>
                  </tr>
                ) : calls.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-3 py-12 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-2">
                        <div className="w-10 h-10 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-muted)]">
                          <PhoneOff size={20} />
                        </div>
                        <p className="font-bold text-[var(--text-main)] text-sm">No call logs match filter</p>
                        <p className="text-xs text-[var(--text-muted)] max-w-xs">
                          Calls made or recorded on staff mobile apps sync here in real-time.
                        </p>
                        {hasActiveFilters && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={clearFilters}
                            className="!rounded-xl text-xs mt-2"
                          >
                            Reset Filters
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  calls.map((call) => (
                    <tr
                      key={call.id}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      {/* Call Type Pill */}
                      <td className="px-2.5 py-2 border-b border-[var(--border)]">
                        {renderCallTypeBadge(call.callType)}
                      </td>

                      {/* Staff Member */}
                      <td className="px-2.5 py-2 border-b border-[var(--border)]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <UserAvatar
                            name={call.staffName || 'Staff'}
                            url={call.userAvatarUrl}
                            size={20}
                            className="w-5 h-5 shrink-0 rounded-lg shadow-2xs"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-[var(--text-main)] text-xs truncate" title={call.staffName}>
                              {call.staffName || 'Staff Member'}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)] font-mono truncate leading-none mt-0.5" title={call.staffPhone || call.staffEmail}>
                              {call.staffPhone || call.staffEmail || 'Mobile App'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Customer / Client */}
                      <td className="px-2.5 py-2 border-b border-[var(--border)]">
                        <div className="min-w-0">
                          <div className="font-bold text-[var(--text-main)] text-xs flex items-center gap-1 min-w-0">
                            <span className="truncate" title={call.customerName}>{call.customerName || 'Customer'}</span>
                            {call.leadId && (
                              <span className="text-[8px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1 py-0.2 rounded font-bold shrink-0">
                                Lead
                              </span>
                            )}
                            {call.clientId && (
                              <span className="text-[8px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-1 py-0.2 rounded font-bold shrink-0">
                                Client
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10.5px] font-mono text-[var(--text-muted)] font-medium">
                              {call.customerPhone}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(call.customerPhone)}
                              className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-0.5 transition-colors cursor-pointer"
                              title="Copy phone"
                            >
                              {copiedPhone === call.customerPhone ? (
                                <Check size={11} className="text-emerald-500" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                            <a
                              href={`https://wa.me/${String(call.customerPhone).replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--text-muted)] hover:text-emerald-600 p-0.5 transition-colors"
                              title="Message on WhatsApp"
                            >
                              <MessageSquare size={11} />
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Duration & Time */}
                      <td className="px-2.5 py-2 border-b border-[var(--border)]">
                        <div className="font-bold text-[var(--text-main)] text-xs leading-none">
                          {formatDuration(call.durationSeconds)}
                        </div>
                        <div
                          className="text-[10px] text-[var(--text-muted)] leading-tight mt-1 cursor-help truncate"
                          title={call.startedAt ? new Date(call.startedAt).toLocaleString('en-IN') : ''}
                        >
                          {formatRelativeTime(call.startedAt)} · {formatExactDateTime(call.startedAt)}
                        </div>
                      </td>

                      {/* Outcome & Notes */}
                      <td className="px-2.5 py-2 border-b border-[var(--border)]">
                        <div className="min-w-0">
                          {call.outcome && (
                            <span className="inline-block px-1.5 py-0.2 text-[9.5px] font-semibold rounded bg-[var(--surface-2)] text-[var(--text-main)] border border-[var(--border)] mb-0.5 leading-tight">
                              {call.outcome}
                            </span>
                          )}
                          <p className="text-[10px] text-[var(--text-muted)] truncate max-w-full leading-tight" title={call.notes}>
                            {call.notes || '—'}
                          </p>
                        </div>
                      </td>

                      {/* Audio Recording */}
                      <td className="px-2.5 py-2 border-b border-[var(--border)]">
                        {call.recordingUrl ? (
                          <CompactAudioPlayer
                            url={call.recordingUrl}
                            fileName={call.recordingFileName}
                            durationSeconds={call.recordingDuration || call.durationSeconds}
                          />
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)] italic select-none">
                            No recording
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-2.5 py-2 border-b border-[var(--border)] text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <a
                            href={`tel:${call.customerPhone}`}
                            className="p-1 text-[var(--text-muted)] hover:text-emerald-600 transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/5"
                            title="Dial phone"
                          >
                            <Phone size={13} />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDeleteCall(call.id)}
                            className="p-1 text-[var(--text-muted)] hover:text-rose-600 transition-colors rounded-md hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                            title="Delete log"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Always Visible Full-Featured CRM Pagination Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 border-t border-[var(--border)] bg-black/[0.01] dark:bg-white/[0.01] text-xs text-[var(--text-muted)] select-none">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-[var(--text-muted)]">
                Showing <span className="font-bold text-[var(--text-main)]">{startItem}</span> to{' '}
                <span className="font-bold text-[var(--text-main)]">{endItem}</span> of{' '}
                <span className="font-bold text-[var(--text-main)]">{pagination.total}</span> calls
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Rows Per Page Selector */}
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="hidden sm:inline text-[var(--text-muted)] font-medium">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-7 px-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
              </div>

              {/* Pagination Navigation & Direct Page Number Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="!rounded-lg h-7 w-7 cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft size={13} />
                </Button>

                {getPageNumbers(page, totalPages).map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-xs text-[var(--text-muted)]">...</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={cn(
                        "h-7 min-w-[28px] px-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer",
                        page === p
                          ? "bg-[var(--primary)] text-white shadow-2xs"
                          : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 border border-transparent hover:border-[var(--border)]"
                      )}
                    >
                      {p}
                    </button>
                  )
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="!rounded-lg h-7 w-7 cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight size={13} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Staff Breakdown Grid View */}
      {activeTab === 'staff' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {staffStats.map((staff) => (
            <div
              key={staff.userId || staff.staffName}
              className="liquid-glass-card rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <UserAvatar
                    name={staff.staffName || 'Staff'}
                    url={staff.avatarUrl}
                    size={26}
                    className="w-7 h-7 shrink-0 rounded-xl shadow-2xs"
                  />
                  <div className="min-w-0">
                    <h3 className="font-bold text-[var(--text-main)] text-xs truncate">
                      {staff.staffName}
                    </h3>
                    <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                      {staff.staffPhone || staff.staffEmail || 'Staff Member'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedStaff(staff.userId || '');
                    setActiveTab('calls');
                  }}
                  className="text-[11px] text-[var(--primary)] font-bold hover:underline shrink-0 cursor-pointer"
                >
                  View calls &rarr;
                </button>
              </div>

              {/* Stats Box */}
              <div className="grid grid-cols-3 gap-1 bg-[var(--surface-2)] p-2 rounded-xl text-center border border-[var(--border)]">
                <div>
                  <div className="text-[9px] text-[var(--text-muted)] uppercase font-bold">Total</div>
                  <div className="text-sm font-black text-[var(--text-main)]">
                    {staff.totalCalls}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-sky-500 uppercase font-bold">Out</div>
                  <div className="text-sm font-black text-sky-600 dark:text-sky-400">
                    {staff.outgoingCalls}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-emerald-500 uppercase font-bold">In</div>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {staff.incomingCalls}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
                <span className="flex items-center gap-1 font-mono font-medium">
                  <Clock size={11} className="text-amber-500" />
                  {formatDuration(staff.totalDurationSeconds)}
                </span>
                <span className="flex items-center gap-1 font-mono font-medium">
                  <Headphones size={11} className="text-indigo-500" />
                  {staff.recordingCalls} recordings
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6. Manual Call Log & Recording Upload Modal */}
      <Modal
        open={showLogModal}
        onClose={() => setShowLogModal(false)}
        title="Log Call / Upload Recording"
        subtitle="Manually create a call log entry or attach an audio recording"
        width="min(460px, 95vw)"
      >
        <form onSubmit={handleCreateCall} className="space-y-3 p-1 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Customer Phone *
            </label>
            <Input
              type="text"
              required
              placeholder="+91 98765 43210"
              value={formData.customerPhone}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
              className="h-8.5 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Customer Name
            </label>
            <Input
              type="text"
              placeholder="e.g. Ramesh Kumar"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              className="h-8.5 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Call Type
              </label>
              <select
                value={formData.callType}
                onChange={(e) => setFormData({ ...formData, callType: e.target.value })}
                className="w-full h-8.5 px-2.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
              >
                <option value="outgoing">Outgoing</option>
                <option value="incoming">Incoming</option>
                <option value="missed">Missed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Duration (seconds)
              </label>
              <Input
                type="number"
                min="0"
                value={formData.durationSeconds}
                onChange={(e) => setFormData({ ...formData, durationSeconds: parseInt(e.target.value, 10) || 0 })}
                className="h-8.5 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Outcome
            </label>
            <select
              value={formData.outcome}
              onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
              className="w-full h-8.5 px-2.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            >
              <option value="Connected">Connected</option>
              <option value="Interested">Interested</option>
              <option value="Follow-up Needed">Follow-up Needed</option>
              <option value="Wrong Number">Wrong Number</option>
              <option value="Not Answered">Not Answered</option>
              <option value="Declined">Declined</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Call Notes
            </label>
            <textarea
              rows={2}
              placeholder="Key points discussed during call..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-2.5 text-xs rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">
              Audio Recording (.mp3, .wav, .m4a, .aac)
            </label>
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => setFormData({ ...formData, recordingFile: e.target.files?.[0] || null })}
              className="w-full text-xs file:mr-2.5 file:py-1 file:px-2.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[var(--primary)] file:text-white file:cursor-pointer text-[var(--text-muted)]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowLogModal(false)}
              className="!rounded-xl text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="!rounded-xl text-xs font-bold bg-[var(--primary)] text-white h-8"
            >
              {submitting ? 'Saving...' : 'Save Call Log'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

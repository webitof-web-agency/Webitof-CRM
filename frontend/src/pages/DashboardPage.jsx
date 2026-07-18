import { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck, BriefcaseBusiness, FileText, Wallet, Banknote, BarChart3, TrendingUp, CheckCircle2, MoreVertical, CreditCard, CalendarCheck, Users, Receipt, UploadCloud, Zap, Clock, Folder, ArrowDownToLine, PieChart, LineChart, UserPlus, CloudUpload, Rocket, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../api/client';
import { Card } from '../components/ui/Card';
import { DataTable } from '../components/ui/Table';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/cn';

function formatAmount(value) {
  const number = Number(value || 0);
  return number.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

// Simple CSS Sparkline for visuals
function Sparkline({ color, points }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const paddingX = 2;
  const paddingY = 4;
  const width = 100;
  const height = 36; // Taller to accommodate the fill

  const getPoint = (val, i) => {
    const x = (i / (points.length - 1)) * (width - paddingX * 2) + paddingX;
    const y = height - paddingY - ((val - min) / range) * (height - paddingY * 2);
    return { x, y };
  };

  const pointCoords = points.map((val, i) => getPoint(val, i));
  const polylineStr = pointCoords.map(p => `${p.x},${p.y}`).join(' ');
  const polygonStr = `${pointCoords[0].x},${height} ${polylineStr} ${pointCoords[pointCoords.length - 1].x},${height}`;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id={`gradient-${color.replace('#','')}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={polygonStr} fill={`url(#gradient-${color.replace('#','')})`} />
      <polyline points={polylineStr} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {pointCoords.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} />
      ))}
    </svg>
  );
}

function TrendChart({ rows = [] }) {
  const series = [
    { key: 'revenue', label: 'Revenue', color: '#2563eb' },
    { key: 'expense', label: 'Expense', color: '#7c3aed' },
    { key: 'profit', label: 'Profit', color: '#10b981' }
  ];

  const values = series.flatMap((item) => rows.map((row) => Number(row?.[item.key] || 0)));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const width = 100;
  const height = 220;
  const paddingX = 10;
  const paddingY = 18;

  const getX = (index) => {
    if (rows.length <= 1) return width / 2;
    return (index / (rows.length - 1)) * (width - paddingX * 2) + paddingX;
  };

  const getY = (value) => {
    const normalized = (Number(value || 0) - min) / range;
    return height - paddingY - normalized * (height - paddingY * 2);
  };

  const pointsFor = (key) => rows.map((row, index) => `${getX(index)},${getY(row?.[key] || 0)}`).join(' ');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
          {[0, 1, 2, 3].map((line) => {
            const y = paddingY + ((height - paddingY * 2) / 3) * line;
            return <line key={line} x1="8" y1={y} x2="92" y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />;
          })}
          {series.map((item) => (
            <g key={item.key}>
              <polyline
                points={pointsFor(item.key)}
                fill="none"
                stroke={item.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {rows.map((row, index) => (
                <circle key={`${item.key}-${index}`} cx={getX(index)} cy={getY(row?.[item.key] || 0)} r="2.8" fill={item.color} />
              ))}
            </g>
          ))}
        </svg>
      </div>

      <div className="grid grid-cols-6 gap-2 text-center text-[10px] uppercase tracking-[0.24em] text-slate-400">
        {rows.map((row) => (
          <div key={row.label} className="truncate">{row.label}</div>
        ))}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { token, hasPermission, user } = useAuth();
  const canViewReports = hasPermission('reports.view');
  
  const [summary, setSummary] = useState(null);
  const [profitLoss, setProfitLoss] = useState(null);
  const [gst, setGst] = useState(null);
  const [pendingPayables, setPendingPayables] = useState([]);
  const [renewals, setRenewals] = useState({ nearby: [], expired: [], future: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!canViewReports) {
        if (mounted) setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [dashboardResponse, profitLossResponse, gstResponse, payablesResponse, renewalsResponse] = await Promise.all([
          api.reports.dashboard(token),
          api.reports.profitLoss(token),
          api.reports.gst(token),
          api.reports.pendingPayables(token),
          api.reports.renewalDashboard(token)
        ]);
        if (!mounted) return;
        setSummary(dashboardResponse.data || {});
        setProfitLoss(profitLossResponse.data || {});
        setGst(gstResponse.data || {});
        setPendingPayables(payablesResponse.data || []);
        setRenewals(renewalsResponse.data || { nearby: [], expired: [], future: [] });
      } catch (error) {
        if (!mounted) return;
        toast.error('Unable to load dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [canViewReports, token]);

  const renewalRows = [...(renewals.expired || []), ...(renewals.nearby || []), ...(renewals.future || [])].map((item) => ({
    ...item,
    rowStatus: item.status || (item.recordType === 'AMC' ? 'AMC' : 'Renewal')
  }));

  // Dummy sparkline data for visuals - all identical shape per user request
  const dummyPoints = [10, 20, 15, 25, 20, 30, 15];
  const financeTrend = summary?.financeTrend || [];

  return (
    <div className="space-y-6">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-[20px] p-6 md:p-8 text-white shadow-lg" style={{ backgroundColor: 'var(--primary, #2563eb)' }}>
        {/* Dynamic Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-transparent pointer-events-none"></div>

        {/* Graphic Container (Right side) */}
        <div className="absolute inset-y-0 right-0 w-[55%] pointer-events-none hidden md:block z-0 overflow-hidden">
          
          {/* Wavy Background Lines */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.15]" viewBox="0 0 500 300" preserveAspectRatio="none">
             {Array.from({length: 15}).map((_, i) => (
                <path key={i} d={`M-50,${250 + i * 15} C100,${150 + i * 10} 250,${350 + i * 5} 400,${100 + i * 12} C500,${-50 + i * 15} 600,${150 + i * 10} 700,${50 + i * 15}`} fill="none" stroke="white" strokeWidth={i % 3 === 0 ? 1 : 0.5} />
             ))}
          </svg>

          {/* Glow/Light effects */}
          <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-white/20 rounded-full blur-[80px]"></div>
          <div className="absolute bottom-0 right-1/2 w-48 h-48 bg-white/10 rounded-full blur-[60px]"></div>

          {/* Glass Elements Group */}
          <div className="absolute inset-0 transform translate-x-[15%] -translate-y-[5%] scale-[0.6] md:scale-[0.65] lg:scale-[0.75] origin-[100%_50%]">
            
            {/* 1. Back Browser Window */}
            <div className="absolute top-[10%] left-[25%] w-[320px] h-[220px] bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-4">
              <div className="flex gap-2 mb-4">
                <div className="w-2.5 h-2.5 rounded-full bg-white/30"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-white/30"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-white/30"></div>
              </div>
              <div className="w-1/3 h-2 bg-white/10 rounded-full mb-3"></div>
              <div className="w-1/4 h-2 bg-white/10 rounded-full"></div>
            </div>

            {/* 2. Main Analytics Panel */}
            <div className="absolute top-[25%] left-[10%] w-[360px] h-[220px] bg-white/20 backdrop-blur-xl rounded-2xl border border-white/30 shadow-[0_20px_40px_rgba(0,0,0,0.15)] p-6 flex gap-6">
              {/* Left: Bar Chart */}
              <div className="flex items-end gap-2.5 h-full w-[55%] pb-2">
                <div className="w-full h-[40%] bg-white/30 rounded-t-sm relative"><div className="absolute bottom-0 w-full h-[60%] bg-white/60 rounded-sm"></div></div>
                <div className="w-full h-[70%] bg-white/30 rounded-t-sm relative"><div className="absolute bottom-0 w-full h-[40%] bg-white/60 rounded-sm"></div></div>
                <div className="w-full h-[60%] bg-white/80 rounded-t-sm"></div>
                <div className="w-full h-[95%] bg-white rounded-t-sm shadow-[0_0_15px_rgba(255,255,255,0.5)]"></div>
                <div className="w-full h-[50%] bg-white/60 rounded-t-sm"></div>
              </div>
              {/* Right: Donut & Lines */}
              <div className="w-[45%] h-full flex flex-col items-center justify-center gap-6">
                <div className="w-24 h-24 rounded-full border-[7px] border-white/20 relative shadow-inner">
                   <div className="absolute inset-[-7px] rounded-full border-[7px] border-white border-b-transparent border-l-transparent transform rotate-45 shadow-[0_0_10px_rgba(255,255,255,0.3)]"></div>
                </div>
                <div className="w-full space-y-2 mt-auto">
                   <div className="h-1.5 w-full bg-white/40 rounded-full"></div>
                   <div className="h-1.5 w-2/3 bg-white/40 rounded-full"></div>
                </div>
              </div>
            </div>

            {/* 3. Small Bottom Right Panel (Area Chart) */}
            <div className="absolute top-[50%] left-[55%] w-[200px] h-[140px] bg-white/20 backdrop-blur-xl rounded-2xl border border-white/30 shadow-[0_20px_40px_rgba(0,0,0,0.15)] p-4 flex flex-col">
               <div className="space-y-1.5 mb-4">
                 <div className="h-1 w-8 bg-white/60 rounded-full"></div>
                 <div className="h-1 w-16 bg-white/40 rounded-full"></div>
               </div>
               <div className="flex-1 w-full relative mt-auto opacity-90">
                 <svg viewBox="0 0 100 50" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                   <defs>
                     <linearGradient id="area1" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
                       <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
                     </linearGradient>
                     <linearGradient id="area2" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                       <stop offset="100%" stopColor="rgba(255,255,255,0.0)" />
                     </linearGradient>
                   </defs>
                   <path d="M0,50 L0,25 C10,15 20,35 30,25 C40,15 50,25 60,15 C70,5 80,25 90,15 C95,10 100,5 100,5 L100,50 Z" fill="url(#area1)" />
                   <path d="M0,50 L0,35 C15,30 25,40 35,30 C45,20 55,25 65,20 C75,15 85,30 100,20 L100,50 Z" fill="url(#area2)" />
                 </svg>
               </div>
            </div>

            {/* 4. Small Top Right Panel (Pie Chart) */}
            <div className="absolute top-[5%] left-[65%] w-[80px] h-[80px] bg-white/20 backdrop-blur-xl rounded-2xl border border-white/30 shadow-[0_20px_40px_rgba(0,0,0,0.1)] flex items-center justify-center">
               <div className="w-10 h-10 rounded-full shadow-inner relative" style={{ background: 'conic-gradient(rgba(255,255,255,0.2) 0% 75%, white 75% 100%)' }}>
                 <div className="absolute inset-0 rounded-full border border-white/30"></div>
               </div>
            </div>

          </div>
        </div>
        
        <div className="relative z-10">
          <h2 className="text-sm font-semibold tracking-wider text-blue-100 uppercase mb-2">Welcome back,</h2>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 flex items-center gap-3">
            {user?.fullName || user?.name || 'System Admin'} <span className="text-3xl">👋</span>
          </h1>
          <p className="text-blue-100 mb-5 max-w-xl text-sm">Here's what's happening with your business today.</p>

          <div className="flex flex-wrap items-center gap-6 md:gap-10 mt-5">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-11 h-11 md:w-14 md:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                 <Users size={22} className="text-white md:w-6 md:h-6" />
              </div>
              <div className="flex flex-col">
                 <span className="text-[11px] md:text-xs font-semibold text-white/90">Clients</span>
                 <span className="text-xl md:text-2xl font-bold text-white leading-none mt-1">{summary?.totalClients || 0}</span>
              </div>
            </div>
            <div className="w-px h-10 bg-white/20 hidden md:block"></div>
            
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-11 h-11 md:w-14 md:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                 <Folder size={22} className="text-white md:w-6 md:h-6" />
              </div>
              <div className="flex flex-col">
                 <span className="text-[11px] md:text-xs font-semibold text-white/90">Projects</span>
                 <span className="text-xl md:text-2xl font-bold text-white leading-none mt-1">{summary?.totalProjects || 0}</span>
              </div>
            </div>
            <div className="w-px h-10 bg-white/20 hidden md:block"></div>

            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-11 h-11 md:w-14 md:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                 <FileText size={22} className="text-white md:w-6 md:h-6" />
              </div>
              <div className="flex flex-col">
                 <span className="text-[11px] md:text-xs font-semibold text-white/90">Invoices</span>
                 <span className="text-xl md:text-2xl font-bold text-white leading-none mt-1">{summary?.totalInvoices || 0}</span>
              </div>
            </div>
            <div className="w-px h-10 bg-white/20 hidden md:block"></div>

            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-11 h-11 md:w-14 md:h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                 <CalendarCheck size={22} className="text-white md:w-6 md:h-6" />
              </div>
              <div className="flex flex-col">
                 <span className="text-[11px] md:text-xs font-semibold text-white/90">Renewals</span>
                 <span className="text-xl md:text-2xl font-bold text-white leading-none mt-1">{summary?.renewalsExpiringSoon || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[
          { label: 'CLIENTS', value: formatCount(summary?.totalClients || 0), icon: Users, color: 'text-blue-500', bg: 'bg-blue-50/80', sub: 'Current month total' },
          { label: 'PROJECTS', value: formatCount(summary?.totalProjects || 0), icon: Folder, color: 'text-purple-500', bg: 'bg-purple-50/80', sub: 'Current month total' },
          { label: 'INVOICES', value: formatAmount(summary?.totalInvoiceAmount || 0), icon: FileText, color: 'text-emerald-500', bg: 'bg-emerald-50/80', sub: 'Current month total' },
          { label: 'RECEIVED', value: formatAmount(summary?.totalReceived || 0), icon: ArrowDownToLine, color: 'text-green-500', bg: 'bg-green-50/80', sub: 'Current month total' },
          { label: 'DUE', value: formatAmount(summary?.totalDue || 0), icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50/80', sub: 'Outstanding amount' },
          { label: 'GST PAYABLE', value: formatAmount(summary?.netGstPayable || 0), icon: PieChart, color: 'text-pink-500', bg: 'bg-pink-50/80', sub: 'Current month total' }
        ].map((stat, i) => (
          <Card key={i} className="px-4 py-6 md:px-5 md:py-8 flex items-center gap-5 shadow-sm border border-slate-100 rounded-[16px]">
            <div className={`shrink-0 w-14 h-14 md:w-16 md:h-16 flex items-center justify-center rounded-full ${stat.bg} ${stat.color}`}>
              <stat.icon size={26} strokeWidth={2} />
            </div>
            <div>
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">{stat.label}</p>
              <h3 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">{stat.value}</h3>
              {stat.sub && <p className="text-[9px] md:text-[10px] text-slate-400 mt-1">{stat.sub}</p>}
            </div>
          </Card>
        ))} 
      </div>

      {/* Main Grid Row 3 */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Finance Overview */}
        <Card className="lg:col-span-5 shadow-sm border border-slate-100 flex flex-col rounded-[16px] overflow-hidden !p-0">
          <div className="px-5 md:px-6 !pt-3 md:!pt-4 pb-3 md:pb-4 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-[12px] flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
                <LineChart size={22} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
              </div>
              <div>
                <h3 className="text-sm md:text-base font-bold text-slate-800">Finance Overview</h3>
                <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">Profit & GST summary for the month</p>
              </div>
            </div>
            <button className="hover:opacity-80 transition-opacity" style={{ color: 'var(--primary)' }}>
              <TrendingUp size={20} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-b border-slate-100 divide-slate-100 bg-white flex-1">
            {[
              { label: 'REVENUE', value: formatAmount(profitLoss?.revenue || 0), color: '#3b82f6', points: dummyPoints },
              { label: 'EXPENSE', value: formatAmount(profitLoss?.expense || 0), color: '#a855f7', points: dummyPoints },
              { label: 'PROFIT', value: formatAmount(profitLoss?.profit || 0), color: '#22c55e', points: dummyPoints },
            ].map((item, i) => (
              <div key={i} className="px-4 py-6 md:px-5 flex items-center justify-between h-full">
                <div>
                  <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1.5">{item.label}</p>
                  <h4 className="text-sm md:text-base font-bold text-slate-800">{item.value}</h4>
                </div>
                <div className="w-16 h-8 md:w-20 md:h-10 ml-2 shrink-0">
                  <Sparkline color={item.color} points={item.points} />
                </div>
              </div>
            ))}
          </div>
          
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-white flex-1">
            {[
              { label: 'GST OUTPUT', value: formatAmount(gst?.outputGst || 0), color: '#f97316', points: dummyPoints },
              { label: 'GST INPUT', value: formatAmount(gst?.inputGst || 0), color: '#06b6d4', points: dummyPoints },
              { label: 'NET GST', value: formatAmount(gst?.netGstPayable || 0), color: '#8b5cf6', points: dummyPoints },
            ].map((item, i) => (
              <div key={i} className="px-4 py-6 md:px-5 flex items-center justify-between h-full">
                <div>
                  <p className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1.5">{item.label}</p>
                  <h4 className="text-sm md:text-base font-bold text-slate-800">{item.value}</h4>
                </div>
                <div className="w-16 h-8 md:w-20 md:h-10 ml-2 shrink-0">
                  <Sparkline color={item.color} points={item.points} />
                </div>
              </div>
            ))}
            </div>
          </div>
        </Card>

        {/* Operational Health */}
        <Card className="lg:col-span-3 px-5 md:px-6 !pt-3 md:!pt-4 pb-5 md:pb-6 shadow-sm border border-slate-100 flex flex-col rounded-[16px]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
              <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
              <CheckCircle2 size={22} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Operational Health</h3>
              <p className="text-[10px] text-slate-500">Key operational metrics at a glance</p>
            </div>
          </div>

          <div className="space-y-0 flex-1">
            {[
              { label: 'Pending invoices', value: summary?.pendingInvoices || 0, icon: FileText },
              { label: 'AMC expiring in 30 days', value: summary?.amcExpiringSoon || 0, icon: Clock },
              { label: 'Renewals expiring in 30 days', value: summary?.renewalsExpiringSoon || 0, icon: RefreshCw },
              { label: 'Total invoices', value: summary?.totalInvoices || 0, icon: FileText },
              { label: 'Active projects', value: summary?.activeProjects || 0, icon: Rocket }
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-3 md:py-4 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3 text-slate-600">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
                    <item.icon size={14} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
                  </div>
                  <span className="text-[11px] md:text-xs font-medium">{item.label}</span>
                </div>
                <span className="font-bold text-xs text-slate-800">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-4 px-5 md:px-6 !pt-3 md:!pt-4 pb-5 md:pb-6 shadow-sm border border-slate-100 flex flex-col rounded-[16px]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
              <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
              <Zap size={22} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Quick Actions</h3>
              <p className="text-[10px] text-slate-500">Shortcuts to common actions</p>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-3 flex-1 h-full items-center">
            {[
              { label: 'Add Client', icon: UserPlus, link: '/app/clients', color: 'text-blue-600', bg: 'bg-blue-50/80' },
              { label: 'New Project', icon: Folder, link: '/app/projects', color: 'text-purple-600', bg: 'bg-purple-50/80' },
              { label: 'Create Invoice', icon: FileText, link: '/app/invoices/new', color: 'text-teal-600', bg: 'bg-teal-50/80' },
              { label: 'Record Payment', icon: Wallet, link: '/app/payments/new', color: 'text-green-600', bg: 'bg-green-50/80' },
              { label: 'Add Expense', icon: Receipt, link: '/app/reports', color: 'text-orange-500', bg: 'bg-orange-50/80' },
              { label: 'Upload File', icon: CloudUpload, link: '/app/documents', color: 'text-blue-500', bg: 'bg-blue-50/80' },
              { label: 'Add Renewal', icon: CalendarCheck, link: '/app/reports', color: 'text-pink-500', bg: 'bg-pink-50/80' },
              { label: 'View Reports', icon: BarChart3, link: '/app/reports', color: 'text-indigo-500', bg: 'bg-indigo-50/80' }
            ].map((action, i) => (
              <Link key={i} to={action.link} className="flex flex-col items-center justify-center py-4 px-2 md:py-5 md:px-3 rounded-[16px] border border-slate-100 hover:border-slate-300 hover:shadow-md transition-all gap-3 text-center group bg-white">
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center ${action.bg} ${action.color} group-hover:scale-110 transition-transform`}>
                  <action.icon size={22} strokeWidth={2} />
                </div>
                <span className="text-[10px] md:text-[11px] font-bold text-slate-700 leading-tight">{action.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {/* Bottom Row Row 4 */}
      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* Recent Activity */}
        <Card className="lg:col-span-5 px-5 md:px-6 !pt-3 md:!pt-4 pb-5 md:pb-6 shadow-sm border border-slate-100 min-h-[300px] flex flex-col rounded-[16px]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
              <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
              <Clock size={22} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
            </div> 
            <div>
              <h3 className="text-sm font-bold text-slate-800">Recent Activity</h3>
              <p className="text-[10px] text-slate-500">Latest invoices and transactions</p>
            </div>
            <Link to="/app/invoices" className="ml-auto text-[11px] font-bold flex items-center gap-1 transition-all hover:gap-1.5" style={{ color: 'var(--primary)' }}>
              View All <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          
          <div className="flex-1 flex flex-col overflow-auto -mx-2">
            {summary?.recentActivity && summary.recentActivity.length > 0 ? (
              <div className="flex flex-col gap-2 px-2">
                {summary.recentActivity.slice(0, 4).map((item, i) => {
                  const dateObj = item.date ? new Date(item.date) : null;
                  const formattedDate = dateObj && !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown';
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-[12px] bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                      <div className="flex flex-col text-left max-w-[65%]">
                        <span className="text-xs font-bold text-slate-800 truncate">{item.title || 'Transaction'}</span>
                        <span className="text-[10px] text-slate-500">{item.type} &bull; {formattedDate} &bull; {item.status}</span>
                      </div>
                      <div className="text-right flex flex-col">
                        <span className={`text-xs font-bold ${item.type === 'Payment' ? 'text-green-600' : 'text-slate-900'}`}>
                          {item.type === 'Payment' ? '+' : ''}{formatAmount(item.amount)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="relative z-10 mb-6 flex items-center justify-center">
                  <div className="relative flex h-24 w-20 flex-col rounded-t-xl rounded-br-xl p-3 shadow-inner" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}>
                    <div className="absolute -left-3 -top-3 h-8 w-8 rounded-full mix-blend-multiply blur-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)' }}></div>
                    <div className="absolute top-0 right-0 h-4 w-4 rounded-bl-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 25%, transparent)' }}></div>
                    <div className="mt-2 h-2 w-10 rounded-full bg-white/60"></div>
                    <div className="mt-2 h-2 w-14 rounded-full bg-white/60"></div>
                    <div className="mt-2 h-2 w-12 rounded-full bg-white/60"></div>
                    <div className="absolute -bottom-2 -right-3 flex h-12 w-12 items-center justify-center rounded-full shadow-lg border-4 border-white transform rotate-12" style={{ backgroundColor: 'var(--primary)' }}>
                      <Search size={20} className="text-white" />
                    </div>
                  </div>
                </div>
                <h4 className="relative z-10 text-slate-900 text-[13px] font-bold mb-1">No recent activity</h4>
                <p className="relative z-10 text-slate-500 text-[11px]">There is nothing to show yet.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Pending Payables */}
        <Card className="lg:col-span-3 px-5 md:px-6 !pt-3 md:!pt-4 pb-5 md:pb-6 shadow-sm border border-slate-100 min-h-[300px] flex flex-col rounded-[16px]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
              <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
              <FileText size={22} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Pending Payables</h3>
              <p className="text-[10px] text-slate-500">Bills and expenses awaiting payment</p>
            </div>
            <Link to="/app/expenses" className="ml-auto text-[11px] font-bold flex items-center gap-1 transition-all hover:gap-1.5" style={{ color: 'var(--primary)' }}>
              View All <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          
          <div className="flex-1 flex flex-col overflow-auto -mx-2">
            {pendingPayables && pendingPayables.length > 0 ? (
              <div className="flex flex-col gap-2 px-2">
                {pendingPayables.slice(0, 4).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-[12px] bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col text-left max-w-[65%]">
                      <span className="text-xs font-bold text-slate-800 truncate">{item.title || item.vendorName || item.partnerName || item.employeeName || 'Payable'}</span>
                      <span className="text-[10px] text-slate-500">{item.type || 'Expense'}</span>
                    </div>
                    <div className="text-right flex flex-col">
                      <span className="text-xs font-bold text-slate-900">{formatAmount(item.amount || item.payable || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="relative z-10 mb-6 flex items-center justify-center">
                  <div className="relative flex h-24 w-20 flex-col rounded-t-xl rounded-br-xl p-3 shadow-inner" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}>
                    <div className="absolute -left-3 -top-3 h-8 w-8 rounded-full mix-blend-multiply blur-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)' }}></div>
                    <div className="absolute top-0 right-0 h-4 w-4 rounded-bl-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 25%, transparent)' }}></div>
                    <div className="mt-2 h-2 w-10 rounded-full bg-white/60"></div>
                    <div className="mt-2 h-2 w-14 rounded-full bg-white/60"></div>
                    <div className="mt-2 h-2 w-12 rounded-full bg-white/60"></div>
                    <div className="absolute -bottom-2 -right-3 flex h-12 w-12 items-center justify-center rounded-full shadow-lg border-4 border-white transform rotate-12" style={{ backgroundColor: 'var(--primary)' }}>
                      <Search size={20} className="text-white" />
                    </div>
                  </div>
                </div>
                <h4 className="relative z-10 text-slate-900 text-[13px] font-bold mb-1">No records found</h4>
                <p className="relative z-10 text-slate-500 text-[11px]">There is nothing to show yet.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Renewals */}
        <Card className="lg:col-span-4 px-5 md:px-6 !pt-3 md:!pt-4 pb-5 md:pb-6 shadow-sm border border-slate-100 min-h-[300px] flex flex-col rounded-[16px]">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-[12px] flex items-center justify-center relative overflow-hidden shrink-0">
              <div className="absolute inset-0 opacity-10" style={{ backgroundColor: 'var(--primary)' }}></div>
              <CalendarCheck size={22} strokeWidth={2.5} style={{ color: 'var(--primary)' }} className="relative z-10" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Renewals & AMC Due</h3>
              <p className="text-[10px] text-slate-500">Upcoming renewals and AMC expiries</p>
            </div>
            <Link to="/app/reports" className="ml-auto text-[11px] font-bold flex items-center gap-1 transition-all hover:gap-1.5" style={{ color: 'var(--primary)' }}>
              View All <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
          
          <div className="flex-1 flex flex-col overflow-auto -mx-2">
            {renewalRows && renewalRows.length > 0 ? (
              <div className="flex flex-col gap-2 px-2">
                {renewalRows.slice(0, 4).map((item, i) => {
                  const dateStr = item.renewalDate || item.endDate || item.expiryDate;
                  const dateObj = dateStr ? new Date(dateStr) : null;
                  const formattedDate = dateObj && !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown';
                  return (
                    <div key={i} className="flex items-center justify-between p-3 rounded-[12px] bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                      <div className="flex flex-col text-left max-w-[65%]">
                        <span className="text-xs font-bold text-slate-800 truncate">{item.domainName || item.hostingName || item.softwareName || item.amcType || item.title || 'Renewal'}</span>
                        <span className="text-[10px] text-slate-500">{item.clientName || item.rowStatus || 'Renewal'} &bull; {formattedDate}</span>
                      </div>
                      <div className="text-right flex flex-col">
                        <span className="text-xs font-bold text-slate-900">{formatAmount(item.renewalPrice || item.amcAmount || item.amount || 0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="relative z-10 mb-6 flex items-center justify-center">
                  <div className="relative flex h-24 w-20 flex-col rounded-t-xl rounded-br-xl p-3 shadow-inner" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}>
                    <div className="absolute -left-3 -top-3 h-8 w-8 rounded-full mix-blend-multiply blur-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)' }}></div>
                    <div className="absolute top-0 right-0 h-4 w-4 rounded-bl-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 25%, transparent)' }}></div>
                    <div className="mt-2 h-2 w-10 rounded-full bg-white/60"></div>
                    <div className="mt-2 h-2 w-14 rounded-full bg-white/60"></div>
                    <div className="mt-2 h-2 w-12 rounded-full bg-white/60"></div>
                    <div className="absolute -bottom-2 -right-3 flex h-12 w-12 items-center justify-center rounded-full shadow-lg border-4 border-white transform rotate-12" style={{ backgroundColor: 'var(--primary)' }}>
                      <Search size={20} className="text-white" />
                    </div>
                  </div>
                </div>
                <h4 className="relative z-10 text-slate-900 text-[13px] font-bold mb-1">No records found</h4>
                <p className="relative z-10 text-slate-500 text-[11px]">There is nothing to show yet.</p>
              </div>
            )}
          </div>
        </Card>

      </div>
    </div>
  );
}


import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Package, Clock, TrendingUp, Scan, Pause, Box, Coffee, LogOut, AlertTriangle, CheckCircle, Play, MapPin, Wifi, WifiOff } from 'lucide-react';
import { User, Session, ConsumableRequest, HelpRequest } from '../types';
import { HOLD_REASONS } from '../constants';
import { todayStr, fmtDur, uid } from '../utils';
import { getStation, getShowConsumables, getEnabledConsumables, computeLeaderboard } from '../services/dataService';
import { useAppData } from '../context/AppDataContext';
import { normalizeScan, validateBinFormat, validateOrderFormat, detectSla } from '../lib/validation';
import { StatusBadge } from './StatusBadge';
import { Leaderboard } from './Leaderboard';

interface PackerStationProps {
  user: User;
  onLogout: () => void;
  t: any;
  lang: string;
  setLang: (l: string) => void;
}

export const PackerStation: React.FC<PackerStationProps> = ({ user, onLogout, t, lang, setLang }) => {
  const {
    sessions: allSessions,
    settings,
    consumableRequests,
    helpRequests,
    upsertSession,
    upsertConsumableRequest,
    upsertHelpRequest,
    updateSettings,
    checkDuplicateOrder,
    isDemoMode,
  } = useAppData();

  const station          = getStation();
  const showConsumables  = getShowConsumables();
  const consumableTypes  = settings.consumable_types;
  const enabledConsum    = getEnabledConsumables(consumableTypes);
  const today            = todayStr();

  // ── Derived from context (auto-updates on Firebase push) ─────────────────────
  const sessions = useMemo(
    () => allSessions.filter(s => s.packer_id === user.uid && s.date === today),
    [allSessions, user.uid, today]
  );
  const activeSession = useMemo(
    () => allSessions.find(s => s.packer_id === user.uid && (s.status === 'IN_PROGRESS' || s.status === 'ON_HOLD')) ?? null,
    [allSessions, user.uid]
  );

  const [inputVal,          setInputVal]          = useState('');
  const [error,             setError]             = useState('');
  const [elapsed,           setElapsed]           = useState(0);
  const [isOnBreak,         setIsOnBreak]         = useState(false);
  const [breakStart,        setBreakStart]        = useState<number | null>(null);
  const [breakSec,          setBreakSec]          = useState(3600);
  const [isHoldOpen,        setIsHoldOpen]        = useState(false);
  const [holdReason,        setHoldReason]        = useState('OTHER');
  const [consumToast,       setConsumToast]       = useState(false);
  const [helpToast,         setHelpToast]         = useState(false);
  const [showSuccess,       setShowSuccess]       = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showSummary,       setShowSummary]       = useState(false);
  const [isScanning,        setIsScanning]        = useState(false);
  const [lastScanDebug,     setLastScanDebug]     = useState<{ raw: string; normalized: string; type: string } | null>(null);
  const [lastPacked,        setLastPacked]        = useState<{ binId: string; orderId: string; duration: string; sla: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const completedToday   = sessions.filter(s => s.status === 'COMPLETED');
  const totalOrders      = completedToday.length;
  const avgTime          = totalOrders > 0
    ? Math.round(completedToday.reduce((a, s) => a + (s.cycle_time_seconds || 0), 0) / totalOrders) : 0;
  const firstStart       = completedToday.length > 0 ? Math.min(...completedToday.map(s => s.start_time)) : null;
  const hoursWorked      = firstStart ? (Date.now() - firstStart) / 3_600_000 : 0;
  const ordersHr         = hoursWorked > 0.01 ? Math.round(totalOrders / hoursWorked * 10) / 10 : 0;
  const targetOrdersHr   = settings.target_orders_per_hour;
  const leaderboard      = useMemo(() => computeLeaderboard(allSessions), [allSessions]);

  // ── Timers ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSession || activeSession.status !== 'IN_PROGRESS') return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - activeSession.start_time) / 1000)), 500);
    return () => clearInterval(iv);
  }, [activeSession?.id, activeSession?.status]);

  useEffect(() => {
    if (!isOnBreak || !breakStart) return;
    const iv = setInterval(() => {
      setBreakSec(Math.max(0, 3600 - Math.floor((Date.now() - breakStart) / 1000)));
    }, 500);
    return () => clearInterval(iv);
  }, [isOnBreak, breakStart]);

  useEffect(() => {
    if (!isHoldOpen && !showSummary && !showSuccess && !isOnBreak)
      setTimeout(() => inputRef.current?.focus(), 100);
  }, [isHoldOpen, showSummary, showSuccess, isOnBreak, activeSession?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'h') handleCallSupervisor();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSession, station]);

  // ── Core scan handler ─────────────────────────────────────────────────────────
  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inputVal;
    setInputVal('');
    if (!raw.trim() || isScanning) return;

    const val = normalizeScan(raw);
    setError('');

    if (isOnBreak) { setError('End break first.'); return; }

    // Debug info (shows in DebugPanel if open)
    let scanType = 'UNKNOWN';
    if (validateBinFormat(val, settings.bin_regex)) scanType = 'BIN';
    else if (validateOrderFormat(val))               scanType = 'ORDER';
    setLastScanDebug({ raw, normalized: val, type: scanType });

    setIsScanning(true);
    try {
      if (!activeSession) {
        // ── FIRST SCAN: expect a BIN ID ──────────────────────────────────────
        if (!validateBinFormat(val, settings.bin_regex)) {
          setError(`Invalid bin format. Expected: ${settings.bin_regex}`);
          return;
        }

        const session: Session = {
          id:          uid(),
          packer_id:   user.uid,
          packer_name: user.name,
          station,
          bin_id:      val,
          start_time:  Date.now(),
          status:      'IN_PROGRESS',
          date:        today,
          holds:       [],
        };
        await upsertSession(session);
        setElapsed(0);

      } else if (activeSession.status === 'IN_PROGRESS') {
        // ── SECOND SCAN: expect an ORDER LABEL ───────────────────────────────
        if (val === activeSession.bin_id) {
          setError("Don't scan the bin again — scan the order label!");
          return;
        }

        if (!validateOrderFormat(val)) {
          setError(`Invalid order label: "${val}". Must be 8–50 alphanumeric/dash/underscore chars.`);
          return;
        }

        // Duplicate order check (cross-device via Firebase)
        const isDuplicate = await checkDuplicateOrder(val, today);
        if (isDuplicate) {
          setError(`⚠️ Order "${val}" was already packed today!`);
          return;
        }

        const holdSec = (activeSession.holds || []).reduce((sum, h) => sum + (h.duration_seconds || 0), 0);
        const dur     = Math.max(0, Math.floor((Date.now() - activeSession.start_time) / 1000) - holdSec);
        const sla     = detectSla(val);

        const updated: Session = {
          ...activeSession,
          status:               'COMPLETED',
          order_id:             val,
          end_time:             Date.now(),
          cycle_time_seconds:   dur,
          total_duration_seconds: Math.floor((Date.now() - activeSession.start_time) / 1000),
          sla,
        };
        await upsertSession(updated);
        setLastPacked({ binId: activeSession.bin_id, orderId: val, duration: fmtDur(dur), sla });
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);

      } else if (activeSession.status === 'ON_HOLD') {
        setError('Session is on hold. Resume first.');
      }
    } catch (err: any) {
      setError(err?.message || 'Scan failed. Try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleHold = async () => {
    if (!activeSession || activeSession.status !== 'IN_PROGRESS') return;
    const hold  = { start_time: Date.now(), reason: holdReason };
    const updated: Session = { ...activeSession, status: 'ON_HOLD', holds: [...(activeSession.holds || []), hold] };
    await upsertSession(updated);
    setIsHoldOpen(false);
  };

  const handleResume = async () => {
    if (!activeSession || activeSession.status !== 'ON_HOLD') return;
    const holds = [...(activeSession.holds || [])];
    const last  = holds[holds.length - 1];
    if (last && !last.end_time) {
      holds[holds.length - 1] = { ...last, end_time: Date.now(), duration_seconds: Math.floor((Date.now() - last.start_time) / 1000) };
    }
    await upsertSession({ ...activeSession, status: 'IN_PROGRESS', holds });
  };

  const handleCancel = async () => {
    if (!activeSession) return;
    await upsertSession({ ...activeSession, status: 'CANCELLED', end_time: Date.now() });
    setShowCancelConfirm(false);
  };

  const handleConsumableRequest = async (type: string) => {
    const req: ConsumableRequest = {
      id: uid(), packer_id: user.uid, packer_name: user.name, station,
      consumable_type: type,
      station_bin_id:      activeSession?.bin_id || station || null,
      packing_session_id:  activeSession?.id     || null,
      requested_at: Date.now(), date: today, status: 'PENDING',
    };
    await upsertConsumableRequest(req);

    // Decrement stock (shared via Firebase)
    const newStock = { ...settings.stock, [type]: Math.max(0, (settings.stock[type] || 0) - 1) };
    await updateSettings({ stock: newStock });

    setConsumToast(true);
    setTimeout(() => setConsumToast(false), 3000);
  };

  const handleCallSupervisor = async () => {
    const curStation = station || 'UNKNOWN';
    const alreadyPending = helpRequests.some(r => r.station === curStation && r.status === 'PENDING');
    if (alreadyPending) { setHelpToast(true); setTimeout(() => setHelpToast(false), 3000); return; }

    const req: HelpRequest = {
      id: uid(), packer_id: user.uid, packer_name: user.name,
      station: curStation, requested_at: Date.now(), date: today, status: 'PENDING',
    };
    await upsertHelpRequest(req);
    setHelpToast(true);
    setTimeout(() => setHelpToast(false), 3000);
  };

  const handleBreak = () => {
    if (activeSession) { setError('Finish or cancel current session first.'); return; }
    if (isOnBreak) { setIsOnBreak(false); setBreakStart(null); setBreakSec(3600); }
    else           { setIsOnBreak(true);  setBreakStart(Date.now()); setBreakSec(3600); }
  };

  const isOnHold = activeSession?.status === 'ON_HOLD';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-40">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <div className="font-bold text-gray-900 text-base">{user.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {today}
            </span>
            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
              <MapPin size={9} />{station}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isDemoMode
            ? <Wifi size={14} className="text-green-500" />
            : <WifiOff size={14} className="text-amber-400" />}
          <StatusBadge status={isOnBreak ? 'BREAK' : activeSession ? (isOnHold ? 'ON_HOLD' : 'PACKING') : 'IDLE'} t={t} />
          <button onClick={() => setLang(lang === 'en' ? 'id' : 'en')}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 border border-gray-200 rounded-lg">
            {t.language}
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t.ordersToday, val: totalOrders,    icon: Package,    color: 'text-green-600' },
            { label: t.avgTime,     val: fmtDur(avgTime), icon: Clock,      color: 'text-blue-600'  },
            { label: t.ordersHr,    val: ordersHr,        icon: TrendingUp, color: 'text-purple-600', target: targetOrdersHr },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
              <s.icon size={16} className={`${s.color} mx-auto mb-1`} />
              <div className={`text-lg font-bold ${s.color}`}>{s.val}</div>
              <div className="text-xs text-gray-400 leading-tight">{s.label}</div>
              {s.target && <div className="text-[8px] font-bold text-gray-400 uppercase mt-1">Target: {s.target}/h</div>}
            </div>
          ))}
        </div>

        {/* Target progress */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${totalOrders >= targetOrdersHr ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Target: {targetOrdersHr} Orders</span>
            </div>
            <span className={`text-xs font-black ${totalOrders >= targetOrdersHr ? 'text-green-600' : 'text-blue-600'}`}>
              {totalOrders} / {targetOrdersHr}
            </span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-1000 ${totalOrders >= targetOrdersHr ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${Math.min(Math.round((totalOrders / targetOrdersHr) * 100), 100)}%` }} />
          </div>
          {totalOrders >= targetOrdersHr
            ? <div className="mt-2 text-[10px] text-green-600 font-bold text-center animate-bounce">Target Achieved! 🚀</div>
            : <div className="mt-2 text-[10px] text-orange-500 font-bold text-center">{targetOrdersHr - totalOrders} more to hit target</div>}
        </div>

        {/* Leaderboard */}
        <Leaderboard data={leaderboard} t={t} compact />

        {/* Active session card */}
        {activeSession && (
          <div className={`rounded-2xl p-4 border ${isOnHold ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm text-gray-700">{isOnHold ? t.onHold : t.packing}</span>
              <span className="font-mono text-lg font-bold text-gray-900">{fmtDur(elapsed)}</span>
            </div>
            <div className="text-xs text-gray-500">
              Bin: <span className="font-mono font-semibold text-gray-800">{activeSession.bin_id}</span>
            </div>
            {isOnHold && activeSession.holds?.length > 0 && (
              <div className="mt-1 text-xs text-orange-700 font-medium">
                {t[activeSession.holds[activeSession.holds.length - 1].reason]}
              </div>
            )}
            {isOnHold && (
              <div className="flex gap-2 mt-3">
                <button onClick={handleResume}
                  className="flex-1 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 flex items-center justify-center gap-1">
                  <Play size={14} />{t.resumePacking}
                </button>
                <button onClick={() => setShowCancelConfirm(true)}
                  className="py-2 px-4 bg-white text-red-500 border border-red-200 text-sm font-semibold rounded-xl hover:bg-red-50">
                  {t.cancelOrder}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Break card */}
        {isOnBreak && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-blue-800 text-sm">{t.onBreak}</div>
              <div className="text-xs text-blue-600 mt-0.5">{fmtDur(breakSec)}</div>
            </div>
            <Coffee size={22} className="text-blue-400" />
          </div>
        )}

        {/* Consumables */}
        {showConsumables && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Box size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900 text-sm">{t.requestConsumables}</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {consumableTypes.filter(ct => enabledConsum.includes(ct)).map(ct => (
                <button key={ct} onClick={() => handleConsumableRequest(ct)}
                  disabled={isOnBreak}
                  className="px-3 py-3 rounded-xl border border-gray-100 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-xs font-bold text-gray-700 transition-all flex flex-col items-center gap-1 active:scale-95 disabled:opacity-40">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mb-1" />
                  {t[ct] || ct}
                </button>
              ))}
              <button onClick={handleCallSupervisor} disabled={isOnBreak}
                className="px-3 py-3 rounded-xl border-2 border-red-100 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 transition-all flex flex-col items-center gap-1 active:scale-95 disabled:opacity-40 col-span-2 sm:col-span-1">
                <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse mb-1" />
                {t.callSupervisor}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-3 text-center uppercase tracking-widest font-bold">Physical Button Simulation</p>
          </div>
        )}

        {/* Scan box */}
        {!isOnBreak && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="text-center mb-4">
              <Scan size={28} className="text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-700">
                {activeSession && activeSession.status === 'IN_PROGRESS' ? t.scanOrder : t.scanBin}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {activeSession && activeSession.status === 'IN_PROGRESS' ? t.step2 : t.step1}
              </p>
            </div>
            <form onSubmit={handleScan} className="flex gap-2">
              <input ref={inputRef} value={inputVal} onChange={e => setInputVal(e.target.value)}
                placeholder={activeSession && activeSession.status === 'IN_PROGRESS' ? t.scanOrderPH : t.scanBinPH}
                disabled={isOnHold || isScanning}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono disabled:bg-gray-100" />
              <button type="submit" disabled={isOnHold || !inputVal.trim() || isScanning}
                className="px-5 py-3 bg-gray-900 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 disabled:opacity-40 transition-colors">
                {isScanning ? '…' : '↵'}
              </button>
            </form>
            {error && (
              <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
                <AlertTriangle size={14} className="shrink-0" />{error}
              </div>
            )}
            {lastScanDebug && (
              <p className="text-[9px] text-gray-300 mt-2 text-center font-mono">
                [{lastScanDebug.type}] {lastScanDebug.normalized}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 pb-8 flex gap-3 shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-40">
        {activeSession && !isOnHold && (
          <button onClick={() => setIsHoldOpen(true)}
            className="flex-1 flex flex-col items-center justify-center gap-1 h-20 rounded-2xl bg-orange-50 text-orange-700 border border-orange-100 font-bold transition-all active:scale-95">
            <Pause size={24} /><span className="text-xs uppercase tracking-wider">{t.holdPause}</span>
          </button>
        )}
        <button onClick={handleBreak} disabled={!!activeSession}
          className={`flex-1 flex flex-col items-center justify-center gap-1 h-20 rounded-2xl font-bold transition-all active:scale-95 ${
            isOnBreak    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
            : activeSession ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white text-gray-700 border-2 border-gray-100 hover:bg-gray-50'
          }`}>
          {isOnBreak ? <Play size={24} /> : <Coffee size={24} />}
          <span className="text-xs uppercase tracking-wider">{isOnBreak ? t.endBreak : t.startBreak}</span>
        </button>
        <button onClick={() => { if (activeSession) { setError('Finish current session first.'); return; } setShowSummary(true); }}
          disabled={isOnBreak || !!activeSession}
          className={`flex-1 flex flex-col items-center justify-center gap-1 h-20 rounded-2xl font-bold transition-all active:scale-95 ${
            isOnBreak || activeSession ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-900 text-white shadow-lg shadow-gray-300'
          }`}>
          <LogOut size={24} /><span className="text-xs uppercase tracking-wider">{t.endShift}</span>
        </button>
      </div>

      {/* Toasts */}
      {consumToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in slide-in-from-top duration-300">
          <CheckCircle size={15} /><span className="text-sm font-semibold">{t.consumableRequested}</span>
        </div>
      )}
      {helpToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in slide-in-from-top duration-300">
          <AlertTriangle size={15} /><span className="text-sm font-semibold">{t.helpRequested}</span>
        </div>
      )}

      {/* Pack success overlay */}
      {showSuccess && lastPacked && (
        <div className="fixed inset-0 bg-emerald-500/90 z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white p-10 rounded-3xl shadow-2xl text-center animate-in zoom-in duration-300 max-w-xs w-full mx-4">
            <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={52} className="text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{t.ordersPacked}</div>
            <div className="text-gray-500 text-base mb-1">{lastPacked.duration}</div>
            {lastPacked.sla === 'Instant' && (
              <span className="inline-block mb-4 text-[10px] font-black bg-orange-100 text-orange-700 px-3 py-1 rounded-full uppercase tracking-widest">⚡ Instant / Same-day</span>
            )}
            <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-2">
              <div>Bin: <span className="font-mono font-bold text-gray-800">{lastPacked.binId}</span></div>
              <div>Order: <span className="font-mono font-bold text-gray-800">{lastPacked.orderId}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Hold modal */}
      {isHoldOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Pause size={18} className="text-orange-600" />{t.selectHoldReason}
            </h3>
            <div className="space-y-2 mb-5">
              {HOLD_REASONS.map(r => (
                <button key={r} onClick={() => setHoldReason(r)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${holdReason === r ? 'border-orange-500 bg-orange-50 text-orange-900 font-semibold' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                  {t[r] || r}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsHoldOpen(false)} className="flex-1 py-2 text-gray-600 font-medium hover:bg-gray-50 rounded-xl text-sm">{t.cancel}</button>
              <button onClick={handleHold} className="flex-1 py-2 bg-orange-600 text-white font-semibold rounded-xl hover:bg-orange-700 text-sm">{t.confirmHold}</button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-base font-bold text-gray-900 mb-2">{t.cancelOrder}?</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to cancel this packing session?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelConfirm(false)} className="flex-1 py-2 text-gray-600 font-medium hover:bg-gray-50 rounded-xl text-sm">{t.cancel}</button>
              <button onClick={handleCancel} className="flex-1 py-2 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 text-sm">{t.approve}</button>
            </div>
          </div>
        </div>
      )}

      {/* Shift summary */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-base font-bold text-gray-900 mb-2">{t.shiftEnded}</h3>
            <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">{t.ordersToday}</span><span className="font-bold text-gray-900">{totalOrders}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t.avgTime}</span><span className="font-bold text-gray-900">{fmtDur(avgTime)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t.ordersHr}</span><span className="font-bold text-gray-900">{ordersHr}</span></div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSummary(false)} className="flex-1 py-2 text-gray-600 font-medium hover:bg-gray-50 rounded-xl text-sm">{t.cancel}</button>
              <button onClick={() => { setShowSummary(false); onLogout(); }} className="flex-1 py-2 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 text-sm">{t.endShift}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

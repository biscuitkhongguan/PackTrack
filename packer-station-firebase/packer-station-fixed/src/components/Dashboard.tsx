import React, { useState, useMemo } from 'react';
import { LogOut, AlertTriangle, MapPin, Edit2, Save, X, Settings as SettingsIcon, Bug, TrendingUp, Clock, AlertCircle, BarChart3, Wifi, WifiOff } from 'lucide-react';
import { User, Session } from '../types';
import { todayStr, fmtDur } from '../utils';
import { useAppData } from '../context/AppDataContext';
import { computeLeaderboard, computePredictiveStock, getDeviceId } from '../services/dataService';
import { ConsumableLog } from './ConsumableLog';
import { LiveSessionCard } from './LiveSessionCard';
import { UserManagement } from './UserManagement';
import { Settings } from './Settings';
import { Analytics } from './Analytics';
import { PackerDetail } from './PackerDetail';
import { Leaderboard } from './Leaderboard';
import { DebugPanel } from './DebugPanel';
import { CONSUMABLE_TYPES } from '../constants';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface DashboardProps {
  user: User; onLogout: () => void; t: any; lang: string; setLang: (l: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, t, lang, setLang }) => {
  const {
    sessions: allSessions, helpRequests, activeLogins, globalStations,
    settings, consumableRequests, users,
    updateHelpRequest, upsertGlobalStation, saveGlobalStations, isDemoMode,
  } = useAppData();

  const [tab,              setTab]              = useState<'live' | 'stations' | 'analytics' | 'users' | 'settings'>('live');
  const [selectedPacker,   setSelectedPacker]   = useState<User | null>(null);
  const [editingStation,   setEditingStation]   = useState<string | null>(null);
  const [newStationName,   setNewStationName]   = useState('');
  const [showDebug,        setShowDebug]        = useState(false);

  const today          = todayStr();
  const todaySessions  = allSessions.filter(s => s.date === today);
  const completed      = todaySessions.filter(s => s.status === 'COMPLETED');
  const activeSessions = todaySessions.filter(s => ['IN_PROGRESS', 'ON_HOLD'].includes(s.status));

  const stock      = settings.stock;
  const thresholds = settings.thresholds;
  const consumTypes = settings.consumable_types;
  const lowStock   = consumTypes.filter(ct => (stock[ct] || 0) <= (thresholds[ct] || 0) && thresholds[ct] > 0);

  const activeHelp = helpRequests.filter(r => r.status === 'PENDING');
  const pendingConsumables = consumableRequests.filter(r => r.date === today && r.status === 'PENDING');
  const leaderboard        = useMemo(() => computeLeaderboard(allSessions), [allSessions]);
  const predictive         = useMemo(() => computePredictiveStock(consumableRequests, stock), [consumableRequests, stock]);

  // Throughput chart
  const hourlyData = useMemo(() => {
    const map: Record<number, number> = {};
    completed.forEach(s => { const h = new Date(s.end_time || s.start_time).getHours(); map[h] = (map[h] || 0) + 1; });
    return Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, orders: map[h] || 0 }));
  }, [completed]);

  const handleResolveHelp = async (id: string) => {
    await updateHelpRequest(id, { status: 'RESOLVED' });
  };

  const handleRenameStation = async (id: string) => {
    if (!newStationName.trim()) return;
    const updated = globalStations.map(s => s.id === id ? { ...s, name: newStationName.trim().toUpperCase() } : s);
    await saveGlobalStations(updated);
    setEditingStation(null);
  };

  const handleDeleteStation = async (id: string) => {
    await saveGlobalStations(globalStations.filter(s => s.id !== id));
  };

  const now = Date.now();
  const ACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 min
  const activeStations   = globalStations.filter(s => now - s.last_active < ACTIVE_THRESHOLD);
  const inactiveStations = globalStations.filter(s => now - s.last_active >= ACTIVE_THRESHOLD);

  const TABS = [
    { id: 'live',      label: t.liveTab,      badge: pendingConsumables.length || null },
    { id: 'stations',  label: t.stationsTab,  badge: null },
    { id: 'analytics', label: t.analyticsTab, badge: null },
    { id: 'users',     label: t.usersTab,     badge: null },
    { id: 'settings',  label: t.settingsTab,  badge: null },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-30">
        <div>
          <div className="font-bold text-gray-900 text-sm">{user.role === 'admin' ? t.adminDashboard : t.supervisorDashboard}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-400">{user.name} · {today}</span>
            {isDemoMode ? <WifiOff size={10} className="text-amber-400" /> : <Wifi size={10} className="text-green-500" />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeHelp.length > 0 && (
            <div className="flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-full animate-pulse">
              <AlertTriangle size={12} />
              <span className="text-xs font-bold">{activeHelp.length} Help Alert{activeHelp.length > 1 ? 's' : ''}</span>
            </div>
          )}
          {user.role === 'admin' && (
            <button onClick={() => setShowDebug(true)} className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors">
              <Bug size={16} />
            </button>
          )}
          <button onClick={() => setLang(lang === 'en' ? 'id' : 'en')}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 border border-gray-200 rounded-lg">{t.language}</button>
          <button onClick={onLogout} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 px-3 py-1.5 border border-gray-200 rounded-xl hover:bg-gray-50">
            <LogOut size={14} />{t.endShift}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-4 pt-4 pb-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Orders Today',     val: completed.length,         color: 'text-green-600',  bg: 'bg-green-50'  },
            { label: 'Active Packers',   val: activeSessions.length,    color: 'text-blue-600',   bg: 'bg-blue-50'   },
            { label: 'Help Alerts',      val: activeHelp.length,        color: 'text-red-600',    bg: 'bg-red-50'    },
            { label: 'Low Stock Items',  val: lowStock.length,          color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
              <div className={`text-xl font-black ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active help alerts banner */}
      {activeHelp.length > 0 && (
        <div className="mx-4 mb-2">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-600" />
              <span className="text-sm font-bold text-red-700">{t.activeHelpAlerts}</span>
            </div>
            <div className="space-y-2">
              {activeHelp.map(r => (
                <div key={r.id} className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-red-100">
                  <div>
                    <span className="font-semibold text-sm text-gray-800">{r.packer_name}</span>
                    <span className="text-gray-400 text-xs ml-2">@ {r.station}</span>
                  </div>
                  <button onClick={() => handleResolveHelp(r.id)}
                    className="text-xs px-3 py-1.5 bg-green-100 text-green-700 font-semibold rounded-lg hover:bg-green-200 transition-colors">
                    {t.helpResolved} ✓
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Low stock */}
      {lowStock.length > 0 && (
        <div className="mx-4 mb-2">
          <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-center gap-2">
            <AlertCircle size={14} className="text-orange-600 flex-shrink-0" />
            <span className="text-xs font-bold text-orange-700">{t.lowStockAlert} {lowStock.map(c => t[c] || c).join(', ')}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 pb-1">
        <div className="flex overflow-x-auto gap-1 bg-gray-100 p-1 rounded-2xl">
          {TABS.map(tab_ => (
            <button key={tab_.id} onClick={() => setTab(tab_.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${tab === tab_.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab_.label}
              {tab_.badge ? <span className="bg-blue-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">{tab_.badge}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 py-4">

        {/* ── LIVE ── */}
        {tab === 'live' && (
          <div className="space-y-4">
            <Leaderboard data={leaderboard} t={t} />

            {/* Hourly chart */}
            {completed.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><TrendingUp size={14} />Hourly Throughput (Today)</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={hourlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="orders" fill="#3b82f6" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            <ConsumableLog t={t} />

            {/* Predictive stock */}
            {Object.keys(predictive).length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Clock size={14} />{t.predictiveStock}</h3>
                <div className="space-y-2">
                  {Object.entries(predictive).map(([type, info]) => (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{t[type] || type}</span>
                      <div className="text-right">
                        <div className={`font-bold text-xs ${info.hoursRemaining !== null && info.hoursRemaining < 2 ? 'text-red-600' : 'text-gray-700'}`}>
                          {info.hoursRemaining !== null ? `${info.hoursRemaining}h remaining` : 'N/A'}
                        </div>
                        <div className="text-[10px] text-gray-400">{info.usagePerHour}/hr</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STATIONS ── */}
        {tab === 'stations' && (
          <div className="space-y-4">
            {/* Active packing sessions */}
            {activeSessions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">{t.activeStations} ({activeSessions.length})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeSessions.map(s => <LiveSessionCard key={s.id} session={s} t={t} />)}
                </div>
              </div>
            )}
            {activeSessions.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <p className="text-gray-400 text-sm">{t.noActiveSessions}</p>
              </div>
            )}

            {/* Registered stations */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-gray-700">Registered Devices ({globalStations.length})</h3>
              </div>
              <div className="divide-y divide-gray-50">
                {globalStations.map(station => {
                  const isActive  = now - station.last_active < ACTIVE_THRESHOLD;
                  const login     = activeLogins.find(l => l.station === station.name);
                  return (
                    <div key={station.id} className="px-5 py-3 flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        {editingStation === station.id ? (
                          <div className="flex gap-2">
                            <input value={newStationName} onChange={e => setNewStationName(e.target.value.toUpperCase())}
                              className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-blue-300" />
                            <button onClick={() => handleRenameStation(station.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save size={14} /></button>
                            <button onClick={() => setEditingStation(null)} className="p-1 text-gray-400 hover:bg-gray-50 rounded"><X size={14} /></button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-gray-800">{station.name}</span>
                              {isActive && <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full uppercase">Active</span>}
                            </div>
                            {login && <div className="text-xs text-gray-400">{login.packer_name}</div>}
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {editingStation !== station.id && (
                          <>
                            <button onClick={() => { setEditingStation(station.id); setNewStationName(station.name); }}
                              className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={12} /></button>
                            <button onClick={() => handleDeleteStation(station.id)}
                              className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"><X size={12} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {globalStations.length === 0 && <p className="text-center text-gray-400 text-sm py-6">No devices registered yet</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {tab === 'analytics' && (
          <Analytics t={t} onPackerClick={id => { const u = users.find(x => x.uid === id); if (u) setSelectedPacker(u); }} />
        )}

        {/* ── USERS ── */}
        {tab === 'users' && <UserManagement t={t} currentUser={user} />}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && <Settings t={t} />}
      </div>

      {/* Packer detail modal */}
      {selectedPacker && <PackerDetail packer={selectedPacker} onClose={() => setSelectedPacker(null)} t={t} />}

      {/* Debug panel */}
      {showDebug && <DebugPanel onClose={() => setShowDebug(false)} />}
    </div>
  );
};

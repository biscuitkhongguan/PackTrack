import React, { useState, useEffect } from 'react';
import { LogOut, AlertTriangle, MapPin, Edit2, Save, X, Settings as SettingsIcon, Bug, TrendingUp, Clock, History, AlertCircle, BarChart3 } from 'lucide-react';
import { User, Session, HelpRequest, ActiveLogin } from '../types';
import { todayStr, fmtDur } from '../utils';
import { getSessions, getStock, getThresholds, getRequests, getConsumableTypes, getConsumableColors, getAllUsers, getHelpRequests, saveHelpRequests, getActiveLogins, getTargetOrdersPerHour, getGlobalStations, saveGlobalStations, getLeaderboard, getPredictiveStock } from '../services/dataService';
import { ConsumableLog } from './ConsumableLog';
import { LiveSessionCard } from './LiveSessionCard';
import { UserManagement } from './UserManagement';
import { Settings } from './Settings';
import { Analytics } from './Analytics';
import { PackerDetail } from './PackerDetail';
import { Leaderboard } from './Leaderboard';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { DebugPanel } from './DebugPanel';
import { CONSUMABLE_TYPES } from '../constants';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  t: any;
  lang: string;
  setLang: (l: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, t, lang, setLang }) => {
  const [tab, setTab] = useState<'live' | 'stations' | 'analytics' | 'users' | 'settings'>('live');
  const [sessions, setSessions] = useState<Session[]>(getSessions);
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>(getHelpRequests());
  const [activeLogins, setActiveLogins] = useState<ActiveLogin[]>(getActiveLogins());
  const [globalStations, setGlobalStations] = useState(getGlobalStations());
  const [leaderboard, setLeaderboard] = useState(getLeaderboard());
  const [editingStationId, setEditingStationId] = useState<string | null>(null);
  const [newStationName, setNewStationName] = useState('');
  const [selectedPacker, setSelectedPacker] = useState<User | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => { 
      setSessions(getSessions()); 
      setHelpRequests(getHelpRequests());
      setActiveLogins(getActiveLogins());
      setGlobalStations(getGlobalStations());
      setLeaderboard(getLeaderboard());
      tick(n => n + 1); 
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const today = todayStr();
  const todaySessions = sessions.filter(s => s.date === today);
  const completed = todaySessions.filter(s => s.status === 'COMPLETED');
  const active = todaySessions.filter(s => ['IN_PROGRESS', 'ON_HOLD'].includes(s.status));

  // Inventory Alerts
  const consumableTypes = getConsumableTypes(CONSUMABLE_TYPES);
  const stock = getStock();
  const thresholds = getThresholds();
  const lowStockItems = consumableTypes.filter(ct => (stock[ct] || 0) <= (thresholds[ct] || 0));

  const TABS = [
    { id: 'live', label: t.liveTab },
    { id: 'stations', label: t.stationsTab },
    { id: 'analytics', label: t.analyticsTab },
    { id: 'users', label: t.usersTab },
    { id: 'settings', label: t.settingsTab }
  ] as const;

  const requests = getRequests();
  const pendingRequests = requests.filter(r => r.date === today && r.status === 'PENDING');
  const kanbanColors = getConsumableColors();

  const handlePackerClick = (packerId: string) => {
    const users = getAllUsers();
    const found = users.find(u => u.uid === packerId);
    if (found) setSelectedPacker(found);
  };

  const startEditingStation = (id: string, name: string) => {
    setEditingStationId(id);
    setNewStationName(name);
  };

  const saveStationRename = () => {
    if (!editingStationId || !newStationName.trim()) return;
    const updated = globalStations.map(s => 
      s.id === editingStationId ? { ...s, name: newStationName.trim().toUpperCase() } : s
    );
    saveGlobalStations(updated);
    setGlobalStations(updated);
    setEditingStationId(null);
  };

  const handleResolveHelp = (id: string) => {
    const updated = helpRequests.map(r => r.id === id ? { ...r, status: 'RESOLVED' as const } : r);
    saveHelpRequests(updated);
    setHelpRequests(updated);
  };

  const activeHelp = helpRequests.filter(r => r.status === 'PENDING');

  const getStationDeviceId = (name: string) => {
    return globalStations.find(s => s.name === name)?.id;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <div className="font-bold text-gray-900 text-sm">
            {user.role === 'admin' ? t.adminDashboard : t.supervisorDashboard}
          </div>
          <div className="text-xs text-gray-500">{user.name} · {today}</div>
        </div>
        <div className="flex items-center gap-2">
          {user.role === 'admin' && (
            <button 
              onClick={() => setShowDebug(true)}
              className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
              title="Debug Panel"
            >
              <Bug size={18} />
            </button>
          )}
          <button onClick={() => setLang(lang === 'en' ? 'id' : 'en')}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 border border-gray-200 rounded-lg">{t.language}</button>
          <button onClick={onLogout}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <LogOut size={14} />{t.signOut}
          </button>
        </div>
      </div>

      {/* Help Alerts Banner */}
      {activeHelp.length > 0 && (
        <div className="bg-red-600 animate-pulse px-4 py-4 flex items-center justify-between text-white shadow-lg sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-2 rounded-full">
              <AlertTriangle size={24} className="animate-bounce" />
            </div>
            <div>
              <div className="text-base font-black uppercase tracking-tighter leading-none">{t.activeHelpAlerts} ({activeHelp.length})</div>
              <div className="text-xs font-bold opacity-90 mt-1">
                {activeHelp.map(r => r.station || 'UNKNOWN').join(', ')}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {activeHelp.slice(0, 2).map(r => (
              <button 
                key={r.id}
                onClick={() => handleResolveHelp(r.id)}
                className="bg-white text-red-600 px-4 py-2 rounded-xl text-xs font-black hover:bg-red-50 transition-all active:scale-95 shadow-sm uppercase"
              >
                {t.helpResolved} {r.station || '?'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pt-5">
        {/* Kanban Status Board */}
        <div className="mb-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
              {t.kanbanStatus}
            </h3>
            <a 
              href="?kanban=true" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-tight flex items-center gap-1"
            >
              {t.openKanban}
            </a>
          </div>
          <div className="flex flex-wrap gap-3">
            {consumableTypes.filter(type => pendingRequests.some(r => r.consumable_type === type)).map(type => (
              <div key={type} className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-gray-100">
                <div 
                  className="w-4 h-4 rounded-full shadow-inner animate-pulse" 
                  style={{ backgroundColor: kanbanColors[type] || '#64748b' }}
                />
                <span className="text-xs font-bold text-gray-700">
                  {t[type] || type.replace(/_/g, ' ')}
                </span>
                <span className="px-1.5 py-0.5 bg-white border border-gray-200 rounded-md text-[10px] font-mono">
                  {pendingRequests.filter(r => r.consumable_type === type).length}
                </span>
              </div>
            ))}
            {pendingRequests.length === 0 && (
              <div className="text-xs text-gray-400 italic">No pending supply requests</div>
            )}
          </div>
        </div>

        {/* Summary Metrics Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: t.activeLabel, val: activeLogins.length, color: 'text-green-500' },
            { label: t.completedLabel, val: completed.length, color: 'text-blue-500' },
            { label: t.packersLabel, val: new Set(todaySessions.map(s => s.packer_id)).size, color: 'text-purple-500' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
              <div className={`text-4xl font-black ${k.color}`}>{k.val}</div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-2">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Low Stock Alerts */}
        {lowStockItems.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-3xl p-6 mb-4">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="text-red-500" size={24} />
              <h4 className="text-lg font-bold text-red-900">{t.lowStockAlert}!</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(item => (
                <span key={item} className="px-4 py-2 bg-red-100/50 text-red-700 rounded-xl text-xs font-bold uppercase border border-red-200/50">
                  {t[item] || item.replace(/_/g, ' ')}: {stock[item] || 0}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Leaderboard */}
        <div className="grid grid-cols-1 gap-4 mb-4">
          <Leaderboard data={leaderboard} t={t} onPackerClick={handlePackerClick} />
        </div>

        {/* Tabs Navigation */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
          {TABS.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === tb.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}>{tb.label}</button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {tab === 'live' && (
            <div className="space-y-4">
              <ConsumableLog t={t} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {active.map(s => <LiveSessionCard key={s.id} session={s} t={t} />)}
              </div>
            </div>
          )}

          {tab === 'stations' && (
            <div className="space-y-6">
              {/* Global Station Registry */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <SettingsIcon size={16} className="text-gray-600" />
                  Station Registry & Remote Rename
                </h3>
                <div className="space-y-3">
                  {globalStations.map(gs => (
                    <div key={gs.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${Date.now() - gs.last_active < 60000 ? 'bg-green-500' : 'bg-gray-300'}`} />
                        {editingStationId === gs.id ? (
                          <input 
                            value={newStationName}
                            onChange={(e) => setNewStationName(e.target.value.toUpperCase())}
                            className="bg-white border border-blue-300 rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 uppercase"
                            autoFocus
                          />
                        ) : (
                          <span className="font-mono text-sm font-bold text-gray-700">{gs.name}</span>
                        )}
                        <span className="text-[10px] text-gray-400 font-mono">ID: {gs.id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {editingStationId === gs.id ? (
                          <>
                            <button onClick={saveStationRename} className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors">
                              <Save size={14} />
                            </button>
                            <button onClick={() => setEditingStationId(null)} className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button onClick={() => startEditingStation(gs.id, gs.name)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors">
                            <Edit2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {globalStations.length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-4">No stations registered yet.</p>
                  )}
                </div>
              </div>

              {/* Active Stations */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {t.activeStations}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeLogins.map(login => {
                    const st = login.station;
                    const stationSessions = active.filter(s => (s.station || 'UNKNOWN') === st);
                    return (
                      <div key={st} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-green-50 text-green-600 rounded-lg">
                              <MapPin size={14} />
                            </div>
                            <span className="font-bold text-gray-900">{st}</span>
                          </div>
                          <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase">
                            {t.activeLabel}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <button 
                            onClick={() => handlePackerClick(login.packer_id)}
                            className="w-full p-2 rounded-xl hover:bg-gray-50 transition-colors text-left"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-700">{login.packer_name}</span>
                              <span className="text-xs text-gray-400 font-mono">
                                {stationSessions.length > 0 ? stationSessions[0].status : t.idle}
                              </span>
                            </div>
                            
                            {/* Performance Indicator */}
                            {(() => {
                              const packerSessions = todaySessions.filter(s => s.packer_id === login.packer_id && s.status === 'COMPLETED');
                              const firstStart = packerSessions.length > 0 ? Math.min(...packerSessions.map(s => s.start_time)) : null;
                              const hoursWorked = firstStart ? (Date.now() - firstStart) / 3600000 : 0;
                              const ordersHr = hoursWorked > 0.05 ? Math.round(packerSessions.length / hoursWorked * 10) / 10 : 0;
                              const target = getTargetOrdersPerHour();
                              const perf = Math.min(Math.round((ordersHr / target) * 100), 100);
                              
                              return (
                                <div className="mt-1">
                                  <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-tighter mb-0.5">
                                    <span className="text-gray-400">{ordersHr} OPH</span>
                                    <span className={perf >= 100 ? 'text-green-600' : 'text-blue-600'}>{perf}%</span>
                                  </div>
                                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                    <div 
                                      className={`h-full transition-all duration-1000 ${perf >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                      style={{ width: `${perf}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })()}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {activeLogins.length === 0 && (
                    <div className="col-span-full py-8 text-center text-gray-400 text-sm italic bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      {t.noActiveSessions}
                    </div>
                  )}
                </div>
              </div>

              {/* Inactive Stations */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-300" />
                  {t.inactiveStations}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-60">
                  {Array.from(new Set(todaySessions.map(s => s.station || 'UNKNOWN'))).map(st => String(st))
                    .filter(st => !activeLogins.some(l => l.station === st))
                    .map(st => {
                      const lastSession = todaySessions
                        .filter(s => (s.station || 'UNKNOWN') === st)
                        .sort((a, b) => (b.end_time || 0) - (a.end_time || 0))[0];
                      
                      return (
                        <div key={st} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm grayscale">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-gray-50 text-gray-400 rounded-lg">
                                <MapPin size={14} />
                              </div>
                              <span className="font-bold text-gray-900">{st}</span>
                            </div>
                            <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase">
                              {t.idle}
                            </span>
                          </div>
                          {lastSession && (
                            <div className="text-[10px] text-gray-400">
                              Last: <span className="font-medium">{lastSession.packer_name}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {tab === 'users' && <UserManagement t={t} currentUser={user} />}
          {tab === 'analytics' && <Analytics t={t} onPackerClick={handlePackerClick} />}
          {tab === 'settings' && <Settings t={t} />}
        </div>
      </div>

      {/* Modals */}
      {selectedPacker && (
        <PackerDetail 
          packer={selectedPacker} 
          onClose={() => setSelectedPacker(null)} 
          t={t} 
        />
      )}

      {showDebug && <DebugPanel onClose={() => setShowDebug(false)} />}
    </div>
  );
};

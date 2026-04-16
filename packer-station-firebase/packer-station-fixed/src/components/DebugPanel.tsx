import React, { useState } from 'react';
import { Bug, Trash2, Database, UserPlus, RefreshCw, AlertTriangle, Package, Zap, Wifi, WifiOff } from 'lucide-react';
import { useAppData, SEED_USERS } from '../context/AppDataContext';
import { uid, todayStr } from '../utils';
import { Session } from '../types';

interface DebugPanelProps { onClose: () => void; }

export const DebugPanel: React.FC<DebugPanelProps> = ({ onClose }) => {
  const { upsertSession, upsertHelpRequest, clearAllData, resetUsers, users, isDemoMode, settings, updateSettings } = useAppData();
  const [confirming, setConfirming] = useState<{ type: 'DATA' | 'USERS'; title: string; desc: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!confirming) return;
    setLoading(true);
    try {
      if (confirming.type === 'DATA')  await clearAllData();
      if (confirming.type === 'USERS') await resetUsers();
    } finally {
      setLoading(false);
      setConfirming(null);
    }
  };

  const addMockSessions = async (count: number) => {
    const packers = users.filter(u => u.role === 'packer' && u.isActive !== false);
    if (!packers.length) return;
    setLoading(true);
    try {
      for (let i = 0; i < count; i++) {
        const packer    = packers[Math.floor(Math.random() * packers.length)];
        const now       = Date.now() - Math.random() * 3_600_000 * 8;
        const cycleTime = Math.floor(Math.random() * 60) + 30;
        const session: Session = {
          id:                  uid(),
          packer_id:           packer.uid,
          packer_name:         packer.name,
          station:             'DEBUG-' + (Math.floor(Math.random() * 3) + 1),
          bin_id:              'BIN-' + Math.floor(Math.random() * 1000).toString().padStart(4, '0'),
          order_id:            'ORD-' + Math.floor(Math.random() * 100000).toString().padStart(5, '0'),
          start_time:          now - cycleTime * 1000,
          end_time:            now,
          date:                todayStr(),
          status:              'COMPLETED',
          cycle_time_seconds:  cycleTime,
          total_duration_seconds: cycleTime,
          holds:               [],
          sla:                 Math.random() > 0.8 ? 'Instant' : 'Regular',
        };
        await upsertSession(session);
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerHelp = async () => {
    setLoading(true);
    try {
      await upsertHelpRequest({
        id: uid(), packer_id: 'p1', packer_name: 'Alice Packer',
        station: 'DEBUG-1', requested_at: Date.now(), date: todayStr(), status: 'PENDING',
      });
    } finally {
      setLoading(false);
    }
  };

  const simulateLowStock = async () => {
    const firstType = settings.consumable_types[0];
    if (!firstType) return;
    await updateSettings({ stock: { ...settings.stock, [firstType]: 0 } });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><Bug size={20} /></div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Admin Debug Panel</h2>
              <div className={`flex items-center gap-1 text-[10px] font-bold uppercase ${isDemoMode ? 'text-amber-500' : 'text-green-500'}`}>
                {isDemoMode ? <WifiOff size={10} /> : <Wifi size={10} />}
                {isDemoMode ? 'Demo Mode (localStorage)' : 'Firebase Mode (Firestore)'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <RefreshCw size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-3 max-h-[65vh] overflow-y-auto">
          {[
            { label: 'Add 1 Mock Session',  desc: 'Quick data injection',     icon: Database, color: 'blue',   onClick: () => addMockSessions(1)  },
            { label: 'Add 10 Mock Sessions', desc: 'Bulk data injection',      icon: Zap,      color: 'indigo', onClick: () => addMockSessions(10) },
            { label: 'Trigger Help Alert',   desc: 'Test emergency banner',    icon: AlertTriangle, color: 'red', onClick: triggerHelp },
            { label: 'Simulate Low Stock',   desc: 'Test inventory alerts',    icon: Package,  color: 'orange', onClick: simulateLowStock },
          ].map(item => (
            <button key={item.label} onClick={item.onClick} disabled={loading}
              className={`flex items-center gap-3 w-full p-4 bg-white hover:bg-${item.color}-50 rounded-2xl border border-gray-100 hover:border-${item.color}-200 transition-all group disabled:opacity-50`}>
              <div className={`p-2 bg-${item.color}-100 text-${item.color}-600 rounded-lg`}>
                <item.icon size={18} />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-gray-800">{item.label}</div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">{item.desc}</div>
              </div>
            </button>
          ))}

          <div className="pt-2 border-t border-gray-100 space-y-3">
            <button onClick={() => setConfirming({ type: 'DATA', title: 'Clear All Data?', desc: 'Wipes sessions, consumable requests, help requests, and active logins. Cannot be undone.' })}
              disabled={loading}
              className="flex items-center gap-3 w-full p-4 bg-gray-50 hover:bg-red-50 rounded-2xl border border-gray-100 hover:border-red-200 transition-all disabled:opacity-50">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg"><Trash2 size={18} /></div>
              <div className="text-left">
                <div className="text-sm font-bold text-gray-800">Clear All Sessions & Requests</div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Wipe operational data</div>
              </div>
            </button>
            <button onClick={() => setConfirming({ type: 'USERS', title: 'Reset User Registry?', desc: 'Restores all users to default seed accounts (Alice, Bob, Citra, Sarah, Admin).' })}
              disabled={loading}
              className="flex items-center gap-3 w-full p-4 bg-gray-50 hover:bg-purple-50 rounded-2xl border border-gray-100 hover:border-purple-200 transition-all disabled:opacity-50">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><UserPlus size={18} /></div>
              <div className="text-left">
                <div className="text-sm font-bold text-gray-800">Reset User Registry</div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Restore seed accounts</div>
              </div>
            </button>
          </div>

          <div className="bg-gray-50 rounded-xl p-3 font-mono text-[10px] text-gray-500 space-y-1">
            <div>Version: 2.0.0-firebase</div>
            <div>Mode: {isDemoMode ? 'Demo (localStorage)' : 'Production (Firestore)'}</div>
            <div>Users: {users.length} · Sessions loaded: ∞ (real-time)</div>
          </div>
        </div>
      </div>

      {confirming && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 border border-gray-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-black text-gray-900 text-center mb-2">{confirming.title}</h3>
            <p className="text-sm text-gray-500 text-center mb-8 leading-relaxed">{confirming.desc}</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleConfirm} disabled={loading}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all disabled:opacity-50">
                {loading ? 'Processing…' : 'YES, PROCEED'}
              </button>
              <button onClick={() => setConfirming(null)} disabled={loading}
                className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl transition-all">
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { Bug, Trash2, Database, UserPlus, RefreshCw, AlertTriangle, Package, Zap } from 'lucide-react';
import { saveSessions, saveRequests, saveHelpRequests, saveActiveLogins, getAllUsers, saveAllUsers, SEED_USERS, saveStock, getStock } from '../services/dataService';
import { uid, todayStr } from '../utils';

interface DebugPanelProps {
  onClose: () => void;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ onClose }) => {
  const [confirming, setConfirming] = useState<{ type: 'DATA' | 'USERS', title: string, desc: string } | null>(null);

  const executeResetData = () => {
    saveSessions([]);
    saveRequests([]);
    saveHelpRequests([]);
    saveActiveLogins([]);
    window.location.reload();
  };

  const executeResetUsers = () => {
    saveAllUsers(SEED_USERS);
    window.location.reload();
  };

  const handleConfirm = () => {
    if (!confirming) return;
    if (confirming.type === 'DATA') executeResetData();
    else executeResetUsers();
  };

  const addMockSessions = (count: number = 1) => {
    const users = getAllUsers().filter(u => u.role === 'packer');
    if (users.length === 0) return;
    
    const sessions = load('pp_sessions', []);
    const newSessions = [];
    
    for (let i = 0; i < count; i++) {
      const packer = users[Math.floor(Math.random() * users.length)];
      const now = Date.now() - (Math.random() * 3600000 * 8); // Random time in last 8 hours
      const cycleTime = Math.floor(Math.random() * 60) + 30; // 30-90s
      
      newSessions.push({
        id: uid(),
        packer_id: packer.uid,
        packer_name: packer.name,
        station: 'DEBUG-STATION-' + (Math.floor(Math.random() * 3) + 1),
        bin_id: 'BIN-' + Math.floor(Math.random() * 1000),
        order_id: 'ORD-' + Math.floor(Math.random() * 100000),
        start_time: now - (cycleTime * 1000),
        end_time: now,
        date: todayStr(),
        status: 'COMPLETED' as const,
        cycle_time_seconds: cycleTime,
        holds: [],
        consumables: []
      });
    }
    
    save('pp_sessions', [...sessions, ...newSessions]);
    window.location.reload();
  };

  const triggerHelp = () => {
    const requests = load('pp_help_requests', []);
    const newReq = {
      id: uid(),
      station: 'DEBUG-STATION',
      packer_id: 'p1',
      packer_name: 'Alice Packer',
      timestamp: Date.now(),
      status: 'PENDING' as const
    };
    save('pp_help_requests', [...requests, newReq]);
    window.location.reload();
  };

  const simulateLowStock = () => {
    const stock = getStock();
    const firstKey = Object.keys(stock)[0] || 'TAPE';
    saveStock({ ...stock, [firstKey]: 0 });
    window.location.reload();
  };

  // Helper for direct localStorage access in debug
  const load = (key: string, def: any) => {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : def;
  };
  const save = (key: string, val: any) => localStorage.setItem(key, JSON.stringify(val));

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
              <Bug size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-gray-900">Admin Debug Panel</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">System Maintenance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <RefreshCw size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 gap-3">
            <button 
              onClick={() => addMockSessions(1)}
              className="flex items-center gap-3 w-full p-4 bg-white hover:bg-blue-50 rounded-2xl border border-gray-100 hover:border-blue-200 transition-all group"
            >
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                <Database size={18} />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-gray-800">Add 1 Mock Session</div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Quick Data Injection</div>
              </div>
            </button>

            <button 
              onClick={() => addMockSessions(10)}
              className="flex items-center gap-3 w-full p-4 bg-white hover:bg-indigo-50 rounded-2xl border border-gray-100 hover:border-indigo-200 transition-all group"
            >
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg group-hover:scale-110 transition-transform">
                <Zap size={18} />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-gray-800">Add 10 Mock Sessions</div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Bulk Data Injection</div>
              </div>
            </button>

            <button 
              onClick={triggerHelp}
              className="flex items-center gap-3 w-full p-4 bg-white hover:bg-red-50 rounded-2xl border border-gray-100 hover:border-red-200 transition-all group"
            >
              <div className="p-2 bg-red-100 text-red-600 rounded-lg group-hover:scale-110 transition-transform">
                <AlertTriangle size={18} />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-gray-800">Trigger Help Alert</div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Test Emergency Banner</div>
              </div>
            </button>

            <button 
              onClick={simulateLowStock}
              className="flex items-center gap-3 w-full p-4 bg-white hover:bg-orange-50 rounded-2xl border border-gray-100 hover:border-orange-200 transition-all group"
            >
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg group-hover:scale-110 transition-transform">
                <Package size={18} />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-gray-800">Simulate Low Stock</div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Test Inventory Alerts</div>
              </div>
            </button>

            <div className="pt-4 border-t border-gray-100 mt-2">
              <button 
                onClick={() => setConfirming({ 
                  type: 'DATA', 
                  title: 'Reset All Data?', 
                  desc: 'This will clear all sessions, requests, and active logins. This action cannot be undone.' 
                })}
                className="flex items-center gap-3 w-full p-4 bg-gray-50 hover:bg-red-100 rounded-2xl border border-gray-100 transition-all group"
              >
                <div className="p-2 bg-red-100 text-red-600 rounded-lg group-hover:scale-110 transition-transform">
                  <Trash2 size={18} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-gray-800">Clear All Sessions</div>
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Wipe Operational Data</div>
                </div>
              </button>
            </div>

            <button 
              onClick={() => setConfirming({ 
                type: 'USERS', 
                title: 'Reset User Registry?', 
                desc: 'This will restore all user accounts to their default seed state.' 
              })}
              className="flex items-center gap-3 w-full p-4 bg-gray-50 hover:bg-purple-100 rounded-2xl border border-gray-100 transition-all group"
            >
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg group-hover:scale-110 transition-transform">
                <UserPlus size={18} />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-gray-800">Reset User Registry</div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Restore Seed Accounts</div>
              </div>
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-100">
            <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              <span>System Info</span>
              <span className="text-amber-500">Admin Mode</span>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 font-mono text-[10px] text-gray-500 space-y-1">
              <div>Version: 1.2.5-stable</div>
              <div>Environment: Production (Sim)</div>
              <div>Storage: LocalStorage (Mock)</div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirming && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 animate-in zoom-in duration-300 border border-gray-100">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-xl font-black text-gray-900 text-center mb-2">{confirming.title}</h3>
            <p className="text-sm text-gray-500 text-center mb-8 font-medium leading-relaxed">
              {confirming.desc}
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleConfirm}
                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all active:scale-95 shadow-lg shadow-red-200"
              >
                YES, PROCEED
              </button>
              <button 
                onClick={() => setConfirming(null)}
                className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-2xl transition-all active:scale-95"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


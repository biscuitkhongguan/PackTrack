import React, { useState, useEffect } from 'react';
import { Box, Clock, BarChart3, CheckCircle2 } from 'lucide-react';
import { ConsumableRequest } from '../types';
import { todayStr, elapsed } from '../utils';
import { getRequests, saveRequests, getConsumableColors } from '../services/dataService';

interface ConsumableLogProps {
  t: any;
}

export const ConsumableLog: React.FC<ConsumableLogProps> = ({ t }) => {
  const [requests, setRequests] = useState<ConsumableRequest[]>(getRequests);
  const [colors, setColors] = useState<Record<string, string>>(getConsumableColors());
  const [tab, setTab] = useState<'PENDING' | 'COMPLETED'>('PENDING');
  const [, tick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      setRequests(getRequests());
      setColors(getConsumableColors());
      tick(n => n + 1);
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const today = todayStr();
  const todayReqs = requests.filter(r => r.date === today);
  
  const pending = todayReqs.filter(r => r.status === 'PENDING').sort((a, b) => b.requested_at - a.requested_at);
  const completed = todayReqs.filter(r => r.status === 'COMPLETED').sort((a, b) => b.requested_at - a.requested_at);

  const summary = todayReqs.reduce((acc, req) => {
    acc[req.consumable_type] = (acc[req.consumable_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleComplete = (id: string) => {
    const all = getRequests();
    const updated = all.map(r => r.id === id ? { ...r, status: 'COMPLETED' as const } : r);
    saveRequests(updated);
    setRequests(updated);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-4">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box size={18} className="text-blue-500" />
          <h2 className="font-semibold text-gray-800">{t.consumableMonitor}</h2>
        </div>
        <span className="text-xs text-gray-400">{today}</span>
      </div>

      <div className="flex border-b border-gray-100">
        {(['PENDING', 'COMPLETED'] as const).map(tb => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${tab === tb
                ? 'text-blue-600 border-blue-500'
                : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}>
            {tb === 'PENDING' ? t.pendingRequests : t.fulfilledRequests}
            {tb === 'PENDING' && pending.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded-full animate-pulse">
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
        {tab === 'PENDING' ? (
          pending.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-2 text-gray-400">
              <Box size={28} className="text-gray-200" />
              <p className="text-sm font-medium">{t.noActiveRequests}</p>
            </div>
          ) : pending.map(req => (
            <div key={req.id} className="px-5 py-3 flex items-center gap-3 group hover:bg-gray-50 transition-colors">
              <div 
                className="w-3 h-3 rounded-full shrink-0 shadow-sm animate-pulse" 
                style={{ backgroundColor: colors[req.consumable_type] || '#64748b' }}
                title={t.kanbanColor}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{req.packer_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-tight">
                    {t[req.consumable_type] || req.consumable_type.replace(/_/g, ' ')}
                  </span>
                  {req.station_bin_id && (
                    <span className="text-xs text-gray-400">
                      {t.stationLabel}: <span className="font-medium text-gray-600">{req.station_bin_id}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Clock size={10} />
                    {elapsed(req.requested_at)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleComplete(req.id)}
                className="p-2 text-gray-300 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                title={t.approve}
              >
                <CheckCircle2 size={20} />
              </button>
            </div>
          ))
        ) : (
          completed.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-2 text-gray-400">
              <CheckCircle2 size={28} className="text-gray-200" />
              <p className="text-sm font-medium">{t.noActiveRequests}</p>
            </div>
          ) : completed.map(req => (
            <div key={req.id} className="px-5 py-3 flex items-center gap-3 opacity-60">
              <div 
                className="w-3 h-3 rounded-full shrink-0" 
                style={{ backgroundColor: colors[req.consumable_type] || '#64748b' }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-600 truncate">{req.packer_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-tight">
                    {t[req.consumable_type] || req.consumable_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-gray-400">
                    {new Date(req.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <CheckCircle2 size={16} className="text-green-500" />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

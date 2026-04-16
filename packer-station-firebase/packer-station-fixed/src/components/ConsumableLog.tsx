import React, { useState } from 'react';
import { Box, Clock, BarChart3, CheckCircle2 } from 'lucide-react';
import { todayStr, elapsed } from '../utils';
import { useAppData } from '../context/AppDataContext';

interface ConsumableLogProps { t: any; }

export const ConsumableLog: React.FC<ConsumableLogProps> = ({ t }) => {
  const { consumableRequests, settings, updateConsumableRequest } = useAppData();
  const [tab, setTab] = useState<'PENDING' | 'COMPLETED'>('PENDING');
  const today     = todayStr();
  const todayReqs = consumableRequests.filter(r => r.date === today);
  const pending   = todayReqs.filter(r => r.status === 'PENDING').sort((a, b) => b.requested_at - a.requested_at);
  const completed = todayReqs.filter(r => r.status === 'COMPLETED').sort((a, b) => b.requested_at - a.requested_at);
  const summary   = todayReqs.reduce((acc, r) => { acc[r.consumable_type] = (acc[r.consumable_type] || 0) + 1; return acc; }, {} as Record<string, number>);

  const handleComplete = async (id: string) => {
    await updateConsumableRequest(id, { status: 'COMPLETED' });
  };

  const colors = settings.consumable_colors;

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
            className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === tb ? 'text-blue-600 border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-700'}`}>
            {tb === 'PENDING' ? `${t.pendingRequests} (${pending.length})` : t.fulfilledRequests}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'PENDING' && (
          <>
            {pending.length === 0
              ? <p className="text-center text-gray-400 text-sm py-8">{t.noActiveRequests}</p>
              : <div className="space-y-2">
                  {pending.map(r => (
                    <div key={r.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors[r.consumable_type] || '#64748b' }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800">{t[r.consumable_type] || r.consumable_type}</div>
                        <div className="text-xs text-gray-400">{r.packer_name} · {r.station || '—'} · <Clock size={10} className="inline" /> {elapsed(r.requested_at)}</div>
                      </div>
                      <button onClick={() => handleComplete(r.id)}
                        className="text-xs px-3 py-1.5 bg-green-100 text-green-700 font-semibold rounded-lg hover:bg-green-200 transition-colors flex items-center gap-1">
                        <CheckCircle2 size={12} />{t.markFulfilled}
                      </button>
                    </div>
                  ))}
                </div>}
          </>
        )}

        {tab === 'COMPLETED' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} className="text-gray-500" />
              <span className="text-sm font-semibold text-gray-700">{t.usageAnalytics}</span>
            </div>
            {Object.entries(summary).length === 0
              ? <p className="text-center text-gray-400 text-sm py-4">{t.allClear}</p>
              : Object.entries(summary)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: colors[type] || '#64748b' }} />
                      <span className="text-sm text-gray-700 flex-1">{t[type] || type}</span>
                      <span className="text-sm font-bold text-gray-900">{count}×</span>
                    </div>
                  ))}
          </div>
        )}
      </div>
    </div>
  );
};

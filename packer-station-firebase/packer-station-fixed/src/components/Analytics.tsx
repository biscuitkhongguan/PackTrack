import React, { useState, useMemo } from 'react';
import { Calendar, TrendingUp, Package, Users, BarChart3, Download, Clock, Zap } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine } from 'recharts';
import { fmtDur, downloadCSV } from '../utils';
import { format, parseISO, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface AnalyticsProps { t: any; onPackerClick: (id: string) => void; }

export const Analytics: React.FC<AnalyticsProps> = ({ t, onPackerClick }) => {
  const { sessions: allSessions, consumableRequests, settings, users } = useAppData();
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate,   setEndDate]   = useState(new Date().toISOString().split('T')[0]);

  const targetOPH        = settings.target_orders_per_hour;
  const targetTotal      = settings.target_total_orders;
  const consumableTypes  = settings.consumable_types;

  const { filteredSessions, filteredRequests } = useMemo(() => {
    const start = parseISO(startDate);
    const end   = parseISO(endDate);
    return {
      filteredSessions: allSessions.filter(s => { const d = parseISO(s.date); return isWithinInterval(d, { start, end }); }),
      filteredRequests: consumableRequests.filter(r => { const d = parseISO(r.date); return isWithinInterval(d, { start, end }); }),
    };
  }, [allSessions, consumableRequests, startDate, endDate]);

  const completed = filteredSessions.filter(s => s.status === 'COMPLETED');

  // Per-packer stats
  const packerStats = useMemo(() => {
    const map: Record<string, { id: string; name: string; count: number; totalCycle: number; firstStart: number }> = {};
    completed.forEach(s => {
      if (!map[s.packer_id]) map[s.packer_id] = { id: s.packer_id, name: s.packer_name, count: 0, totalCycle: 0, firstStart: s.start_time };
      map[s.packer_id].count++;
      map[s.packer_id].totalCycle += s.cycle_time_seconds || 0;
      if (s.start_time < map[s.packer_id].firstStart) map[s.packer_id].firstStart = s.start_time;
    });
    return Object.values(map).map(p => {
      const hours = (Date.now() - p.firstStart) / 3_600_000;
      return { ...p, oph: hours > 0.05 ? Math.round(p.count / hours * 10) / 10 : 0, avgCycle: p.count ? Math.round(p.totalCycle / p.count) : 0 };
    }).sort((a, b) => b.count - a.count);
  }, [completed]);

  // Consumable usage
  const consumableStats = useMemo(() =>
    consumableTypes.map(type => ({ type, count: filteredRequests.filter(r => r.consumable_type === type).length }))
      .filter(x => x.count > 0).sort((a, b) => b.count - a.count)
  , [filteredRequests, consumableTypes]);

  // SLA breakdown
  const slaStats = useMemo(() => ({
    regular: completed.filter(s => !s.sla || s.sla === 'Regular').length,
    instant: completed.filter(s => s.sla === 'Instant').length,
  }), [completed]);

  // Daily trend
  const dailyTrend = useMemo(() => {
    const map: Record<string, number> = {};
    completed.forEach(s => { map[s.date] = (map[s.date] || 0) + 1; });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, orders]) => ({ date: format(parseISO(date), 'MMM d'), orders }));
  }, [completed]);

  const COLORS = ['#3b82f6','#22c55e','#f59e0b','#ef4444','#a855f7','#06b6d4','#f97316'];

  return (
    <div className="space-y-6 pb-8">
      {/* Date range */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Calendar size={16} className="text-gray-400" />
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          <span className="text-gray-400">→</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t.totalOrders,     val: completed.length,            icon: Package,    color: 'text-green-600'  },
          { label: t.totalPackers,    val: packerStats.length,           icon: Users,      color: 'text-blue-600'   },
          { label: '⚡ Instant',      val: slaStats.instant,             icon: Zap,        color: 'text-orange-600' },
          { label: t.totalConsumables, val: filteredRequests.length,     icon: BarChart3,  color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
            <s.icon size={16} className={`${s.color} mx-auto mb-1`} />
            <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
            <div className="text-xs text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Daily trend */}
      {dailyTrend.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><TrendingUp size={14} />Daily Orders Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <ReferenceLine y={targetTotal} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Target', fontSize: 10, fill: '#f59e0b' }} />
              <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Packer performance */}
      {packerStats.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Users size={14} />{t.performanceByPacker}</h3>
            <button onClick={() => downloadCSV(packerStats, 'packer-performance.csv')}
              className="text-xs text-blue-600 font-semibold hover:text-blue-800 flex items-center gap-1">
              <Download size={12} />{t.exportCSV}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {[t.packerCol, t.ordersCol, t.ordersPerHour, t.avgCycleTime].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold text-gray-500 uppercase tracking-wider text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {packerStats.map((p, i) => (
                  <tr key={p.id} onClick={() => onPackerClick(p.id)} className="hover:bg-blue-50 cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">{i+1}</div>
                        <span className="font-semibold text-gray-800">{p.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-900">{p.count}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold ${p.oph >= targetOPH ? 'text-green-600' : 'text-gray-700'}`}>{p.oph}</span>
                      <span className="text-gray-400 text-xs ml-1">/ hr</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmtDur(p.avgCycle)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Consumable usage */}
      {consumableStats.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2"><BarChart3 size={14} />{t.usageByType}</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={consumableStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="type" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {consumableStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

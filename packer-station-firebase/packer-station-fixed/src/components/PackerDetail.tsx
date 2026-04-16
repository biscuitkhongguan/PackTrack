import React, { useState, useMemo } from 'react';
import { X, Calendar, Download, Clock, Package, Activity, Filter, TrendingUp, BarChart3, Zap } from 'lucide-react';
import { Session, User } from '../types';
import { fmtDur, fmtTime, downloadCSV } from '../utils';
import { useAppData } from '../context/AppDataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface PackerDetailProps { packer: User; onClose: () => void; t: any; }

export const PackerDetail: React.FC<PackerDetailProps> = ({ packer, onClose, t }) => {
  const { sessions: allSessions } = useAppData();
  const [startDate,    setStartDate]    = useState(new Date().toISOString().split('T')[0]);
  const [endDate,      setEndDate]      = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = useMemo(() =>
    allSessions.filter(s =>
      s.packer_id === packer.uid && s.date >= startDate && s.date <= endDate &&
      (statusFilter === 'ALL' || s.status === statusFilter)
    ).sort((a, b) => b.start_time - a.start_time)
  , [allSessions, packer.uid, startDate, endDate, statusFilter]);

  const completed  = filtered.filter(s => s.status === 'COMPLETED');
  const totalOrders = completed.length;
  const avgCycle    = totalOrders ? Math.round(completed.reduce((a, s) => a + (s.cycle_time_seconds || 0), 0) / totalOrders) : 0;

  const firstSession = filtered.length ? filtered[filtered.length - 1] : null;
  const lastSession  = filtered.length ? filtered[0] : null;
  const hoursWorked  = firstSession && lastSession ? (lastSession.end_time || Date.now()) / 3_600_000 - firstSession.start_time / 3_600_000 : 0;
  const oph          = hoursWorked > 0.05 ? Math.round(totalOrders / hoursWorked * 10) / 10 : 0;

  const slaBreakdown = completed.reduce((acc, s) => {
    const k = s.sla || 'Regular';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hourlyData = useMemo(() => {
    const map: Record<number, number> = {};
    completed.forEach(s => { const h = new Date(s.end_time || s.start_time).getHours(); map[h] = (map[h] || 0) + 1; });
    return Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, orders: map[h] || 0 })).filter(d => d.orders > 0);
  }, [completed]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in duration-300">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between z-10">
          <div>
            <h2 className="font-black text-gray-900">{packer.name}</h2>
            <p className="text-xs text-gray-400">{t.packerDetailView}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Date filter */}
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <span className="text-gray-400 text-sm">→</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
              <option value="ALL">{t.allStatus}</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
              <option value="IN_PROGRESS">{t.ongoing}</option>
            </select>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: t.ordersPackedLabel, val: totalOrders,     color: 'text-green-600', icon: Package },
              { label: t.ordersPerHour,     val: oph,             color: 'text-blue-600',  icon: TrendingUp },
              { label: t.avgCycleTime,      val: fmtDur(avgCycle), color: 'text-purple-600', icon: Clock },
              { label: 'Instant Orders',    val: slaBreakdown['Instant'] || 0, color: 'text-orange-600', icon: Zap },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <s.icon size={16} className={`${s.color} mx-auto mb-1`} />
                <div className={`text-lg font-bold ${s.color}`}>{s.val}</div>
                <div className="text-[10px] text-gray-400 leading-tight">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Hourly chart */}
          {hourlyData.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><BarChart3 size={14} />Orders by Hour</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Session table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">{t.sessionHistory} ({filtered.length})</h3>
              <button onClick={() => downloadCSV(filtered.map(s => ({
                date: s.date, bin: s.bin_id, order: s.order_id || '-', status: s.status,
                cycle_sec: s.cycle_time_seconds || 0, sla: s.sla || 'Regular', station: s.station || '-'
              })), `${packer.name}-sessions.csv`)}
                className="flex items-center gap-1 text-xs text-blue-600 font-semibold hover:text-blue-800">
                <Download size={12} />{t.exportCSV}
              </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {[t.binIdCol, t.orderIdCol, t.startTimeCol, t.cycleTimeCol, 'SLA', t.statusCol].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-bold text-gray-500 uppercase tracking-wider text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.slice(0, 100).map(s => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-mono text-gray-800">{s.bin_id}</td>
                      <td className="px-3 py-2.5 font-mono text-gray-600">{s.order_id || '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500">{fmtTime(s.start_time)}</td>
                      <td className="px-3 py-2.5 text-gray-600">{fmtDur(s.cycle_time_seconds || 0)}</td>
                      <td className="px-3 py-2.5">
                        {s.sla === 'Instant' && <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold text-[9px]">⚡ Instant</span>}
                        {(!s.sla || s.sla === 'Regular') && <span className="text-gray-400">Regular</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${
                          s.status === 'COMPLETED' ? 'bg-green-100 text-green-700'
                          : s.status === 'CANCELLED' ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'}`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">{t.noSessionsFound}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useMemo } from 'react';
import { X, Calendar, Download, Clock, Package, Activity, Filter, TrendingUp, BarChart3, Zap } from 'lucide-react';
import { Session, User } from '../types';
import { getSessions } from '../services/dataService';
import { fmtDur, fmtTime, downloadCSV } from '../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface PackerDetailProps {
  packer: User;
  onClose: () => void;
  t: any;
}

export const PackerDetail: React.FC<PackerDetailProps> = ({ packer, onClose, t }) => {
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const allSessions = useMemo(() => getSessions(), []);
  
  const filteredSessions = useMemo(() => {
    return allSessions.filter(s => 
      s.packer_id === packer.uid && 
      s.date >= startDate && 
      s.date <= endDate &&
      (statusFilter === 'ALL' || s.status === statusFilter)
    ).sort((a, b) => b.start_time - a.start_time);
  }, [allSessions, packer.uid, startDate, endDate, statusFilter]);

  const stats = useMemo(() => {
    const completed = filteredSessions.filter(s => s.status === 'COMPLETED');
    const totalOrders = completed.length;
    const totalActiveSec = completed.reduce((acc, s) => acc + (s.cycle_time_seconds || 0), 0);
    
    // Break time
    const totalBreakSec = filteredSessions.reduce((acc, s) => {
      const breakSum = s.holds
        .filter(h => h.reason === 'BREAK' && h.duration_seconds)
        .reduce((sum, h) => sum + (h.duration_seconds || 0), 0);
      return acc + breakSum;
    }, 0);

    // Median & P90
    const times = completed.map(s => s.cycle_time_seconds || 0).sort((a, b) => a - b);
    const median = times.length ? times[Math.floor(times.length / 2)] : 0;
    const p90 = times.length ? times[Math.floor(times.length * 0.9)] : 0;

    // Shift start/end (for the selected range, we'll just take the min/max of current filtered)
    const startMs = filteredSessions.length ? Math.min(...filteredSessions.map(s => s.start_time)) : 0;
    const endMs = filteredSessions.length ? Math.max(...filteredSessions.map(s => s.end_time || s.start_time)) : 0;
    
    const totalElapsedSec = startMs && endMs ? (endMs - startMs) / 1000 : 0;
    const idleSec = Math.max(0, totalElapsedSec - totalActiveSec - totalBreakSec);
    const productivity = totalActiveSec > 0 ? (totalOrders / (totalActiveSec / 3600)).toFixed(1) : '0.0';

    // Charts data
    const dailyVolume: Record<string, number> = {};
    const cycleTrend: { name: string; time: number }[] = [];
    
    completed.forEach((s, idx) => {
      dailyVolume[s.date] = (dailyVolume[s.date] || 0) + 1;
      cycleTrend.push({ name: `Order ${idx + 1}`, time: s.cycle_time_seconds || 0 });
    });

    const volumeChart = Object.entries(dailyVolume).map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));

    return {
      totalOrders,
      productivity,
      avgCycleTime: totalOrders ? Math.round(totalActiveSec / totalOrders) : 0,
      median,
      p90,
      shiftStart: startMs,
      shiftEnd: endMs,
      totalActiveTime: totalActiveSec,
      totalBreakTime: totalBreakSec,
      totalIdleTime: idleSec,
      currentStatus: filteredSessions[0]?.status || 'IDLE',
      volumeChart,
      cycleTrend: cycleTrend.slice(-20) // Last 20 orders for trend
    };
  }, [filteredSessions]);

  const handleExport = () => {
    const exportData = filteredSessions.map(s => ({
      [t.orderIdCol]: s.order_id || '-',
      [t.binIdCol]: s.bin_id,
      [t.startTimeCol]: new Date(s.start_time).toLocaleString(),
      [t.cycleTimeCol]: s.cycle_time_seconds ? fmtDur(s.cycle_time_seconds) : '-',
      [t.statusCol]: s.status,
      [t.notesCol]: s.holds.map(h => h.reason).join('; ')
    }));
    downloadCSV(exportData, `productivity_${packer.name}_${startDate}_to_${endDate}.csv`);
  };

  const exportVolume = () => {
    const data = stats.volumeChart.map(v => ({
      Date: v.name,
      Orders: v.count
    }));
    downloadCSV(data, `volume_${packer.name}_${startDate}_to_${endDate}.csv`);
  };

  const exportTrend = () => {
    const data = stats.cycleTrend.map(tr => ({
      Order: tr.name,
      Time: fmtDur(tr.time)
    }));
    downloadCSV(data, `trend_${packer.name}_${startDate}_to_${endDate}.csv`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Activity size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">{packer.name}</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t.packerDetailView}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={24} className="text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Filters & Export */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200">
                <Calendar size={14} className="text-gray-400" />
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-sm font-medium focus:outline-none bg-transparent"
                />
              </div>
              <span className="text-gray-300">-</span>
              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200">
                <Calendar size={14} className="text-gray-400" />
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-sm font-medium focus:outline-none bg-transparent"
                />
              </div>
            </div>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
            >
              <Download size={16} />
              {t.exportCSV}
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Package size={12} className="text-blue-500" />
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.totalOrders}</div>
              </div>
              <div className="text-2xl font-black text-blue-600">{stats.totalOrders}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={12} className="text-orange-500" />
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.packerProductivity}</div>
              </div>
              <div className="text-2xl font-black text-orange-600">{stats.productivity}<span className="text-xs font-bold text-orange-300 ml-1">oph</span></div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={12} className="text-emerald-500" />
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.avgCycleTime}</div>
              </div>
              <div className="text-2xl font-black text-emerald-600">{fmtDur(stats.avgCycleTime)}</div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={12} className="text-red-500" />
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.totalIdleTime}</div>
              </div>
              <div className="text-2xl font-black text-red-600">{fmtDur(Math.round(stats.totalIdleTime))}</div>
            </div>
          </div>

          {/* Secondary Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">{t.shiftStart}</span>
              <span className="text-sm font-bold text-gray-800">{fmtTime(stats.shiftStart)}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">{t.shiftEnd}</span>
              <span className="text-sm font-bold text-gray-800">{stats.shiftEnd ? fmtTime(stats.shiftEnd) : t.ongoing}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">{t.totalActiveTime}</span>
              <span className="text-sm font-bold text-gray-800">{fmtDur(stats.totalActiveTime)}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">{t.totalBreakTime}</span>
              <span className="text-sm font-bold text-gray-800">{fmtDur(stats.totalBreakTime)}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">{t.totalIdleTime}</span>
              <span className="text-sm font-bold text-gray-800">{fmtDur(Math.round(stats.totalIdleTime))}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">{t.currentStatus}</span>
              <span className={`text-xs font-black uppercase px-2 py-1 rounded-lg ${
                stats.currentStatus === 'PACKING' ? 'bg-green-100 text-green-600' : 
                stats.currentStatus === 'BREAK' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
              }`}>{t[stats.currentStatus.toLowerCase()] || stats.currentStatus}</span>
            </div>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2 uppercase tracking-widest">
                  <BarChart3 size={14} className="text-blue-500" />
                  {t.ordersPackedLabel}
                </h3>
                <button 
                  onClick={exportVolume}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-tight flex items-center gap-1"
                >
                  <Download size={12} />
                  {t.exportCSV}
                </button>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.volumeChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" hide />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }} />
                    <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-gray-900 flex items-center gap-2 uppercase tracking-widest">
                  <TrendingUp size={14} className="text-emerald-500" />
                  {t.avgCycleTime} Trend
                </h3>
                <button 
                  onClick={exportTrend}
                  className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-tight flex items-center gap-1"
                >
                  <Download size={12} />
                  {t.exportCSV}
                </button>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.cycleTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" hide />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip 
                      formatter={(val: number) => fmtDur(val)}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }} 
                    />
                    <Line type="monotone" dataKey="time" stroke="#10b981" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                <Activity size={16} className="text-blue-600" />
                {t.sessionHistory}
              </h3>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-gray-400" />
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="text-xs font-bold text-gray-600 focus:outline-none bg-transparent"
                >
                  <option value="ALL">{t.allStatus}</option>
                  <option value="COMPLETED">{t.completedLabel}</option>
                  <option value="CANCELLED">{t.cancelOrder}</option>
                </select>
              </div>
            </div>
            {filteredSessions.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm italic">{t.noSessionsFound}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[10px] text-gray-400 uppercase tracking-widest">
                    <tr>
                      <th className="px-5 py-3 text-left font-bold">{t.orderIdCol}</th>
                      <th className="px-5 py-3 text-left font-bold">{t.binIdCol}</th>
                      <th className="px-5 py-3 text-left font-bold">{t.startTimeCol}</th>
                      <th className="px-5 py-3 text-right font-bold">{t.cycleTimeCol}</th>
                      <th className="px-5 py-3 text-center font-bold">{t.statusCol}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredSessions.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 font-bold text-gray-800">{s.order_id || '-'}</td>
                        <td className="px-5 py-3 text-gray-500 font-mono text-xs">{s.bin_id}</td>
                        <td className="px-5 py-3 text-gray-500">{fmtTime(s.start_time)}</td>
                        <td className="px-5 py-3 text-right font-bold text-gray-700">{s.cycle_time_seconds ? fmtDur(s.cycle_time_seconds) : '-'}</td>
                        <td className="px-5 py-3 text-center">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            s.status === 'COMPLETED' ? 'bg-green-100 text-green-600' : 
                            s.status === 'CANCELLED' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
                          }`}>{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

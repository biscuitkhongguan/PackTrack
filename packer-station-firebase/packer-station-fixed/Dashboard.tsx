import React, { useState, useMemo } from 'react';
import { Calendar, TrendingUp, Package, Users, BarChart3, Download, AlertCircle, Clock, Zap, X, History } from 'lucide-react';
import { getSessions, getRequests, getConsumableTypes, getAllUsers, getTargetOrdersPerHour, getTargetTotalOrders, getPredictiveStock } from '../services/dataService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine } from 'recharts';
import { CONSUMABLE_TYPES } from '../constants';
import { fmtDur, downloadCSV } from '../utils';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

interface AnalyticsProps {
  t: any;
  onPackerClick: (id: string) => void;
}

export const Analytics: React.FC<AnalyticsProps> = ({ t, onPackerClick }) => {
  const [viewType, setViewType] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [activeDetail, setActiveDetail] = useState<'ORDERS' | 'PACKERS' | 'CYCLE' | 'PRODUCTIVITY' | 'HOURLY' | 'STATIONS' | 'HOLDS' | 'CONSUMABLES' | 'USAGE_LEDGER' | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const sessions = useMemo(() => getSessions(), []);
  const requests = useMemo(() => getRequests(), []);
  const consumableTypes = useMemo(() => getConsumableTypes(CONSUMABLE_TYPES), []);
  const targetOrdersPerHour = getTargetOrdersPerHour();
  const targetTotalOrders = getTargetTotalOrders();
  const targetCycleTime = Math.round(3600 / targetOrdersPerHour);

  const filteredData = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    let filteredSessions = sessions.filter(s => {
      const sDate = parseISO(s.date);
      return isWithinInterval(sDate, { start, end });
    });
    
    let filteredRequests = requests.filter(r => {
      const rDate = parseISO(r.date);
      return isWithinInterval(rDate, { start, end });
    });

    const completed = filteredSessions.filter(s => s.status === 'COMPLETED');
    
    // Productivity (OPH) over time
    const ophMap: Record<string, { orders: number; activeTime: number }> = {};
    completed.forEach(s => {
      if (!ophMap[s.date]) ophMap[s.date] = { orders: 0, activeTime: 0 };
      ophMap[s.date].orders++;
      ophMap[s.date].activeTime += (s.cycle_time_seconds || 0);
    });
    const productivityStats = Object.entries(ophMap).map(([name, data]) => ({
      name,
      oph: data.activeTime > 0 ? Number((data.orders / (data.activeTime / 3600)).toFixed(1)) : 0
    })).sort((a, b) => a.name.localeCompare(b.name));

    // Cycle time trend
    const trendMap: Record<string, { sum: number; count: number }> = {};
    completed.forEach(s => {
      if (!trendMap[s.date]) trendMap[s.date] = { sum: 0, count: 0 };
      trendMap[s.date].sum += (s.cycle_time_seconds || 0);
      trendMap[s.date].count++;
    });
    const trendStats = Object.entries(trendMap).map(([name, data]) => ({
      name,
      avg: Math.round(data.sum / data.count)
    })).sort((a, b) => a.name.localeCompare(b.name));

    // Packer stats
    const packerMap: Record<string, { id: string; name: string; total: number; sumTime: number }> = {};
    completed.forEach(s => {
      if (!packerMap[s.packer_id]) packerMap[s.packer_id] = { id: s.packer_id, name: s.packer_name, total: 0, sumTime: 0 };
      packerMap[s.packer_id].total++;
      packerMap[s.packer_id].sumTime += (s.cycle_time_seconds || 0);
    });
    const packerStats = Object.values(packerMap).map(p => {
      const oph = p.sumTime > 0 ? Number((p.total / (p.sumTime / 3600)).toFixed(1)) : 0;
      return { 
        id: p.id,
        name: p.name, 
        orders: p.total, 
        avg: p.total ? Math.round(p.sumTime / p.total) : 0,
        oph
      };
    }).sort((a, b) => b.orders - a.orders);

    // Consumable stats
    const usageMap: Record<string, number> = {};
    filteredRequests.forEach(r => {
      usageMap[r.consumable_type] = (usageMap[r.consumable_type] || 0) + 1;
    });
    const consumableStats = consumableTypes.map(ct => ({
      name: t[ct] || ct.replace(/_/g, ' '),
      count: usageMap[ct] || 0
    })).sort((a, b) => b.count - a.count);

    // Bottleneck (Hold) stats
    const bottleneckMap: Record<string, { count: number; totalTime: number }> = {};
    filteredSessions.forEach(s => {
      s.holds.forEach(h => {
        if (!bottleneckMap[h.reason]) bottleneckMap[h.reason] = { count: 0, totalTime: 0 };
        bottleneckMap[h.reason].count++;
        bottleneckMap[h.reason].totalTime += (h.duration_seconds || 0);
      });
    });
    const bottleneckStats = Object.entries(bottleneckMap).map(([reason, data]) => ({
      reason: t[reason] || reason.replace(/_/g, ' '),
      count: data.count,
      time: data.totalTime,
      timeFmt: fmtDur(data.totalTime),
      avgTime: data.count > 0 ? Math.round(data.totalTime / data.count) : 0
    })).sort((a, b) => b.time - a.time);

    // Hourly Distribution
    const hourlyMap: Record<number, number> = {};
    for (let i = 0; i < 24; i++) hourlyMap[i] = 0;
    filteredSessions.forEach(s => {
      const hour = new Date(s.start_time).getHours();
      hourlyMap[hour]++;
    });
    const hourlyStats = Object.entries(hourlyMap).map(([hour, count]) => ({
      hour: `${hour.padStart(2, '0')}:00`,
      count
    }));

    // Station Stats
    const stationMap: Record<string, { orders: number; sumTime: number }> = {};
    completed.forEach(s => {
      const sName = s.station || 'Unknown';
      if (!stationMap[sName]) stationMap[sName] = { orders: 0, sumTime: 0 };
      stationMap[sName].orders++;
      stationMap[sName].sumTime += (s.cycle_time_seconds || 0);
    });
    const stationStats = Object.entries(stationMap).map(([name, data]) => ({
      name,
      orders: data.orders,
      avg: data.orders ? Math.round(data.sumTime / data.orders) : 0,
      oph: data.sumTime > 0 ? Number((data.orders / (data.sumTime / 3600)).toFixed(1)) : 0
    })).sort((a, b) => b.orders - a.orders);

    // Summary metrics
    const totalOrders = completed.length;
    const uniquePackers = new Set(filteredSessions.map(s => s.packer_id)).size;
    const totalActiveSec = completed.reduce((acc, s) => acc + (s.cycle_time_seconds || 0), 0);
    const avgCycleTime = totalOrders ? Math.round(totalActiveSec / totalOrders) : 0;
    const productivity = totalActiveSec > 0 ? (totalOrders / (totalActiveSec / 3600)).toFixed(1) : '0.0';

    return {
      totalOrders,
      totalPackers: uniquePackers,
      avgCycleTime,
      productivity,
      totalConsumables: filteredRequests.length,
      packerStats,
      consumableStats,
      productivityStats,
      trendStats,
      bottleneckStats,
      hourlyStats,
      stationStats,
      rawSessions: filteredSessions,
      rawRequests: filteredRequests
    };
  }, [sessions, requests, consumableTypes, startDate, endDate, t]);

  const predictions = useMemo(() => getPredictiveStock(), []);

  const handleViewTypeChange = (type: 'DAILY' | 'WEEKLY' | 'MONTHLY') => {
    setViewType(type);
    const now = new Date();
    if (type === 'DAILY') {
      const d = now.toISOString().split('T')[0];
      setStartDate(d);
      setEndDate(d);
    } else if (type === 'WEEKLY') {
      setStartDate(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
      setEndDate(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    } else if (type === 'MONTHLY') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
    }
  };

  const exportData = () => {
    const period = `${startDate}_to_${endDate}`;
    const data = filteredData.packerStats.map(p => ({
      [t.packerCol]: p.name,
      [t.ordersCol]: p.orders,
      [t.avgCol]: fmtDur(p.avg)
    }));
    downloadCSV(data, `packer_performance_${period}.csv`);
  };

  const exportProductivity = () => {
    const period = `${startDate}_to_${endDate}`;
    const data = filteredData.productivityStats.map(v => ({
      Date: v.name,
      OPH: v.oph
    }));
    downloadCSV(data, `productivity_trend_${period}.csv`);
  };

  const exportUsage = () => {
    const period = `${startDate}_to_${endDate}`;
    const data = filteredData.consumableStats.map(c => ({
      Type: c.name,
      Count: c.count
    }));
    downloadCSV(data, `consumable_summary_${period}.csv`);
  };

  const exportLedger = () => {
    const period = `${startDate}_to_${endDate}`;
    const data = filteredData.rawRequests.map(r => ({
      Time: new Date(r.requested_at).toLocaleString(),
      Packer: r.packer_name,
      Station: r.station || '-',
      Type: t[r.consumable_type] || r.consumable_type,
      BinID: r.station_bin_id || '-'
    }));
    downloadCSV(data, `usage_ledger_${period}.csv`);
  };

  const exportTrend = () => {
    const period = `${startDate}_to_${endDate}`;
    const data = filteredData.trendStats.map(tr => ({
      Date: tr.name,
      [t.avgCycleTime]: fmtDur(tr.avg)
    }));
    downloadCSV(data, `cycle_time_trend_${period}.csv`);
  };

  const exportBottlenecks = () => {
    const period = `${startDate}_to_${endDate}`;
    const data = filteredData.bottleneckStats.map(b => ({
      Reason: b.reason,
      Occurrences: b.count,
      'Total Time Lost (s)': b.time,
      'Total Time Lost': b.timeFmt
    }));
    downloadCSV(data, `bottleneck_analytics_${period}.csv`);
  };

  return (
    <div className="space-y-4 pb-10">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4 text-sm">
          <Calendar size={16} className="text-gray-600" />
          {t.analyticsTab}
        </h3>
        
        <div className="flex flex-col gap-4">
          <div className="flex bg-gray-100 rounded-xl p-1">
            {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map(v => (
              <button 
                key={v} 
                onClick={() => handleViewTypeChange(v)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  viewType === v ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t[`${v.toLowerCase()}Analytics`] || v}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-gray-400 uppercase">From</span>
            </div>
            <span className="text-gray-300">-</span>
            <div className="flex-1 relative">
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <span className="absolute -top-2 left-3 bg-white px-1 text-[10px] font-bold text-gray-400 uppercase">To</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button 
          onClick={() => setActiveDetail('ORDERS')}
          className={`bg-white rounded-2xl p-4 border shadow-sm text-left transition-all hover:scale-[1.02] active:scale-95 ${activeDetail === 'ORDERS' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Package size={12} className="text-blue-500" />
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.totalOrders}</div>
          </div>
          <div className="text-2xl font-black text-blue-600">{filteredData.totalOrders}</div>
        </button>

        <button 
          onClick={() => setActiveDetail('PACKERS')}
          className={`bg-white rounded-2xl p-4 border shadow-sm text-left transition-all hover:scale-[1.02] active:scale-95 ${activeDetail === 'PACKERS' ? 'border-purple-500 ring-2 ring-purple-100' : 'border-gray-100'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Users size={12} className="text-purple-500" />
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.totalPackers}</div>
          </div>
          <div className="text-2xl font-black text-purple-600">{filteredData.totalPackers}</div>
        </button>

        <button 
          onClick={() => setActiveDetail('CYCLE')}
          className={`bg-white rounded-2xl p-4 border shadow-sm text-left transition-all hover:scale-[1.02] active:scale-95 ${activeDetail === 'CYCLE' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-gray-100'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock size={12} className="text-emerald-500" />
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.avgCycleTime}</div>
          </div>
          <div className="text-2xl font-black text-emerald-600">{fmtDur(filteredData.avgCycleTime)}</div>
        </button>

        <button 
          onClick={() => setActiveDetail('PRODUCTIVITY')}
          className={`bg-white rounded-2xl p-4 border shadow-sm text-left transition-all hover:scale-[1.02] active:scale-95 ${activeDetail === 'PRODUCTIVITY' ? 'border-orange-500 ring-2 ring-orange-100' : 'border-gray-100'}`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Zap size={12} className="text-orange-500" />
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.packerProductivity}</div>
          </div>
          <div className="text-2xl font-black text-orange-600">{filteredData.productivity}<span className="text-xs font-bold text-orange-300 ml-1">oph</span></div>
        </button>

        <button 
          onClick={() => setActiveDetail('USAGE_LEDGER')}
          className={`bg-white rounded-2xl p-4 border shadow-sm text-left transition-all hover:scale-[1.02] active:scale-95 ${activeDetail === 'USAGE_LEDGER' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100'} col-span-2 md:col-span-4`}
        >
          <div className="flex items-center gap-2 mb-1">
            <History size={12} className="text-blue-500" />
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t.usageLedger}</div>
          </div>
          <div className="text-sm font-bold text-gray-600">View detailed consumable usage logs per shift</div>
        </button>
      </div>

      {/* Detail View Section */}
      {activeDetail && (
        <div className="bg-white rounded-2xl border border-blue-200 shadow-lg p-5 animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
              {activeDetail === 'ORDERS' && <><Package size={16} className="text-blue-500" /> Order History Detail</>}
              {activeDetail === 'PACKERS' && <><Users size={16} className="text-purple-500" /> Active Personnel Detail</>}
              {activeDetail === 'CYCLE' && <><Clock size={16} className="text-emerald-500" /> Cycle Time Breakdown</>}
              {activeDetail === 'PRODUCTIVITY' && <><Zap size={16} className="text-orange-500" /> Productivity Insights</>}
            </h4>
            <button onClick={() => setActiveDetail(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
              <X size={16} />
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {activeDetail === 'ORDERS' && (
              <div className="space-y-2">
                {filteredData.rawSessions.filter(s => s.status === 'COMPLETED').map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <div className="text-xs font-bold text-gray-800">{s.order_id}</div>
                      <div className="text-[10px] text-gray-400">{s.packer_name} · {s.station}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-blue-600">{fmtDur(s.cycle_time_seconds || 0)}</div>
                      <div className="text-[10px] text-gray-400">{format(s.end_time || 0, 'HH:mm:ss')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeDetail === 'PACKERS' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredData.packerStats.map(p => (
                  <button key={p.id} onClick={() => onPackerClick(p.id)} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-purple-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-xs">
                        {p.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-gray-800">{p.name}</div>
                        <div className="text-[10px] text-gray-400">{p.orders} Orders</div>
                      </div>
                    </div>
                    <div className="text-xs font-black text-purple-600">{p.oph} OPH</div>
                  </button>
                ))}
              </div>
            )}

            {activeDetail === 'CYCLE' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Fastest Order</div>
                    <div className="text-xl font-black text-emerald-700">
                      {fmtDur(Math.min(...filteredData.rawSessions.filter(s => s.status === 'COMPLETED').map(s => s.cycle_time_seconds || 999999)))}
                    </div>
                  </div>
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                    <div className="text-[10px] font-bold text-red-600 uppercase mb-1">Slowest Order</div>
                    <div className="text-xl font-black text-red-700">
                      {fmtDur(Math.max(...filteredData.rawSessions.filter(s => s.status === 'COMPLETED').map(s => s.cycle_time_seconds || 0)))}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-gray-400 text-center italic">
                  Average cycle time is calculated across {filteredData.totalOrders} completed orders.
                </div>
              </div>
            )}

            {activeDetail === 'PRODUCTIVITY' && (
              <div className="space-y-4">
                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-orange-800">Efficiency vs Target</span>
                    <span className="text-xs font-black text-orange-600">{Math.round((Number(filteredData.productivity) / targetOrdersPerHour) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-white rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-orange-500 transition-all duration-1000"
                      style={{ width: `${Math.min((Number(filteredData.productivity) / targetOrdersPerHour) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-gray-400 uppercase">Target</div>
                    <div className="text-sm font-black text-gray-700">{targetOrdersPerHour}/h</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-gray-400 uppercase">Actual</div>
                    <div className="text-sm font-black text-orange-600">{filteredData.productivity}/h</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] font-bold text-gray-400 uppercase">Gap</div>
                    <div className="text-sm font-black text-red-500">
                      {Math.max(0, targetOrdersPerHour - Number(filteredData.productivity)).toFixed(1)}/h
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail View Modal */}
      {activeDetail && (
        <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-md flex items-center justify-center p-4 lg:p-8 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-7xl h-full max-h-[90vh] rounded-[32px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${
                  activeDetail === 'PRODUCTIVITY' ? 'bg-orange-100 text-orange-600' :
                  activeDetail === 'ORDERS' ? 'bg-blue-100 text-blue-600' :
                  activeDetail === 'PACKERS' ? 'bg-purple-100 text-purple-600' :
                  activeDetail === 'CYCLE' ? 'bg-emerald-100 text-emerald-600' :
                  activeDetail === 'HOURLY' ? 'bg-blue-100 text-blue-600' :
                  activeDetail === 'STATIONS' ? 'bg-indigo-100 text-indigo-600' :
                  activeDetail === 'HOLDS' ? 'bg-red-100 text-red-600' :
                  activeDetail === 'USAGE_LEDGER' ? 'bg-blue-100 text-blue-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {activeDetail === 'ORDERS' && <Package size={24} />}
                  {activeDetail === 'PACKERS' && <Users size={24} />}
                  {activeDetail === 'CYCLE' && <Clock size={24} />}
                  {activeDetail === 'PRODUCTIVITY' && <Zap size={24} />}
                  {activeDetail === 'HOURLY' && <Clock size={24} />}
                  {activeDetail === 'STATIONS' && <BarChart3 size={24} />}
                  {activeDetail === 'HOLDS' && <AlertCircle size={24} />}
                  {activeDetail === 'CONSUMABLES' && <Package size={24} />}
                  {activeDetail === 'USAGE_LEDGER' && <History size={24} />}
                </div>
                <div>
                  <h4 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                    {activeDetail === 'ORDERS' && 'Order Volume Analysis'}
                    {activeDetail === 'PACKERS' && 'Packer Performance Detail'}
                    {activeDetail === 'CYCLE' && 'Cycle Time Trends'}
                    {activeDetail === 'PRODUCTIVITY' && 'Productivity Deep Dive'}
                    {activeDetail === 'HOURLY' && 'Peak Hour Analysis'}
                    {activeDetail === 'STATIONS' && 'Station Efficiency Detail'}
                    {activeDetail === 'HOLDS' && 'Bottleneck Analytics'}
                    {activeDetail === 'CONSUMABLES' && 'Consumable Usage Detail'}
                    {activeDetail === 'USAGE_LEDGER' && t.usageLedger}
                  </h4>
                  <p className="text-sm text-gray-500 font-medium">Detailed breakdown and historical trends</p>
                </div>
              </div>
              <button 
                onClick={() => setActiveDetail(null)}
                className="p-3 hover:bg-gray-100 rounded-2xl text-gray-400 transition-all hover:text-gray-600"
              >
                <X size={28} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {activeDetail === 'USAGE_LEDGER' ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h5 className="text-lg font-bold text-gray-900">Consumable Usage Logs</h5>
                    <button onClick={exportLedger} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700">
                      <Download size={16} />
                      Export CSV
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-white">
                        <tr className="border-b border-gray-200">
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Time</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Packer</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Station</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Consumable</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Bin ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredData.rawRequests.sort((a, b) => b.requested_at - a.requested_at).map(r => (
                          <tr key={r.id} className="hover:bg-white transition-colors">
                            <td className="px-6 py-4 text-xs font-mono text-gray-500">{format(r.requested_at, 'HH:mm:ss')}</td>
                            <td className="px-6 py-4 text-xs font-bold text-gray-800">{r.packer_name}</td>
                            <td className="px-6 py-4 text-xs text-gray-600">{r.station}</td>
                            <td className="px-6 py-4">
                              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-bold uppercase">
                                {t[r.consumable_type] || r.consumable_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-gray-500">{r.station_bin_id || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 h-full">
                  {/* Large Chart Area */}
                  <div className="lg:col-span-2 space-y-8">
                  <div className="h-[500px] w-full bg-gray-50 rounded-[24px] p-8 border border-gray-100 shadow-inner">
                    <ResponsiveContainer width="100%" height="100%">
                      {activeDetail === 'PRODUCTIVITY' ? (
                        <BarChart data={filteredData.productivityStats}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                          <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }} />
                          <ReferenceLine y={targetOrdersPerHour} stroke="#f87171" strokeDasharray="8 8" strokeWidth={2} label={{ value: `TARGET: ${targetOrdersPerHour}`, position: 'right', fill: '#f87171', fontSize: 12, fontWeight: '900' }} />
                          <Bar dataKey="oph" fill="#f59e0b" radius={[8, 8, 0, 0]} barSize={40} />
                        </BarChart>
                      ) : activeDetail === 'ORDERS' ? (
                        <BarChart data={filteredData.productivityStats.map(d => ({ ...d, count: filteredData.rawSessions.filter(s => s.date === d.name && s.status === 'COMPLETED').length }))}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                          <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }} />
                          <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={40} />
                        </BarChart>
                      ) : activeDetail === 'PACKERS' ? (
                        <BarChart data={filteredData.packerStats}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                          <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }} />
                          <Bar dataKey="orders" fill="#8b5cf6" radius={[8, 8, 0, 0]} barSize={40} />
                        </BarChart>
                      ) : activeDetail === 'CYCLE' ? (
                        <LineChart data={filteredData.trendStats}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                          <Tooltip formatter={(val: number) => fmtDur(val)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }} />
                          <ReferenceLine y={targetCycleTime} stroke="#f87171" strokeDasharray="8 8" strokeWidth={2} label={{ value: `TARGET: ${targetCycleTime}s`, position: 'right', fill: '#f87171', fontSize: 12, fontWeight: '900' }} />
                          <Line type="monotone" dataKey="avg" stroke="#10b981" strokeWidth={5} dot={{ r: 8, fill: '#10b981', strokeWidth: 4, stroke: '#fff' }} activeDot={{ r: 10, strokeWidth: 0 }} />
                        </LineChart>
                      ) : activeDetail === 'HOURLY' ? (
                        <BarChart data={filteredData.hourlyStats}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                          <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }} />
                          <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} barSize={30} />
                        </BarChart>
                      ) : activeDetail === 'STATIONS' ? (
                        <BarChart data={filteredData.stationStats}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                          <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }} />
                          <Bar dataKey="oph" fill="#6366f1" radius={[8, 8, 0, 0]} barSize={40} />
                        </BarChart>
                      ) : activeDetail === 'HOLDS' ? (
                        <BarChart data={filteredData.bottleneckStats} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                          <YAxis dataKey="reason" type="category" width={180} axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }} />
                          <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(val: number) => fmtDur(val)} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }} />
                          <Bar dataKey="time" fill="#ef4444" radius={[0, 8, 8, 0]} barSize={40} />
                        </BarChart>
                      ) : (
                        <BarChart data={filteredData.consumableStats} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                          <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 500 }} />
                          <YAxis dataKey="name" type="category" width={150} axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }} />
                          <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.25)' }} />
                          <Bar dataKey="count" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={40} />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  {/* Summary Cards inside Modal */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-gray-50 rounded-[24px] border border-gray-100">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Samples</div>
                      <div className="text-2xl font-black text-gray-900">
                        {activeDetail === 'ORDERS' ? filteredData.totalOrders : 
                         activeDetail === 'PACKERS' ? filteredData.packerStats.length :
                         activeDetail === 'STATIONS' ? filteredData.stationStats.length :
                         filteredData.totalOrders}
                      </div>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-[24px] border border-gray-100">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Average Value</div>
                      <div className="text-2xl font-black text-blue-600">
                        {activeDetail === 'CYCLE' ? fmtDur(filteredData.avgCycleTime) : 
                         activeDetail === 'PRODUCTIVITY' ? `${filteredData.productivity} OPH` :
                         'N/A'}
                      </div>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-[24px] border border-gray-100">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Performance</div>
                      <div className="text-2xl font-black text-emerald-600">
                        {Math.round((Number(filteredData.productivity) / targetOrdersPerHour) * 100)}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data Table Area */}
                <div className="bg-gray-50 rounded-[24px] border border-gray-100 flex flex-col overflow-hidden">
                  <div className="p-6 border-b border-gray-200 bg-white">
                    <h5 className="text-sm font-black text-gray-900 uppercase tracking-tight">Detailed Records</h5>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-gray-50 z-10">
                        <tr className="border-b border-gray-200">
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Details</th>
                          <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {activeDetail === 'ORDERS' && filteredData.rawSessions.filter(s => s.status === 'COMPLETED').map(s => (
                          <tr key={s.id} className="hover:bg-white transition-colors">
                            <td className="px-6 py-4">
                              <div className="text-xs font-bold text-gray-800">{s.order_id}</div>
                              <div className="text-[10px] text-gray-400">{s.packer_name}</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-xs font-mono font-bold text-blue-600">{fmtDur(s.cycle_time_seconds || 0)}</div>
                            </td>
                          </tr>
                        ))}

                        {activeDetail === 'PACKERS' && filteredData.packerStats.map(p => (
                          <tr key={p.id} className="hover:bg-white transition-colors cursor-pointer" onClick={() => onPackerClick(p.id)}>
                            <td className="px-6 py-4">
                              <div className="text-xs font-bold text-gray-800">{p.name}</div>
                              <div className="text-[10px] text-gray-400">{p.orders} Orders</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-xs font-black text-purple-600">{p.oph} OPH</div>
                            </td>
                          </tr>
                        ))}

                        {activeDetail === 'STATIONS' && filteredData.stationStats.map(s => (
                          <tr key={s.name} className="hover:bg-white transition-colors">
                            <td className="px-6 py-4">
                              <div className="text-xs font-bold text-gray-800">{s.name}</div>
                              <div className="text-[10px] text-gray-400">{s.orders} Orders</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-xs font-black text-indigo-600">{s.oph} OPH</div>
                            </td>
                          </tr>
                        ))}

                        {activeDetail === 'HOLDS' && filteredData.bottleneckStats.map(b => (
                          <tr key={b.reason} className="hover:bg-white transition-colors">
                            <td className="px-6 py-4">
                              <div className="text-xs font-bold text-gray-800">{b.reason}</div>
                              <div className="text-[10px] text-gray-400">{b.count} Occurrences</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-xs font-black text-red-600">{b.timeFmt}</div>
                            </td>
                          </tr>
                        ))}

                        {activeDetail === 'CONSUMABLES' && filteredData.consumableStats.map(c => (
                          <tr key={c.name} className="hover:bg-white transition-colors">
                            <td className="px-6 py-4">
                              <div className="text-xs font-bold text-gray-800">{c.name}</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-xs font-black text-blue-600">{c.count}</div>
                            </td>
                          </tr>
                        ))}

                        {activeDetail === 'USAGE_LEDGER' && filteredData.rawRequests.sort((a, b) => b.requested_at - a.requested_at).map(r => (
                          <tr key={r.id} className="hover:bg-white transition-colors">
                            <td className="px-6 py-4">
                              <div className="text-xs font-bold text-gray-800">{new Date(r.requested_at).toLocaleTimeString()}</div>
                              <div className="text-[10px] text-gray-400">{r.packer_name}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-xs font-medium text-gray-700">{t[r.consumable_type] || r.consumable_type}</div>
                              <div className="text-[10px] text-gray-400">{r.station} · {r.station_bin_id || '-'}</div>
                            </td>
                          </tr>
                        ))}

                        {activeDetail === 'HOURLY' && filteredData.hourlyStats.map(h => (
                          <tr key={h.hour} className="hover:bg-white transition-colors">
                            <td className="px-6 py-4">
                              <div className="text-xs font-bold text-gray-800">{h.hour}</div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="text-xs font-black text-blue-600">{h.count}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productivity Trend (OPH) */}
        <button 
          onClick={() => setActiveDetail('PRODUCTIVITY')}
          className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 text-left transition-all hover:border-orange-200 hover:shadow-md group"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-3 text-base">
              <Zap size={20} className="text-orange-600" />
              Productivity (OPH)
            </h3>
            <Download size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors" onClick={(e) => { e.stopPropagation(); exportProductivity(); }} />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData.productivityStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, (dataMax: number) => Math.max(dataMax, targetOrdersPerHour + 10)]} />
                <ReferenceLine y={targetOrdersPerHour} stroke="#f87171" strokeDasharray="3 3" />
                <Bar dataKey="oph" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </button>

        {/* Order Volume (Total) */}
        <button 
          onClick={() => setActiveDetail('ORDERS')}
          className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 text-left transition-all hover:border-blue-200 hover:shadow-md group"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-3 text-base">
              <Package size={20} className="text-blue-600" />
              Order Volume
            </h3>
            <Download size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors" onClick={(e) => { e.stopPropagation(); exportProductivity(); }} />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData.productivityStats.map(d => ({ ...d, count: filteredData.rawSessions.filter(s => s.date === d.name && s.status === 'COMPLETED').length }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </button>

        {/* Packer Volume (Total) */}
        <button 
          onClick={() => setActiveDetail('PACKERS')}
          className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 text-left transition-all hover:border-purple-200 hover:shadow-md group"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-3 text-base">
              <Users size={20} className="text-purple-600" />
              Packer Volume
            </h3>
            <Download size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors" onClick={(e) => { e.stopPropagation(); exportProductivity(); }} />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData.packerStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, (dataMax: number) => Math.max(dataMax, targetTotalOrders + 5)]} />
                <ReferenceLine y={targetTotalOrders} stroke="#f87171" strokeDasharray="3 3" />
                <Bar dataKey="orders" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </button>

        {/* Peak Hours (Hourly Distribution) */}
        <button 
          onClick={() => setActiveDetail('HOURLY')}
          className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 text-left transition-all hover:border-blue-200 hover:shadow-md group"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-3 text-base">
              <Clock size={20} className="text-blue-600" />
              Peak Hours
            </h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData.hourlyStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </button>

        {/* Station Efficiency */}
        <button 
          onClick={() => setActiveDetail('STATIONS')}
          className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 text-left transition-all hover:border-indigo-200 hover:shadow-md group"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-3 text-base">
              <BarChart3 size={20} className="text-indigo-600" />
              Station Efficiency
            </h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData.stationStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Bar dataKey="oph" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </button>

        {/* Cycle Time Trend */}
        <button 
          onClick={() => setActiveDetail('CYCLE')}
          className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 text-left transition-all hover:border-emerald-200 hover:shadow-md group"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-3 text-base">
              <Clock size={20} className="text-emerald-600" />
              Cycle Time Trend
            </h3>
            <Download size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors" onClick={(e) => { e.stopPropagation(); exportTrend(); }} />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData.trendStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <ReferenceLine y={targetCycleTime} stroke="#f87171" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="avg" stroke="#10b981" strokeWidth={4} dot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </button>

        {/* Consumable Usage */}
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 text-left transition-all hover:border-blue-200 hover:shadow-md group relative">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-3 text-base">
              <Package size={20} className="text-blue-500" />
              Consumable Usage
            </h3>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setActiveDetail('USAGE_LEDGER')}
                className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <History size={14} />
                Ledger
              </button>
              <Download size={18} className="text-gray-300 hover:text-blue-500 cursor-pointer transition-colors" onClick={() => exportUsage()} />
            </div>
          </div>
          <button onClick={() => setActiveDetail('CONSUMABLES')} className="w-full text-left">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredData.consumableStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} width={80} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </button>
        </div>

        {/* Bottleneck Analytics */}
        <button 
          onClick={() => setActiveDetail('HOLDS')}
          className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 text-left transition-all hover:border-red-200 hover:shadow-md group"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-3 text-base">
              <AlertCircle size={20} className="text-red-600" />
              Bottlenecks
            </h3>
            <Download size={18} className="text-gray-300 group-hover:text-blue-500 transition-colors" onClick={(e) => { e.stopPropagation(); exportBottlenecks(); }} />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredData.bottleneckStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis dataKey="reason" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} width={120} />
                    <Bar dataKey="time" fill="#ef4444" radius={[0, 8, 8, 0]} barSize={32} />
                  </BarChart>
            </ResponsiveContainer>
          </div>
        </button>
      </div>

      {/* Performance Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
            <Users size={16} className="text-purple-600" />
            {t.performanceByPacker}
          </h3>
          <button 
            onClick={exportData}
            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-tight flex items-center gap-1"
          >
            <Download size={12} />
            {t.exportCSV}
          </button>
        </div>
        {filteredData.packerStats.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm italic">{t.noDataYet}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">{t.packerCol}</th>
                  <th className="px-4 py-3 text-right">{t.ordersCol}</th>
                  <th className="px-4 py-3 text-right">OPH</th>
                  <th className="px-4 py-3 text-right">{t.avgCol}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredData.packerStats.map(p => {
                  const isMeetingTarget = p.oph >= targetOrdersPerHour;

                  return (
                    <tr key={p.id} className="hover:bg-gray-50 group">
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-800">{p.name}</span>
                          <button 
                            onClick={() => onPackerClick(p.id)}
                            className="text-[10px] font-bold text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1"
                          >
                            <TrendingUp size={10} />
                            {t.viewDetail || 'View Detail'}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-bold text-gray-900">{p.orders}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className={`font-black ${isMeetingTarget ? 'text-emerald-600' : 'text-red-500'}`}>
                           {p.oph}
                        </div>
                        <div className="text-[8px] font-bold text-gray-400 uppercase">Target: {targetOrdersPerHour}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-bold text-gray-600">
                           {fmtDur(p.avg)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Predictive Stock */}
      <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <TrendingUp size={20} className="text-blue-600" />
          {t.predictiveStock}
        </h3>
        <div className="space-y-3">
          {consumableTypes.map(type => {
            const pred = predictions[type];
            if (!pred) return null;
            return (
              <div key={type} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-slate-400" />
                  <span className="text-sm font-bold text-gray-700">{t[type] || type}</span>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-base font-black text-gray-900">{pred.usagePerHour}/hr</div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">{t.usageRate}</div>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <div className={`text-base font-black ${pred.hoursRemaining !== null && pred.hoursRemaining < 4 ? 'text-red-600' : 'text-green-600'}`}>
                      {pred.hoursRemaining !== null ? `${pred.hoursRemaining}h` : <span className="text-green-500 text-xl">∞</span>}
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold tracking-tighter">{t.depletionEst}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

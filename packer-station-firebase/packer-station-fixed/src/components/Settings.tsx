import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Eye, EyeOff, Check, Plus, Trash2, Package, Palette, TrendingUp, Wifi, WifiOff } from 'lucide-react';
import { getStation, saveStation, getShowConsumables, saveShowConsumables, getEnabledConsumables, saveEnabledConsumables } from '../services/dataService';
import { useAppData } from '../context/AppDataContext';

interface SettingsProps { t: any; }

const PRESET_COLORS = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#06b6d4','#3b82f6','#6366f1','#a855f7','#ec4899','#64748b'];

export const Settings: React.FC<SettingsProps> = ({ t }) => {
  const { settings, updateSettings, isDemoMode } = useAppData();

  // ── Device-local state ────────────────────────────────────────────────────────
  const [stationName,       setStationName]       = useState(getStation());
  const [showConsumables,   setShowConsumables]   = useState(getShowConsumables());
  const [enabledConsumables, setEnabledConsumables] = useState<string[]>([]);

  // ── Shared settings (synced from Firebase/context) ────────────────────────────
  const [consumableTypes, setConsumableTypes] = useState<string[]>([]);
  const [stock,           setStock]           = useState<Record<string,number>>({});
  const [thresholds,      setThresholds]      = useState<Record<string,number>>({});
  const [colors,          setColors]          = useState<Record<string,string>>({});
  const [targetPerHour,   setTargetPerHour]   = useState(80);
  const [targetTotal,     setTargetTotal]     = useState(50);
  const [binRegex,        setBinRegex]        = useState('');
  const [newConsumable,   setNewConsumable]   = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [ok,  setOk]  = useState('');
  const [err, setErr] = useState('');

  // Sync from context whenever Firebase pushes updates
  useEffect(() => {
    setConsumableTypes(settings.consumable_types);
    setStock(settings.stock);
    setThresholds(settings.thresholds);
    setColors(settings.consumable_colors);
    setTargetPerHour(settings.target_orders_per_hour);
    setTargetTotal(settings.target_total_orders);
    setBinRegex(settings.bin_regex);
    setEnabledConsumables(getEnabledConsumables(settings.consumable_types));
  }, [settings]);

  const flashOk = (msg = t.stationNameUpdated) => { setOk(msg); setErr(''); setTimeout(() => setOk(''), 3000); };

  const handleSaveStation = () => {
    if (!stationName.trim()) { setErr(t.stationRequired); return; }
    saveStation(stationName.trim());
    flashOk();
  };

  const handleToggleConsumables = () => {
    const next = !showConsumables;
    saveShowConsumables(next);
    setShowConsumables(next);
    flashOk();
  };

  const toggleEnabled = (id: string) => {
    const next = enabledConsumables.includes(id) ? enabledConsumables.filter(x => x !== id) : [...enabledConsumables, id];
    saveEnabledConsumables(next);
    setEnabledConsumables(next);
    flashOk();
  };

  const handleAddConsumable = async () => {
    const name = newConsumable.trim().toUpperCase().replace(/\s+/g, '_');
    if (!name) return;
    if (consumableTypes.includes(name)) { setErr(t.pinExists); return; }
    const next = [...consumableTypes, name];
    await updateSettings({ consumable_types: next });
    setNewConsumable('');
    flashOk();
  };

  const handleDeleteConsumable = async (name: string) => {
    const next = consumableTypes.filter(c => c !== name);
    const nextStock  = { ...stock };  delete nextStock[name];
    const nextThresh = { ...thresholds }; delete nextThresh[name];
    const nextColors = { ...colors }; delete nextColors[name];
    await updateSettings({ consumable_types: next, stock: nextStock, thresholds: nextThresh, consumable_colors: nextColors });
    setDeleteConfirmId(null);
    flashOk();
  };

  const handleSaveStock = async () => {
    await updateSettings({ stock, thresholds });
    flashOk();
  };

  const handleSaveColors = async () => {
    await updateSettings({ consumable_colors: colors });
    flashOk();
  };

  const handleSaveTargets = async () => {
    await updateSettings({ target_orders_per_hour: targetPerHour, target_total_orders: targetTotal });
    flashOk();
  };

  const handleSaveBinRegex = async () => {
    try { new RegExp(binRegex); } catch { setErr('Invalid regex pattern'); return; }
    await updateSettings({ bin_regex: binRegex });
    flashOk('Bin regex saved!');
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Firebase status */}
      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold ${isDemoMode ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
        {isDemoMode ? <WifiOff size={14} /> : <Wifi size={14} />}
        {isDemoMode ? 'Demo Mode — data is local to this device only' : 'Firebase Connected — settings sync across all devices'}
      </div>

      {/* Status messages */}
      {ok  && <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-xl px-4 py-3"><Check size={14} />{ok}</div>}
      {err && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3"><AlertCircle size={14} />{err}</div>}

      {/* Station name (device-local) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
          <Package size={16} className="text-purple-500" />{t.editStationName} <span className="text-[9px] text-gray-400 font-normal">(this device only)</span>
        </h3>
        <div className="flex gap-2">
          <input value={stationName} onChange={e => setStationName(e.target.value.toUpperCase())}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-200" />
          <button onClick={handleSaveStation} className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 flex items-center gap-1.5">
            <Save size={14} />Save
          </button>
        </div>
      </div>

      {/* Show/hide consumables (device-local) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-gray-900 text-sm">{t.toggleConsumables} <span className="text-[9px] text-gray-400 font-normal">(this device)</span></div>
            <div className="text-xs text-gray-400 mt-0.5">{t.toggleConsumablesDesc}</div>
          </div>
          <button onClick={handleToggleConsumables}
            className={`w-12 h-6 rounded-full transition-colors ${showConsumables ? 'bg-blue-500' : 'bg-gray-200'} relative`}>
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${showConsumables ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* Targets (shared via Firebase) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
          <TrendingUp size={16} className="text-blue-500" />Targets <span className="text-[9px] text-gray-400 font-normal">(shared)</span>
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Orders / Hour</label>
            <input type="number" value={targetPerHour} onChange={e => setTargetPerHour(parseInt(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Target Total Orders</label>
            <input type="number" value={targetTotal} onChange={e => setTargetTotal(parseInt(e.target.value) || 0)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          </div>
        </div>
        <button onClick={handleSaveTargets} className="w-full py-2 bg-blue-600 text-white font-semibold rounded-xl text-sm hover:bg-blue-700 flex items-center justify-center gap-1.5">
          <Save size={14} />Save Targets
        </button>
      </div>

      {/* Bin regex (shared) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 text-sm mb-1 flex items-center gap-2">
          Bin ID Regex Pattern <span className="text-[9px] text-gray-400 font-normal">(shared)</span>
        </h3>
        <p className="text-xs text-gray-400 mb-3">Regex to validate bin/tote scans on first scan. Default accepts any alphanumeric bin ID.</p>
        <div className="flex gap-2">
          <input value={binRegex} onChange={e => setBinRegex(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
          <button onClick={handleSaveBinRegex} className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 flex items-center gap-1.5">
            <Save size={14} />Save
          </button>
        </div>
      </div>

      {/* Consumable types + stock + colors (shared) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
          <Package size={16} className="text-orange-500" />Consumable Types <span className="text-[9px] text-gray-400 font-normal">(shared)</span>
        </h3>

        <div className="space-y-3 mb-4">
          {consumableTypes.map(ct => (
            <div key={ct} className="border border-gray-100 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800">{t[ct] || ct}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleEnabled(ct)}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg ${enabledConsumables.includes(ct) ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                    {enabledConsumables.includes(ct) ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button onClick={() => setDeleteConfirmId(ct)}
                    className="p-1 text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Stock + threshold */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">{t.stockLabel}</label>
                  <input type="number" value={stock[ct] || 0}
                    onChange={e => setStock(s => ({ ...s, [ct]: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-200" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">{t.minStockLabel}</label>
                  <input type="number" value={thresholds[ct] || 0}
                    onChange={e => setThresholds(s => ({ ...s, [ct]: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-200" />
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1.5">{t.kanbanColor}</label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_COLORS.map(c => (
                    <button key={c} onClick={() => setColors(x => ({ ...x, [ct]: c }))}
                      className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${colors[ct] === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                  <input type="color" value={colors[ct] || '#64748b'}
                    onChange={e => setColors(x => ({ ...x, [ct]: e.target.value }))}
                    className="w-5 h-5 rounded-full cursor-pointer border-0" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Save stock + colors */}
        <div className="flex gap-2 mb-4">
          <button onClick={handleSaveStock} className="flex-1 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl text-xs hover:bg-gray-200 flex items-center justify-center gap-1">
            <Save size={12} />Save Stock
          </button>
          <button onClick={handleSaveColors} className="flex-1 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl text-xs hover:bg-gray-200 flex items-center justify-center gap-1">
            <Palette size={12} />Save Colors
          </button>
        </div>

        {/* Add consumable */}
        <div className="flex gap-2">
          <input value={newConsumable} onChange={e => setNewConsumable(e.target.value.toUpperCase())}
            placeholder={t.consumableNamePH}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-blue-200" />
          <button onClick={handleAddConsumable} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* Kanban link */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 text-sm mb-2 flex items-center gap-2">
          <Palette size={16} className="text-indigo-500" />{t.kanbanStatus}
        </h3>
        <a href="?kanban" target="_blank" rel="noopener noreferrer"
          className="block w-full text-center py-2.5 bg-indigo-600 text-white font-semibold rounded-xl text-sm hover:bg-indigo-700 transition-colors">
          {t.openKanban} ↗
        </a>
      </div>

      {/* Delete confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-2">{t.deleteConsumable}?</h3>
            <p className="text-sm text-gray-500 mb-6">{t.confirmDelete}</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2 text-gray-600 hover:bg-gray-50 rounded-xl text-sm">{t.cancel}</button>
              <button onClick={() => handleDeleteConsumable(deleteConfirmId)} className="flex-1 py-2 bg-red-600 text-white font-semibold rounded-xl text-sm hover:bg-red-700">{t.deleteConsumable}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

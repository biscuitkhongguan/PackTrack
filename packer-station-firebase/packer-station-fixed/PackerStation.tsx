import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, AlertCircle, Eye, EyeOff, Check, X, Plus, Trash2, Package, Palette, TrendingUp } from 'lucide-react';
import { getStation, saveStation, getShowConsumables, saveShowConsumables, getEnabledConsumables, saveEnabledConsumables, getConsumableTypes, saveConsumableTypes, getStock, saveStock, getThresholds, saveThresholds, getConsumableColors, saveConsumableColors, getTargetOrdersPerHour, saveTargetOrdersPerHour, getTargetTotalOrders, saveTargetTotalOrders } from '../services/dataService';
import { CONSUMABLE_TYPES } from '../constants';

interface SettingsProps {
  t: any;
}

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#a855f7', // purple
  '#ec4899', // pink
  '#64748b', // slate
];

export const Settings: React.FC<SettingsProps> = ({ t }) => {
  const [stationName, setStationName] = useState(getStation());
  const [showConsumables, setShowConsumables] = useState(getShowConsumables());
  const [consumableTypes, setConsumableTypes] = useState(getConsumableTypes(CONSUMABLE_TYPES));
  const [enabledConsumables, setEnabledConsumables] = useState(getEnabledConsumables(consumableTypes));
  const [stock, setStockState] = useState(getStock());
  const [thresholds, setThresholdsState] = useState(getThresholds());
  const [colors, setColorsState] = useState(getConsumableColors());
  const [targetPerHour, setTargetPerHourState] = useState(getTargetOrdersPerHour());
  const [targetTotal, setTargetTotalState] = useState(getTargetTotalOrders());
  const [newConsumable, setNewConsumable] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [ok, setOk] = useState('');
  const [err, setErr] = useState('');

  const handleSaveStation = () => {
    if (!stationName.trim()) {
      setErr(t.stationRequired);
      return;
    }
    saveStation(stationName.trim());
    setOk(t.stationNameUpdated);
    setErr('');
    setTimeout(() => setOk(''), 3000);
  };

  const handleToggleConsumables = () => {
    const newVal = !showConsumables;
    saveShowConsumables(newVal);
    setShowConsumables(newVal);
    setOk(t.stationNameUpdated);
    setTimeout(() => setOk(''), 3000);
  };

  const toggleIndividualConsumable = (id: string) => {
    let newList: string[];
    if (enabledConsumables.includes(id)) {
      newList = enabledConsumables.filter(x => x !== id);
    } else {
      newList = [...enabledConsumables, id];
    }
    saveEnabledConsumables(newList);
    setEnabledConsumables(newList);
    setOk(t.stationNameUpdated);
    setTimeout(() => setOk(''), 3000);
  };

  const handleAddConsumable = () => {
    const name = newConsumable.trim().toUpperCase().replace(/\s+/g, '_');
    if (!name) return;
    if (consumableTypes.includes(name)) {
      setErr(t.pinExists);
      return;
    }
    const newList = [...consumableTypes, name];
    saveConsumableTypes(newList);
    setConsumableTypes(newList);
    
    const newEnabled = [...enabledConsumables, name];
    saveEnabledConsumables(newEnabled);
    setEnabledConsumables(newEnabled);
    
    setNewConsumable('');
    setOk(t.stationNameUpdated);
    setTimeout(() => setOk(''), 3000);
  };

  const handleDeleteConsumable = (id: string) => {
    const newList = consumableTypes.filter(x => x !== id);
    saveConsumableTypes(newList);
    setConsumableTypes(newList);

    const newEnabled = enabledConsumables.filter(x => x !== id);
    saveEnabledConsumables(newEnabled);
    setEnabledConsumables(newEnabled);
    
    setDeleteConfirmId(null);
    setOk(t.stationNameUpdated);
    setTimeout(() => setOk(''), 3000);
  };

  const updateStock = (id: string, val: string) => {
    const n = Math.max(0, parseInt(val) || 0);
    const newStock = { ...stock, [id]: n };
    setStockState(newStock);
    saveStock(newStock);
  };

  const updateThreshold = (id: string, val: string) => {
    const n = Math.max(0, parseInt(val) || 0);
    const newThresholds = { ...thresholds, [id]: n };
    setThresholdsState(newThresholds);
    saveThresholds(newThresholds);
  };

  const updateColor = (id: string, color: string) => {
    const newColors = { ...colors, [id]: color };
    setColorsState(newColors);
    saveConsumableColors(newColors);
  };

  const handleSaveTarget = () => {
    saveTargetOrdersPerHour(targetPerHour);
    saveTargetTotalOrders(targetTotal);
    setOk(t.successful);
    setTimeout(() => setOk(''), 3000);
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2 text-sm">
          <SettingsIcon size={16} className="text-gray-600" />
          {t.editStationName}
        </h3>
        <p className="text-xs text-gray-400 mb-4">{t.resetStationDesc}</p>
        
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              {t.stationNameLabel}
            </label>
            <div className="flex gap-2">
              <input
                value={stationName}
                onChange={(e) => setStationName(e.target.value.toUpperCase())}
                placeholder={t.stationNamePH}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300 uppercase"
              />
              <button
                onClick={handleSaveStation}
                className="px-4 py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors flex items-center gap-2 text-sm"
              >
                <Save size={16} />
                {t.approve}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2 text-sm">
          <TrendingUp size={16} className="text-purple-600" />
          Efficiency Targets
        </h3>
        <p className="text-xs text-gray-400 mb-4">Set the performance targets for all packing stations.</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Target Orders Per Hour</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <TrendingUp size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  value={targetPerHour}
                  onChange={(e) => setTargetPerHourState(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Target Total Orders (Per Shift/Day)</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Package size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  value={targetTotal}
                  onChange={(e) => setTargetTotalState(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveTarget}
            className="w-full py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Save size={16} />
            {t.approve}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-2 text-sm">
          {showConsumables ? <Eye size={16} className="text-blue-600" /> : <EyeOff size={16} className="text-gray-400" />}
          {t.toggleConsumables}
        </h3>
        <p className="text-xs text-gray-400 mb-4">{t.toggleConsumablesDesc}</p>

        <button
          onClick={handleToggleConsumables}
          className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mb-6 ${
            showConsumables 
              ? 'bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100' 
              : 'bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100'
          }`}
        >
          {showConsumables ? <Eye size={16} /> : <EyeOff size={16} />}
          {showConsumables ? t.activeLabel : t.idle}
        </button>

        {showConsumables && (
          <div className="space-y-6 border-t border-gray-100 pt-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                {t.addConsumable}
              </label>
              <div className="flex gap-2">
                <input
                  value={newConsumable}
                  onChange={(e) => setNewConsumable(e.target.value)}
                  placeholder={t.consumableNamePH}
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={handleAddConsumable}
                  className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                {t.activeLabel} {t.requestConsumables} & Inventory
              </label>
              <div className="grid grid-cols-1 gap-4">
                {consumableTypes.map(ct => {
                  const isActive = enabledConsumables.includes(ct);
                  const currentColor = colors[ct] || '#64748b';
                  return (
                    <div key={ct} className="bg-slate-50 rounded-2xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleIndividualConsumable(ct)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                              isActive ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-transparent'
                            }`}
                          >
                            <Check size={12} />
                          </button>
                          <span className={`text-sm font-bold ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                            {t[ct] || ct.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {deleteConfirmId === ct ? (
                            <div className="flex items-center gap-1 animate-in fade-in zoom-in duration-200">
                              <button
                                onClick={() => handleDeleteConsumable(ct)}
                                className="px-2 py-1 bg-red-500 text-white text-[10px] font-bold rounded-lg hover:bg-red-600 transition-colors"
                              >
                                {t.deleteUser || 'Delete'}
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(ct)}
                              className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">{t.stockLabel}</label>
                          <div className="relative">
                            <Package size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="number"
                              min="0"
                              value={stock[ct] || 0}
                              onChange={(e) => updateStock(ct, e.target.value)}
                              className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-300"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-1">{t.minStockLabel}</label>
                          <div className="relative">
                            <AlertCircle size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="number"
                              min="0"
                              value={thresholds[ct] || 0}
                              onChange={(e) => updateThreshold(ct, e.target.value)}
                              className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-300"
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase mb-2 flex items-center gap-1">
                          <Palette size={10} />
                          {t.kanbanColor}
                        </label>
                        <div className="flex flex-wrap gap-2 items-center">
                          {PRESET_COLORS.map(c => (
                            <button
                              key={c}
                              onClick={() => updateColor(ct, c)}
                              className={`w-6 h-6 rounded-full border-2 transition-all ${
                                currentColor === c ? 'border-gray-900 scale-110' : 'border-transparent hover:scale-105'
                              }`}
                              style={{ backgroundColor: c }}
                            />
                          ))}
                          <div className="flex items-center gap-2 ml-2">
                            <input 
                              type="color" 
                              value={currentColor} 
                              onChange={(e) => updateColor(ct, e.target.value)}
                              className="w-8 h-8 rounded-lg border-2 border-gray-200 cursor-pointer p-0 overflow-hidden"
                            />
                            <input 
                              type="text" 
                              value={currentColor} 
                              onChange={(e) => updateColor(ct, e.target.value)}
                              placeholder="#000000"
                              className="w-20 px-2 py-1 text-[10px] font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {(err || ok) && (
        <div className="fixed bottom-24 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-300">
          {err && (
            <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-4 py-3 border border-red-100 shadow-lg">
              <AlertCircle size={14} />
              {err}
            </div>
          )}
          {ok && (
            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-xl px-4 py-3 border border-green-100 shadow-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              {ok}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

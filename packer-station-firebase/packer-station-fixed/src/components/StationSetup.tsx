import React, { useState } from 'react';
import { MapPin } from 'lucide-react';
import { saveStation, getDeviceId } from '../services/dataService';
import { useAppData } from '../context/AppDataContext';

interface StationSetupProps {
  t: any;
  lang: string;
  setLang: (l: string) => void;
}

export const StationSetup: React.FC<StationSetupProps> = ({ t, lang, setLang }) => {
  const { upsertGlobalStation } = useAppData();
  const [name, setName] = useState('');
  const [err,  setErr]  = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setErr(t.stationRequired); return; }
    const cleaned = name.trim().toUpperCase();
    saveStation(cleaned);
    await upsertGlobalStation({ id: getDeviceId(), name: cleaned, last_active: Date.now() });
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in zoom-in duration-200">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MapPin size={32} className="text-purple-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{t.stationSetupTitle}</h1>
          <p className="text-sm text-gray-400 mt-1">{t.stationSetupSub}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {t.stationNameLabel}
            </label>
            <input
              value={name}
              onChange={e => { setName(e.target.value.toUpperCase()); setErr(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder={t.stationNamePH}
              autoFocus
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 text-center text-xl font-mono tracking-widest focus:outline-none focus:border-purple-400 transition-colors uppercase"
            />
            {err && <p className="text-xs text-red-500 mt-1 text-center">{err}</p>}
          </div>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 transition-colors disabled:opacity-40"
          >
            {t.saveStation}
          </button>
        </div>

        <button
          onClick={() => setLang(lang === 'en' ? 'id' : 'en')}
          className="w-full mt-4 text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors"
        >
          {t.language}
        </button>
      </div>
    </div>
  );
};

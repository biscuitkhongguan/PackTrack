import React, { useState } from 'react';
import { Package, MapPin } from 'lucide-react';
import { User } from '../types';
import { getStation } from '../services/dataService';
import { useAppData } from '../context/AppDataContext';

interface LoginProps {
  onLogin: (u: User) => void;
  t: any;
  lang: string;
  setLang: (l: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, t, lang, setLang }) => {
  const { users, isDemoMode } = useAppData();
  const [pin,   setPin]   = useState('');
  const [error, setError] = useState('');
  const station           = getStation();

  const handleSubmit = (val: string) => {
    const u = users.find(x => x.pin === val && x.isActive !== false);
    if (!u) { setError(t.invalidPin); setPin(''); return; }
    onLogin(u);
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(val);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-in zoom-in duration-300">
        {station && (
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 text-[10px] font-bold px-3 py-1.5 rounded-full">
              <MapPin size={11} />{t.stationBadge}: {station}
            </span>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package size={32} className="text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">{t.appName}</h1>
          {isDemoMode && (
            <span className="inline-block mt-2 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-widest">
              Demo Mode
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 text-center">
              {t.enterPin}
            </label>
            <input
              type="password"
              value={pin}
              onChange={handlePinChange}
              onKeyDown={e => e.key === 'Enter' && pin.length >= 4 && handleSubmit(pin)}
              autoFocus
              placeholder="······"
              inputMode="numeric"
              pattern="[0-9]*"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-4 text-center text-2xl font-mono tracking-widest focus:outline-none focus:border-blue-400 transition-colors"
            />
          </div>
          {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          <button
            onClick={() => handleSubmit(pin)}
            disabled={pin.length < 4}
            className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200 active:scale-[0.98]"
          >
            {t.loginButton}
          </button>
        </div>

        {isDemoMode && (
          <p className="text-xs text-gray-400 text-center mt-4">{t.demoPins}</p>
        )}

        <button
          onClick={() => setLang(lang === 'en' ? 'id' : 'en')}
          className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 py-2 transition-colors"
        >
          {t.language}
        </button>
      </div>
    </div>
  );
};

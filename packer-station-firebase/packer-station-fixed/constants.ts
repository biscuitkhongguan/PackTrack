import { useState, useEffect } from 'react';
import { User } from './types';
import { T } from './constants';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { PackerStation } from './components/PackerStation';
import { StationSetup } from './components/StationSetup';
import { KanbanDisplay } from './components/KanbanDisplay';
import { getStation, getActiveLogins, saveActiveLogins, getGlobalStations, getDeviceId, saveStation, updateGlobalStation } from './services/dataService';
import { ActiveLogin } from './types';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [lang, setLang] = useState<'en' | 'id'>('en');
  const [isKanban, setIsKanban] = useState(false);
  const [currentStation, setCurrentStation] = useState(getStation());
  const t = T[lang];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('kanban')) setIsKanban(true);
  }, []);

  useEffect(() => {
    if (isKanban) return;
    const iv = setInterval(() => {
      const deviceId = getDeviceId();
      const globalStations = getGlobalStations();
      const config = globalStations.find(s => s.id === deviceId);
      
      if (config) {
        if (config.name !== currentStation) {
          saveStation(config.name);
          setCurrentStation(config.name);
        }
      } else if (currentStation) {
        // Register if missing from global list
        updateGlobalStation(deviceId, currentStation);
      }
    }, 5000);
    return () => clearInterval(iv);
  }, [currentStation, isKanban]);

  const handleLogin = (u: User) => {
    setUser(u);
    if (u.role === 'packer' && currentStation) {
      const logins = getActiveLogins();
      const filtered = logins.filter(l => l.station !== currentStation);
      const newLogin: ActiveLogin = {
        station: currentStation,
        packer_id: u.uid,
        packer_name: u.name,
        login_time: Date.now()
      };
      saveActiveLogins([...filtered, newLogin]);
    }
  };

  const handleLogout = () => {
    if (user?.role === 'packer' && currentStation) {
      const logins = getActiveLogins();
      saveActiveLogins(logins.filter(l => l.station !== currentStation));
    }
    setUser(null);
  };

  if (isKanban) return <KanbanDisplay t={t} />;
  if (!user) return <Login onLogin={handleLogin} t={t} lang={lang} setLang={setLang} />;
  
  // Only packers need a station name
  if (user.role === 'packer' && !currentStation) {
    return <StationSetup t={t} lang={lang} setLang={setLang} />;
  }
  
  if (user.role === 'supervisor' || user.role === 'admin') {
    return <Dashboard user={user} onLogout={handleLogout} t={t} lang={lang} setLang={setLang} />;
  }
  
  return <PackerStation user={user} onLogout={handleLogout} t={t} lang={lang} setLang={setLang} />;
}

import { useState, useEffect } from 'react';
import { User } from './types';
import { T } from './constants';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { PackerStation } from './components/PackerStation';
import { StationSetup } from './components/StationSetup';
import { KanbanDisplay } from './components/KanbanDisplay';
import { getStation, saveStation, getDeviceId } from './services/dataService';
import { useAppData } from './context/AppDataContext';
import { ActiveLogin } from './types';

export default function App() {
  const { globalStations, setActiveLogin, removeActiveLogin, upsertGlobalStation } = useAppData();

  const [user,           setUser]           = useState<User | null>(null);
  const [lang,           setLang]           = useState<'en' | 'id'>('en');
  const [isKanban,       setIsKanban]       = useState(false);
  const [currentStation, setCurrentStation] = useState(getStation());
  const t = T[lang];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('kanban')) setIsKanban(true);
  }, []);

  // React to globalStations changes (Firebase pushes name changes from supervisor)
  useEffect(() => {
    if (isKanban) return;
    const deviceId = getDeviceId();
    const config   = globalStations.find(s => s.id === deviceId);

    if (config) {
      if (config.name !== currentStation) {
        saveStation(config.name);
        setCurrentStation(config.name);
      }
    } else if (currentStation) {
      // Register this device
      upsertGlobalStation({ id: deviceId, name: currentStation, last_active: Date.now() });
    }
  }, [globalStations, isKanban]);

  const handleLogin = async (u: User) => {
    setUser(u);
    if (u.role === 'packer' && currentStation) {
      const newLogin: ActiveLogin = {
        station:     currentStation,
        packer_id:   u.uid,
        packer_name: u.name,
        login_time:  Date.now(),
      };
      await setActiveLogin(newLogin);
    }
  };

  const handleLogout = async () => {
    if (user?.role === 'packer' && currentStation) {
      await removeActiveLogin(currentStation);
    }
    setUser(null);
  };

  if (isKanban) return <KanbanDisplay t={t} />;
  if (!user)    return <Login onLogin={handleLogin} t={t} lang={lang} setLang={setLang} />;

  if (user.role === 'packer' && !currentStation) {
    return <StationSetup t={t} lang={lang} setLang={setLang} />;
  }

  if (user.role === 'supervisor' || user.role === 'admin') {
    return <Dashboard user={user} onLogout={handleLogout} t={t} lang={lang} setLang={setLang} />;
  }

  return <PackerStation user={user} onLogout={handleLogout} t={t} lang={lang} setLang={setLang} />;
}

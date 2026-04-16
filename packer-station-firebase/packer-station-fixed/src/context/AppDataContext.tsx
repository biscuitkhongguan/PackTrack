import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, getDocs, writeBatch, query, where, limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { sanitizeFirestoreData } from '../lib/firestore-utils';
import { Session, ConsumableRequest, HelpRequest, ActiveLogin, StationConfig, User, GlobalSettings } from '../types';
import { CONSUMABLE_TYPES } from '../constants';

/** True when no Firebase credentials are configured — falls back to localStorage */
export const isDemoMode = !isFirebaseConfigured;

export const SEED_USERS: User[] = [
  { uid: 'p1', name: 'Alice Packer',  role: 'packer',     pin: '1111',   isActive: true },
  { uid: 'p2', name: 'Bob Packer',    role: 'packer',     pin: '2222',   isActive: true },
  { uid: 'p3', name: 'Citra Packer',  role: 'packer',     pin: '3333',   isActive: true },
  { uid: 's1', name: 'Sarah Super',   role: 'supervisor', pin: '999999', isActive: true },
  { uid: 'a1', name: 'Admin User',    role: 'admin',      pin: '888888', isActive: true },
];

export const DEFAULT_SETTINGS: GlobalSettings = {
  stock: {},
  thresholds: {},
  consumable_colors: {},
  consumable_types: CONSUMABLE_TYPES,
  target_orders_per_hour: 80,
  target_total_orders: 50,
  bin_regex: '^[A-Z0-9][A-Z0-9_\\-]{1,48}$',
};

// ── localStorage helpers (demo mode) ──────────────────────────────────────────
const lsGet = <T>(k: string, def: T): T => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; }
};
const lsSet = <T>(k: string, v: T) => localStorage.setItem(k, JSON.stringify(v));

function loadSettingsFromLS(): GlobalSettings {
  return {
    stock:                 lsGet('consumable_stock',      {}),
    thresholds:            lsGet('consumable_thresholds', {}),
    consumable_colors:     lsGet('consumable_colors',     {}),
    consumable_types:      lsGet('consumable_types',      CONSUMABLE_TYPES),
    target_orders_per_hour: parseInt(localStorage.getItem('target_orders_per_hour') || '80'),
    target_total_orders:    parseInt(localStorage.getItem('target_total_orders')    || '50'),
    bin_regex:              localStorage.getItem('bin_regex') || DEFAULT_SETTINGS.bin_regex,
  };
}

function saveSettingsToLS(s: GlobalSettings) {
  lsSet('consumable_stock',      s.stock);
  lsSet('consumable_thresholds', s.thresholds);
  lsSet('consumable_colors',     s.consumable_colors);
  lsSet('consumable_types',      s.consumable_types);
  localStorage.setItem('target_orders_per_hour', String(s.target_orders_per_hour));
  localStorage.setItem('target_total_orders',    String(s.target_total_orders));
  localStorage.setItem('bin_regex',              s.bin_regex);
}

// ── Context interface ──────────────────────────────────────────────────────────
interface AppData {
  sessions:            Session[];
  users:               User[];
  consumableRequests:  ConsumableRequest[];
  helpRequests:        HelpRequest[];
  activeLogins:        ActiveLogin[];
  globalStations:      StationConfig[];
  settings:            GlobalSettings;
  loading:             boolean;
  isDemoMode:          boolean;

  // Writes
  upsertSession:               (s: Session) => Promise<void>;
  upsertUser:                  (u: User) => Promise<void>;
  saveAllUsers:                (users: User[]) => Promise<void>;
  deleteUser:                  (userId: string) => Promise<void>;
  upsertConsumableRequest:     (r: ConsumableRequest) => Promise<void>;
  updateConsumableRequest:     (id: string, updates: Partial<ConsumableRequest>) => Promise<void>;
  upsertHelpRequest:           (r: HelpRequest) => Promise<void>;
  updateHelpRequest:           (id: string, updates: Partial<HelpRequest>) => Promise<void>;
  setActiveLogin:              (login: ActiveLogin) => Promise<void>;
  removeActiveLogin:           (station: string) => Promise<void>;
  upsertGlobalStation:         (station: StationConfig) => Promise<void>;
  saveGlobalStations:          (stations: StationConfig[]) => Promise<void>;
  updateSettings:              (updates: Partial<GlobalSettings>) => Promise<void>;
  checkDuplicateOrder:         (orderId: string, date: string) => Promise<boolean>;
  clearAllData:                () => Promise<void>;
  resetUsers:                  () => Promise<void>;
}

const AppDataContext = createContext<AppData | null>(null);

export const useAppData = (): AppData => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be called inside <AppDataProvider>');
  return ctx;
};

// ── Provider ──────────────────────────────────────────────────────────────────
export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions,           setSessions]           = useState<Session[]>([]);
  const [users,              setUsers]              = useState<User[]>([]);
  const [consumableRequests, setConsumableRequests] = useState<ConsumableRequest[]>([]);
  const [helpRequests,       setHelpRequests]       = useState<HelpRequest[]>([]);
  const [activeLogins,       setActiveLogins]       = useState<ActiveLogin[]>([]);
  const [globalStations,     setGlobalStations]     = useState<StationConfig[]>([]);
  const [settings,           setSettings]           = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [loading,            setLoading]            = useState(true);

  // ── DEMO MODE: poll localStorage every 1.5 s ────────────────────────────────
  useEffect(() => {
    if (!isDemoMode) return;

    const load = () => {
      setSessions(lsGet('pp_sessions', []));
      const storedUsers = lsGet<User[]>('pp_users', []);
      setUsers(storedUsers.length ? storedUsers : SEED_USERS);
      setConsumableRequests(lsGet('pp_consumables',    []));
      setHelpRequests(lsGet('pp_help_requests',        []));
      setActiveLogins(lsGet('pp_active_logins',        []));
      setGlobalStations(lsGet('pp_global_stations',    []));
      setSettings(loadSettingsFromLS());
    };

    load();
    setLoading(false);
    const iv = setInterval(load, 1500);
    return () => clearInterval(iv);
  }, []);

  // ── FIREBASE MODE: onSnapshot real-time listeners ────────────────────────────
  useEffect(() => {
    if (isDemoMode) return;

    let loadedCount = 0;
    const TOTAL = 7;
    const markLoaded = () => { if (++loadedCount >= TOTAL) setLoading(false); };

    const unsubs: (() => void)[] = [];

    unsubs.push(onSnapshot(collection(db, 'sessions'), snap => {
      setSessions(snap.docs.map(d => d.data() as Session));
      markLoaded();
    }));

    unsubs.push(onSnapshot(collection(db, 'users'), snap => {
      if (snap.empty) {
        // First run — seed default users
        const batch = writeBatch(db);
        SEED_USERS.forEach(u => batch.set(doc(db, 'users', u.uid), u));
        batch.commit().catch(console.error);
      } else {
        setUsers(snap.docs.map(d => d.data() as User));
      }
      markLoaded();
    }));

    unsubs.push(onSnapshot(collection(db, 'consumable_requests'), snap => {
      setConsumableRequests(snap.docs.map(d => d.data() as ConsumableRequest));
      markLoaded();
    }));

    unsubs.push(onSnapshot(collection(db, 'help_requests'), snap => {
      setHelpRequests(snap.docs.map(d => d.data() as HelpRequest));
      markLoaded();
    }));

    unsubs.push(onSnapshot(collection(db, 'active_logins'), snap => {
      setActiveLogins(snap.docs.map(d => d.data() as ActiveLogin));
      markLoaded();
    }));

    unsubs.push(onSnapshot(collection(db, 'global_stations'), snap => {
      setGlobalStations(snap.docs.map(d => d.data() as StationConfig));
      markLoaded();
    }));

    unsubs.push(onSnapshot(doc(db, 'settings', 'global'), snap => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as GlobalSettings) });
      } else {
        // First run — initialize settings document
        setDoc(doc(db, 'settings', 'global'), sanitizeFirestoreData(DEFAULT_SETTINGS)).catch(console.error);
      }
      markLoaded();
    }));

    return () => unsubs.forEach(u => u());
  }, []);

  // ── Write operations ─────────────────────────────────────────────────────────

  const upsertSession = async (s: Session) => {
    if (isDemoMode) {
      const all = lsGet<Session[]>('pp_sessions', []);
      lsSet('pp_sessions', [...all.filter(x => x.id !== s.id), s]);
    } else {
      await setDoc(doc(db, 'sessions', s.id), sanitizeFirestoreData(s));
    }
  };

  const upsertUser = async (u: User) => {
    if (isDemoMode) {
      const all = lsGet<User[]>('pp_users', SEED_USERS);
      lsSet('pp_users', [...all.filter(x => x.uid !== u.uid), u]);
    } else {
      await setDoc(doc(db, 'users', u.uid), sanitizeFirestoreData(u));
    }
  };

  const saveAllUsers = async (usrs: User[]) => {
    if (isDemoMode) {
      lsSet('pp_users', usrs);
    } else {
      const batch = writeBatch(db);
      const snap = await getDocs(collection(db, 'users'));
      snap.docs.forEach(d => batch.delete(d.ref));
      usrs.forEach(u => batch.set(doc(db, 'users', u.uid), sanitizeFirestoreData(u)));
      await batch.commit();
    }
  };

  const deleteUser = async (userId: string) => {
    if (isDemoMode) {
      const all = lsGet<User[]>('pp_users', SEED_USERS);
      lsSet('pp_users', all.filter(u => u.uid !== userId));
    } else {
      await deleteDoc(doc(db, 'users', userId));
    }
  };

  const upsertConsumableRequest = async (r: ConsumableRequest) => {
    if (isDemoMode) {
      const all = lsGet<ConsumableRequest[]>('pp_consumables', []);
      lsSet('pp_consumables', [...all.filter(x => x.id !== r.id), r]);
    } else {
      await setDoc(doc(db, 'consumable_requests', r.id), sanitizeFirestoreData(r));
    }
  };

  const updateConsumableRequest = async (id: string, updates: Partial<ConsumableRequest>) => {
    if (isDemoMode) {
      const all = lsGet<ConsumableRequest[]>('pp_consumables', []);
      lsSet('pp_consumables', all.map(r => r.id === id ? { ...r, ...updates } : r));
    } else {
      await updateDoc(doc(db, 'consumable_requests', id), sanitizeFirestoreData(updates));
    }
  };

  const upsertHelpRequest = async (r: HelpRequest) => {
    if (isDemoMode) {
      const all = lsGet<HelpRequest[]>('pp_help_requests', []);
      lsSet('pp_help_requests', [...all.filter(x => x.id !== r.id), r]);
    } else {
      await setDoc(doc(db, 'help_requests', r.id), sanitizeFirestoreData(r));
    }
  };

  const updateHelpRequest = async (id: string, updates: Partial<HelpRequest>) => {
    if (isDemoMode) {
      const all = lsGet<HelpRequest[]>('pp_help_requests', []);
      lsSet('pp_help_requests', all.map(r => r.id === id ? { ...r, ...updates } : r));
    } else {
      await updateDoc(doc(db, 'help_requests', id), sanitizeFirestoreData(updates));
    }
  };

  const setActiveLogin = async (login: ActiveLogin) => {
    if (isDemoMode) {
      const all = lsGet<ActiveLogin[]>('pp_active_logins', []);
      lsSet('pp_active_logins', [...all.filter(l => l.station !== login.station), login]);
    } else {
      await setDoc(doc(db, 'active_logins', login.station), sanitizeFirestoreData(login));
    }
  };

  const removeActiveLogin = async (station: string) => {
    if (isDemoMode) {
      const all = lsGet<ActiveLogin[]>('pp_active_logins', []);
      lsSet('pp_active_logins', all.filter(l => l.station !== station));
    } else {
      await deleteDoc(doc(db, 'active_logins', station));
    }
  };

  const upsertGlobalStation = async (station: StationConfig) => {
    if (isDemoMode) {
      const all = lsGet<StationConfig[]>('pp_global_stations', []);
      lsSet('pp_global_stations', [...all.filter(s => s.id !== station.id), station]);
    } else {
      await setDoc(doc(db, 'global_stations', station.id), sanitizeFirestoreData(station));
    }
  };

  const saveGlobalStations = async (stations: StationConfig[]) => {
    if (isDemoMode) {
      lsSet('pp_global_stations', stations);
    } else {
      const batch = writeBatch(db);
      const snap = await getDocs(collection(db, 'global_stations'));
      snap.docs.forEach(d => batch.delete(d.ref));
      stations.forEach(s => batch.set(doc(db, 'global_stations', s.id), sanitizeFirestoreData(s)));
      await batch.commit();
    }
  };

  const updateSettings = async (updates: Partial<GlobalSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next); // optimistic local update
    if (isDemoMode) {
      saveSettingsToLS(next);
    } else {
      await setDoc(doc(db, 'settings', 'global'), sanitizeFirestoreData(next), { merge: true });
    }
  };

  /** Returns true if orderId has already been completed today (duplicate check) */
  const checkDuplicateOrder = async (orderId: string, date: string): Promise<boolean> => {
    if (isDemoMode) {
      return sessions.some(s => s.order_id === orderId && s.status === 'COMPLETED' && s.date === date);
    }
    const q = query(
      collection(db, 'sessions'),
      where('order_id', '==', orderId),
      where('status', '==', 'COMPLETED'),
      where('date', '==', date),
      limit(1)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  };

  const clearAllData = async () => {
    if (isDemoMode) {
      lsSet('pp_sessions',       []);
      lsSet('pp_consumables',    []);
      lsSet('pp_help_requests',  []);
      lsSet('pp_active_logins',  []);
    } else {
      const colls = ['sessions', 'consumable_requests', 'help_requests', 'active_logins'];
      const snaps = await Promise.all(colls.map(c => getDocs(collection(db, c))));
      const batch = writeBatch(db);
      snaps.forEach(snap => snap.docs.forEach(d => batch.delete(d.ref)));
      await batch.commit();
    }
  };

  const resetUsers = async () => {
    if (isDemoMode) {
      lsSet('pp_users', SEED_USERS);
    } else {
      const batch = writeBatch(db);
      const snap = await getDocs(collection(db, 'users'));
      snap.docs.forEach(d => batch.delete(d.ref));
      SEED_USERS.forEach(u => batch.set(doc(db, 'users', u.uid), u));
      await batch.commit();
    }
  };

  return (
    <AppDataContext.Provider value={{
      sessions, users, consumableRequests, helpRequests, activeLogins,
      globalStations, settings, loading, isDemoMode,
      upsertSession, upsertUser, saveAllUsers, deleteUser,
      upsertConsumableRequest, updateConsumableRequest,
      upsertHelpRequest, updateHelpRequest,
      setActiveLogin, removeActiveLogin,
      upsertGlobalStation, saveGlobalStations,
      updateSettings, checkDuplicateOrder,
      clearAllData, resetUsers,
    }}>
      {loading ? (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm font-semibold">
              {isDemoMode ? 'Loading PackTrack…' : 'Connecting to database…'}
            </p>
            {!isDemoMode && (
              <p className="text-slate-600 text-xs mt-1">Firebase Firestore</p>
            )}
          </div>
        </div>
      ) : children}
    </AppDataContext.Provider>
  );
};

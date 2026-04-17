import { load, save, uid } from '../utils';
import { Session, ConsumableRequest, User, HelpRequest, ActiveLogin, StationConfig } from '../types';

export const SEED_USERS: User[] = [
  { uid: 'p1', name: 'Alice Packer', role: 'packer', pin: '1111', isActive: true },
  { uid: 'p2', name: 'Bob Packer', role: 'packer', pin: '2222', isActive: true },
  { uid: 'p3', name: 'Citra Packer', role: 'packer', pin: '3333', isActive: true },
  { uid: 's1', name: 'Sarah Super', role: 'supervisor', pin: '999999', isActive: true },
  { uid: 'a1', name: 'Admin User', role: 'admin', pin: '888888', isActive: true },
];

export const getAllUsers = (): User[] => {
  return load('pp_users', SEED_USERS);
};
export const saveAllUsers = (u: User[]) => save('pp_users', u);

export const toggleUserActive = (userId: string) => {
  const users = getAllUsers();
  const updated = users.map(u => u.uid === userId ? { ...u, isActive: !u.isActive } : u);
  saveAllUsers(updated);
  return updated;
};

export const getSessions = (): Session[] => load('pp_sessions', []);
export const saveSessions = (d: Session[]) => save('pp_sessions', d);

export const getRequests = (): ConsumableRequest[] => load('pp_consumables', []);
export const saveRequests = (d: ConsumableRequest[]) => save('pp_consumables', d);

export const getHelpRequests = (): HelpRequest[] => load('pp_help_requests', []);
export const saveHelpRequests = (d: HelpRequest[]) => save('pp_help_requests', d);

export const getActiveLogins = (): ActiveLogin[] => load('pp_active_logins', []);
export const saveActiveLogins = (d: ActiveLogin[]) => save('pp_active_logins', d);

export const getStation = (): string => localStorage.getItem('station_name') || '';
export const saveStation = (name: string) => localStorage.setItem('station_name', name.toUpperCase());

export const getShowConsumables = (): boolean => localStorage.getItem('show_consumables') !== 'false';
export const saveShowConsumables = (show: boolean) => localStorage.setItem('show_consumables', String(show));

export const getEnabledConsumables = (all: string[]): string[] => {
  const saved = localStorage.getItem('enabled_consumables');
  if (!saved) return all;
  try {
    return JSON.parse(saved);
  } catch {
    return all;
  }
};
export const saveEnabledConsumables = (list: string[]) => localStorage.setItem('enabled_consumables', JSON.stringify(list));

export const getConsumableTypes = (initial: string[]): string[] => {
  const saved = localStorage.getItem('consumable_types');
  if (!saved) return initial;
  try {
    return JSON.parse(saved);
  } catch {
    return initial;
  }
};
export const saveConsumableTypes = (list: string[]) => localStorage.setItem('consumable_types', JSON.stringify(list));

export const getStock = (): Record<string, number> => {
  try {
    const saved = localStorage.getItem('consumable_stock');
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
};
export const saveStock = (stock: Record<string, number>) => localStorage.setItem('consumable_stock', JSON.stringify(stock));

export const getThresholds = (): Record<string, number> => {
  try {
    const saved = localStorage.getItem('consumable_thresholds');
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
};
export const saveThresholds = (thresholds: Record<string, number>) => localStorage.setItem('consumable_thresholds', JSON.stringify(thresholds));

export const getConsumableColors = (): Record<string, string> => {
  const saved = localStorage.getItem('consumable_colors');
  return saved ? JSON.parse(saved) : {};
};
export const saveConsumableColors = (colors: Record<string, string>) => localStorage.setItem('consumable_colors', JSON.stringify(colors));

export const getTargetOrdersPerHour = (): number => {
  const saved = localStorage.getItem('target_orders_per_hour');
  return saved ? parseInt(saved, 10) : 80;
};
export const saveTargetOrdersPerHour = (target: number) => localStorage.setItem('target_orders_per_hour', String(target));

export const getTargetTotalOrders = (): number => {
  const saved = localStorage.getItem('target_total_orders');
  return saved ? parseInt(saved, 10) : 50;
};
export const saveTargetTotalOrders = (target: number) => localStorage.setItem('target_total_orders', String(target));

export const getDeviceId = (): string => {
  let id = localStorage.getItem('pp_device_id');
  if (!id) {
    id = uid();
    localStorage.setItem('pp_device_id', id);
  }
  return id;
};

export const getGlobalStations = (): StationConfig[] => load('pp_global_stations', []);
export const saveGlobalStations = (s: StationConfig[]) => save('pp_global_stations', s);

export const updateGlobalStation = (id: string, name: string) => {
  const stations = getGlobalStations();
  const filtered = stations.filter(s => s.id !== id);
  saveGlobalStations([...filtered, { id, name, last_active: Date.now() }]);
};

// --- Analytics Helpers ---

export const getLeaderboard = () => {
  const sessions = getSessions();
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const todaySessions = sessions.filter(s => s.date === today && s.status === 'COMPLETED');
  
  const stats: Record<string, { id: string, name: string, count: number, firstStart: number }> = {};
  
  todaySessions.forEach(s => {
    if (!stats[s.packer_id]) {
      stats[s.packer_id] = { id: s.packer_id, name: s.packer_name, count: 0, firstStart: s.start_time };
    }
    stats[s.packer_id].count++;
    if (s.start_time < stats[s.packer_id].firstStart) {
      stats[s.packer_id].firstStart = s.start_time;
    }
  });

  return Object.values(stats)
    .map(p => {
      const hours = (Date.now() - p.firstStart) / 3600000;
      const oph = hours > 0.05 ? Math.round((p.count / hours) * 10) / 10 : p.count;
      return { ...p, oph };
    })
    .sort((a, b) => b.oph - a.oph)
    .slice(0, 5);
};

export const getPredictiveStock = () => {
  const requests = getRequests();
  const stock = getStock();
  const _d = new Date();
  const today = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
  
  // Usage in the last 4 hours to get a "current" rate
  const fourHoursAgo = Date.now() - (4 * 3600000);
  const recentRequests = requests.filter(r => r.requested_at > fourHoursAgo);
  
  const usagePerHour: Record<string, number> = {};
  recentRequests.forEach(r => {
    usagePerHour[r.consumable_type] = (usagePerHour[r.consumable_type] || 0) + 1;
  });

  const prediction: Record<string, { hoursRemaining: number | null, usagePerHour: number }> = {};
  
  Object.keys(stock).forEach(type => {
    const rate = (usagePerHour[type] || 0) / 4; // average per hour over 4 hours
    prediction[type] = {
      usagePerHour: Math.round(rate * 10) / 10,
      hoursRemaining: rate > 0 ? Math.round((stock[type] / rate) * 10) / 10 : null
    };
  });

  return prediction;
};


/**
 * dataService.ts
 * ──────────────
 * ONLY handles device-local settings (stored in this browser's localStorage).
 * All shared / cross-device data lives in AppDataContext (Firebase or localStorage via context).
 */

import { Session, ConsumableRequest } from '../types';

// ── Device identity ────────────────────────────────────────────────────────────
export const getDeviceId = (): string => {
  let id = localStorage.getItem('pp_device_id');
  if (!id) {
    id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem('pp_device_id', id);
  }
  return id;
};

// ── Station name (per-device) ──────────────────────────────────────────────────
export const getStation     = ():              string  => localStorage.getItem('station_name') || '';
export const saveStation    = (name: string)           => localStorage.setItem('station_name', name.toUpperCase());

// ── Consumable display toggles (per-device) ────────────────────────────────────
export const getShowConsumables  = (): boolean             => localStorage.getItem('show_consumables') !== 'false';
export const saveShowConsumables = (show: boolean)         => localStorage.setItem('show_consumables', String(show));

export const getEnabledConsumables = (all: string[]): string[] => {
  const saved = localStorage.getItem('enabled_consumables');
  if (!saved) return all;
  try { return JSON.parse(saved); } catch { return all; }
};
export const saveEnabledConsumables = (list: string[]) =>
  localStorage.setItem('enabled_consumables', JSON.stringify(list));

// ── Pure analytics helpers (take context data as params — no direct reads) ────

export const computeLeaderboard = (sessions: Session[]) => {
  const d    = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const done = sessions.filter(s => s.date === today && s.status === 'COMPLETED');

  const stats: Record<string, { id: string; name: string; count: number; firstStart: number }> = {};
  done.forEach(s => {
    if (!stats[s.packer_id])
      stats[s.packer_id] = { id: s.packer_id, name: s.packer_name, count: 0, firstStart: s.start_time };
    stats[s.packer_id].count++;
    if (s.start_time < stats[s.packer_id].firstStart)
      stats[s.packer_id].firstStart = s.start_time;
  });

  return Object.values(stats)
    .map(p => {
      const hours = (Date.now() - p.firstStart) / 3_600_000;
      const oph   = hours > 0.05 ? Math.round((p.count / hours) * 10) / 10 : p.count;
      return { ...p, oph };
    })
    .sort((a, b) => b.oph - a.oph)
    .slice(0, 5);
};

export const computePredictiveStock = (
  requests: ConsumableRequest[],
  stock: Record<string, number>
) => {
  const fourHoursAgo   = Date.now() - 4 * 3_600_000;
  const recent         = requests.filter(r => r.requested_at > fourHoursAgo);
  const usageCount: Record<string, number> = {};
  recent.forEach(r => { usageCount[r.consumable_type] = (usageCount[r.consumable_type] || 0) + 1; });

  const pred: Record<string, { hoursRemaining: number | null; usagePerHour: number }> = {};
  Object.keys(stock).forEach(type => {
    const rate = (usageCount[type] || 0) / 4;
    pred[type] = {
      usagePerHour:   Math.round(rate * 10) / 10,
      hoursRemaining: rate > 0 ? Math.round((stock[type] / rate) * 10) / 10 : null,
    };
  });
  return pred;
};

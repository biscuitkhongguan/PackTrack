import React from 'react';
import { useAppData } from '../context/AppDataContext';
import { ConsumableRequest } from '../types';
import { todayStr } from '../utils';

interface KanbanDisplayProps { t: any; }

export const KanbanDisplay: React.FC<KanbanDisplayProps> = ({ t }) => {
  const { consumableRequests, settings } = useAppData();
  const today   = todayStr();
  const pending = consumableRequests.filter(r => r.date === today && r.status === 'PENDING');
  const activeTypes = Array.from(new Set(pending.map(r => r.consumable_type)));

  if (activeTypes.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
        <div className="w-32 h-32 rounded-full border-4 border-gray-800 mb-4" />
        <h1 className="text-2xl font-bold tracking-widest uppercase text-gray-700">SYSTEM READY</h1>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
      {activeTypes.map(type => {
        const color = settings.consumable_colors[type] || '#64748b';
        const count = pending.filter(r => r.consumable_type === type).length;
        return (
          <div key={type} className="rounded-3xl flex flex-col items-center justify-center text-white shadow-2xl animate-pulse"
            style={{ backgroundColor: color }}>
            <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4 text-center px-4 drop-shadow-lg">
              {t[type] || type.replace(/_/g, ' ')}
            </h2>
            <div className="bg-black/20 px-8 py-4 rounded-full backdrop-blur-sm">
              <span className="text-6xl md:text-8xl font-black drop-shadow-md">{count}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

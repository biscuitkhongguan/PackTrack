import React from 'react';
import { Trophy, Medal } from 'lucide-react';

interface LeaderboardProps {
  data: { id: string, name: string, oph: number }[];
  t: any;
  compact?: boolean;
  onPackerClick?: (id: string) => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ data, t, compact, onPackerClick }) => {
  if (data.length === 0) return null;

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden ${compact ? 'p-3' : 'p-5'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`${compact ? 'text-xs' : 'text-sm'} font-bold text-gray-900 flex items-center gap-2`}>
          <Trophy size={compact ? 14 : 16} className="text-amber-500" />
          {t.topPackers}
        </h3>
      </div>
      <div className="space-y-2">
        {data.map((p, i) => (
          <button 
            key={p.id} 
            onClick={() => onPackerClick?.(p.id)}
            className={`w-full flex items-center justify-between p-2 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99] text-left ${i === 0 ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50 border border-gray-100'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                i === 0 ? 'bg-amber-400 text-white' : 
                i === 1 ? 'bg-slate-300 text-white' : 
                i === 2 ? 'bg-orange-400 text-white' : 
                'bg-gray-200 text-gray-500'
              }`}>
                {i === 0 ? <Medal size={12} /> : i + 1}
              </div>
              <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold text-gray-700 truncate max-w-[100px]`}>{p.name}</span>
            </div>
            <div className="text-right">
              <div className={`${compact ? 'text-[10px]' : 'text-xs'} font-black text-blue-600`}>{p.oph}</div>
              <div className="text-[8px] text-gray-400 uppercase font-bold tracking-tighter">OPH</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Session } from '../types';
import { fmtDur } from '../utils';

interface LiveSessionCardProps {
  session: Session;
  t: any;
}

export const LiveSessionCard: React.FC<LiveSessionCardProps> = ({ session, t }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    if (session.status === 'IN_PROGRESS') {
      const iv = setInterval(() => tick(n => n + 1), 1000);
      return () => clearInterval(iv);
    }
  }, [session.status]);

  const sec = session.status === 'IN_PROGRESS'
    ? Math.floor((Date.now() - session.start_time) / 1000)
    : (session.cycle_time_seconds || 0);

  const COLOR = {
    IN_PROGRESS: 'border-green-300 bg-green-50',
    ON_HOLD: 'border-orange-300 bg-orange-50',
    COMPLETED: 'border-gray-200 bg-gray-50',
  }[session.status as string] || 'border-gray-200 bg-gray-50';

  return (
    <div className={`rounded-xl border p-4 ${COLOR}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm text-gray-800">{session.packer_name}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${session.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-700' :
            session.status === 'ON_HOLD' ? 'bg-orange-100 text-orange-700' :
              'bg-gray-100 text-gray-600'
          }`}>{session.status.replace('_', ' ')}</span>
      </div>
      <div className="text-xs text-gray-500 space-y-1">
        <div>Bin: <span className="font-mono font-semibold text-gray-700">{session.bin_id}</span></div>
        <div className="flex items-center gap-1">
          <Clock size={11} />
          {fmtDur(sec)}
        </div>
        {session.status === 'ON_HOLD' && session.holds?.length > 0 && (
          <div className="text-orange-600 font-medium">
            {t[session.holds[session.holds.length - 1].reason] || session.holds[session.holds.length - 1].reason}
          </div>
        )}
      </div>
    </div>
  );
};

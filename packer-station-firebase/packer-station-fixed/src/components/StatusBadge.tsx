import React from 'react';
import { Status } from '../types';

interface StatusBadgeProps {
  status: Status;
  t: any;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, t }) => {
  const cfg = {
    IDLE: { bg: 'bg-gray-100', text: 'text-gray-600', label: t.idle },
    PACKING: { bg: 'bg-green-100', text: 'text-green-700', label: t.packing },
    IN_PROGRESS: { bg: 'bg-green-100', text: 'text-green-700', label: t.packing },
    BREAK: { bg: 'bg-blue-100', text: 'text-blue-700', label: t.onBreak },
    ON_HOLD: { bg: 'bg-orange-100', text: 'text-orange-700', label: t.onHold },
  }[status as string] || { bg: 'bg-gray-100', text: 'text-gray-600', label: status };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
};

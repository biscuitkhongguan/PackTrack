export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/** Returns today's date string in WIB (Asia/Jakarta) timezone: YYYY-MM-DD */
export function getTodayWIB(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Alias — always uses WIB timezone */
export function todayStr() {
  return getTodayWIB();
}

export function fmtDur(sec: number) {
  if (!sec || sec < 0) return '0s';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function fmtTime(ms: number) {
  if (!ms) return '--:--';
  return new Date(ms).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: 'Asia/Jakarta',
  });
}

export function downloadCSV(data: any[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data
    .map(row =>
      Object.values(row)
        .map(val => (typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val))
        .join(',')
    )
    .join('\n');
  const csv = `\uFEFFsep=,\n${headers}\n${rows}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function elapsed(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

import type { RiskLevel } from '@/lib/apps';

const levelToClass: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  CRITICAL: 'bg-rose-100 text-rose-800 border-rose-200',
  UNKNOWN: 'bg-slate-200 text-slate-700 border-slate-300',
};

interface RiskPillProps {
  level: RiskLevel;
}

export function RiskPill({ level }: RiskPillProps): JSX.Element {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${levelToClass[level]}`}>
      {level}
    </span>
  );
}

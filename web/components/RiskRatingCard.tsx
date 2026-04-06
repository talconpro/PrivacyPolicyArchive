import type { RiskLevel } from '@/lib/apps';

import { RiskPill } from './RiskPill';

interface RiskRatingCardProps {
  level: RiskLevel;
  score: number;
}

export function RiskRatingCard({ level, score }: RiskRatingCardProps): JSX.Element {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Risk Rating</p>
      <div className="mt-3 flex items-center gap-3">
        <RiskPill level={level} />
        <span className="text-sm text-slate-600">Score</span>
        <span className="text-2xl font-bold text-slate-900">{score}</span>
        <span className="text-sm text-slate-500">/100</span>
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
    </div>
  );
}

import Link from 'next/link';

interface CategoryGridProps {
  entries: Array<{ name: string; count: number; href: string }>;
}

export function CategoryGrid({ entries }: CategoryGridProps): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <Link
          key={entry.name}
          href={entry.href}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{entry.name}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{entry.count}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function SearchBox(): JSX.Element {
  return (
    <form action="/apps" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label htmlFor="app-search" className="mb-2 block text-sm font-medium text-slate-700">
        Search App
      </label>
      <div className="flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3">
        <span aria-hidden className="mr-2 text-slate-500">
          🔎
        </span>
        <input
          id="app-search"
          name="q"
          type="search"
          placeholder="Search by app name, category, or developer"
          className="w-full border-0 bg-transparent py-3 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate-500">Use filters in browse page for category and risk.</p>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
        >
          Search
        </button>
      </div>
    </form>
  );
}

import { getChangelog } from '../../src/lib/changelog';

export const dynamic = 'force-static';

export default async function ChangelogPage() {
  const { releases } = await getChangelog();
  const published = releases.filter((r) => r.unreleased !== true);
  const upcoming = releases.filter((r) => r.unreleased === true);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black text-slate-900">Changelog</h1>
        <p className="text-slate-600">Cambios por versión. Las versiones “Unreleased” se agrupan como “Próximamente”.</p>
      </header>

      <div className="grid gap-4">
        {published.map((r) => (
          <section key={r.version} id={`v${r.version}`} className="rounded-2xl border border-iron-200 bg-white p-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-black text-slate-900">v{r.version}</h2>
              <div className="text-sm font-bold text-slate-500">{r.date ?? '—'}</div>
            </div>
            <ul className="mt-4 space-y-2">
              {r.items.map((it, idx) => (
                <li key={`${r.version}-${idx}`} className="flex gap-3">
                  <span className="mt-[2px] text-iron-500 font-black">•</span>
                  <span className="text-slate-700">{it}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {upcoming.length > 0 && (
        <section className="rounded-2xl border border-iron-200 bg-iron-50 p-6">
          <h2 className="text-xl font-black text-slate-900">Próximamente</h2>
          <div className="mt-4 grid gap-4">
            {upcoming.map((r) => (
              <div key={r.version} className="rounded-xl border border-iron-200 bg-white p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="text-lg font-black text-slate-900">v{r.version}</div>
                  <div className="text-sm font-bold text-slate-500">Unreleased</div>
                </div>
                <ul className="mt-3 space-y-2">
                  {r.items.map((it, idx) => (
                    <li key={`${r.version}-${idx}`} className="flex gap-3">
                      <span className="mt-[2px] text-iron-500 font-black">•</span>
                      <span className="text-slate-700">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

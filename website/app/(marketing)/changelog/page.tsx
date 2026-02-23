import { getChangelog } from '../../../src/lib/changelog';

export const dynamic = 'force-static';

export default async function ChangelogPage() {
  const { releases } = await getChangelog();
  const published = releases.filter((r) => r.unreleased !== true);
  const upcoming = releases.filter((r) => r.unreleased === true);

  return (
    <>
      <header className="border-b border-current/20 pb-6">
        <div className="text-[10px] opacity-40 tracking-[0.3em] mb-3">━━━ CAMBIOS DE VERSIÓN ━━━</div>
        <h1 className="text-4xl font-bold tracking-tight">CHANGELOG</h1>
        <p className="mt-2 opacity-70 leading-relaxed">
          Cambios por versión. Las versiones “Unreleased” se agrupan como “Próximamente”.
        </p>
      </header>

      <div className="grid gap-4">
        {published.map((r) => (
          <section
            key={r.version}
            id={`v${r.version}`}
            className="border border-current/20 p-6 hover:border-current/40 transition-colors bg-[#f5f1e8]"
          >
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-bold tracking-tight">v{r.version}</h2>
              <div className="text-[12px] opacity-60">{r.date ?? '—'}</div>
            </div>
            <ul className="mt-4 space-y-2">
              {r.items.map((it, idx) => (
                <li key={`${r.version}-${idx}`} className="flex gap-3">
                  <span className="mt-[2px] text-[10px] opacity-50">•</span>
                  <span className="opacity-80 leading-relaxed">{it}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {upcoming.length > 0 && (
        <section className="border border-current/20 bg-[#1a1a2e]/5 p-6">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-bold tracking-tight">PRÓXIMAMENTE</h2>
            <div className="text-[12px] opacity-60">UNRELEASED</div>
          </div>
          <div className="mt-4 grid gap-4">
            {upcoming.map((r) => (
              <div key={r.version} className="border border-current/20 bg-[#f5f1e8] p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div className="text-lg font-bold tracking-tight">v{r.version}</div>
                  <div className="text-[12px] opacity-60">Unreleased</div>
                </div>
                <ul className="mt-3 space-y-2">
                  {r.items.map((it, idx) => (
                    <li key={`${r.version}-${idx}`} className="flex gap-3">
                      <span className="mt-[2px] text-[10px] opacity-50">•</span>
                      <span className="opacity-80 leading-relaxed">{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

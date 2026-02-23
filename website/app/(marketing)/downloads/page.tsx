import { getChangelog } from '../../../src/lib/changelog';
import { getDownloads } from '../../../src/lib/downloads';
import { compareSemver, isSemver } from '../../../src/lib/version';

export default async function DownloadsPage() {
  const downloads = await getDownloads();
  const changelog = await getChangelog();
  const latestChangelog = changelog.releases.find((r) => r.unreleased !== true) ?? null;
  const latestDownloads = downloads.latest ?? null;
  const downloadMap = new Map<string, { url?: string; sha256?: string }>();
  if (downloads.latest?.version) downloadMap.set(downloads.latest.version, downloads.latest.apk ?? {});
  for (const r of downloads.previous ?? []) {
    if (r?.version) downloadMap.set(r.version, r.apk ?? {});
  }

  const latest =
    latestChangelog && latestDownloads && isSemver(latestChangelog.version) && isSemver(latestDownloads.version)
      ? (compareSemver(latestDownloads.version, latestChangelog.version) >= 0
          ? { version: latestDownloads.version, date: latestDownloads.date ?? null }
          : { version: latestChangelog.version, date: latestChangelog.date ?? null })
      : (latestChangelog
          ? { version: latestChangelog.version, date: latestChangelog.date ?? null }
          : (latestDownloads ? { version: latestDownloads.version, date: latestDownloads.date ?? null } : null));

  const published = changelog.releases.filter((r) => r.unreleased !== true);
  const latestApk = latest?.version ? downloadMap.get(latest.version) : undefined;
  const latestApkUrl = latestApk?.url;
  const fallbackLatestAvailableUrl = downloads.latest?.apk?.url;
  const fallbackLatestAvailableVersion = downloads.latest?.version;

  return (
    <>
      <header className="border-b border-current/20 pb-6">
        <div className="text-[10px] opacity-40 tracking-[0.3em] mb-3">━━━ DESCARGAS ━━━</div>
        <h1 className="text-4xl font-bold tracking-tight">DOWNLOADS</h1>
        <p className="mt-2 opacity-70 leading-relaxed">
          Descarga la última versión. Si necesitas una versión anterior, se listarán aquí cuando estén disponibles.
        </p>
      </header>

      <section className="border border-current/20 p-6 bg-[#f5f1e8]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[10px] opacity-60 tracking-wider mb-1">ÚLTIMA VERSIÓN</div>
            <div className="text-2xl font-bold">{latest ? `v${latest.version}` : '—'}</div>
            <div className="text-[12px] opacity-50 mt-1">{latest?.date ?? '—'}</div>
            {!latestApkUrl && fallbackLatestAvailableVersion && latest?.version && fallbackLatestAvailableVersion !== latest.version ? (
              <div className="mt-2 text-[10px] opacity-60">
                APK para v{latest.version} todavía no está listo. Último APK disponible: v{fallbackLatestAvailableVersion}.
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            {latestApkUrl ? (
              <a
                href={latestApkUrl}
                className="inline-flex items-center justify-center px-5 py-3 font-bold bg-[#1a1a2e] text-[#f5f1e8] hover:opacity-90 transition-opacity"
              >
                Descargar APK (Android)
              </a>
            ) : (
              <>
                <span className="inline-flex items-center justify-center px-5 py-3 font-bold bg-[#1a1a2e]/10 opacity-50">
                  APK (pendiente)
                </span>
                {fallbackLatestAvailableUrl && fallbackLatestAvailableVersion && latest?.version && fallbackLatestAvailableVersion !== latest.version ? (
                  <a
                    href={fallbackLatestAvailableUrl}
                    className="inline-flex items-center justify-center border border-current px-5 py-3 font-bold hover:bg-[#1a1a2e]/5 transition-colors"
                  >
                    Descargar última disponible (v{fallbackLatestAvailableVersion})
                  </a>
                ) : null}
              </>
            )}
            <a
              href="/changelog"
              className="inline-flex items-center justify-center border border-current px-5 py-3 font-bold hover:bg-[#1a1a2e]/5 transition-colors"
            >
              Ver changelog
            </a>
          </div>
        </div>

        {downloads.latest?.apk?.sha256 ? (
          <div className="mt-4 border border-current/20 bg-[#1a1a2e]/5 p-4">
            <div className="text-[10px] font-bold opacity-60">SHA-256</div>
            <div className="mt-1 break-all text-[12px] opacity-70">{downloads.latest.apk.sha256}</div>
          </div>
        ) : null}
      </section>

      <section className="border border-current/20 p-6 bg-[#f5f1e8]">
        <h2 className="text-xl font-bold">INSTALACIÓN (ANDROID)</h2>
        <ul className="mt-3 space-y-2 opacity-80">
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>Descarga el APK desde esta página.</span></li>
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>Si Android lo solicita, habilita "Instalar apps desconocidas" para tu navegador/gestor de archivos.</span></li>
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>Si vienes de una versión muy vieja, haz backup antes y considera restaurar luego.</span></li>
        </ul>
        <div className="mt-4 border border-current/20 bg-[#1a1a2e]/5 p-4 text-xs opacity-70">
          La app puede avisar de updates automáticamente usando <span className="font-mono">/releases.json</span>.
        </div>
      </section>

      <section className="border border-current/20 p-6 bg-[#f5f1e8]">
        <h2 className="text-xl font-bold">VERSIONES</h2>
        <p className="mt-2 opacity-70">Listado en orden por changelog. Solo algunas versiones pueden tener APK disponible.</p>
        <div className="mt-4 space-y-3">
          {published.length ? (
            published.map((r) => {
              const apk = downloadMap.get(r.version);
              const url = apk?.url;
              return (
                <div key={r.version} className="flex flex-col gap-2 border border-current/20 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-bold">v{r.version}</div>
                    <div className="text-[12px] opacity-50">{r.date ?? '—'}</div>
                  </div>
                  {url ? (
                    <a href={url} className="px-4 py-2 text-sm font-bold bg-[#1a1a2e] text-[#f5f1e8] hover:opacity-90 transition-opacity">
                      Descargar APK
                    </a>
                  ) : (
                    <span className="px-4 py-2 text-sm font-bold bg-[#1a1a2e]/10 opacity-50">Sin APK</span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="border border-current/20 bg-[#1a1a2e]/5 p-4 opacity-70">
              No hay releases publicados todavía.
            </div>
          )}
        </div>
      </section>

      <section className="border border-current/20 p-6 bg-[#f5f1e8]">
        <h2 className="text-xl font-bold">NOTAS</h2>
        <ul className="mt-3 space-y-2 opacity-80">
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>Android puede bloquear instalaciones externas: habilita "Instalar apps desconocidas".</span></li>
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>Si vienes de una versión muy vieja, usa backup/restore.</span></li>
        </ul>
      </section>
    </>
  );
}

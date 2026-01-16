import { getChangelog } from '../../src/lib/changelog';
import { getDownloads } from '../../src/lib/downloads';
import { compareSemver, isSemver } from '../../src/lib/version';

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
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black text-slate-900">Descargas</h1>
        <p className="text-slate-600">
          Descarga la última versión. Si necesitas una versión anterior, se listarán aquí cuando estén disponibles.
        </p>
      </header>

      <section className="rounded-2xl border border-iron-200 bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-black text-iron-600">Última versión</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{latest ? `v${latest.version}` : '—'}</div>
            <div className="mt-1 text-sm text-slate-500">{latest?.date ?? '—'}</div>
            {!latestApkUrl && fallbackLatestAvailableVersion && latest?.version && fallbackLatestAvailableVersion !== latest.version ? (
              <div className="mt-2 text-xs font-bold text-slate-500">
                APK para v{latest.version} todavía no está listo. Último APK disponible: v{fallbackLatestAvailableVersion}.
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            {latestApkUrl ? (
              <a
                href={latestApkUrl}
                className="inline-flex items-center justify-center rounded-xl bg-iron-500 px-5 py-3 font-bold text-white hover:bg-iron-600"
              >
                Descargar APK (Android)
              </a>
            ) : (
              <>
                <span className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-5 py-3 font-bold text-slate-500">
                  APK (pendiente)
                </span>
                {fallbackLatestAvailableUrl && fallbackLatestAvailableVersion && latest?.version && fallbackLatestAvailableVersion !== latest.version ? (
                  <a
                    href={fallbackLatestAvailableUrl}
                    className="inline-flex items-center justify-center rounded-xl border border-iron-200 bg-white px-5 py-3 font-bold text-slate-900 hover:bg-iron-50"
                  >
                    Descargar última disponible (v{fallbackLatestAvailableVersion})
                  </a>
                ) : null}
              </>
            )}
            <a
              href="/changelog"
              className="inline-flex items-center justify-center rounded-xl border border-iron-200 bg-white px-5 py-3 font-bold text-slate-900 hover:bg-iron-50"
            >
              Ver changelog
            </a>
          </div>
        </div>

        {downloads.latest?.apk?.sha256 ? (
          <div className="mt-4 rounded-xl border border-iron-200 bg-iron-50 p-4">
            <div className="text-xs font-bold text-slate-600">SHA-256</div>
            <div className="mt-1 break-all font-mono text-sm text-slate-700">{downloads.latest.apk.sha256}</div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-iron-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-900">Instalación (Android)</h2>
        <ul className="mt-3 space-y-2 text-slate-700">
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>Descarga el APK desde esta página.</span></li>
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>Si Android lo solicita, habilita “Instalar apps desconocidas” para tu navegador/gestor de archivos.</span></li>
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>Si vienes de una versión muy vieja, haz backup antes y considera restaurar luego.</span></li>
        </ul>
        <div className="mt-4 rounded-xl border border-iron-200 bg-iron-50 p-4 text-sm text-slate-700">
          La app puede avisar de updates automáticamente usando <span className="font-mono">/releases.json</span>.
        </div>
      </section>

      <section className="rounded-2xl border border-iron-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-900">Versiones</h2>
        <p className="mt-2 text-slate-600">Listado en orden por changelog. Solo algunas versiones pueden tener APK disponible.</p>
        <div className="mt-4 space-y-3">
          {published.length ? (
            published.map((r) => {
              const apk = downloadMap.get(r.version);
              const url = apk?.url;
              return (
                <div key={r.version} className="flex flex-col gap-2 rounded-xl border border-iron-200 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-black text-slate-900">v{r.version}</div>
                    <div className="text-sm text-slate-500">{r.date ?? '—'}</div>
                  </div>
                  {url ? (
                    <a href={url} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
                      Descargar APK
                    </a>
                  ) : (
                    <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-500">Sin APK</span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-iron-200 bg-iron-50 p-4 text-slate-700">
              No hay releases publicados todavía.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-iron-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-900">Notas</h2>
        <ul className="mt-3 space-y-2 text-slate-700">
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>Android puede bloquear instalaciones externas: habilita “Instalar apps desconocidas”.</span></li>
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>Si vienes de una versión muy vieja, usa backup/restore.</span></li>
        </ul>
      </section>
    </div>
  );
}

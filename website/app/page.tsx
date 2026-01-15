import Link from 'next/link';
import { getChangelog } from '../src/lib/changelog';
import { getDownloads } from '../src/lib/downloads';
import { AppMockup } from '../src/components/AppMockup';

export default async function HomePage() {
  const changelog = await getChangelog();
  const downloads = await getDownloads();
  const latest = changelog.releases.find((r) => r.unreleased !== true);

  return (
    <div className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-iron-200 bg-white p-8 shadow-sm">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-iron-100 blur-2xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-iron-200/60 blur-2xl" />

        <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
          <div className="anim-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-iron-200 bg-iron-50 px-4 py-2 text-xs font-black text-iron-800">
              <span>Desarrollado por</span>
              <a href="https://motiona.xyz" className="text-slate-900 hover:text-iron-700">MotionA</a>
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
              Entrena con precisión.
              <span className="block text-iron-600">Registra, analiza y progresa.</span>
            </h1>
            <p className="mt-4 max-w-xl text-slate-600">
              IronTrain es una app enfocada en ejecución: diario pro, biblioteca de ejercicios, análisis útiles y herramientas
              para mantener consistencia real.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/downloads"
                className="inline-flex items-center justify-center rounded-xl bg-iron-500 px-6 py-3 font-black text-white hover:bg-iron-600"
              >
                Descargar
              </Link>
              <Link
                href="/changelog"
                className="inline-flex items-center justify-center rounded-xl border border-iron-200 bg-white px-6 py-3 font-black text-slate-900 hover:bg-iron-50"
              >
                Changelog
              </Link>
              <Link
                href="/faq"
                className="inline-flex items-center justify-center rounded-xl border border-iron-200 bg-white px-6 py-3 font-black text-slate-900 hover:bg-iron-50"
              >
                FAQ
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-iron-200 bg-white p-4">
                <div className="text-xs font-black text-slate-600">Última versión</div>
                <div className="mt-1 text-lg font-black text-slate-900">{latest ? `v${latest.version}` : '—'}</div>
                <div className="mt-1 text-xs font-bold text-slate-500">{latest?.date ?? '—'}</div>
              </div>
              <div className="rounded-2xl border border-iron-200 bg-white p-4">
                <div className="text-xs font-black text-slate-600">Updates</div>
                <div className="mt-1 text-lg font-black text-slate-900">Automáticos</div>
                <div className="mt-1 text-xs font-bold text-slate-500">
                  Feed: <span className="font-mono">/releases.json</span>
                </div>
              </div>
              <div className="rounded-2xl border border-iron-200 bg-white p-4">
                <div className="text-xs font-black text-slate-600">APK Android</div>
                {downloads.latest?.apk?.url ? (
                  <a href={downloads.latest.apk.url} className="mt-1 inline-flex font-black text-iron-700 hover:text-iron-800">
                    Descargar ahora
                  </a>
                ) : (
                  <div className="mt-1 text-sm font-black text-slate-400">Pendiente</div>
                )}
                <div className="mt-1 text-xs font-bold text-slate-500">Instalación directa (sin tienda).</div>
              </div>
            </div>
          </div>

          <div className="anim-fade-up md:justify-self-end">
            <AppMockup />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-iron-200 bg-white p-6">
          <div className="text-xs font-black text-iron-700">Daily Log</div>
          <div className="mt-2 text-xl font-black text-slate-900">Resumen por ejercicio</div>
          <p className="mt-2 text-slate-600">Chips por series/reps/volumen y mejor serie para decisiones rápidas.</p>
        </div>
        <div className="rounded-2xl border border-iron-200 bg-white p-6">
          <div className="text-xs font-black text-iron-700">Análisis</div>
          <div className="mt-2 text-xl font-black text-slate-900">Tendencias accionables</div>
          <p className="mt-2 text-slate-600">Rangos por defecto, consistencia y señales para ajustar tu plan.</p>
        </div>
        <div className="rounded-2xl border border-iron-200 bg-white p-6">
          <div className="text-xs font-black text-iron-700">Datos</div>
          <div className="mt-2 text-xl font-black text-slate-900">Backups sólidos</div>
          <p className="mt-2 text-slate-600">Export/Import robusto con validación y tolerancia a tablas legacy.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-iron-200 bg-white p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Soporte y comunidad</h2>
            <p className="mt-2 text-slate-600">FAQ oficial, changelog vivo y una forma directa de apoyar el proyecto.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/faq" className="rounded-xl border border-iron-200 bg-white px-5 py-3 font-black hover:bg-iron-50">
              FAQ
            </Link>
            <Link href="/donate" className="rounded-xl bg-iron-500 px-5 py-3 font-black text-white hover:bg-iron-600">
              Donar
            </Link>
            <a
              href="https://motiona.xyz"
              className="rounded-xl border border-iron-200 bg-white px-5 py-3 font-black hover:bg-iron-50"
            >
              MotionA
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

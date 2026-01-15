export default function SupportPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black text-slate-900">Soporte</h1>
        <p className="text-slate-600">Canales oficiales para soporte, feedback y roadmap.</p>
      </header>

      <section className="rounded-2xl border border-iron-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-900">MotionA</h2>
        <p className="mt-2 text-slate-700">Empresa desarrolladora y canal principal.</p>
        <div className="mt-4">
          <a className="inline-flex rounded-xl bg-slate-900 px-5 py-3 font-black text-white hover:bg-slate-800" href="https://motiona.xyz">
            Ir a motiona.xyz
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-iron-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-900">Cafecito</h2>
        <p className="mt-2 text-slate-700">Apoya el mantenimiento y mejoras del ecosistema.</p>
        <div className="mt-4">
          <a className="inline-flex rounded-xl bg-iron-500 px-5 py-3 font-black text-white hover:bg-iron-600" href="https://cafecito.app/motiona">
            Abrir Cafecito
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-iron-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-900">Feedback</h2>
        <p className="mt-2 text-slate-700">
          El changelog se mantiene público y el roadmap se consolida a partir de feedback real. Si reportas un problema, incluye
          versión de la app, dispositivo y pasos para reproducir.
        </p>
      </section>
    </div>
  );
}


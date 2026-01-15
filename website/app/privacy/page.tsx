export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black text-slate-900">Privacidad y seguridad</h1>
        <p className="text-slate-600">Resumen oficial de cómo IronTrain maneja tus datos.</p>
      </header>

      <section className="rounded-2xl border border-iron-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-900">Modelo</h2>
        <ul className="mt-3 space-y-2 text-slate-700">
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>Sin cuentas y sin backend: tus datos residen en el dispositivo.</span></li>
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>Backups export/import en JSON para migración y recuperación.</span></li>
        </ul>
      </section>

      <section className="rounded-2xl border border-iron-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-900">Principios</h2>
        <ul className="mt-3 space-y-2 text-slate-700">
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>No se loggean datos sensibles del usuario (historial, payloads de DB).</span></li>
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>Los errores al usuario son claros y no exponen SQL crudo.</span></li>
        </ul>
      </section>

      <section className="rounded-2xl border border-iron-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-900">Backups</h2>
        <ul className="mt-3 space-y-2 text-slate-700">
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>Export: genera un JSON con tus datos.</span></li>
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>Import: valida estructura antes de escribir.</span></li>
        </ul>
      </section>

      <section className="rounded-2xl border border-iron-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-900">Desarrollador</h2>
        <p className="mt-2 text-slate-700">
          IronTrain es desarrollado por <a className="font-black hover:text-iron-700" href="https://motiona.xyz">MotionA</a>.
        </p>
      </section>
    </div>
  );
}


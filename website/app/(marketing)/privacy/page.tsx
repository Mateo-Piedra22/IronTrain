export default function PrivacyPage() {
  return (
    <>
      <header className="border-b border-current/20 pb-6">
        <div className="text-[10px] opacity-40 tracking-[0.3em] mb-3">━━━ PRIVACIDAD Y SEGURIDAD ━━━</div>
        <h1 className="text-4xl font-bold tracking-tight">PRIVACIDAD</h1>
        <p className="mt-2 opacity-70 leading-relaxed">Resumen oficial de cómo IronTrain maneja tus datos.</p>
      </header>

      <section className="border border-current/20 p-6 bg-[#f5f1e8]">
        <h2 className="text-xl font-bold">MODELO</h2>
        <ul className="mt-3 space-y-2 opacity-80">
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>Sin cuentas y sin backend: tus datos residen en el dispositivo.</span></li>
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>Backups export/import en JSON para migración y recuperación.</span></li>
        </ul>
      </section>

      <section className="border border-current/20 p-6 bg-[#f5f1e8]">
        <h2 className="text-xl font-bold">PRINCIPIOS</h2>
        <ul className="mt-3 space-y-2 opacity-80">
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>No se loggean datos sensibles del usuario (historial, payloads de DB).</span></li>
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>Los errores al usuario son claros y no exponen SQL crudo.</span></li>
        </ul>
      </section>

      <section className="border border-current/20 p-6 bg-[#f5f1e8]">
        <h2 className="text-xl font-bold">BACKUPS</h2>
        <ul className="mt-3 space-y-2 opacity-80">
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>Export: genera un JSON con tus datos.</span></li>
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>Import: valida estructura antes de escribir.</span></li>
        </ul>
      </section>

      <section className="border border-current/20 p-6 bg-[#f5f1e8]">
        <h2 className="text-xl font-bold">DESARROLLADOR</h2>
        <p className="mt-2 opacity-80">
          IronTrain es desarrollado por <a className="font-bold underline hover:opacity-80" href="https://motiona.xyz">MotionA</a>.
        </p>
      </section>
    </>
  );
}


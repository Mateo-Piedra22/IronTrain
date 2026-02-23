export default function SupportPage() {
  return (
    <>
      <header className="border-b border-current/20 pb-6">
        <div className="text-[10px] opacity-40 tracking-[0.3em] mb-3">━━━ SOPORTE ━━━</div>
        <h1 className="text-4xl font-bold tracking-tight">SOPORTE</h1>
        <p className="mt-2 opacity-70 leading-relaxed">Canales oficiales para soporte, feedback y roadmap.</p>
      </header>

      <section className="border border-current/20 p-6 bg-[#f5f1e8]">
        <h2 className="text-xl font-bold">MOTIONA</h2>
        <p className="mt-2 opacity-80">Empresa desarrolladora y canal principal.</p>
        <div className="mt-4">
          <a className="inline-flex px-5 py-3 font-bold bg-[#1a1a2e] text-[#f5f1e8] hover:opacity-90 transition-opacity" href="https://motiona.xyz">
            Ir a motiona.xyz
          </a>
        </div>
      </section>

      <section className="border border-current/20 p-6 bg-[#f5f1e8]">
        <h2 className="text-xl font-bold">CAFECITO</h2>
        <p className="mt-2 opacity-80">Apoya el mantenimiento y mejoras del ecosistema.</p>
        <div className="mt-4">
          <a className="inline-flex px-5 py-3 font-bold border border-current bg-[#1a1a2e]/10 hover:bg-[#1a1a2e]/20 transition-colors" href="https://cafecito.app/motiona">
            Abrir Cafecito
          </a>
        </div>
      </section>

      <section className="border border-current/20 p-6 bg-[#f5f1e8]">
        <h2 className="text-xl font-bold">FEEDBACK</h2>
        <p className="mt-2 opacity-80 leading-relaxed">
          El changelog se mantiene público y el roadmap se consolida a partir de feedback real. Si reportas un problema, incluye
          versión de la app, dispositivo y pasos para reproducir.
        </p>
      </section>
    </>
  );
}


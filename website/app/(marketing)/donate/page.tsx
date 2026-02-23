import Link from 'next/link';

export default function DonatePage() {
  return (
    <>
      <header className="border-b border-current/20 pb-6">
        <div className="text-[10px] opacity-40 tracking-[0.3em] mb-3">━━━ DONACIONES ━━━</div>
        <h1 className="text-4xl font-bold tracking-tight">APOYA IRONTRAIN</h1>
        <p className="mt-2 opacity-70 leading-relaxed">
          Si IronTrain te aporta valor, puedes apoyar el proyecto. Enlace oficial sin trackers.
        </p>
      </header>

      <section className="border border-current/20 p-6 bg-[#f5f1e8]">
        <h2 className="text-xl font-bold">MÉTODOS</h2>
        <div className="mt-4 grid gap-3">
          <a
            href="https://cafecito.app/motiona"
            className="border border-current/20 bg-[#1a1a2e]/5 p-5 hover:border-current/40 transition-colors"
          >
            <div className="text-sm font-bold">Cafecito</div>
            <div className="mt-2 opacity-70">Invitame 1 café para ayudar a mantener y mejorar los sistemas.</div>
            <div className="mt-4 inline-flex px-4 py-2 text-sm font-bold border border-current bg-[#1a1a2e] text-[#f5f1e8]">
              Abrir Cafecito
            </div>
          </a>
        </div>
      </section>

      <section className="border border-current/20 p-6 bg-[#f5f1e8]">
        <h2 className="text-xl font-bold">TRANSPARENCIA</h2>
        <ul className="mt-3 space-y-2 opacity-80">
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>El objetivo es cubrir costos de build, dominio y publicación.</span></li>
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>El changelog y las releases quedan públicos en esta web.</span></li>
          <li className="flex gap-3"><span className="text-[10px] opacity-50 mt-[2px]">•</span><span>Desarrollado por MotionA: <a className="font-bold underline hover:opacity-80" href="https://motiona.xyz">motiona.xyz</a>.</span></li>
        </ul>
        <div className="mt-5">
          <Link href="/faq" className="font-bold hover:opacity-80 underline">Ver FAQ</Link>
        </div>
      </section>
    </>
  );
}

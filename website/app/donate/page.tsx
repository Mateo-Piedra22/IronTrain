import Link from 'next/link';

export default function DonatePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-black text-slate-900">Donaciones</h1>
        <p className="text-slate-600">
          Si IronTrain te aporta valor, puedes apoyar el proyecto. Enlace oficial (sin trackers).
        </p>
      </header>

      <section className="rounded-2xl border border-iron-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-900">Métodos</h2>
        <div className="mt-4 grid gap-3">
          <a
            href="https://cafecito.app/motiona"
            className="rounded-2xl border border-iron-200 bg-iron-50 p-5 hover:bg-white"
          >
            <div className="text-sm font-black text-slate-900">Cafecito</div>
            <div className="mt-2 text-slate-600">Invitame 1 café para ayudar a mantener y mejorar los sistemas.</div>
            <div className="mt-4 inline-flex rounded-xl bg-iron-500 px-4 py-2 text-sm font-black text-white">Abrir Cafecito</div>
          </a>
        </div>
      </section>

      <section className="rounded-2xl border border-iron-200 bg-white p-6">
        <h2 className="text-xl font-black text-slate-900">Transparencia</h2>
        <ul className="mt-3 space-y-2 text-slate-700">
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>El objetivo es cubrir costos de build, dominio y publicación.</span></li>
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>El changelog y las releases quedan públicos en esta web.</span></li>
          <li className="flex gap-3"><span className="text-iron-500 font-black">•</span><span>Desarrollado por MotionA: <a className="font-bold hover:text-iron-700" href="https://motiona.xyz">motiona.xyz</a>.</span></li>
        </ul>
        <div className="mt-5">
          <Link href="/faq" className="font-bold text-iron-700 hover:text-iron-800">Ver FAQ</Link>
        </div>
      </section>
    </div>
  );
}

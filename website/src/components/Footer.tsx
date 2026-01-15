import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-iron-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-black text-slate-900">IronTrain</div>
            <div className="mt-1 text-sm text-slate-600">
              Entrena, registra y analiza tu progreso. Desarrollado por <a className="font-bold hover:text-iron-700" href="https://motiona.xyz">MotionA</a>.
            </div>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm font-bold text-slate-700">
            <Link href="/downloads" className="hover:text-iron-700">Descargas</Link>
            <Link href="/changelog" className="hover:text-iron-700">Changelog</Link>
            <Link href="/faq" className="hover:text-iron-700">FAQ</Link>
            <Link href="/support" className="hover:text-iron-700">Soporte</Link>
            <Link href="/donate" className="hover:text-iron-700">Donar</Link>
            <Link href="/privacy" className="hover:text-iron-700">Privacidad</Link>
            <a href="https://motiona.xyz" className="hover:text-iron-700">MotionA</a>
          </nav>
        </div>
        <div className="mt-8 text-xs text-slate-500">
          © {new Date().getFullYear()} IronTrain · {`irontrain.motiona.xyz`}
        </div>
      </div>
    </footer>
  );
}

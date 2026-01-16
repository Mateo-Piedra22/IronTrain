import Link from 'next/link';

const links = [
  { href: '/downloads', label: 'Descargas' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/faq', label: 'FAQ' },
  { href: '/support', label: 'Soporte' },
  { href: '/donate', label: 'Donar' },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-iron-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/icon.png"
            alt="IronTrain"
            width={36}
            height={36}
            className="h-9 w-9 rounded-xl border border-iron-200 bg-white"
          />
          <div className="font-black text-slate-900">IronTrain</div>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-bold text-slate-700 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-iron-700">
              {l.label}
            </Link>
          ))}
          <a href="https://motiona.xyz" className="hover:text-iron-700">
            MotionA
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/downloads"
            className="rounded-xl bg-iron-500 px-4 py-2 text-sm font-black text-white hover:bg-iron-600"
          >
            Descargar
          </Link>
        </div>
      </div>
    </header>
  );
}

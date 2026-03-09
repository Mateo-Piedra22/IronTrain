import Link from "next/link";
import { ArrowLeft, Heart } from "lucide-react";

export default function IOSPage() {
  return (
    <>
      <header className="border-b border-current/20 pb-6">
        <div className="text-[10px] opacity-40 tracking-[0.3em] mb-3">━━━ IRONTRAIN ━━━</div>
        <h1 className="text-4xl font-bold tracking-tight">iOS</h1>
        <p className="mt-2 opacity-70 leading-relaxed">
          IronTrain para iPhone y iPad.
        </p>
      </header>

      <section className="border-2 border-amber-500/50 p-6 bg-amber-50/80 mt-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <span className="text-amber-600 text-3xl">📱</span>
            <div>
              <h2 className="text-xl font-bold text-amber-900">
                No disponible en App Store
              </h2>
              <p className="mt-2 opacity-80 leading-relaxed">
                Actualmente IronTrain no está publicado en la App Store de Apple. Publicar en iOS requiere una cuenta de desarrollador Apple ($99 USD/año), un Mac para compilar la app, y tiempo adicional de desarrollo.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border border-current/20 p-6 bg-[#f5f1e8] mt-6">
        <h3 className="font-bold text-lg mb-4">¿Qué podés hacer mientras tanto?</h3>
        <ul className="space-y-3">
          <li className="flex gap-3">
            <span className="text-[10px] opacity-50 mt-[2px]">•</span>
            <span>
              <strong>Descargar para Android</strong> - IronTrain está disponible como APK directo.
              <Link href="/downloads" className="ml-2 underline font-bold">Ver descargas →</Link>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-[10px] opacity-50 mt-[2px]">•</span>
            <span>
              <strong>Usar en versión web</strong> - Podés acceder desde cualquier navegador.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-[10px] opacity-50 mt-[2px]">•</span>
            <span>
              <strong>Esperar</strong> - Estamos trabajando para traer IronTrain a iOS.
            </span>
          </li>
        </ul>
      </section>

      <section className="border border-current/20 p-6 bg-[#f5f1e8] mt-6">
        <div className="text-center">
          <Heart className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h3 className="text-xl font-bold mb-2">
            Ayudanos a llegar a iOS
          </h3>
          <p className="opacity-70 mb-6 max-w-md mx-auto">
            Si querés apoyar el desarrollo y el pronto despliegue de IronTrain en la App Store, podés contribuir con una donación.
          </p>
          <a 
            href="https://cafecito.app/motiona" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="inline-flex items-center gap-2 bg-[#1a1a2e] text-[#f5f1e8] px-8 py-4 font-bold hover:opacity-90 transition-opacity"
          >
            <Heart className="w-5 h-5" />
            Apoyar con donación
          </a>
          <p className="text-sm opacity-50 mt-4">
            Tu apoyo ayuda a cubrir los costos de desarrollo y la suscripción de Apple Developer.
          </p>
        </div>
      </section>

      <div className="mt-8 pt-6 border-t border-current/20">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm opacity-70 hover:opacity-100 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al inicio
        </Link>
      </div>
    </>
  );
}
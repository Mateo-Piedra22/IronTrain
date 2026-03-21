import { ExternalLink } from 'lucide-react';
import Link from 'next/link';

const faqGroups = [
  {
    title: 'SINCRONIZACIÓN Y CUENTAS',
    id: 'sync',
    items: [
      {
        q: '¿Qué es IronSync y cómo funciona?',
        a: 'IronSync es nuestro motor de sincronización propietario. A diferencia del modo offline puro, IronSync respalda tus entrenamientos, rutinas y medidas en nuestra infraestructura segura (PostgreSQL) cada vez que tienes conexión. Esto permite que si cambias de dispositivo, simplemente inicies sesión y recuperes tu IronScore y progreso completo.',
      },
      {
        q: '¿Puedo seguir entrenando sin conexión?',
        a: 'Absolutamente. IronTrain es local-first. La app utiliza una base de datos SQLite interna para que nunca te detengas en un gimnasio con mala señal. En cuanto recuperas conectividad, el protocolo de sincronización resuelve los deltas automáticamente.',
      },
      {
        q: '¿Cómo borro mis datos por completo?',
        a: 'En IronTrain respetamos la soberanía del usuario. Puedes eliminar tu cuenta desde los Ajustes de la App o desde tu perfil en la web. Al hacerlo, se ejecuta un purgado irreversible de todas tus entradas de entrenamiento, perfiles y metadatos de nuestros servidores.',
      }
    ]
  },
  {
    title: 'IRONSCORE Y REPUTACIÓN',
    id: 'score',
    items: [
      {
        q: '¿Cómo se calcula el IronScore?',
        a: 'El IronScore es una métrica dinámica. Se compone de tres pilares: Consistencia (ritmo de entrenamiento), Intensidad (volumen relativo) y Comunidad (aporte de rutinas y feedback). No solo mide cuánto levantas, sino cuánto te comprometes con el protocolo.',
      },
      {
        q: '¿Mi entrenamiento es público por defecto?',
        a: 'Negativo. La privacidad es el estado base. Tus sesiones de entrenamiento son privadas y solo tú puedes verlas. Solo las rutinas que decidas explícitamente "Publicar en el Marketplace" serán visibles para otros operadores en el Feed.',
      }
    ]
  },
  {
    title: 'COMUNIDAD Y MARKETPLACE',
    id: 'share',
    items: [
      {
        q: '¿Qué pasa si publico una rutina y me la moderan?',
        a: 'El Marketplace de IronTrain es un entorno de alta calidad. Si una rutina es marcada por falta de descripción o contenido inapropiado, un moderador puede ocultarla. Recibirás un mensaje en el detalle de la rutina con los pasos para re-habilitarla.',
      },
      {
        q: '¿Cómo funcionan los Kudos?',
        a: 'Los Kudos son la moneda social de IronTrain. Al recibir Kudos en tu actividad o rutinas públicas, tu IronScore aumenta, desbloqueando mayor visibilidad en el ecosistema global.',
      }
    ]
  }
];

export default function FAQPage() {
  return (
    <div className="space-y-12">
      <header className="border-b-[4px] border-[#1a1a2e] pb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 border-[2px] border-[#1a1a2e] text-[10px] font-black uppercase tracking-[0.3em] mb-6">
          PROTOCOL_DOCUMENTATION_V2.4
        </div>
        <h1 className="text-5xl font-black uppercase tracking-tighter italic">PREGUNTAS_FRECUENTES</h1>
        <p className="mt-4 text-sm font-bold opacity-60 leading-relaxed uppercase italic">
          DIRECTIVAS OPERATIVAS Y MANUAL DE PROCEDIMIENTOS TÉCNICOS.
        </p>
      </header>

      <div className="space-y-16">
        {faqGroups.map((group) => (
          <section key={group.id} id={group.id} className="scroll-mt-24">
            <h2 className="text-xs font-black tracking-[0.5em] text-[#1a1a2e]/40 mb-8 border-l-4 border-[#1a1a2e] pl-4">
              // {group.title}
            </h2>
            <div className="grid gap-6">
              {group.items.map((item) => (
                <div
                  key={item.q}
                  className="border-[3px] border-[#1a1a2e] p-8 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,46,0.05)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
                >
                  <h3 className="text-xl font-black uppercase tracking-tight mb-4 group-hover:italic">{item.q}</h3>
                  <p className="text-sm font-medium opacity-70 leading-relaxed border-t border-[#1a1a2e]/10 pt-4">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="pt-10 border-t border-[#1a1a2e]/10">
        <div className="bg-[#1a1a2e] text-[#f5f1e8] p-10">
          <h4 className="text-xl font-black uppercase mb-4 italic">¿NECSITAS SOPORTE ADICIONAL?</h4>
          <p className="text-xs font-bold opacity-60 uppercase mb-8">Nuestros operados técnicos están listos para la transmisión.</p>
          <Link
            href="/help"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#f5f1e8] text-[#1a1a2e] text-[10px] font-black uppercase tracking-widest hover:invert transition-all"
          >
            SISTEMA_DE_TICKETS <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </footer>
    </div>
  );
}

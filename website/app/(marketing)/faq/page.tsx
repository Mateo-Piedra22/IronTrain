const faqs = [
  {
    q: '¿Dónde se guardan mis datos?',
    a: 'Todo se guarda localmente en tu dispositivo (SQLite). No dependes de un servidor para entrenar.',
  },
  {
    q: '¿Cómo hago backup y restore?',
    a: 'En Ajustes puedes exportar un backup JSON y restaurarlo. El restore soporta modo sobrescritura y maneja tablas legacy.',
  },
  {
    q: '¿Qué pasa si restauro un backup viejo?',
    a: 'El import intenta ser tolerante: ignora tablas no existentes y columnas no permitidas, y crea categorías “Importado” si faltan.',
  },
  {
    q: '¿Cómo actualizo sin Play Store?',
    a: 'Cuando hay una versión nueva, la app puede avisar “Actualización disponible” y enviarte a esta web para descargar el APK.',
  },
  {
    q: '¿Qué es el feed /releases.json?',
    a: 'Es un endpoint estable que usa la app para comprobar actualizaciones. Se mantiene automáticamente con GitHub Releases + Vercel.',
  },
  {
    q: '¿Qué significa “Próximamente / Unreleased”?',
    a: 'Son cambios ya planificados pero todavía no publicados como release estable. En la app y web se muestran separados.',
  },
  {
    q: '¿Las unidades (kg/lbs) están bien manejadas?',
    a: 'Sí: la app centraliza conversión y aplica coherencia en UI y cálculos. Puedes elegir unidad en Ajustes.',
  },
  {
    q: '¿Incluye inventario de discos (plate inventory)?',
    a: 'Sí: hay una herramienta dedicada y el inventario soporta unidades para evitar conflictos.',
  },
  {
    q: '¿Los timers son confiables?',
    a: 'Sí: rest timer sin drift y workout timer por delta real para mantener precisión.',
  },
  {
    q: '¿Cómo reporto un bug o pido una mejora?',
    a: 'Puedes escribirnos desde MotionA o apoyar el roadmap vía Cafecito. También podemos incorporar feedback al changelog.',
  },
];

export default function FAQPage() {
  return (
    <>
      <header className="border-b border-current/20 pb-6">
        <div className="text-[10px] opacity-40 tracking-[0.3em] mb-3">━━━ PREGUNTAS FRECUENTES ━━━</div>
        <h1 className="text-4xl font-bold tracking-tight">FAQ</h1>
        <p className="mt-2 opacity-70 leading-relaxed">
          Preguntas frecuentes oficiales. Si falta algo, lo añadimos aquí para que quede centralizado y mantenible.
        </p>
      </header>

      <div className="grid gap-4">
        {faqs.map((f) => (
          <section key={f.q} className="border border-current/20 p-6 bg-[#f5f1e8] hover:border-current/40 transition-colors">
            <h2 className="text-lg font-bold">{f.q}</h2>
            <p className="mt-2 opacity-80 leading-relaxed">{f.a}</p>
          </section>
        ))}
      </div>
    </>
  );
}

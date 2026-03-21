export default function PrivacyPage() {
  return (
    <div className="space-y-12">
      <header className="border-b-[4px] border-[#1a1a2e] pb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 border-[2px] border-[#1a1a2e] text-[10px] font-black uppercase tracking-[0.3em] mb-6 animate-pulse">
          DATA_INTEGRITY_SAFEGUARD
        </div>
        <h1 className="text-5xl font-black uppercase tracking-tighter italic">POLÍTICA_DE_PRIVACIDAD</h1>
        <p className="mt-4 text-sm font-bold opacity-60 leading-relaxed uppercase italic">
          PROTOCOLO DE TRATAMIENTO DE DATOS Y SEGURIDAD OPERATIVA.
        </p>
      </header>

      <div className="space-y-10">
        <section className="border-[3px] border-[#1a1a2e] p-8 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,46,0.05)]">
          <h2 className="text-xl font-black uppercase tracking-tight mb-4">01. RECOPILACIÓN_DE_DATOS</h2>
          <p className="text-sm font-medium opacity-70 leading-relaxed mb-4 italic uppercase">
            ESTADO: TRANSMISIÓN ACTIVA.
          </p>
          <div className="space-y-4 text-sm font-medium opacity-80 leading-relaxed">
            <p>
              IronTrain recopila datos de entrenamiento (ejercicios, series, repeticiones, peso) y datos biométricos para el cálculo de tu IronScore. Estos datos se almacenan localmente en tu dispositivo y se sincronizan con nuestra infraestructura (IronSync) para garantizar la persistencia entre sesiones.
            </p>
            <p>
              Recopilamos tu dirección de correo electrónico únicamente para fines de autenticación y soporte técnico. No compartimos esta información con terceros ajenos al protocolo operativo.
            </p>
          </div>
        </section>

        <section className="border-[3px] border-[#1a1a2e] p-8 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,46,0.05)]">
          <h2 className="text-xl font-black uppercase tracking-tight mb-4">02. USO_DE_LA_INFORMACIÓN</h2>
          <div className="space-y-4 text-sm font-medium opacity-80 leading-relaxed">
            <p>
              La información transmitida se utiliza para:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Sincronización de perfiles multi-dispositivo.</li>
              <li>Generación de métricas de rendimiento y IronScore.</li>
              <li>Publicación de rutinas en el Marketplace (solo si el usuario lo autoriza).</li>
              <li>Mejora continua de la telemetría del sistema mediante PostHog.</li>
            </ul>
          </div>
        </section>

        <section className="border-[3px] border-[#1a1a2e] p-8 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,46,0.05)]">
          <h2 className="text-xl font-black uppercase tracking-tight mb-4">03. SOBERANÍA_Y_DERECHOS</h2>
          <div className="space-y-4 text-sm font-medium opacity-80 leading-relaxed">
            <p>
              El usuario mantiene la soberanía absoluta sobre sus datos. En cualquier momento, puedes solicitar un volcado completo de tu información o realizar el procedimiento de <strong>ELIMINACIÓN_DE_CUENTA</strong> desde los Ajustes de la App, lo cual purgará de forma definitiva e irreversible toda la información asociada a tu identificador en nuestros servidores.
            </p>
          </div>
        </section>

        <section className="border border-[#1a1a2e]/10 p-6 bg-[#f5f1e8] italic">
          <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">
            ÚLTIMA_ACTUALIZACIÓN_SISTEMA: 2024.11.20 // FIRMADO_POR: MOTIONA_OPERATIONS
          </p>
        </section>
      </div>
    </div>
  );
}

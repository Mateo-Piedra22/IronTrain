export default function TermsPage() {
    return (
        <div className="space-y-12">
            <header className="border-b-[4px] border-[#1a1a2e] pb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 border-[2px] border-[#1a1a2e] text-[10px] font-black uppercase tracking-[0.3em] mb-6 animate-pulse">
                    OPERATIONAL_BINDING_AGREEMENT
                </div>
                <h1 className="text-5xl font-black uppercase tracking-tighter italic">TÉRMINOS_Y_CONDICIONES</h1>
                <p className="mt-4 text-sm font-bold opacity-60 leading-relaxed uppercase italic">
                    MARCO REGULATORIO PARA EL USO DE LA PLATAFORMA IRONTRAIN.
                </p>
            </header>

            <div className="space-y-10">
                <section className="border-[3px] border-[#1a1a2e] p-8 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,46,0.05)]">
                    <h2 className="text-xl font-black uppercase tracking-tight mb-4">01. ACEPTACIÓN_DEL_PROTOCOLO</h2>
                    <div className="space-y-4 text-sm font-medium opacity-80 leading-relaxed">
                        <p>
                            Al acceder a la aplicación móvil o plataforma web de IronTrain, el usuario acepta de forma vinculante los presentes términos. Todo entrenamiento ejecutado bajo este sistema está sujeto a las directivas operativas aquí expuestas.
                        </p>
                    </div>
                </section>

                <section className="border-[3px] border-[#1a1a2e] p-8 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,46,0.05)]">
                    <h2 className="text-xl font-black uppercase tracking-tight mb-4">02. RESPONSABILIDAD_OPERATIVA</h2>
                    <div className="space-y-4 text-sm font-medium opacity-80 leading-relaxed">
                        <p>
                            El usuario es responsable de la integridad de sus credenciales de acceso. IronTrain no se hace responsable de la pérdida de transmisiones de datos resultante de negligencia en la seguridad del dispositivo del usuario.
                        </p>
                        <p>
                            <strong>ADVERTENCIA_FISIOLÓGICA:</strong> El usuario reconoce que el entrenamiento de fuerza conlleva riesgos inherentes. IronTrain es una herramienta de registro y optimización, no un prescriptor médico. Consulte a un profesional antes de iniciar cualquier protocolo de alta intensidad.
                        </p>
                    </div>
                </section>

                <section className="border-[3px] border-[#1a1a2e] p-8 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,46,0.05)]">
                    <h2 className="text-xl font-black uppercase tracking-tight mb-4">03. PROPIEDAD_Y_CONTENIDO_COMPARTIDO</h2>
                    <div className="space-y-4 text-sm font-medium opacity-80 leading-relaxed">
                        <p>
                            Al publicar rutinas en el Marketplace de IronTrain, el usuario concede una licencia perpetua, global e irrevocable a IronTrain para alojar, distribuir y permitir que otros usuarios clonen y utilicen dicho contenido. El usuario declara que tiene los derechos absolutos sobre las rutinas compartidas.
                        </p>
                    </div>
                </section>

                <section className="border-[3px] border-[#1a1a2e] p-8 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,46,0.05)]">
                    <h2 className="text-xl font-black uppercase tracking-tight mb-4">04. MODALIDADES_DE_PAGO_Y_SUSCRIPCIÓN</h2>
                    <div className="space-y-4 text-sm font-medium opacity-80 leading-relaxed">
                        <p>
                            Ciertas funciones del protocolo pueden requerir pagos a través de procesadores de terceros (MercadoPago u otros). IronTrain no almacena datos de tarjetas directamente y se rige por las políticas de dichos procesadores para la resolución de disputas transaccionales.
                        </p>
                    </div>
                </section>

                <section className="border-[3px] border-[#1a1a2e] p-8 bg-white shadow-[8px_8px_0px_0px_rgba(26,26,46,0.05)]">
                    <h2 className="text-xl font-black uppercase tracking-tight mb-4">05. TERMINACIÓN_DE_PROTOCOLO</h2>
                    <div className="space-y-4 text-sm font-medium opacity-80 leading-relaxed">
                        <p>
                            IronTrain se reserva el derecho de suspender el acceso a la red de sincronización a cualquier usuario que viole las normas de comunidad, realice ingeniería inversa no autorizada o comprometa la estabilidad de la infraestructura compartida.
                        </p>
                    </div>
                </section>

                <section className="border border-[#1a1a2e]/10 p-6 bg-[#f5f1e8] italic">
                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">
                        VERSIÓN_2.4.0 // STABLE_AGREEMENT // COPYRIGHT_MOTIONA_2024
                    </p>
                </section>
            </div>
        </div>
    );
}

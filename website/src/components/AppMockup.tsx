export function AppMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 -z-10 rounded-[42px] bg-gradient-to-br from-iron-200/60 to-white blur-2xl" />
      <div className="anim-float rounded-[40px] border border-iron-200 bg-white p-4 shadow-sm">
        <div className="rounded-[32px] border border-iron-200 bg-iron-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-black text-iron-700">Daily Log</div>
              <div className="mt-1 text-lg font-black text-slate-900">Sesión de hoy</div>
            </div>
            <div className="rounded-2xl bg-iron-500 px-3 py-2 text-xs font-black text-white">En progreso</div>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-iron-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-slate-900">Bench Press</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs font-bold text-slate-600">
                    <span className="rounded-full bg-iron-50 px-3 py-1 border border-iron-200">4 series</span>
                    <span className="rounded-full bg-iron-50 px-3 py-1 border border-iron-200">Volumen alto</span>
                    <span className="rounded-full bg-iron-50 px-3 py-1 border border-iron-200">Mejor serie</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-slate-900">85kg</div>
                  <div className="text-xs font-bold text-slate-500">× 5 reps</div>
                </div>
              </div>
              <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-iron-100">
                <div className="h-full w-2/3 rounded-full bg-iron-500" />
              </div>
            </div>

            <div className="rounded-2xl border border-iron-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-black text-slate-900">Rest Timer</div>
                  <div className="text-xs font-bold text-slate-500">Sin drift · Delta real</div>
                </div>
                <div className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-black text-white">01:30</div>
              </div>
            </div>

            <div className="rounded-2xl border border-iron-200 bg-white p-4">
              <div className="text-sm font-black text-slate-900">Tendencia (30D)</div>
              <div className="mt-3 grid grid-cols-12 items-end gap-1">
                {[4, 7, 5, 8, 9, 6, 10, 12, 9, 14, 13, 16].map((h, i) => (
                  <div key={i} className="rounded-md bg-iron-200" style={{ height: `${h * 5}px` }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl border border-iron-200 bg-white px-4 py-3">
          <div className="text-xs font-black text-slate-700">IronTrain</div>
          <div className="text-xs font-bold text-slate-500">Backups · Plantillas · PRs</div>
        </div>
      </div>
    </div>
  );
}


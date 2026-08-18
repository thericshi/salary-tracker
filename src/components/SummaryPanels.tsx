import { ViewMode } from '../types';

interface SummaryPanelsProps {
  isWorking: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  todayDollarRef: React.RefObject<HTMLSpanElement>;
  todayCentRef: React.RefObject<HTMLSpanElement>;
  totalDollarRef: React.RefObject<HTMLSpanElement>;
  totalCentRef: React.RefObject<HTMLSpanElement>;
}

export function SummaryPanels({
  isWorking,
  viewMode,
  setViewMode,
  todayDollarRef,
  todayCentRef,
  totalDollarRef,
  totalCentRef,
}: SummaryPanelsProps) {
  return (
    <div className="grid gap-6 md:gap-8 md:grid-cols-2">
      <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl flex flex-col items-center justify-center shadow-2xl">
        <span className="text-slate-400 mb-2 font-medium tracking-wide uppercase text-sm">Earned Today</span>
        <div className={`font-mono tabular-nums tracking-tight font-semibold flex items-baseline justify-center ${isWorking ? 'text-emerald-400' : 'text-slate-200'}`}>
          <span ref={todayDollarRef} className="text-5xl">$0</span>
          <span className="text-3xl opacity-70 ml-0.5">.<span ref={todayCentRef}>00</span></span>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 p-6 pt-5 rounded-3xl flex flex-col items-center shadow-2xl relative">
        <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800 mb-6 w-full max-w-xs">
          {(['PERIOD', 'YTD', 'TOTAL'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                viewMode === mode ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {mode === 'TOTAL' ? 'Total' : mode === 'YTD' ? 'YTD' : 'Period'}
            </button>
          ))}
        </div>

        <span className="text-slate-400 mb-2 font-medium tracking-wide uppercase text-sm">
          {viewMode === 'TOTAL' ? 'Earned Total' : viewMode === 'YTD' ? 'Earned YTD' : 'Earned This Period'}
        </span>
        <div className={`font-mono tabular-nums tracking-tight font-semibold flex items-baseline justify-center ${isWorking ? 'text-emerald-400' : 'text-slate-200'}`}>
          <span ref={totalDollarRef} className="text-5xl">$0</span>
          <span className="text-3xl opacity-70 ml-0.5">.<span ref={totalCentRef}>00</span></span>
        </div>
      </div>
    </div>
  );
}
import { ViewMode } from '../types';

interface SummaryPanelsProps {
  isWorking: boolean;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  todayDollarRef: React.RefObject<HTMLSpanElement>;
  todayCentRef: React.RefObject<HTMLSpanElement>;
  totalDollarRef: React.RefObject<HTMLSpanElement>;
  totalCentRef: React.RefObject<HTMLSpanElement>;
  todayProgressBaseRef: React.RefObject<HTMLDivElement>;
  aggProgressBaseRef: React.RefObject<HTMLDivElement>;
  aggProgressNewRef: React.RefObject<HTMLDivElement>;
  aggCheckpointRef: React.RefObject<HTMLDivElement>;
}

export function SummaryPanels({
  isWorking,
  viewMode,
  setViewMode,
  todayDollarRef,
  todayCentRef,
  totalDollarRef,
  totalCentRef,
  todayProgressBaseRef,
  aggProgressBaseRef,
  aggProgressNewRef,
  aggCheckpointRef
}: SummaryPanelsProps) {
  return (
    <div className="grid gap-6 md:gap-8 md:grid-cols-2">
      
      {/* Earned Today Panel */}
      <div className="relative overflow-hidden bg-slate-900/50 border border-slate-800 p-8 rounded-3xl flex flex-col items-center justify-center shadow-2xl group">
        
        {/* Animated Background Fill (Green only for Today) */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div 
            ref={todayProgressBaseRef}
            className="absolute top-0 left-0 bottom-0 bg-emerald-500/10"
            style={{ width: '0%' }}
          >
            <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
          </div>
        </div>

        {/* Foreground Content */}
        <div className="relative z-10 flex flex-col items-center">
          <span className="text-slate-400 mb-2 font-medium tracking-wide uppercase text-sm group-hover:text-slate-300 transition-colors duration-300">
            Earned Today
          </span>
          <div className={`font-mono tabular-nums tracking-tight font-semibold flex items-baseline justify-center ${isWorking ? 'text-emerald-400' : 'text-slate-200'}`}>
            <span ref={todayDollarRef} className="text-5xl">$0</span>
            <span className="text-3xl opacity-70 ml-0.5">.<span ref={todayCentRef}>00</span></span>
          </div>
        </div>
      </div>

      {/* Aggregated Panel */}
      <div className="relative overflow-hidden bg-slate-900/50 border border-slate-800 p-6 pt-5 rounded-3xl flex flex-col items-center shadow-2xl group">
        
        {/* Split Animated Background Fill */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div 
            ref={aggProgressBaseRef}
            className="absolute top-0 left-0 bottom-0 bg-emerald-500/10"
            style={{ width: '0%' }}
          >
            <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
          </div>
          <div 
            ref={aggProgressNewRef}
            className="absolute top-0 bottom-0 bg-yellow-500/10"
            style={{ left: '0%', width: '0%' }}
          >
            <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-yellow-500/50 shadow-[0_0_12px_rgba(234,179,8,0.8)]" />
          </div>
        </div>

        {/* Checkpoint Line (Previous Period End) */}
        <div 
          ref={aggCheckpointRef}
          className="absolute top-0 bottom-0 w-[1px] border-l border-dashed border-slate-500 z-0 pointer-events-none"
          style={{ display: 'none', left: '0%' }}
        />

        {/* Foreground Content */}
        <div className="relative z-10 flex flex-col items-center w-full">
          <div className="flex bg-slate-950/80 backdrop-blur-sm rounded-lg p-1 border border-slate-800 mb-6 w-full max-w-xs relative z-20">
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

          <span className="text-slate-400 mb-2 font-medium tracking-wide uppercase text-sm group-hover:text-slate-300 transition-colors duration-300">
            {viewMode === 'TOTAL' ? 'Earned Total' : viewMode === 'YTD' ? 'Earned YTD' : 'Earned This Period'}
          </span>
          <div className={`font-mono tabular-nums tracking-tight font-semibold flex items-baseline justify-center ${isWorking ? 'text-emerald-400' : 'text-slate-200'}`}>
            <span ref={totalDollarRef} className="text-5xl">$0</span>
            <span className="text-3xl opacity-70 ml-0.5">.<span ref={totalCentRef}>00</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
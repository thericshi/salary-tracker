import { PieChart } from 'lucide-react';
import { UserConfig, ViewMode, StreamDisplayMode } from '../types';
import { formatMoney } from '../lib/calculator';

interface StreamBreakdownProps {
  config: UserConfig;
  streamRefs: React.MutableRefObject<{ [key: string]: any }>;
  viewMode: ViewMode;
  streamDisplayMode: StreamDisplayMode;
  setStreamDisplayMode: (mode: StreamDisplayMode) => void;
  isWorking: boolean;
}

export function StreamBreakdown({
  config,
  streamRefs,
  viewMode,
  streamDisplayMode,
  setStreamDisplayMode,
  isWorking
}: StreamBreakdownProps) {
  if (config.streams.length === 0) return null;

  return (
    <div className="md:col-span-2 bg-slate-900/50 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2 text-slate-400 font-medium tracking-wide uppercase text-sm">
          <PieChart size={18} />
          <span>Stream Breakdown</span>
        </div>
        
        <div className="flex bg-slate-950/80 rounded-lg p-1 border border-slate-800 w-full sm:w-auto">
          <button 
            onClick={() => setStreamDisplayMode('EARNED')} 
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${streamDisplayMode === 'EARNED' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Earned
          </button>
          <button 
            onClick={() => setStreamDisplayMode('REMAINING')} 
            className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${streamDisplayMode === 'REMAINING' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Remaining
          </button>
        </div>
      </div>

      <div className="w-full grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {config.streams.map(stream => {
          const streamAnnualGross = stream.months ? (stream.amount * 12) / stream.months : 0;
          return (
            <div key={stream.id} className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800 flex flex-col text-left">
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col">
                  <span className="font-medium text-slate-300 truncate w-full">{stream.name}</span>
                  <span className="text-xs text-slate-500">{formatMoney(streamAnnualGross, 0)} / yr</span>
                </div>
              </div>

              {/* Labeled Graph Area */}
              <div className="flex flex-col mt-2 mb-6">
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[10px] text-slate-500 font-mono tracking-tight" ref={(el) => { streamRefs.current[`${stream.id}-axis-y-max`] = el; }}>$0</span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20" ref={(el) => { streamRefs.current[`${stream.id}-graph-pct`] = el; }}>0.0000%</span>
                </div>

                <div className="relative w-full h-12 bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shadow-inner">
                  <svg preserveAspectRatio="none" viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-slate-700 opacity-20">
                    <path d="M0,100 L100,0 L100,100 Z" fill="currentColor" />
                    <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                  </svg>
                  <svg preserveAspectRatio="none" viewBox="0 0 100 100" className="absolute inset-0 w-full h-full text-emerald-500">
                    <defs>
                      <clipPath id={`clip-${stream.id}`}>
                        <rect ref={(el) => { streamRefs.current[`${stream.id}-graph-clip`] = el; }} x="0" y="0" width="0" height="100" />
                      </clipPath>
                    </defs>
                    <g clipPath={`url(#clip-${stream.id})`}>
                      <path d="M0,100 L100,0 L100,100 Z" fill="currentColor" fillOpacity="0.2" />
                      <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </g>
                  </svg>
                </div>

                <div className="flex justify-between items-center mt-1 text-[10px] text-slate-500 font-mono tracking-tight">
                  <div className="flex items-center gap-1.5">
                    <span>$0</span>
                    <span className="text-slate-700 font-sans">|</span>
                    <span ref={(el) => { streamRefs.current[`${stream.id}-axis-x-start`] = el; }}>Start</span>
                  </div>
                  <span ref={(el) => { streamRefs.current[`${stream.id}-axis-x-end`] = el; }}>End</span>
                </div>
              </div>
              
              {/* Lower Stats Area */}
              <div className="mt-auto w-full flex justify-between items-end gap-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                    {viewMode === 'TOTAL' ? 'Total' : viewMode === 'YTD' ? 'YTD' : 'Period'}
                  </span>
                  <div className={`font-mono tabular-nums tracking-tight font-semibold flex items-baseline ${isWorking ? 'text-emerald-400' : 'text-slate-200'}`}>
                    <span ref={(el) => { streamRefs.current[`${stream.id}-agg-dollar`] = el; }} className="text-2xl">$0</span>
                    <span className="text-lg opacity-70 ml-[1px]">.<span ref={(el) => { streamRefs.current[`${stream.id}-agg-cent`] = el; }}>00</span></span>
                  </div>
                </div>
                <div className="flex flex-col text-right pb-[2px]">
                  <div className="text-xs font-mono tabular-nums text-slate-400 flex items-baseline justify-end">
                    <span>Today:&nbsp;</span>
                    <span ref={(el) => { streamRefs.current[`${stream.id}-today-dollar`] = el; }}>$0</span>
                    <span className="text-[10px] opacity-80 ml-[1px]">.<span ref={(el) => { streamRefs.current[`${stream.id}-today-cent`] = el; }}>00</span></span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
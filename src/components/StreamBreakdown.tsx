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
            <div key={stream.id} className="group relative bg-slate-950/50 rounded-2xl border border-slate-800 flex flex-col text-left overflow-hidden cursor-default transition-colors duration-500 hover:border-slate-700 hover:bg-slate-900/80 shadow-lg">
              
              {/* Card Progress Background (Fades out on hover) */}
              <div 
                ref={(el) => { streamRefs.current[`${stream.id}-card-progress`] = el; }}
                className="absolute top-0 left-0 bottom-0 bg-emerald-500/10 group-hover:opacity-0 transition-opacity duration-500 z-0 pointer-events-none"
                style={{ width: '0%' }}
              >
                <div className="absolute top-0 right-0 bottom-0 w-[1px] bg-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
              </div>

              {/* Content Layer */}
              <div className="relative z-10 p-5 flex flex-col h-full">
                
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-300 truncate w-full group-hover:text-white transition-colors">{stream.name}</span>
                    <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors">{formatMoney(streamAnnualGross, 0)} / yr</span>
                  </div>
                </div>

                {/* Interactive Detailed Progress Bar Area (Expands on hover) */}
                <div className="transition-all duration-500 ease-out overflow-hidden max-h-0 opacity-0 group-hover:max-h-[120px] group-hover:opacity-100">
                  <div className="relative w-full h-16 mt-4 mb-2 flex flex-col justify-center">
                    
                    {/* Top Stats */}
                    <div className="absolute top-0 left-0 right-0 flex justify-between items-start pointer-events-none">
                      <span className="text-[10px] text-slate-500 font-mono tracking-tight" ref={(el) => { streamRefs.current[`${stream.id}-axis-y-max`] = el; }}>$0</span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)]" ref={(el) => { streamRefs.current[`${stream.id}-graph-pct`] = el; }}>0.0000%</span>
                    </div>

                    {/* The Glossy Progress Bar */}
                    <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800/80 shadow-[inset_0_3px_8px_rgba(0,0,0,0.6)]">
                      <div 
                        ref={(el) => { streamRefs.current[`${stream.id}-progress-bar`] = el; }}
                        className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-400"
                        style={{ width: '0%' }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-70 pointer-events-none" />
                        <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-white/30 pointer-events-none" />
                      </div>
                    </div>

                    {/* Bottom Stats */}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between items-end text-[10px] text-slate-500 font-mono tracking-tight pointer-events-none">
                      <span ref={(el) => { streamRefs.current[`${stream.id}-axis-x-start`] = el; }}>Start</span>
                      <span ref={(el) => { streamRefs.current[`${stream.id}-axis-x-end`] = el; }}>End</span>
                    </div>

                  </div>
                </div>

                {/* Lower Dollar Breakdowns */}
                <div className="mt-auto w-full flex justify-between items-end gap-2 pt-3 border-t border-transparent group-hover:border-slate-800/50 transition-colors duration-500">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
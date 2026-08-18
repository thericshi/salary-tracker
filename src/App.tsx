import { useState } from 'react';
import { Settings, Beaker } from 'lucide-react';
import { UserConfig } from './types';
import defaultConfigFile from './config.json';
import { formatMoney } from './lib/calculator';
import { useSalaryEngine } from './hooks/useSalaryEngine';

// Components
import { SummaryPanels } from './components/SummaryPanels';
import { StreamBreakdown } from './components/StreamBreakdown';
import { SettingsModal } from './components/SettingsModal';

const DEFAULT_CONFIG: UserConfig = defaultConfigFile as UserConfig;

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const [config, setConfig] = useState<UserConfig>(() => {
    const saved = localStorage.getItem('salaryConfig');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    
    // Core polyfills mapping over to new schemas
    if (!parsed.payPeriod) parsed.payPeriod = { type: 'BIWEEKLY', anchorDate: '2026-01-01' };
    if (!parsed.testing) parsed.testing = { useFakeTime: false, fakeTime: '' };
    if (!parsed.taxProvince) parsed.taxProvince = 'BC';
    if (parsed.highPrecision === undefined) parsed.highPrecision = false;
    
    delete (parsed as any).useCustomTaxRate;
    delete (parsed as any).customTaxRate;
    
    if ((parsed as any).startDate) {
      parsed.streams = parsed.streams.map((s: any) => ({ ...s, startDate: s.startDate || (parsed as any).startDate }));
      delete (parsed as any).startDate;
    } else {
      parsed.streams = parsed.streams.map((s: any) => ({ ...s, startDate: s.startDate || new Date().toISOString().split('T')[0] }));
    }

    return parsed;
  });

  const {
    annualTotalDisplay,
    isWorking,
    simulatedTimeDisplay,
    viewMode,
    setViewMode,
    taxMode,
    setTaxMode,
    streamDisplayMode,
    setStreamDisplayMode,
    todayDollarRef,
    todayCentRef,
    totalDollarRef,
    totalCentRef,
    streamRefs
  } = useSalaryEngine(config);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <button 
        onClick={() => setIsSettingsOpen(true)}
        className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors z-10"
      >
        <Settings size={24} />
      </button>

      <main className="w-full max-w-4xl text-center space-y-12">
        <div className="space-y-4">
          <div className="flex flex-wrap justify-center gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-sm text-slate-400 font-medium shadow-sm">
              <div className={`w-2 h-2 rounded-full ${isWorking ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
              {isWorking ? 'Active Earnings' : 'Off Hours'}
            </div>
            
            <div className="inline-flex items-center p-0.5 rounded-full bg-slate-900 border border-slate-800 text-sm font-medium shadow-sm">
              <button onClick={() => setTaxMode('GROSS')} className={`px-3 py-0.5 rounded-full transition-colors ${taxMode === 'GROSS' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}>Gross</button>
              <button onClick={() => setTaxMode('ACTUAL')} className={`px-3 py-0.5 rounded-full transition-colors ${taxMode === 'ACTUAL' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-300'}`}>Actual</button>
            </div>

            {config.testing?.useFakeTime && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-sm text-amber-500 font-medium shadow-sm">
                <Beaker size={14} />
                Simulated Time: {simulatedTimeDisplay}
              </div>
            )}
          </div>

          <h1 className="text-4xl md:text-5xl font-light text-slate-300">
            Total Compensation Tracker
          </h1>
          <p className="text-xl text-slate-500">
            {formatMoney(annualTotalDisplay, 0)} / year {taxMode === 'ACTUAL' ? 'actual ' : 'base '}equivalent
          </p>
        </div>

        <SummaryPanels 
          isWorking={isWorking}
          viewMode={viewMode}
          setViewMode={setViewMode}
          todayDollarRef={todayDollarRef}
          todayCentRef={todayCentRef}
          totalDollarRef={totalDollarRef}
          totalCentRef={totalCentRef}
        />

        <StreamBreakdown 
          config={config}
          streamRefs={streamRefs}
          viewMode={viewMode}
          streamDisplayMode={streamDisplayMode}
          setStreamDisplayMode={setStreamDisplayMode}
          isWorking={isWorking}
        />
      </main>

      {isSettingsOpen && (
        <SettingsModal 
          config={config} 
          setConfig={setConfig} 
          onClose={() => setIsSettingsOpen(false)} 
          defaultConfig={DEFAULT_CONFIG}
        />
      )}
    </div>
  );
}
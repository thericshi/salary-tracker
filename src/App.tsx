import { useState, useEffect, useRef } from 'react';
import { Settings, X, Plus, Trash2, Clock, CalendarDays, DollarSign, Download, Upload, Copy, FileJson, Database, Briefcase, PieChart, Beaker, Landmark, Monitor } from 'lucide-react';
import { UserConfig, PayPeriodType } from './types';
import { calculateAnnualSalary, formatMoney, formatMoneyParts, getDailyWorkingMilliseconds, parseTime, getWorkingMsBetween, getCurrentPayPeriodStart, getCurrentPayPeriodEnd, calculateNetIncome } from './lib/calculator';
import defaultConfigFile from './config.json';

const DEFAULT_CONFIG: UserConfig = defaultConfigFile as UserConfig;

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

type ViewMode = 'TOTAL' | 'YTD' | 'PERIOD';
type TaxMode = 'GROSS' | 'ACTUAL';
type StreamDisplayMode = 'EARNED' | 'REMAINING';

export default function App() {
  const [config, setConfig] = useState<UserConfig>(() => {
    const saved = localStorage.getItem('salaryConfig');
    const parsed = saved ? JSON.parse(saved) : DEFAULT_CONFIG;
    
    // Polyfills for older config schemas
    if (!parsed.payPeriod) parsed.payPeriod = { type: 'BIWEEKLY', anchorDate: '2026-01-01' };
    if (!parsed.testing) parsed.testing = { useFakeTime: false, fakeTime: '' };
    if (!parsed.taxProvince) parsed.taxProvince = 'BC';
    if (parsed.highPrecision === undefined) parsed.highPrecision = false;
    
    // Remove old properties if they exist
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

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [annualTotalDisplay, setAnnualTotalDisplay] = useState(0);
  const [isWorking, setIsWorking] = useState(false);
  const [simulatedTimeDisplay, setSimulatedTimeDisplay] = useState('');
  
  const [viewMode, setViewMode] = useState<ViewMode>('PERIOD');
  const [taxMode, setTaxMode] = useState<TaxMode>('GROSS');
  const [streamDisplayMode, setStreamDisplayMode] = useState<StreamDisplayMode>('EARNED');

  // Track modes in refs to avoid restarting the 60FPS loop on UI clicks
  const viewModeRef = useRef<ViewMode>(viewMode);
  const taxModeRef = useRef<TaxMode>(taxMode);
  const streamDisplayModeRef = useRef<StreamDisplayMode>(streamDisplayMode);
  
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { taxModeRef.current = taxMode; }, [taxMode]);
  useEffect(() => { streamDisplayModeRef.current = streamDisplayMode; }, [streamDisplayMode]);

  const todayDollarRef = useRef<HTMLSpanElement>(null);
  const todayCentRef = useRef<HTMLSpanElement>(null);
  const totalDollarRef = useRef<HTMLSpanElement>(null);
  const totalCentRef = useRef<HTMLSpanElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRefs = useRef<{ [key: string]: HTMLSpanElement | null }>({});

  useEffect(() => {
    localStorage.setItem('salaryConfig', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    let animationFrameId: number;

    const dailyMs = getDailyWorkingMilliseconds(config.schedule);
    const annualSalaryGross = calculateAnnualSalary(config.streams);
    const annualMs = dailyMs * config.schedule.days.length * 52;

    const tickStartReal = Date.now();
    const useFakeTime = config.testing?.useFakeTime && config.testing?.fakeTime;
    const fakeStartMs = useFakeTime ? new Date(config.testing!.fakeTime).getTime() : tickStartReal;

    const getNow = () => useFakeTime ? new Date(fakeStartMs + (Date.now() - tickStartReal)) : new Date();
    const nowRef = getNow();
    const startOfToday = new Date(nowRef.getFullYear(), nowRef.getMonth(), nowRef.getDate());
    const startOfYear = new Date(nowRef.getFullYear(), 0, 1);
    const endOfYear = new Date(nowRef.getFullYear() + 1, 0, 1);
    
    let periodStart = getCurrentPayPeriodStart(nowRef, config.payPeriod.type, config.payPeriod.anchorDate);
    let periodEnd = getCurrentPayPeriodEnd(periodStart, config.payPeriod.type);

    const msTotalInYear = getWorkingMsBetween(startOfYear, endOfYear, config.schedule, dailyMs);
    const msTotalInPeriod = getWorkingMsBetween(periodStart, periodEnd, config.schedule, dailyMs);

    // Pre-calculate elapsed historical time per stream
    const streamData = config.streams.map(stream => {
      const streamAnnualGross = stream.months ? (stream.amount * 12) / stream.months : 0;
      const streamRateGross = annualMs > 0 ? streamAnnualGross / annualMs : 0;
      
      let parsedStartDate = startOfToday;
      if (stream.startDate) {
        const [year, month, day] = stream.startDate.split('-').map(Number);
        parsedStartDate = new Date(year, month - 1, day);
      }
      
      const isStartedToday = startOfToday >= parsedStartDate;
      const historicalStart = parsedStartDate;
      
      let ytdStart = new Date(startOfYear);
      if (parsedStartDate > ytdStart) ytdStart = parsedStartDate;

      let pStart = new Date(periodStart);
      if (parsedStartDate > pStart) pStart = parsedStartDate;

      return {
        id: stream.id,
        amount: stream.amount,
        streamRateGross,
        streamAnnualGross,
        isStartedToday,
        msHistorical: getWorkingMsBetween(historicalStart, startOfToday, config.schedule, dailyMs),
        msYtd: getWorkingMsBetween(ytdStart, startOfToday, config.schedule, dailyMs),
        msPeriod: getWorkingMsBetween(pStart, startOfToday, config.schedule, dailyMs),
        maxGrossPeriod: msTotalInPeriod * streamRateGross,
        maxGrossYtd: msTotalInYear * streamRateGross,
      };
    });

    const numDecimals = config.highPrecision ? 4 : 2;

    const tick = () => {
      const now = getNow();
      let msWorkedToday = 0;
      let isWorkingNow = false;
      const todayIsWorkDay = config.schedule.days.includes(now.getDay()) && dailyMs > 0;

      if (todayIsWorkDay) {
        const startTime = new Date(now);
        const s = parseTime(config.schedule.startTime);
        startTime.setHours(s.h, s.m, 0, 0);

        const endTime = new Date(now);
        const e = parseTime(config.schedule.endTime);
        endTime.setHours(e.h, e.m, 0, 0);

        if (now > endTime) {
          msWorkedToday = dailyMs;
        } else if (now >= startTime && now <= endTime) {
          msWorkedToday = now.getTime() - startTime.getTime();
          isWorkingNow = true;
        }
      }

      let totalGrossToday = 0;
      let totalGrossPeriod = 0;
      let totalGrossYtd = 0;
      let totalGrossTotal = 0;

      // Calculate Running Gross Totals
      streamData.forEach((sData) => {
        const streamGrossToday = sData.isStartedToday ? (msWorkedToday * sData.streamRateGross) : 0;
        totalGrossToday += streamGrossToday;
        totalGrossPeriod += (sData.msPeriod * sData.streamRateGross) + streamGrossToday;
        totalGrossYtd += (sData.msYtd * sData.streamRateGross) + streamGrossToday;
        totalGrossTotal += (sData.msHistorical * sData.streamRateGross) + streamGrossToday;
      });

      // Calculate Exact Marginal Net (Actual)
      const totalNetYtd = calculateNetIncome(totalGrossYtd, config.taxProvince);
      
      const netAtStartOfDay = calculateNetIncome(totalGrossYtd - totalGrossToday, config.taxProvince);
      const exactNetToday = totalNetYtd - netAtStartOfDay;
      
      const netAtStartOfPeriod = calculateNetIncome(totalGrossYtd - totalGrossPeriod, config.taxProvince);
      const exactNetPeriod = totalNetYtd - netAtStartOfPeriod;
      
      const effectiveYtdRate = totalGrossYtd > 0 ? (totalNetYtd / totalGrossYtd) : 1;
      const exactNetTotal = totalGrossTotal * effectiveYtdRate; // Historical total uses blended current YTD rate

      // Main UI Panel Totals
      const isActual = taxModeRef.current === 'ACTUAL';
      
      const displayTotalToday = isActual ? exactNetToday : totalGrossToday;
      
      let displayTotalAgg = 0;
      if (viewModeRef.current === 'TOTAL') displayTotalAgg = isActual ? exactNetTotal : totalGrossTotal;
      else if (viewModeRef.current === 'YTD') displayTotalAgg = isActual ? totalNetYtd : totalGrossYtd;
      else if (viewModeRef.current === 'PERIOD') displayTotalAgg = isActual ? exactNetPeriod : totalGrossPeriod;

      // Update Main DOM
      const { dollars: tDol, cents: tCent } = formatMoneyParts(displayTotalToday, numDecimals);
      if (todayDollarRef.current) todayDollarRef.current.innerText = tDol;
      if (todayCentRef.current) todayCentRef.current.innerText = tCent;

      const { dollars: totDol, cents: totCent } = formatMoneyParts(displayTotalAgg, numDecimals);
      if (totalDollarRef.current) totalDollarRef.current.innerText = totDol;
      if (totalCentRef.current) totalCentRef.current.innerText = totCent;
      
      // Update Stream Widgets
      // To ensure individual streams strictly equal the exact marginal net, we apply 
      // the proportional weight of the stream for that period to the exact total net.
      const ratioToday = totalGrossToday > 0 ? (exactNetToday / totalGrossToday) : 1;
      const ratioPeriod = totalGrossPeriod > 0 ? (exactNetPeriod / totalGrossPeriod) : 1;
      
      streamData.forEach(sData => {
        const streamGrossToday = sData.isStartedToday ? (msWorkedToday * sData.streamRateGross) : 0;
        let streamGrossAgg = 0;
        let maxGrossAgg = 0;
        let ratioAgg = 1;

        if (viewModeRef.current === 'TOTAL') {
          streamGrossAgg = (sData.msHistorical * sData.streamRateGross) + streamGrossToday;
          maxGrossAgg = sData.amount; // Total grant amount
          ratioAgg = effectiveYtdRate;
        } else if (viewModeRef.current === 'YTD') {
          streamGrossAgg = (sData.msYtd * sData.streamRateGross) + streamGrossToday;
          maxGrossAgg = sData.maxGrossYtd;
          ratioAgg = effectiveYtdRate;
        } else if (viewModeRef.current === 'PERIOD') {
          streamGrossAgg = (sData.msPeriod * sData.streamRateGross) + streamGrossToday;
          maxGrossAgg = sData.maxGrossPeriod;
          ratioAgg = ratioPeriod;
        }

        let displayStreamAggGross = 0;
        let displayStreamTodayGross = 0;

        if (streamDisplayModeRef.current === 'EARNED') {
          displayStreamAggGross = streamGrossAgg;
          displayStreamTodayGross = streamGrossToday;
        } else {
          // REMAINING logic
          displayStreamAggGross = Math.max(0, maxGrossAgg - streamGrossAgg);
          const maxGrossToday = sData.isStartedToday && todayIsWorkDay ? (dailyMs * sData.streamRateGross) : 0;
          displayStreamTodayGross = Math.max(0, maxGrossToday - streamGrossToday);
        }

        const finalStreamAgg = isActual ? displayStreamAggGross * ratioAgg : displayStreamAggGross;
        const finalStreamToday = isActual ? displayStreamTodayGross * ratioToday : displayStreamTodayGross;

        // Update DOM per stream
        const { dollars: aggDol, cents: aggCent } = formatMoneyParts(finalStreamAgg, numDecimals);
        const refAggDol = streamRefs.current[`${sData.id}-agg-dollar`];
        const refAggCent = streamRefs.current[`${sData.id}-agg-cent`];
        if (refAggDol) refAggDol.innerText = aggDol;
        if (refAggCent) refAggCent.innerText = aggCent;
        
        const { dollars: todDol, cents: todCent } = formatMoneyParts(finalStreamToday, numDecimals);
        const refTodDol = streamRefs.current[`${sData.id}-today-dollar`];
        const refTodCent = streamRefs.current[`${sData.id}-today-cent`];
        if (refTodDol) refTodDol.innerText = todDol;
        if (refTodCent) refTodCent.innerText = todCent;
      });

      const displayAnnualSalary = isActual ? calculateNetIncome(annualSalaryGross, config.taxProvince) : annualSalaryGross;
      setAnnualTotalDisplay(prev => prev !== displayAnnualSalary ? displayAnnualSalary : prev);
      setIsWorking(prev => prev !== isWorkingNow ? isWorkingNow : prev);
      
      if (useFakeTime) {
        setSimulatedTimeDisplay(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [config]);

  const addStream = () => setConfig({ 
    ...config, 
    streams: [...config.streams, { 
      id: Date.now().toString(), 
      name: 'New Stream', 
      amount: 0, 
      months: 12, 
      startDate: new Date().toISOString().split('T')[0] 
    }] 
  });
  
  const updateStream = (id: string, field: string, value: string | number) => setConfig({ ...config, streams: config.streams.map(s => s.id === id ? { ...s, [field]: value } : s) });
  const removeStream = (id: string) => setConfig({ ...config, streams: config.streams.filter(s => s.id !== id) });

  const toggleDay = (dayValue: number) => {
    const newDays = config.schedule.days.includes(dayValue) ? config.schedule.days.filter(d => d !== dayValue) : [...config.schedule.days, dayValue].sort();
    setConfig({ ...config, schedule: { ...config.schedule, days: newDays } });
  };

  const downloadJsonFile = (data: any, filename: string) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedConfig = JSON.parse(event.target?.result as string);
        if (importedConfig?.streams && importedConfig?.schedule) {
          setConfig(importedConfig);
          alert("Configuration imported successfully!");
        } else alert("Invalid configuration file format.");
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

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
            
            {/* Gross / Actual Pill Toggle */}
            <div className="inline-flex items-center p-0.5 rounded-full bg-slate-900 border border-slate-800 text-sm font-medium shadow-sm">
              <button
                onClick={() => setTaxMode('GROSS')}
                className={`px-3 py-0.5 rounded-full transition-colors ${taxMode === 'GROSS' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}
              >
                Gross
              </button>
              <button
                onClick={() => setTaxMode('ACTUAL')}
                className={`px-3 py-0.5 rounded-full transition-colors ${taxMode === 'ACTUAL' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-slate-300'}`}
              >
                Actual
              </button>
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

        <div className="grid gap-6 md:gap-8 md:grid-cols-2">
          {/* Earned Today Panel */}
          <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-3xl flex flex-col items-center justify-center shadow-2xl">
            <span className="text-slate-400 mb-2 font-medium tracking-wide uppercase text-sm">Earned Today</span>
            <div className={`font-mono tabular-nums tracking-tight font-semibold flex items-baseline justify-center ${isWorking ? 'text-emerald-400' : 'text-slate-200'}`}>
              <span ref={todayDollarRef} className="text-5xl">$0</span>
              <span className="text-3xl opacity-70 ml-0.5">.<span ref={todayCentRef}>00</span></span>
            </div>
          </div>

          {/* Aggregated Panel with Toggle Switch */}
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

          {/* Income Stream Breakdown Widget */}
          {config.streams.length > 0 && (
            <div className="md:col-span-2 bg-slate-900/50 border border-slate-800 p-6 md:p-8 rounded-3xl shadow-2xl flex flex-col">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2 text-slate-400 font-medium tracking-wide uppercase text-sm">
                  <PieChart size={18} />
                  <span>Stream Breakdown</span>
                </div>
                
                {/* Earned vs Remaining Toggle */}
                <div className="flex bg-slate-950/80 rounded-lg p-1 border border-slate-800 w-full sm:w-auto">
                  <button onClick={() => setStreamDisplayMode('EARNED')} className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${streamDisplayMode === 'EARNED' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                    Earned
                  </button>
                  <button onClick={() => setStreamDisplayMode('REMAINING')} className={`flex-1 sm:flex-none px-4 py-1.5 text-xs font-semibold rounded-md transition-all ${streamDisplayMode === 'REMAINING' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>
                    Remaining
                  </button>
                </div>
              </div>

              <div className="w-full grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {config.streams.map(stream => {
                  const streamAnnualGross = stream.months ? (stream.amount * 12) / stream.months : 0;

                  return (
                    <div key={stream.id} className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800 flex flex-col text-left">
                      <span className="font-medium text-slate-300 truncate w-full">{stream.name}</span>
                      <span className="text-xs text-slate-500 mb-6">
                        {formatMoney(streamAnnualGross, 0)} / yr
                      </span>
                      
                      <div className="mt-auto w-full flex justify-between items-end gap-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">
                            {viewMode === 'TOTAL' ? 'Total' : viewMode === 'YTD' ? 'YTD' : 'Period'}
                          </span>
                          <div className={`font-mono tabular-nums tracking-tight font-semibold flex items-baseline ${isWorking ? 'text-emerald-400' : 'text-slate-200'}`}>
                            <span ref={el => { streamRefs.current[`${stream.id}-agg-dollar`] = el; }} className="text-2xl">$0</span>
                            <span className="text-lg opacity-70 ml-[1px]">.<span ref={el => { streamRefs.current[`${stream.id}-agg-cent`] = el; }}>00</span></span>
                          </div>
                        </div>
                        <div className="flex flex-col text-right pb-[2px]">
                          <div className="text-xs font-mono tabular-nums text-slate-400 flex items-baseline justify-end">
                            <span>Today:&nbsp;</span>
                            <span ref={el => { streamRefs.current[`${stream.id}-today-dollar`] = el; }}>$0</span>
                            <span className="text-[10px] opacity-80 ml-[1px]">.<span ref={el => { streamRefs.current[`${stream.id}-today-cent`] = el; }}>00</span></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Settings Overlay */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Settings className="text-slate-400" /> Configuration
              </h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-8">
              {/* Income Streams */}
              <section className="space-y-4">
                <h3 className="text-lg font-medium text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-2">
                  <DollarSign size={18} /> Income Streams
                </h3>
                {config.streams.map(stream => (
                  <div key={stream.id} className="grid grid-cols-12 gap-3 items-center bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                    <input type="text" value={stream.name} onChange={(e) => updateStream(stream.id, 'name', e.target.value)} className="col-span-12 md:col-span-4 bg-slate-800 text-white px-3 py-2 rounded-lg outline-none" placeholder="Name" />
                    <div className="col-span-6 md:col-span-3 relative">
                      <span className="absolute left-3 top-2.5 text-slate-400">$</span>
                      <input type="number" value={stream.amount || ''} onChange={(e) => updateStream(stream.id, 'amount', Number(e.target.value))} className="w-full bg-slate-800 text-white pl-7 pr-3 py-2 rounded-lg outline-none" placeholder="Amount" />
                    </div>
                    <input type="date" value={stream.startDate || ''} onChange={(e) => updateStream(stream.id, 'startDate', e.target.value)} className="col-span-6 md:col-span-3 bg-slate-800 text-white px-3 py-2 rounded-lg outline-none text-sm" />
                    <div className="col-span-9 md:col-span-1 flex items-center gap-1 justify-center">
                      <input type="number" value={stream.months || ''} onChange={(e) => updateStream(stream.id, 'months', Number(e.target.value))} className="w-12 bg-slate-800 text-white px-1 py-2 rounded-lg outline-none text-center" placeholder="Mo." title="Months" />
                    </div>
                    <button onClick={() => removeStream(stream.id)} className="col-span-3 md:col-span-1 flex justify-center text-rose-500 hover:bg-rose-500/10 p-2 rounded-lg">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
                <button onClick={addStream} className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 font-medium px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors">
                  <Plus size={16} /> Add Income Component
                </button>
              </section>

              {/* Schedule */}
              <section className="space-y-4">
                <h3 className="text-lg font-medium text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Clock size={18} /> Work Schedule
                </h3>
                <div className="space-y-6 bg-slate-950/50 p-5 rounded-xl border border-slate-800">
                  <div className="space-y-3">
                    <label className="text-sm text-slate-400 flex items-center gap-2">
                      <CalendarDays size={16} /> Work Days
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map(day => (
                        <button key={day.value} onClick={() => toggleDay(day.value)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${config.schedule.days.includes(day.value) ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">Start Time</label>
                      <input type="time" value={config.schedule.startTime} onChange={(e) => setConfig({ ...config, schedule: { ...config.schedule, startTime: e.target.value } })} className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">End Time</label>
                      <input type="time" value={config.schedule.endTime} onChange={(e) => setConfig({ ...config, schedule: { ...config.schedule, endTime: e.target.value } })} className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg outline-none" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Pay Periods */}
              <section className="space-y-4">
                <h3 className="text-lg font-medium text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Briefcase size={18} /> Pay Periods
                </h3>
                <div className="bg-slate-950/50 p-5 rounded-xl border border-slate-800 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">Pay Period Frequency</label>
                      <select value={config.payPeriod.type} onChange={(e) => setConfig({ ...config, payPeriod: { ...config.payPeriod, type: e.target.value as PayPeriodType } })} className="w-full bg-slate-800 text-white px-3 py-2.5 rounded-lg outline-none appearance-none">
                        <option value="WEEKLY">Weekly</option>
                        <option value="BIWEEKLY">Bi-weekly</option>
                        <option value="SEMIMONTHLY">Semi-monthly (1st & 16th)</option>
                        <option value="MONTHLY">Monthly</option>
                      </select>
                    </div>
                    {(config.payPeriod.type === 'BIWEEKLY' || config.payPeriod.type === 'WEEKLY') && (
                      <div className="space-y-2">
                        <label className="text-sm text-slate-400">Reference Anchor Date</label>
                        <input type="date" value={config.payPeriod.anchorDate || ''} onChange={(e) => setConfig({ ...config, payPeriod: { ...config.payPeriod, anchorDate: e.target.value } })} className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg outline-none" />
                        <p className="text-xs text-slate-500 mt-1">Pick the start date of any known past pay cycle.</p>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Tax & Display Settings */}
              <section className="space-y-4">
                <h3 className="text-lg font-medium text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Landmark size={18} /> Tax & Display Settings
                </h3>
                <div className="bg-slate-950/50 p-5 rounded-xl border border-slate-800 space-y-6">
                  
                  <div className="space-y-4">
                    <div className="space-y-2 border-l-2 border-slate-700 pl-4">
                      <label className="text-sm text-slate-400">Tax Province</label>
                      <select value={config.taxProvince} onChange={(e) => setConfig({ ...config, taxProvince: e.target.value })} className="w-full bg-slate-800 text-white px-3 py-2.5 rounded-lg outline-none appearance-none max-w-xs">
                        <option value="BC">British Columbia</option>
                        <option value="AB">Alberta</option>
                        <option value="ON">Ontario</option>
                        <option value="QC">Quebec</option>
                      </select>
                      <p className="text-xs text-slate-500 mt-1">Used to auto-calculate exact progressive brackets, BPA, CPP, and EI.</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/50">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input type="checkbox" className="sr-only" checked={config.highPrecision} onChange={(e) => setConfig({ ...config, highPrecision: e.target.checked })} />
                        <div className={`block w-10 h-6 rounded-full transition-colors ${config.highPrecision ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${config.highPrecision ? 'translate-x-4' : ''}`}></div>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Monitor size={16} className="text-slate-500" />
                        High Precision Numbers (4 Decimals)
                      </div>
                    </label>
                  </div>
                </div>
              </section>

              {/* Developer / Testing Settings */}
              <section className="space-y-4">
                <h3 className="text-lg font-medium text-amber-500 flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Beaker size={18} /> Testing & Time Travel
                </h3>
                <div className="bg-slate-950/50 p-5 rounded-xl border border-amber-500/20 space-y-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input type="checkbox" className="sr-only" checked={config.testing?.useFakeTime || false} onChange={(e) => setConfig({ ...config, testing: { ...config.testing!, useFakeTime: e.target.checked } })} />
                      <div className={`block w-10 h-6 rounded-full transition-colors ${config.testing?.useFakeTime ? 'bg-amber-500' : 'bg-slate-700'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${config.testing?.useFakeTime ? 'translate-x-4' : ''}`}></div>
                    </div>
                    <span className="text-sm text-slate-300">Enable Simulated Time</span>
                  </label>
                  
                  {config.testing?.useFakeTime && (
                    <div className="space-y-2 pt-2">
                      <label className="text-sm text-slate-400">Mock Current Date & Time</label>
                      <input type="datetime-local" value={config.testing?.fakeTime || ''} onChange={(e) => setConfig({ ...config, testing: { ...config.testing!, fakeTime: e.target.value } })} className="w-full bg-slate-800 text-white px-3 py-2 rounded-lg outline-none border border-amber-500/30 focus:border-amber-500" />
                    </div>
                  )}
                </div>
              </section>

              {/* Backups */}
              <section className="space-y-4">
                <h3 className="text-lg font-medium text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Database size={18} /> Data Backup
                </h3>
                <div className="bg-slate-950/50 p-5 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button onClick={() => downloadJsonFile(config, "my-salary-config.json")} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm"><Download size={16} /> Export Config</button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm"><Upload size={16} /> Import Config</button>
                  <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                  <button onClick={async () => { await navigator.clipboard.writeText(btoa(JSON.stringify(config))); alert("Copied to clipboard!"); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm"><Copy size={16} /> Copy Base64</button>
                  <button onClick={() => downloadJsonFile(DEFAULT_CONFIG, "template-config.json")} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm"><FileJson size={16} /> Get Template</button>
                </div>
              </section>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
              <button onClick={() => setIsSettingsOpen(false)} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium rounded-lg">
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
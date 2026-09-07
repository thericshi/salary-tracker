import { useState, useEffect, useRef } from 'react';
import { UserConfig, ViewMode, TaxMode, StreamDisplayMode } from '../types';
import { calculateAnnualSalary, formatMoneyParts, getDailyWorkingMilliseconds, parseTime, getWorkingMsBetween, getCurrentPayPeriodStart, getCurrentPayPeriodEnd, calculateNetIncome } from '../lib/calculator';

export function useSalaryEngine(config: UserConfig) {
  const [baseEquivalents, setBaseEquivalents] = useState<{ amount: number, label: string }[]>([{ amount: 0, label: 'year' }]);
  const [isWorking, setIsWorking] = useState(false);
  const [simulatedTimeDisplay, setSimulatedTimeDisplay] = useState('');
  
  const [viewMode, setViewMode] = useState<ViewMode>('PERIOD');
  const [taxMode, setTaxMode] = useState<TaxMode>('GROSS');
  const [streamDisplayMode, setStreamDisplayMode] = useState<StreamDisplayMode>('EARNED');

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
  const todayProgressRef = useRef<HTMLDivElement>(null);
  const aggProgressRef = useRef<HTMLDivElement>(null);
  
  const streamRefs = useRef<{ [key: string]: any }>({});

  // Main High Performance 60 FPS Loop
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

    const streamData = config.streams.map(stream => {
      const streamAnnualGross = stream.months ? (stream.amount * 12) / stream.months : 0;
      const streamRateGross = annualMs > 0 ? streamAnnualGross / annualMs : 0;
      
      let parsedStartDate = startOfToday;
      if (stream.startDate) {
        const [year, month, day] = stream.startDate.split('-').map(Number);
        parsedStartDate = new Date(year, month - 1, day);
      }
      
      const parsedEndDate = new Date(parsedStartDate);
      parsedEndDate.setMonth(parsedEndDate.getMonth() + (stream.months || 12));

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
        historicalStart,
        endDate: parsedEndDate,
        ytdStart,
        pStart,
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

      // Update Today's Background Progress Bar
      const todayProgressPct = dailyMs > 0 ? Math.min(100, Math.max(0, (msWorkedToday / dailyMs) * 100)) : 0;
      if (todayProgressRef.current) {
        todayProgressRef.current.style.width = `${todayProgressPct.toFixed(4)}%`;
      }

      // Update Aggregated Panel Background Progress Bar
      let aggStart = 0;
      let aggEnd = 0;

      if (viewModeRef.current === 'PERIOD') {
        aggStart = periodStart.getTime();
        aggEnd = periodEnd.getTime();
      } else if (viewModeRef.current === 'YTD') {
        aggStart = startOfYear.getTime();
        aggEnd = endOfYear.getTime();
      } else { // TOTAL
        if (streamData.length > 0) {
          aggStart = Math.min(...streamData.map(s => s.historicalStart.getTime()));
          aggEnd = Math.max(...streamData.map(s => s.endDate.getTime()));
        }
      }

      let aggProgressPct = 0;
      if (aggEnd > aggStart) {
        const elapsed = now.getTime() - aggStart;
        aggProgressPct = Math.min(100, Math.max(0, (elapsed / (aggEnd - aggStart)) * 100));
      }

      if (aggProgressRef.current) {
        aggProgressRef.current.style.width = `${aggProgressPct.toFixed(4)}%`;
      }

      let totalGrossToday = 0;
      let totalGrossPeriod = 0;
      let totalGrossYtd = 0;
      let totalGrossTotal = 0;

      streamData.forEach((sData) => {
        const streamGrossToday = sData.isStartedToday ? (msWorkedToday * sData.streamRateGross) : 0;
        totalGrossToday += streamGrossToday;
        totalGrossPeriod += (sData.msPeriod * sData.streamRateGross) + streamGrossToday;
        totalGrossYtd += (sData.msYtd * sData.streamRateGross) + streamGrossToday;
        totalGrossTotal += (sData.msHistorical * sData.streamRateGross) + streamGrossToday;
      });

      const totalNetYtd = calculateNetIncome(totalGrossYtd, config.taxProvince);
      const exactNetToday = totalNetYtd - calculateNetIncome(totalGrossYtd - totalGrossToday, config.taxProvince);
      const exactNetPeriod = totalNetYtd - calculateNetIncome(totalGrossYtd - totalGrossPeriod, config.taxProvince);
      const effectiveYtdRate = totalGrossYtd > 0 ? (totalNetYtd / totalGrossYtd) : 1;
      const exactNetTotal = totalGrossTotal * effectiveYtdRate;

      const isActual = taxModeRef.current === 'ACTUAL';
      const displayTotalToday = isActual ? exactNetToday : totalGrossToday;
      
      let displayTotalAgg = 0;
      if (viewModeRef.current === 'TOTAL') displayTotalAgg = isActual ? exactNetTotal : totalGrossTotal;
      else if (viewModeRef.current === 'YTD') displayTotalAgg = isActual ? totalNetYtd : totalGrossYtd;
      else if (viewModeRef.current === 'PERIOD') displayTotalAgg = isActual ? exactNetPeriod : totalGrossPeriod;

      const updateText = (ref: HTMLElement | null, text: string) => { if (ref && ref.innerText !== text) ref.innerText = text; };

      const { dollars: tDol, cents: tCent } = formatMoneyParts(displayTotalToday, numDecimals);
      updateText(todayDollarRef.current, tDol);
      updateText(todayCentRef.current, tCent);

      const { dollars: totDol, cents: totCent } = formatMoneyParts(displayTotalAgg, numDecimals);
      updateText(totalDollarRef.current, totDol);
      updateText(totalCentRef.current, totCent);
      
      const ratioToday = totalGrossToday > 0 ? (exactNetToday / totalGrossToday) : 1;
      const ratioPeriod = totalGrossPeriod > 0 ? (exactNetPeriod / totalGrossPeriod) : 1;
      
      streamData.forEach(sData => {
        const streamGrossToday = sData.isStartedToday ? msWorkedToday * sData.streamRateGross : 0;
        let streamGrossAgg = 0;
        let maxGrossAgg = 0;
        let ratioAgg = 1;

        let axisStartDate: Date;
        let axisEndDate: Date;

        if (viewModeRef.current === 'TOTAL') {
          streamGrossAgg = (sData.msHistorical * sData.streamRateGross) + streamGrossToday;
          maxGrossAgg = sData.amount; 
          ratioAgg = effectiveYtdRate;
          axisStartDate = sData.historicalStart;
          axisEndDate = sData.endDate;
        } else if (viewModeRef.current === 'YTD') {
          streamGrossAgg = (sData.msYtd * sData.streamRateGross) + streamGrossToday;
          maxGrossAgg = sData.maxGrossYtd;
          ratioAgg = effectiveYtdRate;
          axisStartDate = sData.ytdStart;
          axisEndDate = endOfYear;
        } else { // PERIOD
          streamGrossAgg = (sData.msPeriod * sData.streamRateGross) + streamGrossToday;
          maxGrossAgg = sData.maxGrossPeriod;
          ratioAgg = ratioPeriod;
          axisStartDate = sData.pStart;
          axisEndDate = periodEnd;
        }

        const calendarTotal = axisEndDate.getTime() - axisStartDate.getTime();
        let calendarElapsed = now.getTime() - axisStartDate.getTime();
        if (calendarElapsed < 0) calendarElapsed = 0;
        
        const progressPct = calendarTotal > 0 ? Math.min(100, Math.max(0, (calendarElapsed / calendarTotal) * 100)) : 0;
        
        // Mutate BOTH Progress Bar Widths
        const barRef = streamRefs.current[`${sData.id}-progress-bar`];
        if (barRef) barRef.style.width = `${progressPct.toFixed(4)}%`;

        const cardRef = streamRefs.current[`${sData.id}-card-progress`];
        if (cardRef) cardRef.style.width = `${progressPct.toFixed(4)}%`;

        updateText(streamRefs.current[`${sData.id}-graph-pct`], `${progressPct.toFixed(4)}%`);

        const finalMax = isActual ? maxGrossAgg * ratioAgg : maxGrossAgg;
        const formatShortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        
        updateText(streamRefs.current[`${sData.id}-axis-y-max`], formatMoneyParts(finalMax, 0).dollars);
        updateText(streamRefs.current[`${sData.id}-axis-x-start`], formatShortDate(axisStartDate));
        updateText(streamRefs.current[`${sData.id}-axis-x-end`], formatShortDate(axisEndDate));

        let displayStreamAggGross = 0;
        let displayStreamTodayGross = 0;

        if (streamDisplayModeRef.current === 'EARNED') {
          displayStreamAggGross = streamGrossAgg;
          displayStreamTodayGross = streamGrossToday;
        } else {
          displayStreamAggGross = Math.max(0, maxGrossAgg - streamGrossAgg);
          const maxGrossToday = sData.isStartedToday && todayIsWorkDay ? (dailyMs * sData.streamRateGross) : 0;
          displayStreamTodayGross = Math.max(0, maxGrossToday - streamGrossToday);
        }

        const finalStreamAgg = isActual ? displayStreamAggGross * ratioAgg : displayStreamAggGross;
        const finalStreamToday = isActual ? displayStreamTodayGross * ratioToday : displayStreamTodayGross;

        const { dollars: aggDol, cents: aggCent } = formatMoneyParts(finalStreamAgg, numDecimals);
        updateText(streamRefs.current[`${sData.id}-agg-dollar`], aggDol);
        updateText(streamRefs.current[`${sData.id}-agg-cent`], aggCent);
        
        const { dollars: todDol, cents: todCent } = formatMoneyParts(finalStreamToday, numDecimals);
        updateText(streamRefs.current[`${sData.id}-today-dollar`], todDol);
        updateText(streamRefs.current[`${sData.id}-today-cent`], todCent);
      });

      // Calculate Header Rates Based on Selected View
      const displayAnnualSalary = isActual ? calculateNetIncome(annualSalaryGross, config.taxProvince) : annualSalaryGross;
      let newEquivalents: { amount: number, label: string }[] = [];

      if (viewModeRef.current === 'PERIOD') {
        const eqAmount = annualMs > 0 ? displayAnnualSalary * (msTotalInPeriod / annualMs) : 0;
        newEquivalents = [{ amount: eqAmount, label: 'period' }];
      } else if (viewModeRef.current === 'TOTAL') {
        const eqAmount = annualMs > 0 ? displayAnnualSalary * (dailyMs / annualMs) : 0;
        newEquivalents = [
          { amount: eqAmount, label: 'day' },
          { amount: displayAnnualSalary, label: 'year' }
        ];
      } else {
        newEquivalents = [{ amount: displayAnnualSalary, label: 'year' }];
      }

      setBaseEquivalents(prev => {
        if (prev.length !== newEquivalents.length) return newEquivalents;
        const isSame = prev.every((p, i) => p.amount === newEquivalents[i].amount && p.label === newEquivalents[i].label);
        return isSame ? prev : newEquivalents;
      });

      setIsWorking(prev => prev !== isWorkingNow ? isWorkingNow : prev);
      
      if (useFakeTime) {
        setSimulatedTimeDisplay(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameId);
  }, [config]);

  return {
    baseEquivalents,
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
    todayProgressRef,
    aggProgressRef,
    streamRefs
  };
}
import { useState, useEffect, useRef } from 'react';
import { UserConfig, ViewMode, TaxMode, StreamDisplayMode } from '../types';
import { calculateAnnualSalary, formatMoney, formatMoneyParts, getDailyWorkingMilliseconds, parseTime, getWorkingMsBetween, getCurrentPayPeriodStart, getCurrentPayPeriodEnd, calculateNetIncome } from '../lib/calculator';

export function useSalaryEngine(config: UserConfig) {
  const [annualTotalDisplay, setAnnualTotalDisplay] = useState(0);
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
  
  // Using 'any' for the dictionary map allows us to bypass strict SVG vs HTML element typing issues
  const streamRefs = useRef<{ [key: string]: any }>({});

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
    
    const periodStart = getCurrentPayPeriodStart(nowRef, config.payPeriod.type, config.payPeriod.anchorDate);
    const periodEnd = getCurrentPayPeriodEnd(periodStart, config.payPeriod.type);

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
      const msTotalInLife = getWorkingMsBetween(parsedStartDate, parsedEndDate, config.schedule, dailyMs);

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
        msTotalInLife
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
        let maxMsAgg = 0;
        let currentMsAgg = 0;

        let axisStartDate: Date;
        let axisEndDate: Date;

        if (viewModeRef.current === 'TOTAL') {
          streamGrossAgg = (sData.msHistorical * sData.streamRateGross) + streamGrossToday;
          maxGrossAgg = sData.amount; 
          ratioAgg = effectiveYtdRate;
          maxMsAgg = sData.msTotalInLife;
          currentMsAgg = sData.msHistorical + msWorkedToday;
          axisStartDate = sData.historicalStart;
          axisEndDate = sData.endDate;
        } else if (viewModeRef.current === 'YTD') {
          streamGrossAgg = (sData.msYtd * sData.streamRateGross) + streamGrossToday;
          maxGrossAgg = sData.maxGrossYtd;
          ratioAgg = effectiveYtdRate;
          maxMsAgg = msTotalInYear;
          currentMsAgg = sData.msYtd + msWorkedToday;
          axisStartDate = sData.ytdStart;
          axisEndDate = endOfYear;
        } else { // PERIOD
          streamGrossAgg = (sData.msPeriod * sData.streamRateGross) + streamGrossToday;
          maxGrossAgg = sData.maxGrossPeriod;
          ratioAgg = ratioPeriod;
          maxMsAgg = msTotalInPeriod;
          currentMsAgg = sData.msPeriod + msWorkedToday;
          axisStartDate = sData.pStart;
          axisEndDate = periodEnd;
        }

        // 1. Update Graph SVG & Progress Text
        const progressPct = maxMsAgg > 0 ? Math.min(100, Math.max(0, (currentMsAgg / maxMsAgg) * 100)) : 0;
        const clipRef = streamRefs.current[`${sData.id}-graph-clip`];
        if (clipRef) clipRef.setAttribute('width', progressPct.toFixed(4));
        updateText(streamRefs.current[`${sData.id}-graph-pct`], `${progressPct.toFixed(4)}%`);

        // 2. Update Graph Axes
        const finalMax = isActual ? maxGrossAgg * ratioAgg : maxGrossAgg;
        updateText(streamRefs.current[`${sData.id}-axis-y-max`], formatMoney(finalMax, 0));
        
        const formatShortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
        updateText(streamRefs.current[`${sData.id}-axis-x-start`], formatShortDate(axisStartDate));
        updateText(streamRefs.current[`${sData.id}-axis-x-end`], formatShortDate(axisEndDate));

        // 3. Update Dollar Breakdowns
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

  return {
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
  };
}
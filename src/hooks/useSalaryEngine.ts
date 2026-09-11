import { useState, useEffect, useRef } from 'react';
import { UserConfig, ViewMode, TaxMode, StreamDisplayMode } from '../types';
import { calculateAnnualSalary, formatMoneyParts, getDailyWorkingMilliseconds, parseTime, getWorkingMsBetween, getCurrentPayPeriodStart, getCurrentPayPeriodEnd, calculateNetIncome } from '../lib/calculator';

// Updated thresholds: 2k, 20k, 200k
const getBoxScale = (totalDollars: number) => {
  if (totalDollars >= 200000) return { multiplier: 1000, bg: '185, 28, 28', fg: '248, 113, 113' }; // Red ($1000)
  if (totalDollars >= 20000) return { multiplier: 100, bg: '161, 98, 7', fg: '250, 204, 21' }; // Yellow ($100)
  if (totalDollars >= 2000) return { multiplier: 10, bg: '29, 78, 216', fg: '96, 165, 250' }; // Blue ($10)
  return { multiplier: 1, bg: '4, 120, 87', fg: '52, 211, 153' }; // Emerald ($1)
};

export function useSalaryEngine(config: UserConfig) {
  const [baseEquivalents, setBaseEquivalents] = useState<{ amount: number, label: string }[]>([{ amount: 0, label: 'year' }]);
  const [isWorking, setIsWorking] = useState(false);
  const [simulatedTimeDisplay, setSimulatedTimeDisplay] = useState('');
  
  const [dayRolloverKey, setDayRolloverKey] = useState(Date.now());
  
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
  
  const todayProgressBaseRef = useRef<HTMLDivElement>(null);
  const aggProgressBaseRef = useRef<HTMLDivElement>(null);
  const aggProgressNewRef = useRef<HTMLDivElement>(null);
  const aggCheckpointRef = useRef<HTMLDivElement>(null);

  const todayCanvasRef = useRef<HTMLCanvasElement>(null);
  const aggCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const legend1Ref = useRef<HTMLDivElement>(null);
  const legend10Ref = useRef<HTMLDivElement>(null);
  const legend100Ref = useRef<HTMLDivElement>(null);
  const legend1000Ref = useRef<HTMLDivElement>(null);
  
  const streamRefs = useRef<{ [key: string]: any }>({});

  const updateBoxCanvas = (
    canvas: HTMLCanvasElement | null, 
    pct: number, 
    totalDollars: number, 
    isBackground: boolean = false
  ) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = rect.height;
    
    if (W <= 0 || H <= 0) return;

    const pixelW = Math.floor(W * dpr);
    const pixelH = Math.floor(H * dpr);

    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
    }

    const scale = getBoxScale(totalDollars);
    const exactTotalBoxes = totalDollars / scale.multiplier;
    const drawableBoxes = Math.min(250000, Math.max(1, Math.ceil(exactTotalBoxes)));
    const aspect = pixelW / pixelH;
    
    let cols = Math.ceil(Math.sqrt(drawableBoxes * aspect));
    let rows = Math.ceil(drawableBoxes / cols);
    
    let gap = 1 * dpr;
    let boxSize = Math.min((pixelW - (cols - 1) * gap) / cols, (pixelH - (rows - 1) * gap) / rows);
    
    if (boxSize < 1.5 * dpr) {
      gap = 0;
      boxSize = Math.min(pixelW / cols, pixelH / rows);
    }

    const gridW = cols * boxSize + (cols - 1) * gap;
    const gridH = rows * boxSize + (rows - 1) * gap;
    const offsetX = (pixelW - gridW) / 2;
    const offsetY = (pixelH - gridH) / 2;

    ctx.clearRect(0, 0, pixelW, pixelH);

    const earnedBoxes = (pct / 100) * exactTotalBoxes;
    const fullIdx = Math.floor(earnedBoxes);
    const frac = earnedBoxes - fullIdx;
    
    const emptyOp = isBackground ? 0.05 : 0.15;
    const fullOp = isBackground ? 0.25 : 1.0;
    const baseColor = isBackground ? scale.bg : scale.fg;

    // 1. Draw fully earned solid boxes
    if (fullIdx > 0) {
      ctx.fillStyle = `rgba(${baseColor}, ${fullOp})`;
      ctx.beginPath();
      for (let i = 0; i < Math.min(fullIdx, drawableBoxes); i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.rect(offsetX + col * (boxSize + gap), offsetY + row * (boxSize + gap), boxSize, boxSize);
      }
      ctx.fill();
    }

    // 2. Draw faint empty/future boxes
    if (fullIdx < drawableBoxes) {
      ctx.fillStyle = `rgba(${baseColor}, ${emptyOp})`;
      ctx.beginPath();
      for (let i = fullIdx; i < drawableBoxes; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.rect(offsetX + col * (boxSize + gap), offsetY + row * (boxSize + gap), boxSize, boxSize);
      }
      ctx.fill();
    }

    // 3. Overlay the exact fractional value on the active box
    if (fullIdx < drawableBoxes && frac > 0) {
      const col = fullIdx % cols;
      const row = Math.floor(fullIdx / cols);
      ctx.fillStyle = `rgba(${baseColor}, ${frac * fullOp})`;
      ctx.fillRect(offsetX + col * (boxSize + gap), offsetY + row * (boxSize + gap), boxSize, boxSize);
    }

    // 4. Draw gray placeholder boxes to complete the perfect rectangular grid
    const totalGridSlots = cols * rows;
    if (drawableBoxes < totalGridSlots) {
      const placeholderOp = isBackground ? 0.05 : 0.15;
      ctx.fillStyle = `rgba(100, 116, 139, ${placeholderOp})`; // slate-500 equivalent
      ctx.beginPath();
      for (let i = drawableBoxes; i < totalGridSlots; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.rect(offsetX + col * (boxSize + gap), offsetY + row * (boxSize + gap), boxSize, boxSize);
      }
      ctx.fill();
    }
  };

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
    const initialDateString = nowRef.toDateString(); 
    
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
      
      if (now.toDateString() !== initialDateString) {
        setDayRolloverKey(Date.now());
        return;
      }

      let msWorkedToday = 0;
      let isWorkingNow = false;
      const todayIsWorkDay = config.schedule.days.includes(now.getDay()) && dailyMs > 0;

      let todayEarnedPct = 0;

      if (todayIsWorkDay) {
        const startTime = new Date(now);
        const s = parseTime(config.schedule.startTime);
        startTime.setHours(s.h, s.m, 0, 0);

        const endTime = new Date(now);
        const e = parseTime(config.schedule.endTime);
        endTime.setHours(e.h, e.m, 0, 0);

        if (now > endTime) {
          msWorkedToday = dailyMs;
          todayEarnedPct = 100;
        } else if (now < startTime) {
          msWorkedToday = 0;
          todayEarnedPct = 0;
        } else {
          msWorkedToday = now.getTime() - startTime.getTime();
          isWorkingNow = true;
          todayEarnedPct = Math.min(100, Math.max(0, (msWorkedToday / dailyMs) * 100));
        }
      }

      let aggStart = 0;
      let aggEnd = 0;

      if (viewModeRef.current === 'PERIOD') {
        aggStart = periodStart.getTime();
        aggEnd = periodEnd.getTime();
      } else if (viewModeRef.current === 'YTD') {
        aggStart = startOfYear.getTime();
        aggEnd = endOfYear.getTime();
      } else { 
        if (streamData.length > 0) {
          aggStart = Math.min(...streamData.map(s => s.historicalStart.getTime()));
          aggEnd = Math.max(...streamData.map(s => s.endDate.getTime()));
        }
      }

      const aggTotalTime = aggEnd - aggStart;
      let aggEarnedPct = 0;
      let aggIncompletePct = 0;
      let aggCheckpointPct = -1;

      if (aggTotalTime > 0) {
        const elapsed = now.getTime() - aggStart;
        aggEarnedPct = Math.min(100, Math.max(0, (elapsed / aggTotalTime) * 100));
        
        const incompleteStart = Math.max(aggStart, now.getTime());
        const incompleteEnd = Math.min(aggEnd, periodEnd.getTime());
        const incompleteTime = incompleteEnd - incompleteStart;
        aggIncompletePct = incompleteTime > 0 ? (incompleteTime / aggTotalTime) * 100 : 0;

        if (viewModeRef.current !== 'PERIOD') {
          const checkpointElapsed = periodStart.getTime() - aggStart;
          if (checkpointElapsed > 0 && checkpointElapsed <= aggTotalTime) {
            aggCheckpointPct = (checkpointElapsed / aggTotalTime) * 100;
          }
        }
      }

      let totalGrossToday = 0;
      let totalGrossPeriod = 0;
      let totalGrossYtd = 0;
      let totalGrossTotal = 0;

      let maxGrossTodayGlobal = 0;
      let maxGrossAggGlobal = 0;

      streamData.forEach((sData) => {
        const streamGrossToday = sData.isStartedToday ? (msWorkedToday * sData.streamRateGross) : 0;
        totalGrossToday += streamGrossToday;
        totalGrossPeriod += (sData.msPeriod * sData.streamRateGross) + streamGrossToday;
        totalGrossYtd += (sData.msYtd * sData.streamRateGross) + streamGrossToday;
        totalGrossTotal += (sData.msHistorical * sData.streamRateGross) + streamGrossToday;

        maxGrossTodayGlobal += sData.isStartedToday && todayIsWorkDay ? (dailyMs * sData.streamRateGross) : 0;
        if (viewModeRef.current === 'TOTAL') maxGrossAggGlobal += sData.amount;
        else if (viewModeRef.current === 'YTD') maxGrossAggGlobal += sData.maxGrossYtd;
        else maxGrossAggGlobal += sData.maxGrossPeriod;
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

      const ratioToday = totalGrossToday > 0 ? (exactNetToday / totalGrossToday) : 1;
      const ratioPeriod = totalGrossPeriod > 0 ? (exactNetPeriod / totalGrossPeriod) : 1;
      const ratioAggGlobal = viewModeRef.current === 'PERIOD' ? ratioPeriod : effectiveYtdRate;

      let uses1 = false, uses10 = false, uses100 = false, uses1000 = false;
      const trackScale = (val: number) => {
        if (val >= 200000) uses1000 = true;
        else if (val >= 20000) uses100 = true;
        else if (val >= 2000) uses10 = true;
        else uses1 = true;
      };

      if (config.showDollarBlocks) {
        const todayMaxGlobal = isActual ? maxGrossTodayGlobal * ratioToday : maxGrossTodayGlobal;
        updateBoxCanvas(todayCanvasRef.current, todayEarnedPct, todayMaxGlobal, true);
        trackScale(todayMaxGlobal);

        const aggMaxGlobal = isActual ? maxGrossAggGlobal * ratioAggGlobal : maxGrossAggGlobal;
        updateBoxCanvas(aggCanvasRef.current, aggEarnedPct, aggMaxGlobal, true);
        trackScale(aggMaxGlobal);
      } else {
        if (todayProgressBaseRef.current) todayProgressBaseRef.current.style.width = `${todayEarnedPct.toFixed(4)}%`;
        if (aggProgressBaseRef.current) aggProgressBaseRef.current.style.width = `${aggEarnedPct.toFixed(4)}%`;
        if (aggProgressNewRef.current) {
          aggProgressNewRef.current.style.left = `${aggEarnedPct.toFixed(4)}%`;
          aggProgressNewRef.current.style.width = `${aggIncompletePct.toFixed(4)}%`;
        }
        if (aggCheckpointRef.current) {
          aggCheckpointRef.current.style.display = (aggCheckpointPct > 0 && aggCheckpointPct < 100) ? 'block' : 'none';
          aggCheckpointRef.current.style.left = `${aggCheckpointPct.toFixed(4)}%`;
        }
      }

      const updateText = (ref: HTMLElement | null, text: string) => { if (ref && ref.innerText !== text) ref.innerText = text; };

      const { dollars: tDol, cents: tCent } = formatMoneyParts(displayTotalToday, numDecimals);
      updateText(todayDollarRef.current, tDol);
      updateText(todayCentRef.current, tCent);

      const { dollars: totDol, cents: totCent } = formatMoneyParts(displayTotalAgg, numDecimals);
      updateText(totalDollarRef.current, totDol);
      updateText(totalCentRef.current, totCent);
      
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
        
        const earnedPct = calendarTotal > 0 ? Math.min(100, Math.max(0, (calendarElapsed / calendarTotal) * 100)) : 0;
        
        const incompleteStart = Math.max(axisStartDate.getTime(), now.getTime());
        const incompleteEnd = Math.min(axisEndDate.getTime(), periodEnd.getTime());
        const incompleteTime = incompleteEnd - incompleteStart;
        const incompletePct = (calendarTotal > 0 && incompleteTime > 0) ? (incompleteTime / calendarTotal) * 100 : 0;

        let checkpointPct = -1;
        if (viewModeRef.current !== 'PERIOD') {
          const checkpointElapsed = periodStart.getTime() - axisStartDate.getTime();
          if (calendarTotal > 0 && checkpointElapsed > 0 && checkpointElapsed <= calendarTotal) {
            checkpointPct = (checkpointElapsed / calendarTotal) * 100;
          }
        }

        const finalMax = isActual ? maxGrossAgg * ratioAgg : maxGrossAgg;

        if (config.showDollarBlocks) {
          updateBoxCanvas(streamRefs.current[`${sData.id}-card-canvas`], earnedPct, finalMax, true);
          updateBoxCanvas(streamRefs.current[`${sData.id}-detail-canvas`], earnedPct, finalMax, false);
          trackScale(finalMax);
        } else {
          const baseBarRef = streamRefs.current[`${sData.id}-progress-base`];
          if (baseBarRef) baseBarRef.style.width = `${earnedPct.toFixed(4)}%`;

          const newBarRef = streamRefs.current[`${sData.id}-progress-new`];
          if (newBarRef) newBarRef.style.width = `${incompletePct.toFixed(4)}%`;

          const cardBaseRef = streamRefs.current[`${sData.id}-card-progress-base`];
          if (cardBaseRef) cardBaseRef.style.width = `${earnedPct.toFixed(4)}%`;

          const cardNewRef = streamRefs.current[`${sData.id}-card-progress-new`];
          if (cardNewRef) {
            cardNewRef.style.left = `${earnedPct.toFixed(4)}%`;
            cardNewRef.style.width = `${incompletePct.toFixed(4)}%`;
          }

          const checkpointBarRef = streamRefs.current[`${sData.id}-checkpoint-bar`];
          if (checkpointBarRef) {
            checkpointBarRef.style.display = (checkpointPct > 0 && checkpointPct < 100) ? 'block' : 'none';
            checkpointBarRef.style.left = `${checkpointPct.toFixed(4)}%`;
          }

          const cardCheckpointRef = streamRefs.current[`${sData.id}-card-checkpoint`];
          if (cardCheckpointRef) {
            cardCheckpointRef.style.display = (checkpointPct > 0 && checkpointPct < 100) ? 'block' : 'none';
            cardCheckpointRef.style.left = `${checkpointPct.toFixed(4)}%`;
          }
        }

        updateText(streamRefs.current[`${sData.id}-graph-pct`], `${earnedPct.toFixed(4)}%`);

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

      // Update Global Legend Visibility
      if (config.showDollarBlocks) {
        if (legend1Ref.current) legend1Ref.current.style.display = uses1 ? 'flex' : 'none';
        if (legend10Ref.current) legend10Ref.current.style.display = uses10 ? 'flex' : 'none';
        if (legend100Ref.current) legend100Ref.current.style.display = uses100 ? 'flex' : 'none';
        if (legend1000Ref.current) legend1000Ref.current.style.display = uses1000 ? 'flex' : 'none';
      }

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
  }, [config, dayRolloverKey]); 

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
    todayProgressBaseRef,
    aggProgressBaseRef,
    aggProgressNewRef,
    aggCheckpointRef,
    todayCanvasRef,
    aggCanvasRef,
    legend1Ref,
    legend10Ref,
    legend100Ref,
    legend1000Ref,
    streamRefs
  };
}
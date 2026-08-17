import { IncomeStream, Schedule, PayPeriodType } from '../types';

export const calculateAnnualSalary = (streams: IncomeStream[]): number => {
  return streams.reduce((total, stream) => {
    return total + (stream.amount * 12) / stream.months;
  }, 0);
};

export const parseTime = (timeStr: string): { h: number; m: number } => {
  const [h, m] = timeStr.split(':').map(Number);
  return { h, m };
};

export const getDailyWorkingMilliseconds = (schedule: Schedule): number => {
  const start = parseTime(schedule.startTime);
  const end = parseTime(schedule.endTime);
  const startMs = (start.h * 60 + start.m) * 60 * 1000;
  const endMs = (end.h * 60 + end.m) * 60 * 1000;
  return Math.max(0, endMs - startMs);
};

export const formatMoney = (amount: number, decimals: number = 2): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
};

export const formatMoneyParts = (amount: number, decimals: number = 2): { dollars: string; cents: string } => {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  
  const [dollars, cents] = formatted.split('.');
  return { dollars, cents: cents || '00'.padEnd(decimals, '0') };
};

export const getWorkingMsBetween = (start: Date, end: Date, schedule: Schedule, dailyMs: number): number => {
  let ms = 0;
  const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const target = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  while (current < target) {
    if (schedule.days.includes(current.getDay())) {
      ms += dailyMs;
    }
    current.setDate(current.getDate() + 1);
  }
  return ms;
};

export const getCurrentPayPeriodStart = (now: Date, type: PayPeriodType, anchorDateStr: string): Date => {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  if (type === 'MONTHLY') {
    return new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
  }
  
  if (type === 'SEMIMONTHLY') {
    if (startOfToday.getDate() < 16) {
      return new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);
    } else {
      return new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 16);
    }
  }
  
  if (!anchorDateStr) return startOfToday; 
  
  const [y, m, d] = anchorDateStr.split('-').map(Number);
  const anchor = new Date(y, m - 1, d, 0, 0, 0, 0);
  
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffMs = startOfToday.getTime() - anchor.getTime();
  const diffDays = Math.round(diffMs / msPerDay);
  
  const cycleDays = type === 'BIWEEKLY' ? 14 : 7;
  
  let daysSinceCycleStart = diffDays % cycleDays;
  if (daysSinceCycleStart < 0) {
    daysSinceCycleStart += cycleDays;
  }
  
  const cycleStart = new Date(startOfToday);
  cycleStart.setDate(startOfToday.getDate() - daysSinceCycleStart);
  return cycleStart;
};

// --- Canadian Progressive Tax Engine ---
interface TaxBracket { threshold: number; rate: number; }

const calculateBracketTax = (income: number, brackets: TaxBracket[], bpa: number): number => {
  let tax = 0;
  let taxableIncome = Math.max(0, income - bpa);
  let previousThreshold = 0;

  for (const bracket of brackets) {
    const amountInBracket = Math.min(taxableIncome, bracket.threshold - previousThreshold);
    if (amountInBracket > 0) {
      tax += amountInBracket * bracket.rate;
    }
    previousThreshold = bracket.threshold;
    if (taxableIncome <= previousThreshold) break;
  }
  return tax;
};

export const calculateEffectiveTaxRate = (annualIncome: number, province: string): number => {
  if (annualIncome <= 0) return 0;

  // Approximate 2024 Federal Brackets & Basic Personal Amount
  const fedBPA = 15705;
  const fedBrackets: TaxBracket[] = [
    { threshold: 55867, rate: 0.15 },
    { threshold: 111733, rate: 0.205 },
    { threshold: 173205, rate: 0.26 },
    { threshold: 246752, rate: 0.29 },
    { threshold: Infinity, rate: 0.33 }
  ];

  // Approximate 2024 Provincial Brackets & BPAs
  let provBPA = 0;
  let provBrackets: TaxBracket[] = [];

  switch (province) {
    case 'BC':
      provBPA = 12580;
      provBrackets = [
        { threshold: 47937, rate: 0.0506 },
        { threshold: 95875, rate: 0.077 },
        { threshold: 109256, rate: 0.105 },
        { threshold: 133561, rate: 0.1229 },
        { threshold: 181232, rate: 0.147 },
        { threshold: 252752, rate: 0.168 },
        { threshold: Infinity, rate: 0.205 }
      ];
      break;
    case 'ON':
      provBPA = 12399;
      provBrackets = [
        { threshold: 51446, rate: 0.0505 },
        { threshold: 102894, rate: 0.0915 },
        { threshold: 150000, rate: 0.1116 },
        { threshold: 220000, rate: 0.1216 },
        { threshold: Infinity, rate: 0.1316 }
      ];
      break;
    case 'AB':
      provBPA = 21885;
      provBrackets = [
        { threshold: 148269, rate: 0.10 },
        { threshold: 177922, rate: 0.12 },
        { threshold: 237230, rate: 0.13 },
        { threshold: 355845, rate: 0.14 },
        { threshold: Infinity, rate: 0.15 }
      ];
      break;
    case 'QC':
      provBPA = 18056;
      provBrackets = [
        { threshold: 51780, rate: 0.14 },
        { threshold: 103545, rate: 0.19 },
        { threshold: 126000, rate: 0.24 },
        { threshold: Infinity, rate: 0.2575 }
      ];
      break;
    default:
      // Fallback to BC if unknown
      provBPA = 12580;
      provBrackets = [
        { threshold: 47937, rate: 0.0506 },
        { threshold: 95875, rate: 0.077 },
        { threshold: Infinity, rate: 0.105 }
      ];
      break;
  }

  const fedTax = calculateBracketTax(annualIncome, fedBrackets, fedBPA);
  const provTax = calculateBracketTax(annualIncome, provBrackets, provBPA);
  
  // Also approximating CPP/EI deductions to make Net Pay truly accurate
  // 2024 Limits: CPP max ~$3867, EI max ~$1049
  const cppDeduction = Math.min(Math.max(0, annualIncome - 3500) * 0.0595, 3867.50);
  const eiDeduction = Math.min(annualIncome * 0.0166, 1049.12);

  const totalTaxAndDeductions = fedTax + provTax + cppDeduction + eiDeduction;
  return totalTaxAndDeductions / annualIncome;
};
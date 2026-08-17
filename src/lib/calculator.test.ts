import { describe, it, expect } from 'vitest';
import { 
  calculateAnnualSalary, 
  parseTime, 
  getDailyWorkingMilliseconds, 
  formatMoney,
  formatMoneyParts,
  getWorkingMsBetween,
  getCurrentPayPeriodStart,
  getCurrentPayPeriodEnd,
  calculateTotalTaxes,
  calculateNetIncome
} from './calculator';
import { IncomeStream, Schedule } from '../types';

describe('Calculator Engine', () => {
  
  // --- Stream Aggregation Tests ---
  describe('calculateAnnualSalary', () => {
    it('should correctly annualize a 12-month base salary', () => {
      const streams: IncomeStream[] = [
        { id: '1', name: 'Base', amount: 100000, months: 12, startDate: '2026-01-01' }
      ];
      expect(calculateAnnualSalary(streams)).toBe(100000);
    });

    it('should correctly annualize a 24-month equity grant', () => {
      const streams: IncomeStream[] = [
        { id: '1', name: 'RSU', amount: 40000, months: 24, startDate: '2026-01-01' }
      ];
      expect(calculateAnnualSalary(streams)).toBe(20000);
    });

    it('should correctly aggregate multiple streams', () => {
      const streams: IncomeStream[] = [
        { id: '1', name: 'Base', amount: 120000, months: 12, startDate: '2026-01-01' },
        { id: '2', name: 'Bonus', amount: 10000, months: 12, startDate: '2026-01-01' },
        { id: '3', name: 'RSU', amount: 80000, months: 48, startDate: '2026-01-01' }
      ];
      expect(calculateAnnualSalary(streams)).toBe(150000);
    });
  });

  // --- Formatting Tests ---
  describe('formatMoney & formatMoneyParts', () => {
    it('should format numbers into USD currency string', () => {
      expect(formatMoney(100000, 0)).toBe('$100,000');
      expect(formatMoney(1234.5678, 2)).toBe('$1,234.57');
    });

    it('should split dollars and cents correctly for DOM layout', () => {
      const parts2 = formatMoneyParts(1234.5678, 2);
      expect(parts2.dollars).toBe('$1,234');
      expect(parts2.cents).toBe('57');

      const parts4 = formatMoneyParts(1234.5678, 4);
      expect(parts4.dollars).toBe('$1,234');
      expect(parts4.cents).toBe('5678');
    });
  });

  // --- Core Time Engine Tests ---
  describe('Time Parsing & Daily Working Ms', () => {
    it('should convert 24h string to hours and minutes', () => {
      expect(parseTime('09:30')).toEqual({ h: 9, m: 30 });
      expect(parseTime('17:45')).toEqual({ h: 17, m: 45 });
    });

    it('should accurately calculate milliseconds between two times', () => {
      const schedule: Schedule = { days: [1, 2, 3, 4, 5], startTime: '09:00', endTime: '17:00' };
      const eightHoursInMs = 8 * 60 * 60 * 1000;
      expect(getDailyWorkingMilliseconds(schedule)).toBe(eightHoursInMs);
    });
  });

  // --- Historical Time Accumulation ---
  describe('Historical Accumulation (Different Start Dates vs Current Time)', () => {
    const schedule: Schedule = {
      days: [1, 2, 3, 4, 5], // Monday - Friday
      startTime: '09:00',
      endTime: '17:00'
    };
    const dailyMs = 8 * 60 * 60 * 1000;

    it('should calculate 0 ms if the start date is today', () => {
      const start = new Date(2026, 7, 16); 
      const end = new Date(2026, 7, 16);
      expect(getWorkingMsBetween(start, end, schedule, dailyMs)).toBe(0);
    });

    it('should strictly skip weekends when calculating historical time', () => {
      const start = new Date(2026, 7, 14); // Friday, Aug 14
      const end = new Date(2026, 7, 18);   // Tuesday, Aug 18
      // Fri (1) + Mon (1) = 2 days elapsed
      expect(getWorkingMsBetween(start, end, schedule, dailyMs)).toBe(dailyMs * 2);
    });
  });

  // --- Pay Period Cycle Engine ---
  describe('Pay Period & Cycle Tracking', () => {
    it('should calculate the correct BIWEEKLY start date based on anchor', () => {
      const anchorStr = '2026-08-07'; 
      const now = new Date(2026, 7, 16);
      const periodStart = getCurrentPayPeriodStart(now, 'BIWEEKLY', anchorStr);
      expect(periodStart.getDate()).toBe(7); 
    });

    it('should properly roll over into the NEXT biweekly period', () => {
      const anchorStr = '2026-08-07'; 
      const now = new Date(2026, 7, 25);
      const periodStart = getCurrentPayPeriodStart(now, 'BIWEEKLY', anchorStr);
      expect(periodStart.getDate()).toBe(21); 
    });
  });

  // --- Actual / Tax Engine ---
  describe('Actual Values (Canadian Tax Engine)', () => {
    it('should correctly calculate progressive taxes for BC', () => {
      const taxes = calculateTotalTaxes(100000, 'BC');
      // ~ $15,071 (Fed) + $5,913 (Prov) + $3,867 (CPP) + $1,049 (EI) = ~ $25,901
      expect(taxes).toBeGreaterThan(25000);
      expect(taxes).toBeLessThan(26500); 
    });

    it('should mathematically equal Gross minus Deductions for Net Income', () => {
      const gross = 100000;
      const taxes = calculateTotalTaxes(gross, 'BC');
      const net = calculateNetIncome(gross, 'BC');
      expect(net).toBe(gross - taxes);
    });

    it('should properly apply higher marginal tax brackets (150k vs 50k)', () => {
      const taxRateLow = calculateTotalTaxes(50000, 'ON') / 50000;
      const taxRateHigh = calculateTotalTaxes(150000, 'ON') / 150000;
      
      // Due to progressive tax brackets, a $150k earner's effective tax rate MUST be higher than a $50k earner's
      expect(taxRateHigh).toBeGreaterThan(taxRateLow);
    });

    it('should reflect different provincial tax policies (Alberta vs Quebec)', () => {
      const gross = 150000;
      const netAB = calculateNetIncome(gross, 'AB');
      const netQC = calculateNetIncome(gross, 'QC');
      
      // Alberta has a structurally lower effective tax burden than Quebec for high earners
      expect(netAB).toBeGreaterThan(netQC);
    });
  });
});
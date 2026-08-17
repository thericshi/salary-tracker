export interface IncomeStream {
  id: string;
  name: string;
  amount: number;
  months: number;
  startDate: string; // "YYYY-MM-DD" format
}

export interface Schedule {
  days: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // "HH:mm" format (24h)
  endTime: string; // "HH:mm" format (24h)
}

export type PayPeriodType = 'WEEKLY' | 'BIWEEKLY' | 'SEMIMONTHLY' | 'MONTHLY';

export interface PayPeriodConfig {
  type: PayPeriodType;
  anchorDate: string; // "YYYY-MM-DD" used for Weekly/Bi-weekly cycles
}

export interface TestingConfig {
  useFakeTime: boolean;
  fakeTime: string; // "YYYY-MM-DDTHH:mm" format
}

export interface UserConfig {
  streams: IncomeStream[];
  schedule: Schedule;
  payPeriod: PayPeriodConfig;
  testing?: TestingConfig;
  taxProvince: string; // e.g., 'BC', 'ON', 'AB'
  highPrecision: boolean; // Toggle for 4 decimal places vs 2
}
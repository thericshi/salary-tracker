import { useRef } from 'react';
import { Settings, X, Plus, Trash2, Clock, CalendarDays, DollarSign, Download, Upload, Copy, FileJson, Database, Briefcase, Landmark, Monitor, Beaker } from 'lucide-react';
import { UserConfig, PayPeriodType } from '../types';

interface SettingsModalProps {
  config: UserConfig;
  setConfig: (config: UserConfig) => void;
  onClose: () => void;
  defaultConfig: UserConfig;
}

export function SettingsModal({ config, setConfig, onClose, defaultConfig }: SettingsModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const DAYS_OF_WEEK = [
    { value: 0, label: 'Sun' }, { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }
  ];

  const updateStream = (id: string, field: string, value: string | number) => {
    setConfig({ ...config, streams: config.streams.map(s => s.id === id ? { ...s, [field]: value } : s) });
  };
  
  const removeStream = (id: string) => setConfig({ ...config, streams: config.streams.filter(s => s.id !== id) });
  const addStream = () => setConfig({ 
    ...config, 
    streams: [...config.streams, { id: Date.now().toString(), name: 'New Stream', amount: 0, months: 12, startDate: new Date().toISOString().split('T')[0] }] 
  });

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
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Settings className="text-slate-400" /> Configuration
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-8">
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

          <section className="space-y-4">
            <h3 className="text-lg font-medium text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-2">
              <Clock size={18} /> Work Schedule
            </h3>
            <div className="space-y-6 bg-slate-950/50 p-5 rounded-xl border border-slate-800">
              <div className="space-y-3">
                <label className="text-sm text-slate-400 flex items-center gap-2"><CalendarDays size={16} /> Work Days</label>
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

          <section className="space-y-4">
            <h3 className="text-lg font-medium text-slate-300 flex items-center gap-2 border-b border-slate-800 pb-2">
              <Database size={18} /> Data Backup
            </h3>
            <div className="bg-slate-950/50 p-5 rounded-xl border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3">
              <button onClick={() => downloadJsonFile(config, "my-salary-config.json")} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm"><Download size={16} /> Export Config</button>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm"><Upload size={16} /> Import Config</button>
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
              <button onClick={async () => { await navigator.clipboard.writeText(btoa(JSON.stringify(config))); alert("Copied to clipboard!"); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm"><Copy size={16} /> Copy Base64</button>
              <button onClick={() => downloadJsonFile(defaultConfig, "template-config.json")} className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm"><FileJson size={16} /> Get Template</button>
            </div>
          </section>
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-medium rounded-lg">
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
}
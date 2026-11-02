'use client';

import { useState, useEffect, useCallback } from 'react';

type Preset = 'manual' | 'once' | 'hourly' | 'daily' | 'weekdays' | 'weekly' | 'custom';

interface FrequencyPickerProps {
  value: string;
  onChange: (cron: string) => void;
  scheduledAt: string | null;
  onScheduledAtChange: (date: string | null) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function cronToPreset(cron: string, scheduledAt: string | null): { preset: Preset; hour: number; minute: number; day: number } {
  if (scheduledAt) return { preset: 'once', hour: 9, minute: 0, day: 1 };
  if (!cron) return { preset: 'manual', hour: 9, minute: 0, day: 1 };
  if (cron === '0 * * * *') return { preset: 'hourly', hour: 9, minute: 0, day: 1 };

  const parts = cron.split(' ');
  if (parts.length !== 5) return { preset: 'custom', hour: 9, minute: 0, day: 1 };

  const [min, hr, , , dow] = parts;
  const minute = parseInt(min) || 0;
  const hour = parseInt(hr) || 9;

  if (dow === '*' && hr !== '*') return { preset: 'daily', hour, minute, day: 1 };
  if (dow === '1-5') return { preset: 'weekdays', hour, minute, day: 1 };
  if (dow !== '*') return { preset: 'weekly', hour, minute, day: parseInt(dow) || 1 };

  return { preset: 'custom', hour, minute, day: 1 };
}

function toLocalDatetimeString(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getDefaultDatetime(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function FrequencyPicker({ value, onChange, scheduledAt, onScheduledAtChange }: FrequencyPickerProps) {
  const parsed = cronToPreset(value, scheduledAt);
  const [preset, setPreset] = useState<Preset>(parsed.preset);
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [day, setDay] = useState(parsed.day);
  const [customCron, setCustomCron] = useState(value);
  const [dateValue, setDateValue] = useState(
    scheduledAt ? toLocalDatetimeString(scheduledAt) : getDefaultDatetime()
  );

  // Sync internal state when props change (e.g. switching tasks)
  useEffect(() => {
    const synced = cronToPreset(value, scheduledAt);
    setPreset(synced.preset);
    setHour(synced.hour);
    setMinute(synced.minute);
    setDay(synced.day);
    if (value) setCustomCron(value);
    if (scheduledAt) {
      setDateValue(toLocalDatetimeString(scheduledAt));
    }
  }, [value, scheduledAt]);

  // Helper: compute cron for given params and emit if changed
  const emitCron = useCallback((p: Preset, h: number, m: number, d: number, custom: string) => {
    if (p === 'once') {
      if (value !== '') onChange('');
      return;
    }
    let cron = '';
    switch (p) {
      case 'manual': cron = ''; break;
      case 'hourly': cron = '0 * * * *'; break;
      case 'daily': cron = `${m} ${h} * * *`; break;
      case 'weekdays': cron = `${m} ${h} * * 1-5`; break;
      case 'weekly': cron = `${m} ${h} * * ${d}`; break;
      case 'custom': cron = custom; break;
    }
    if (cron !== value) onChange(cron);
  }, [value, onChange]);

  const handlePresetChange = useCallback((p: Preset) => {
    setPreset(p);
    if (p === 'once') {
      onChange('');
      const iso = new Date(dateValue).toISOString();
      onScheduledAtChange(iso);
    } else {
      if (scheduledAt !== null) onScheduledAtChange(null);
      emitCron(p, hour, minute, day, customCron);
    }
  }, [dateValue, hour, minute, day, customCron, scheduledAt, onChange, onScheduledAtChange, emitCron]);

  const handleHourChange = useCallback((h: number) => {
    setHour(h);
    emitCron(preset, h, minute, day, customCron);
  }, [preset, minute, day, customCron, emitCron]);

  const handleMinuteChange = useCallback((m: number) => {
    setMinute(m);
    emitCron(preset, hour, m, day, customCron);
  }, [preset, hour, day, customCron, emitCron]);

  const handleDayChange = useCallback((d: number) => {
    setDay(d);
    emitCron(preset, hour, minute, d, customCron);
  }, [preset, hour, minute, customCron, emitCron]);

  const handleCustomCronChange = useCallback((c: string) => {
    setCustomCron(c);
    if (c !== value) onChange(c);
  }, [value, onChange]);

  const handleDateChange = useCallback((val: string) => {
    setDateValue(val);
  }, []);

  const handleDateBlur = useCallback(() => {
    const iso = new Date(dateValue).toISOString();
    if (iso !== scheduledAt) onScheduledAtChange(iso);
  }, [dateValue, scheduledAt, onScheduledAtChange]);

  const presets: { label: string; value: Preset }[] = [
    { label: 'Manual', value: 'manual' },
    { label: 'Once', value: 'once' },
    { label: 'Hourly', value: 'hourly' },
    { label: 'Daily', value: 'daily' },
    { label: 'Weekdays', value: 'weekdays' },
    { label: 'Weekly', value: 'weekly' },
    { label: 'Custom', value: 'custom' },
  ];

  const showTime = preset === 'daily' || preset === 'weekdays' || preset === 'weekly';
  const showDay = preset === 'weekly';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {presets.map(p => (
          <button
            key={p.value}
            type="button"
            onClick={() => handlePresetChange(p.value)}
            className={`px-2 py-1 text-[11px] rounded transition-colors ${
              preset === p.value
                ? 'bg-zinc-800 text-emerald-400'
                : 'text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800/50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'once' && (
        <input
          type="datetime-local"
          value={dateValue}
          onChange={e => handleDateChange(e.target.value)}
          onBlur={handleDateBlur}
          min={getDefaultDatetime().slice(0, 16)}
          className="px-2 py-1 text-[11px] bg-zinc-900 border border-zinc-800 rounded text-zinc-300 focus:outline-none focus:border-zinc-700"
        />
      )}

      {showTime && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">at</span>
          <input
            type="number"
            min={0}
            max={23}
            value={hour}
            onChange={e => handleHourChange(parseInt(e.target.value) || 0)}
            className="w-12 px-1.5 py-0.5 text-[11px] bg-zinc-900 border border-zinc-800 rounded text-zinc-300 text-center focus:outline-none focus:border-zinc-700"
          />
          <span className="text-[10px] text-zinc-500">:</span>
          <input
            type="number"
            min={0}
            max={59}
            value={minute}
            onChange={e => handleMinuteChange(parseInt(e.target.value) || 0)}
            className="w-12 px-1.5 py-0.5 text-[11px] bg-zinc-900 border border-zinc-800 rounded text-zinc-300 text-center focus:outline-none focus:border-zinc-700"
          />
        </div>
      )}

      {showDay && (
        <div className="flex gap-1">
          {DAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDayChange(i)}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${
                day === i
                  ? 'bg-zinc-800 text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {preset === 'custom' && (
        <input
          type="text"
          value={customCron}
          onChange={e => handleCustomCronChange(e.target.value)}
          placeholder="*/5 * * * *"
          className="w-full px-2 py-1 text-[11px] font-mono bg-zinc-900 border border-zinc-800 rounded text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
        />
      )}
    </div>
  );
}

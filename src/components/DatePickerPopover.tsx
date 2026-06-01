import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { formatDDMMYYYY, isThirdSaturday } from '../utils/scheduler';
import { Holiday } from '../types';

interface DatePickerPopoverProps {
  id: string;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
  highlights?: { date: string; label: string; color: string }[]; // custom indicators
  placeholder?: string;
  disabled?: boolean;
}

export default function DatePickerPopover({
  id,
  value,
  onChange,
  label,
  minDate,
  maxDate,
  highlights = [],
  placeholder = "Select Date",
  disabled = false,
}: DatePickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse value to active month/year view state
  const getCurrentDate = (): Date => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  };

  const currentDateObj = getCurrentDate();
  const [viewYear, setViewYear] = useState(currentDateObj.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(currentDateObj.getUTCMonth()); // 0-indexed

  // Sync state if selected value updates
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getUTCFullYear());
        setViewMonth(d.getUTCMonth());
      }
    }
  }, [value]);

  // Click outside listener to dismiss popup
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calendar grid calculations
  const daysInMonth = (month: number, year: number) => {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  };

  const startDayOfWeek = (month: number, year: number) => {
    return new Date(Date.UTC(year, month, 1)).getUTCDay(); // 0 is Sunday, 1 is Monday, etc.
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const selectedIsoStr = `${viewYear}-${m}-${d}`;
    onChange(selectedIsoStr);
    setIsOpen(false);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const totalDays = daysInMonth(viewMonth, viewYear);
  const startOffset = startDayOfWeek(viewMonth, viewYear);

  // Generate date cells
  const dayCells = [];
  
  // Fill previous month padding cells
  for (let i = 0; i < startOffset; i++) {
    dayCells.push({ day: null, key: `pad-prev-${i}` });
  }

  // Active month days
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const checkDateObj = new Date(Date.UTC(viewYear, viewMonth, d));
    const dayOfWeek = checkDateObj.getUTCDay();

    // Check bounds
    let isClickable = true;
    if (minDate && dateStr < minDate) isClickable = false;
    if (maxDate && dateStr > maxDate) isClickable = false;

    // Check special highlights
    const dayHighlight = highlights.find(h => h.date === dateStr);
    const isThirdSat = isThirdSaturday(checkDateObj);
    const isSunday = dayOfWeek === 0;

    dayCells.push({
      day: d,
      dateStr,
      isClickable,
      isSunday,
      isThirdSat,
      dayHighlight,
      key: `day-${d}`,
      isSelected: value === dateStr,
    });
  }

  // Human friendly displayed value (DD/MM/YYYY)
  const getDisplayValue = () => {
    if (!value) return '';
    const dateObj = new Date(value);
    if (isNaN(dateObj.getTime())) return value;
    return formatDDMMYYYY(dateObj);
  };

  return (
    <div ref={containerRef} className="relative w-full" id={`datepicker-container-${id}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 font-sans">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center justify-between text-left px-3.5 py-2.5 rounded-xl border font-mono text-sm leading-tight transition-all bg-white cursor-pointer ${
            disabled 
              ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' 
              : isOpen
              ? 'border-indigo-600 ring-2 ring-indigo-150 shadow-sm'
              : 'border-slate-300 text-slate-800 hover:border-slate-400'
          }`}
        >
          <span>{getDisplayValue() || placeholder}</span>
          <CalendarIcon className="h-4.5 w-4.5 text-slate-400" />
        </button>

        {isOpen && (
          <div className="absolute left-0 mt-2 w-72 bg-white rounded-2xl border border-slate-250 shadow-xl z-50 p-4 font-sans animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <span className="text-sm font-semibold text-slate-800">
                {monthNames[viewMonth]} {viewYear}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-600"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-600"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Weekday Labels */}
            <div className="grid grid-cols-7 gap-1 text-center text-3xs font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {dayCells.map((cell) => {
                if (cell.day === null) {
                  return <div key={cell.key} className="h-8 w-8" />;
                }

                // Determine highlight style
                let btnClass = 'h-8 w-8 flex items-center justify-center text-xs font-semibold rounded-lg transition-all cursor-pointer ';
                let innerStyle = {};

                if (cell.isSelected) {
                  btnClass += 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-200 ';
                } else if (!cell.isClickable) {
                  btnClass += 'text-slate-300 bg-slate-50 cursor-not-allowed ';
                } else if (cell.isSunday) {
                  btnClass += 'text-rose-500 bg-rose-50/50 hover:bg-rose-100/50 ';
                } else if (cell.isThirdSat) {
                  btnClass += 'text-amber-600 bg-amber-50 hover:bg-amber-100 ';
                } else if (cell.dayHighlight) {
                  btnClass += `text-slate-800 hover:brightness-95 hover:bg-slate-100 `;
                  innerStyle = { 
                    borderBottom: `3px solid ${cell.dayHighlight.color}`, 
                    backgroundColor: `${cell.dayHighlight.color}15`
                  };
                } else {
                  btnClass += 'text-slate-700 hover:bg-slate-100 ';
                }

                return (
                  <button
                    key={cell.key}
                    type="button"
                    disabled={!cell.isClickable}
                    onClick={() => handleSelectDay(cell.day!)}
                    style={innerStyle}
                    className={btnClass}
                    title={cell.dayHighlight?.label || (cell.isThirdSat ? 'Third Saturday' : cell.isSunday ? 'Sunday' : '')}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Visual Legend */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2 text-3xs font-semibold text-slate-500 justify-between">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Sunday
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Skip Sat
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-0.5 rounded bg-sky-500 inline-block" /> Holiday
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

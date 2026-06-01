import React, { useState } from 'react';
import { Calendar, Award, BookOpen, Clock, Plus, Trash2, CalendarX, PlusCircle, Sparkles } from 'lucide-react';
import { SemesterConfig, WeeklyConfig, Holiday, BlockedPeriod } from '../types';
import DatePickerPopover from './DatePickerPopover';

interface ConfigPanelProps {
  config: SemesterConfig;
  onConfigChange: (c: SemesterConfig) => void;
  weekly: WeeklyConfig;
  onWeeklyChange: (w: WeeklyConfig) => void;
  blockedPeriods: BlockedPeriod[];
  onBlockedPeriodsChange: (bp: BlockedPeriod[]) => void;
  manualHolidays: Holiday[];
  onAddManualHoliday: (h: Omit<Holiday, 'id'>) => void;
  onRemoveManualHoliday: (id: string) => void;
  highlights: { date: string; label: string; color: string }[];
}

export default function ConfigPanel({
  config,
  onConfigChange,
  weekly,
  onWeeklyChange,
  blockedPeriods,
  onBlockedPeriodsChange,
  manualHolidays,
  onAddManualHoliday,
  onRemoveManualHoliday,
  highlights,
}: ConfigPanelProps) {
  // Local sessional helpers
  const midExam = blockedPeriods.find(bp => bp.type === 'exam_mid') || {
    name: 'Mid-Sessional Exams',
    startDate: '',
    endDate: '',
    type: 'exam_mid'
  };

  const secExam = blockedPeriods.find(bp => bp.type === 'second_sessional') || {
    name: 'Second Sessional Exams',
    startDate: '',
    endDate: '',
    type: 'second_sessional'
  };

  // Local state for adding holiday
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [holidayError, setHolidayError] = useState('');

  const handleUpdateConfig = (field: keyof SemesterConfig, value: string) => {
    onConfigChange({
      ...config,
      [field]: value,
    });
  };

  const handleUpdateWeekly = (field: keyof WeeklyConfig, value: any) => {
    onWeeklyChange({
      ...weekly,
      [field]: value,
    });
  };

  const toggleDaySelection = (dayIndex: number) => {
    let updatedDays = [...weekly.selectedDays];
    if (updatedDays.includes(dayIndex)) {
      updatedDays = updatedDays.filter(d => d !== dayIndex);
    } else {
      updatedDays.push(dayIndex);
      updatedDays.sort();
    }
    handleUpdateWeekly('selectedDays', updatedDays);
  };

  const handleUpdateBlocked = (type: 'exam_mid' | 'second_sessional', field: 'startDate' | 'endDate', val: string) => {
    const list = [...blockedPeriods];
    const idx = list.findIndex(bp => bp.type === type);
    
    if (idx !== -1) {
      list[idx] = { ...list[idx], [field]: val };
    } else {
      list.push({
        name: type === 'exam_mid' ? 'Mid-Sessional Exams' : 'Second Sessional Exams',
        startDate: field === 'startDate' ? val : '',
        endDate: field === 'endDate' ? val : '',
        type
      });
    }
    onBlockedPeriodsChange(list);
  };

  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    setHolidayError('');
    if (!newHolidayName.trim()) {
      setHolidayError('Please provide a holiday name or description.');
      return;
    }
    if (!newHolidayDate) {
      setHolidayError('Please select a holiday date.');
      return;
    }

    onAddManualHoliday({
      name: newHolidayName.trim(),
      date: newHolidayDate,
      type: 'holiday',
    });

    setNewHolidayName('');
    setNewHolidayDate('');
  };

  const weekdayLabels = [
    { label: 'Mon', index: 1 },
    { label: 'Tue', index: 2 },
    { label: 'Wed', index: 3 },
    { label: 'Thu', index: 4 },
    { label: 'Fri', index: 5 },
    { label: 'Sat', index: 6 },
  ];

  // Auto class count calculation display
  const requiredHours = weekly.credits * 15;
  const classesNeeded = Math.ceil(requiredHours / weekly.lectureDuration);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="config-panel">
      
      {/* COLUMN 1: Academic metadata & duration */}
      <div className="bg-white rounded-2xl border border-slate-250 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <BookOpen className="h-5 w-5 text-indigo-600 font-semibold" />
            <h3 className="font-sans font-semibold text-slate-800 text-base">Course Information</h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-750 uppercase tracking-wider mb-1.5 font-sans">
                Course Title
              </label>
              <input
                id="input-courseTitle"
                type="text"
                placeholder="e.g. Design Systems and Frontend Architecture"
                value={config.courseTitle}
                onChange={(e) => handleUpdateConfig('courseTitle', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-sans text-sm text-slate-800 focus:border-indigo-650 focus:ring-2 focus:ring-indigo-150 transition-all outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-755 uppercase tracking-wider mb-1.5 font-sans">
                  Course Code
                </label>
                <input
                  id="input-courseCode"
                  type="text"
                  placeholder="e.g. CS-402"
                  value={config.courseCode}
                  onChange={(e) => handleUpdateConfig('courseCode', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm text-slate-800 focus:border-indigo-650 focus:ring-2 focus:ring-indigo-150 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-755 uppercase tracking-wider mb-1.5 font-sans">
                  Academic Year
                </label>
                <input
                  id="input-academicYear"
                  type="text"
                  placeholder="e.g. 2026-27"
                  value={config.academicYear}
                  onChange={(e) => handleUpdateConfig('academicYear', e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-sans text-sm text-slate-800 focus:border-indigo-650 focus:ring-2 focus:ring-indigo-150 transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-750 uppercase tracking-wider mb-1.5 font-sans">
                Semester / Phase
              </label>
              <input
                id="input-semesterName"
                type="text"
                placeholder="e.g. Autumn (Semester III)"
                value={config.semesterName}
                onChange={(e) => handleUpdateConfig('semesterName', e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-sans text-sm text-slate-800 focus:border-indigo-650 focus:ring-2 focus:ring-indigo-150 transition-all outline-none"
              />
            </div>

            <div className="border-t border-slate-100 my-2 pt-3" />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <DatePickerPopover
                  id="semester-start"
                  label="Semester Start Date"
                  value={config.startDate}
                  onChange={(val) => handleUpdateConfig('startDate', val)}
                  highlights={highlights}
                  placeholder="dd/mm/yyyy"
                />
              </div>
              <div>
                <DatePickerPopover
                  id="semester-end"
                  label="Semester End Date"
                  value={config.endDate}
                  onChange={(val) => handleUpdateConfig('endDate', val)}
                  highlights={highlights}
                  placeholder="dd/mm/yyyy"
                  minDate={config.startDate}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 flex items-center gap-2 bg-indigo-50/40 border border-indigo-100 rounded-xl p-3">
          <Sparkles className="h-4 w-4 text-indigo-500 shrink-0" />
          <p className="font-sans text-2xs text-indigo-700 leading-normal">
            Calculated calendar dates use the start and end dates as strict scheduler constraints.
          </p>
        </div>
      </div>

      {/* COLUMN 2: Frequency & calculations */}
      <div className="bg-white rounded-2xl border border-slate-250 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <Clock className="h-5 w-5 text-indigo-600 font-semibold" />
            <h3 className="font-sans font-semibold text-slate-800 text-base">Weekly Class Setup</h3>
          </div>

          <div className="grid grid-cols-1 gap-5">
            <div>
              <label className="block text-xs font-semibold text-slate-750 uppercase tracking-wider mb-2 font-sans">
                Weekly Teaching Days
              </label>
              <div className="grid grid-cols-6 gap-1.5" id="weekly-days-group">
                {weekdayLabels.map((day) => {
                  const isDaySelected = weekly.selectedDays.includes(day.index);
                  return (
                    <button
                      key={day.index}
                      type="button"
                      id={`day-btn-${day.index}`}
                      onClick={() => toggleDaySelection(day.index)}
                      className={`py-2 px-1 text-center font-sans text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                        isDaySelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-350 hover:bg-slate-50'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-755 uppercase tracking-wider mb-1.5 font-sans">
                  Credit Hours
                </label>
                <div className="relative">
                  <select
                    id="input-credits"
                    value={weekly.credits}
                    onChange={(e) => handleUpdateWeekly('credits', parseInt(e.target.value, 10))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-sans text-sm text-slate-800 bg-white focus:border-indigo-650 focus:ring-2 focus:ring-indigo-150 transition-all outline-none cursor-pointer"
                  >
                    <option value={1}>1 Credit (15 hrs)</option>
                    <option value={2}>2 Credits (30 hrs)</option>
                    <option value={3}>3 Credits (45 hrs)</option>
                    <option value={4}>4 Credits (60 hrs)</option>
                    <option value={5}>5 Credits (75 hrs)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-755 uppercase tracking-wider mb-1.5 font-sans">
                  Lecture Duration
                </label>
                <select
                  id="input-lectureDuration"
                  value={weekly.lectureDuration}
                  onChange={(e) => handleUpdateWeekly('lectureDuration', parseFloat(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-sans text-sm text-slate-800 bg-white focus:border-indigo-650 focus:ring-2 focus:ring-indigo-150 transition-all outline-none cursor-pointer"
                >
                  <option value={1}>1.0 Hour</option>
                  <option value={1.5}>1.5 Hours</option>
                  <option value={2}>2.0 Hours</option>
                  <option value={3}>3.0 Hours</option>
                </select>
              </div>
            </div>

            {/* Detailed Workload Allocation Subsection */}
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2 font-sans">
                Hours Allocation by Session Type
              </span>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 font-sans text-center">Lecture</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={weekly.lectureHours ?? (weekly.credits * 15)}
                    onChange={(e) => handleUpdateWeekly('lectureHours', parseInt(e.target.value, 10) || 0)}
                    className="w-full px-1.5 py-1.5 rounded-lg border border-slate-300 font-sans text-xs text-slate-800 text-center outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 font-sans text-center">Tutorial</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={weekly.tutorialHours ?? 0}
                    onChange={(e) => handleUpdateWeekly('tutorialHours', parseInt(e.target.value, 10) || 0)}
                    className="w-full px-1.5 py-1.5 rounded-lg border border-slate-300 font-sans text-xs text-slate-800 text-center outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 font-sans text-center">Practical</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={weekly.practicalHours ?? 0}
                    onChange={(e) => handleUpdateWeekly('practicalHours', parseInt(e.target.value, 10) || 0)}
                    className="w-full px-1.5 py-1.5 rounded-lg border border-slate-300 font-sans text-xs text-slate-800 text-center outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-600 mb-1 font-sans text-center">Clinics</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={weekly.clinicsHours ?? 0}
                    onChange={(e) => handleUpdateWeekly('clinicsHours', parseInt(e.target.value, 10) || 0)}
                    className="w-full px-1.5 py-1.5 rounded-lg border border-slate-300 font-sans text-xs text-slate-800 text-center outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 bg-white"
                  />
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-slate-200 text-xs font-semibold text-slate-700 font-sans flex justify-between px-1">
                <span>FACE TO FACE TOTAL:</span>
                <span className="font-mono text-indigo-600 font-bold">
                  {((weekly.lectureHours ?? (weekly.credits * 15)) + (weekly.tutorialHours ?? 0) + (weekly.practicalHours ?? 0) + (weekly.clinicsHours ?? 0))} Hours
                </span>
              </div>
            </div>

            <div className="border-t border-slate-100 my-1 pt-4" />

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-150" id="calculation-output">
              <span className="text-4xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Required Totals Display
              </span>
              <div className="grid grid-cols-2 gap-4 text-center mt-2">
                <div className="bg-white py-2 rounded-lg shadow-2xs border border-slate-200">
                  <span className="block text-xs font-medium text-slate-500">Total Hours</span>
                  <span className="font-mono text-lg font-bold text-slate-800">{requiredHours} hrs</span>
                </div>
                <div className="bg-white py-2 rounded-lg shadow-2xs border border-slate-200">
                  <span className="block text-xs font-medium text-slate-500">Classes Needed</span>
                  <span className="font-mono text-lg font-bold text-indigo-600">{classesNeeded}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 flex items-center gap-2 border-t border-slate-100">
          <Award className="h-5 w-5 text-indigo-500 shrink-0" />
          <p className="font-sans text-2xs text-slate-500 leading-normal">
            1 Credit = 15 lecture hours. The system continues mapping lectures sequentially until classes needed are fully booked.
          </p>
        </div>
      </div>

      {/* COLUMN 3: Sessional blocking & manual holidays */}
      <div className="bg-white rounded-2xl border border-slate-250 p-6 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <CalendarX className="h-5 w-5 text-indigo-600 font-semibold" />
            <h3 className="font-sans font-semibold text-slate-800 text-base">Academic Blocks & Holidays</h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Mid-sessional blockade dates */}
            <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-150">
              <span className="block text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>Mid-Sessional Exams</span>
                <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-150">Block Schedule</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                <DatePickerPopover
                  id="mid-exam-start"
                  placeholder="Start Date"
                  value={midExam.startDate}
                  onChange={(val) => handleUpdateBlocked('exam_mid', 'startDate', val)}
                  highlights={highlights}
                  minDate={config.startDate}
                  maxDate={config.endDate}
                />
                <DatePickerPopover
                  id="mid-exam-end"
                  placeholder="End Date"
                  value={midExam.endDate}
                  onChange={(val) => handleUpdateBlocked('exam_mid', 'endDate', val)}
                  highlights={highlights}
                  minDate={midExam.startDate || config.startDate}
                  maxDate={config.endDate}
                />
              </div>
            </div>

            {/* Second-sessional blockade dates */}
            <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-150">
              <span className="block text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>Second Sessional Exams</span>
                <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-150">Block Schedule</span>
              </span>
              <div className="grid grid-cols-2 gap-2">
                <DatePickerPopover
                  id="sec-exam-start"
                  placeholder="Start Date"
                  value={secExam.startDate}
                  onChange={(val) => handleUpdateBlocked('second_sessional', 'startDate', val)}
                  highlights={highlights}
                  minDate={midExam.endDate || config.startDate}
                  maxDate={config.endDate}
                />
                <DatePickerPopover
                  id="sec-exam-end"
                  placeholder="End Date"
                  value={secExam.endDate}
                  onChange={(val) => handleUpdateBlocked('second_sessional', 'endDate', val)}
                  highlights={highlights}
                  minDate={secExam.startDate || config.startDate}
                  maxDate={config.endDate}
                />
              </div>
            </div>

            {/* Manual Holiday Addition inline form */}
            <form onSubmit={handleAddHoliday} className="border-t border-slate-100 pt-3 flex flex-col gap-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1 font-sans">
                Quick Holiday Add
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="e.g. Founder's Day"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-250 font-sans text-xs text-slate-800 focus:border-indigo-650 outline-none"
                  />
                </div>
                <div className="w-28 shrink-0">
                  <DatePickerPopover
                    id="new-manual-holiday-picker"
                    placeholder="Date"
                    value={newHolidayDate}
                    onChange={(val) => setNewHolidayDate(val)}
                    highlights={highlights}
                    minDate={config.startDate}
                    maxDate={config.endDate}
                  />
                </div>
                <button
                  type="submit"
                  id="add-holiday-btn"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {holidayError && <p className="text-4xs font-semibold text-rose-600 leading-normal">{holidayError}</p>}
            </form>
          </div>
        </div>

        {/* Manual holidays list rendering */}
        {manualHolidays.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <span className="text-4xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
              Manual Exceptions Added ({manualHolidays.length})
            </span>
            <div className="max-h-24 overflow-y-auto flex flex-col gap-1.5 pr-1">
              {manualHolidays.map((holiday) => (
                <div key={holiday.id} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-2xs">
                  <div className="overflow-hidden">
                    <p className="font-semibold text-slate-800 truncate">{holiday.name}</p>
                    <p className="font-mono text-slate-400 mt-0.5">{holiday.date.split('-').reverse().join('/')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveManualHoliday(holiday.id)}
                    className="text-slate-400 hover:text-red-650 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

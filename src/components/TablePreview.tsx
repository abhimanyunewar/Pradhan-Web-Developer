import React, { useState } from 'react';
import { 
  Calendar, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  ToggleLeft, 
  ToggleRight, 
  Undo, 
  Clock, 
  Info, 
  CalendarCheck,
  RotateCcw,
  Lock,
  Shield
} from 'lucide-react';
import { ParsedTable, ParsedRow, GeneratedClass, SkipRecord, AuditLogItem } from '../types';
import DatePickerPopover from './DatePickerPopover';

interface TablePreviewProps {
  tables: ParsedTable[];
  classes: GeneratedClass[];
  skippedDates: SkipRecord[];
  dateMappings: Map<string, string>; // key t-X-r-Y -> Date (DD/MM/YYYY)
  onOverrideDate: (tableIndex: number, rowIndex: number, newDate: string) => void;
  onToggleLectureRow: (tableIndex: number, rowIndex: number) => void;
  onExportDocx: () => void;
  onResetOverrides: () => void;
  isCompleted: boolean;
  totalClassesNeeded: number;
  totalClassesGenerated: number;
  auditLogs: AuditLogItem[];
  highlights: { date: string; label: string; color: string }[];
  semesterEndDate?: string;
}

export default function TablePreview({
  tables,
  classes,
  skippedDates,
  dateMappings,
  onOverrideDate,
  onToggleLectureRow,
  onExportDocx,
  onResetOverrides,
  isCompleted,
  totalClassesNeeded,
  totalClassesGenerated,
  auditLogs,
  highlights,
  semesterEndDate,
}: TablePreviewProps) {
  const [activeTab, setActiveTab] = useState<'tables' | 'skipped' | 'logs'>('tables');
  const [expandedTables, setExpandedTables] = useState<Record<number, boolean>>({ 0: true });

  const toggleTableExpand = (idx: number) => {
    setExpandedTables(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Count active lecture rows in tables
  let lectureRowGlobalIndex = 0;

  // Render a cell's contents
  const renderCellContent = (cellTxt: string, colIdx: number, row: ParsedRow, tIdx: number, calculatedDate: string | null) => {
    // If it's the date column and is a lecture row, render interactive date picker / badge
    const isDateCol = colIdx === (row.dateColIdx !== undefined && row.dateColIdx !== -1 ? row.dateColIdx : 4);
    if (isDateCol && row.isLectureRow) {
      const key = `t-${tIdx}-r-${row.index}`;
      const activeDateVal = dateMappings.get(key) || ''; // DD/MM/YYYY formatted

      // Let's convert DD/MM/YYYY to YYYY-MM-DD for the date picker
      let isoDate = '';
      if (activeDateVal) {
        const parts = activeDateVal.split('/');
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      return (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <div className="w-40 shrink-0">
            <DatePickerPopover
              id={`table-date-picker-${tIdx}-${row.index}`}
              placeholder="Assign class"
              value={isoDate}
              onChange={(newIsoDate) => {
                // Formatting back to DD/MM/YYYY
                const parts = newIsoDate.split('-');
                if (parts.length === 3) {
                  const ddmmyyyy = `${parts[2]}/${parts[1]}/${parts[0]}`;
                  onOverrideDate(tIdx, row.index, ddmmyyyy);
                }
              }}
              highlights={highlights}
            />
          </div>
          {dateMappings.has(key) && (
            <span className="text-4xs font-bold leading-none bg-indigo-50 border border-indigo-150 text-indigo-700 px-1 py-0.5 rounded" title="Manually Edited">
              EDITED
            </span>
          )}
        </div>
      );
    }

    // Default text cell display
    return (
      <span className={`line-clamp-4 font-sans text-xs ${colIdx === 0 ? 'font-mono' : ''}`}>
        {cellTxt}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-250 p-6 shadow-sm mb-12" id="preview-viewport">
      
      {/* SECTION HEADER: Status indicators and primary CTA actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <h2 className="font-sans font-semibold text-slate-800 text-lg flex items-center gap-2">
            <Calendar className="h-5.5 w-5.5 text-indigo-600 font-bold" />
            Calendar Scheduling Preview
          </h2>
          <p className="font-sans text-xs text-slate-500 mt-1">
            Reconciled schedule mapping. Verify dates and export the final document.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {dateMappings.size > 0 && (
            <button
              onClick={onResetOverrides}
              id="reset-preview-btn"
              className="flex items-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-600 hover:text-indigo-600 border border-slate-200 hover:border-indigo-150 rounded-xl transition-all cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" /> Reset Edits
            </button>
          )}

          <button
            onClick={onExportDocx}
            id="export-docx-btn"
            className="flex items-center gap-1.5 py-2.5 px-5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm cursor-pointer hover:shadow"
          >
            <Download className="h-4 w-4" /> Export Updated .docx
          </button>
        </div>
      </div>

      {/* COMPLETED NOTIFICATIONS & WARNINGS PANEL */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div id="reconciliation-badge" className={`p-4 rounded-xl border flex items-start gap-3 ${
            isCompleted 
              ? 'bg-emerald-50/60 border-emerald-100 text-emerald-800' 
              : 'bg-rose-50/60 border-rose-100 text-rose-800'
          }`}>
            <div className="mt-0.5">
              {isCompleted ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
              )}
            </div>
            <div>
              <h4 className="font-sans font-semibold text-sm">
                {isCompleted ? 'Calculations Reconciled' : 'Academic Span Deficit Warning'}
              </h4>
              <p className="font-sans text-xs opacity-90 mt-1 leading-normal">
                {isCompleted 
                  ? `Successfully booked all ${totalClassesNeeded} required lectures within the semester duration without conflicts.`
                  : `We could only fit ${totalClassesGenerated} of ${totalClassesNeeded} required lectures. Expand the semester end date, add weekly teaching days, or lessen sessional blocks.`
                }
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <Clock className="text-indigo-600 h-5 w-5" />
              <div className="shrink-0 text-left">
                <span className="block text-3xs font-bold text-slate-400 uppercase tracking-widest leading-none">Mapping State</span>
                <span className="font-sans text-xs font-semibold text-slate-700 mt-1 block">Scheduled vs Target Lectures</span>
              </div>
            </div>
            <div className="font-mono text-medium font-bold text-slate-800 shrink-0">
              {totalClassesGenerated} / {totalClassesNeeded} Lectures
            </div>
          </div>
        </div>

        {/* COMPREHENSIVE ALERTS ROUTER (SPECIAL EVENT & LECTURE LIMITS WARNINGS) */}
        {(() => {
          const templateLectureSlots = tables
            .filter(t => t.isEditable !== false)
            .reduce((acc, t) => acc + t.rows.filter(r => r.isLectureRow).length, 0);

          const holidaysSkippedCount = skippedDates.filter(s => s.type === 'holiday').length;
          const examsSkippedCount = skippedDates.filter(s => s.type === 'exam').length;
          
          const hasMismatch = templateLectureSlots !== totalClassesNeeded;
          const hasInsufficientDays = !isCompleted;
          const hasHolidayImpact = !isCompleted && holidaysSkippedCount > 3;

          if (hasMismatch || hasInsufficientDays || hasHolidayImpact) {
            return (
              <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-5 space-y-3.5 text-amber-900">
                <div className="flex items-center gap-2 border-b border-amber-200/50 pb-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <h4 className="font-sans font-bold text-xs uppercase tracking-wider">
                    Academic Scheduling Alerts & Warning Analysis
                  </h4>
                </div>
                
                <ul className="text-xs space-y-2.5 list-disc pl-5 leading-normal">
                  {hasMismatch && (
                    <li>
                      <span className="font-semibold">Syllabus Template Structure Mismatch</span>: The uploaded Word template contains <span className="font-mono font-bold">{templateLectureSlots}</span> editable lecture slots, but your configured credits/hours target requires <span className="font-mono font-bold">{totalClassesNeeded}</span> sessions. 
                      {templateLectureSlots < totalClassesNeeded ? (
                        <span className="block mt-0.5 text-slate-500 font-medium">The exported document can only write up to cell bounds. Toggle more rows to 'Class Slot' or update hours to align.</span>
                      ) : (
                        <span className="block mt-0.5 text-slate-500 font-medium">We will leave the remaining {templateLectureSlots - totalClassesNeeded} slot cells untouched as blank or original state.</span>
                      )}
                    </li>
                  )}
                  {hasInsufficientDays && (
                    <li>
                      <span className="font-semibold">Insufficient Teaching Days Available</span>: Confirmed weekly teaching pattern cannot fit the target number of sessions (<span className="font-bold">{totalClassesNeeded}</span>) before the semester ends on <span className="font-mono font-bold">{semesterEndDate ? semesterEndDate.split('-').reverse().join('/') : 'the configured end date'}</span>. Some schedule items remain <span className="underline font-bold">Unscheduled</span>.
                    </li>
                  )}
                  {hasHolidayImpact && (
                    <li>
                      <span className="font-semibold">High Holiday Exclusion Density</span>: A volume of <span className="font-mono font-bold">{holidaysSkippedCount}</span> classes was skipped due to public holidays, plus <span className="font-mono font-bold">{examsSkippedCount}</span> days in sessional exam blocks. This significantly reduced available lecture days.
                    </li>
                  )}
                </ul>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* PANELS CONTROL TABS */}
      <div className="flex border-b border-slate-200 mb-6 font-sans">
        <button
          onClick={() => setActiveTab('tables')}
          className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === 'tables' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Schedule Tables View
        </button>
        <button
          onClick={() => setActiveTab('skipped')}
          className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'skipped' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Calendar Skipped Entries
          <span className="bg-slate-100 border border-slate-150 text-slate-600 text-3xs font-bold font-mono px-1.5 py-0.5 rounded-full">
            {skippedDates.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-3 px-4 text-sm font-semibold transition-all border-b-2 cursor-pointer ${
            activeTab === 'logs' 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Audit History Trail
        </button>
      </div>

      {/* VIEWPORT CONTROLLER */}
      {activeTab === 'tables' && (
        <div className="flex flex-col gap-6">
          {tables.map((table) => {
            const isExpanded = expandedTables[table.index] ?? true;
            const isTableEditable = table.isEditable !== false;

            return (
              <div 
                key={table.index} 
                className={`border rounded-2xl overflow-hidden shadow-sm transition-all ${
                  isTableEditable 
                    ? 'border-slate-250 bg-white' 
                    : 'border-amber-200/60 bg-amber-50/5'
                }`}
              >
                
                {/* Table toggle bar */}
                <div 
                  onClick={() => toggleTableExpand(table.index)}
                  className={`px-5 py-4 flex items-center justify-between border-b cursor-pointer transition-colors ${
                    isTableEditable 
                      ? 'bg-slate-50 border-slate-200 hover:bg-slate-100/50' 
                      : 'bg-amber-50/30 border-amber-150 hover:bg-amber-100/20'
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-left">
                    {isTableEditable ? (
                      <FileText className="h-5 w-5 text-indigo-600 shrink-0" />
                    ) : (
                      <Shield className="h-5 w-5 text-amber-600 shrink-0" />
                    )}
                    <div>
                      <h3 className="font-sans font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                        {isTableEditable ? `Schedule Table #${table.index + 1}` : 'Course Information Table (Protected Section)'}
                        {!isTableEditable && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 font-bold uppercase tracking-wider">
                            <Lock className="h-2.5 w-2.5 font-bold" /> Locked
                          </span>
                        )}
                      </h3>
                      <p className="font-sans text-4xs font-bold text-slate-400 uppercase tracking-widest mt-0.5 pb-1">
                        {isTableEditable ? (
                          `${table.rows.filter(r => r.isLectureRow).length} Lecture Blocks Identified`
                        ) : (
                          'Preserved completely in original parsed structure without modifications'
                        )}
                      </p>
                    </div>
                  </div>
                  <button className="text-slate-500 p-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {/* Table main rows */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-3xs font-bold text-slate-500 uppercase tracking-wider">
                          <th className="py-3 px-4 w-16 text-center font-sans border-r border-slate-200">Role</th>
                          {table.rows[0]?.cells.map((cellText, idx) => {
                            const dateColIdx = table.rows.find(r => r.dateColIdx !== undefined && r.dateColIdx !== -1)?.dateColIdx ?? 4;
                            const isDateCol = idx === dateColIdx;
                            return (
                              <th 
                                key={idx} 
                                className={`py-3 px-4 font-sans ${
                                  idx === 0 ? 'w-20 text-center border-r border-slate-200' :
                                  idx === 1 ? 'w-24 text-center border-r border-slate-200' :
                                  isDateCol ? 'w-60 text-center bg-slate-100/40' : 'border-r border-slate-200'
                                }`}
                              >
                                {isDateCol ? 'Generated Date' : cellText}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {table.rows.slice(1).map((row) => {
                          let calculatedDate: string | null = null;
                          let lectureIndexText = '';
                          
                          if (row.isLectureRow) {
                            lectureRowGlobalIndex++;
                            const matchedClass = classes[lectureRowGlobalIndex - 1];
                            calculatedDate = matchedClass ? matchedClass.formattedDate : null;
                            if (matchedClass) {
                              lectureIndexText = `Lec #${matchedClass.lectureIndex}`;
                            }
                          }

                          return (
                            <tr 
                              key={row.index} 
                              className={`group hover:bg-slate-50/50 transition-colors ${
                                row.isLectureRow 
                                  ? 'bg-white font-medium' 
                                  : isTableEditable 
                                  ? 'bg-stone-50/30 text-slate-500 font-sans italic text-2xs'
                                  : 'text-slate-700 font-sans font-medium text-xs bg-white'
                              }`}
                            >
                              {/* Interaction toggle (Lecture row vs Static row) */}
                              <td className="py-3 px-4 text-center border-r border-slate-100">
                                {isTableEditable ? (
                                  <button
                                    type="button"
                                    onClick={() => onToggleLectureRow(table.index, row.index)}
                                    title={row.isLectureRow ? "Active Class Slot (Sequential replacement)" : "Static row (Ignored by scheduler)"}
                                    className="text-slate-400 hover:text-indigo-600 transition-colors p-1 rounded hover:bg-slate-100 cursor-pointer inline-block"
                                  >
                                    {row.isLectureRow ? (
                                      <ToggleRight className="h-6 w-6 text-indigo-600" />
                                    ) : (
                                      <ToggleLeft className="h-6 w-6 text-slate-300" />
                                    )}
                                  </button>
                                ) : (
                                  <span title="Protected Section (Safe locked Course Info)" className="inline-flex p-1 bg-slate-100 rounded text-slate-400">
                                    <Lock className="h-3.5 w-3.5 shrink-0" />
                                  </span>
                                )}
                              </td>

                              {row.cells.map((cellText, idx) => {
                                const isDateCol = idx === (row.dateColIdx !== undefined && row.dateColIdx !== -1 ? row.dateColIdx : 4);

                                if (idx === 0) {
                                  return (
                                    <td key={idx} className="py-3 px-4 font-mono text-xs text-center border-r border-slate-100">
                                      {row.isLectureRow && lectureIndexText ? (
                                        <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded bg-indigo-50 border border-indigo-150 text-indigo-700 text-3xs">
                                          {lectureIndexText}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">{cellText || '-'}</span>
                                      )}
                                    </td>
                                  );
                                }

                                if (idx === 1) {
                                  return (
                                    <td key={idx} className="py-3 px-4 font-sans text-xs text-center border-r border-slate-100">
                                      <span className="font-semibold text-slate-700">{cellText || '-'}</span>
                                    </td>
                                  );
                                }

                                // Mode of Delivery style-badge helper
                                if (!isDateCol) {
                                  const isModeOfDelivery = idx === 3 && row.cells.length === 5;
                                  return (
                                    <td key={idx} className={`py-3 px-4 border-r border-slate-100 ${isModeOfDelivery ? 'text-center font-sans text-xs' : ''}`}>
                                      {isModeOfDelivery ? (
                                        <span className={`px-2 py-0.5 rounded text-3xs font-semibold ${
                                          cellText?.toLowerCase() === 'practical' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                          cellText?.toLowerCase() === 'tutorial' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                          'bg-blue-50 text-blue-700 border border-blue-100'
                                        }`}>
                                          {cellText || 'Lecture'}
                                        </span>
                                      ) : (
                                        renderCellContent(cellText || '', idx, row, table.index, calculatedDate)
                                      )}
                                    </td>
                                  );
                                }

                                // Date field
                                return (
                                  <td key={idx} className="py-3 px-4 bg-indigo-50/10 text-center">
                                    {renderCellContent(cellText || '', idx, row, table.index, calculatedDate)}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'skipped' && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">
            <h3 className="font-sans font-semibold text-slate-800 text-sm">
              Academic Holidays & Closed dates Skipped
            </h3>
            <p className="font-sans text-4xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Dates scheduled on Sundays, Saturdays, or Sessional Exams have been systematically bypassed.
            </p>
          </div>
          {skippedDates.length === 0 ? (
            <div className="p-12 text-center">
              <CalendarCheck className="h-10 w-10 text-slate-405 mx-auto mb-3" />
              <p className="font-sans text-sm font-semibold text-slate-700">No dates were skipped!</p>
              <p className="font-sans text-xs text-slate-400 mt-1">Change dates or block options to test.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-3xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-5 w-44 font-sans">Calendar Date</th>
                    <th className="py-3 px-5 w-36 font-sans">Day Of Week</th>
                    <th className="py-3 px-5 font-sans">Exclusion Event description / Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 font-sans text-xs">
                  {skippedDates.map((record, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-medium text-slate-700">
                        {record.date.split('-').reverse().join('/')}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500">
                        {record.dayOfWeek}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-3xs font-semibold uppercase tracking-wider ${
                          record.type === 'holiday' 
                            ? 'bg-sky-50 text-sky-700 border border-sky-100'
                            : record.type === 'exam'
                            ? 'bg-pink-50 text-pink-700 border border-pink-100'
                            : record.type === 'third_saturday'
                            ? 'bg-amber-50 text-amber-700 border border-amber-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-100'
                        }`}>
                          {record.reason}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">
            <h3 className="font-sans font-semibold text-slate-800 text-sm">
              Actions and Date Overrides Audit Trail
            </h3>
            <p className="font-sans text-4xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Live updates tracking during sessions to ensure high academic standards.
            </p>
          </div>
          {auditLogs.length === 0 ? (
            <div className="p-12 text-center font-sans">
              <Info className="h-10 w-10 text-slate-350 mx-auto mb-3" />
              <p className="font-sm font-semibold text-slate-705">No edits made yet</p>
              <p className="text-xs text-slate-400 mt-1">Double click date values inside grids to override dates.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-150">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start justify-between p-4 font-sans hover:bg-slate-50/40 transition-colors">
                  <div className="text-left text-xs max-w-2xl">
                    <p className="font-semibold text-slate-800">{log.action}</p>
                    <p className="text-slate-500 mt-1 leading-normal">{log.details}</p>
                  </div>
                  <div className="font-mono text-4xs font-bold text-slate-400 uppercase shrink-0 text-right mt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

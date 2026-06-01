/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FileText, 
  CalendarRange, 
  Trash2, 
  RotateCcw, 
  BookOpen, 
  AlertCircle, 
  CheckCircle2, 
  History, 
  Share2, 
  Download,
  Info
} from 'lucide-react';

import { 
  SemesterConfig, 
  WeeklyConfig, 
  Holiday, 
  BlockedPeriod, 
  ParsedTable, 
  AuditLogItem, 
  GeneratedClass, 
  SkipRecord 
} from './types';

import { 
  generateSchedule, 
  formatYYYYMMDD, 
  formatDDMMYYYY 
} from './utils/scheduler';

import { 
  rebuildDocxFile 
} from './utils/docxParser';

import { 
  getSampleParsedTables, 
  getSampleCourseConfig, 
  getSampleWeeklyConfig, 
  getSampleHolidays, 
  createStandardDocx 
} from './utils/docxGenerator';

import UploadSection from './components/UploadSection';
import ConfigPanel from './components/ConfigPanel';
import TablePreview from './components/TablePreview';

// Helper to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

export default function App() {
  // 1. Core State
  const [config, setConfig] = useState<SemesterConfig>({
    courseTitle: 'Clinical Radiography & Special Procedures',
    courseCode: 'MIT-401',
    semesterName: 'Fifth Semester',
    academicYear: '2026-27',
    startDate: '2026-08-10',
    endDate: '2026-10-30',
  });

  const [weekly, setWeekly] = useState<WeeklyConfig>({
    selectedDays: [2, 4], // Tuesday, Thursday default
    lectureDuration: 1.5,
    credits: 2,
    lectureHours: 30,
    tutorialHours: 0,
    practicalHours: 0,
    clinicsHours: 0
  });

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [manualHolidays, setManualHolidays] = useState<Holiday[]>([]);
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([
    { name: 'Mid-Sessional Exams', startDate: '2026-09-14', endDate: '2026-09-19', type: 'exam_mid' },
    { name: 'Second Sessional Exams', startDate: '2026-10-12', endDate: '2026-10-17', type: 'second_sessional' },
  ]);

  // Document states
  const [docxFile, setDocxFile] = useState<File | null>(null);
  const [docxParserRef, setDocxParserRef] = useState<any>(null); // holds parsed ZIP + DOM state
  const [tables, setTables] = useState<ParsedTable[]>([]);
  const [loadedDocxName, setLoadedDocxName] = useState<string | null>(null);

  // Overrides & auditing
  const [dateOverrides, setDateOverrides] = useState<Map<string, string>>(new Map()); // t-X-r-Y -> date string (DD/MM/YYYY)
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  
  // Track first run for loading a sample automatically or showing welcome info
  const [isUsingSample, setIsUsingSample] = useState(true);

  // Submit and Calculation Center indicators
  const [isCalculatedDirty, setIsCalculatedDirty] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>('');
  const [isFirstRender, setIsFirstRender] = useState(true);

  // Logging function
  const logAction = (action: string, details: string) => {
    const newItem: AuditLogItem = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      action,
      details,
    };
    setAuditLogs(prev => [newItem, ...prev].slice(0, 50)); // Max 50 records
  };

  // 2. Load LocalStorage backup on boot or fall back to high-quality default
  useEffect(() => {
    const initWorkspace = async () => {
      try {
        const savedConfig = localStorage.getItem('schedule_config');
        const savedWeekly = localStorage.getItem('schedule_weekly');
        const savedHolidays = localStorage.getItem('schedule_holidays');
        const savedBlocked = localStorage.getItem('schedule_blocked');
        const savedManualHolidays = localStorage.getItem('schedule_manual_holidays');
        const savedTables = localStorage.getItem('schedule_tables');
        const savedDocxName = localStorage.getItem('schedule_docx_name');
        const savedDocxBase64 = localStorage.getItem('schedule_docx_base64');

        if (savedConfig) setConfig(JSON.parse(savedConfig));
        if (savedWeekly) setWeekly(JSON.parse(savedWeekly));
        if (savedHolidays) setHolidays(JSON.parse(savedHolidays));
        if (savedBlocked) setBlockedPeriods(JSON.parse(savedBlocked));
        if (savedManualHolidays) setManualHolidays(JSON.parse(savedManualHolidays));

        if (savedDocxBase64 && savedDocxName) {
          try {
            // Convert base64 back to file object
            const byteCharacters = atob(savedDocxBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            const fileObj = new File([blob], savedDocxName, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

            const { parseDocxFile } = await import('./utils/docxParser');
            const parsed = await parseDocxFile(fileObj);

            setDocxFile(fileObj);
            setTables(parsed.tables);
            setDocxParserRef(parsed);
            setLoadedDocxName(savedDocxName);
            setIsUsingSample(false);
            console.log('Successfully re-parsed saved base64 docx template:', savedDocxName);
          } catch (rebuildErr) {
            console.error('Failed to parse cached docx base64. Falling back to table cache:', rebuildErr);
            if (savedTables) {
              setTables(JSON.parse(savedTables));
            }
            setLoadedDocxName(savedDocxName);
            setIsUsingSample(savedDocxName === 'Standard_Syllabus_Template.docx');
          }
        } else if (savedTables && savedDocxName) {
          setTables(JSON.parse(savedTables));
          setLoadedDocxName(savedDocxName);
          setIsUsingSample(savedDocxName === 'Standard_Syllabus_Template.docx');
        } else {
          // First-run experience: auto populate beautiful default syllabus skeleton so review section works with zero manual upload barriers!
          const defaultTables = getSampleParsedTables();
          setTables(defaultTables);
          setLoadedDocxName('Standard_Syllabus_Template.docx');
          setIsUsingSample(true);
          setHolidays(getSampleHolidays().map(h => ({ ...h, id: generateId() })));
        }

        setLastUpdatedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        logAction('App Initialization', 'Restored previous scheduling workspace parameters from local store auto-backup.');
      } catch (e) {
        console.error('Error recovering cached workspace', e);
      }
    };

    initWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Auto Backup changes to LocalStorage and trigger dirty calculation state on user modifications
  useEffect(() => {
    if (isFirstRender) {
      setIsFirstRender(false);
      return;
    }
    setIsCalculatedDirty(true);
  }, [config, weekly, holidays, manualHolidays, blockedPeriods]);

  useEffect(() => {
    if (config.startDate) localStorage.setItem('schedule_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('schedule_weekly', JSON.stringify(weekly));
  }, [weekly]);

  useEffect(() => {
    localStorage.setItem('schedule_holidays', JSON.stringify(holidays));
  }, [holidays]);

  useEffect(() => {
    localStorage.setItem('schedule_blocked', JSON.stringify(blockedPeriods));
  }, [blockedPeriods]);

  useEffect(() => {
    localStorage.setItem('schedule_manual_holidays', JSON.stringify(manualHolidays));
  }, [manualHolidays]);

  useEffect(() => {
    if (tables.length > 0) {
      localStorage.setItem('schedule_tables', JSON.stringify(tables));
    }
    if (loadedDocxName) {
      localStorage.setItem('schedule_docx_name', loadedDocxName);
    }
  }, [tables, loadedDocxName]);

  // 4. File Handlers
  const handleDocxLoaded = (file: File, parsedTables: ParsedTable[], rawParserRef: any) => {
    if (!file) {
      // Clear document
      setDocxFile(null);
      setDocxParserRef(null);
      setTables([]);
      setLoadedDocxName(null);
      setDateOverrides(new Map());
      setIsUsingSample(false);
      localStorage.removeItem('schedule_docx_base64');
      logAction('Template Removed', 'Cleared current Microsoft Word schema template.');
      return;
    }

    setDocxFile(file);
    setTables(parsedTables);
    setDocxParserRef(rawParserRef);
    setLoadedDocxName(file.name);
    setIsUsingSample(false);
    setDateOverrides(new Map()); // clear overrides for new document

    // Save actual file content as base64 to localStorage for persistence across publishes/reloads
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        localStorage.setItem('schedule_docx_base64', base64);
      };
      reader.readAsDataURL(file);
    } catch (e) {
      console.error('Failed to store document in localStorage:', e);
    }

    logAction(
      'Template Imported',
      `Uploaded and successfully compiled "${file.name}" containing ${parsedTables.length} schedule tables.`
    );
  };

  const handleHolidaysLoaded = (importedHolidays: Omit<Holiday, 'id'>[]) => {
    if (importedHolidays.length === 0) {
      setHolidays([]);
      logAction('Holidays Reset', 'Cleared university holiday exclusion filters.');
      return;
    }

    const holidaysWithId: Holiday[] = importedHolidays.map((h) => ({
      ...h,
      id: generateId(),
    }));

    setHolidays(holidaysWithId);
    logAction(
      'Holidays Imported',
      `Imported university holiday planner list with ${importedHolidays.length} active event exclusions.`
    );
  };

  const handleAddManualHoliday = (h: Omit<Holiday, 'id'>) => {
    const newHItem: Holiday = {
      ...h,
      id: generateId(),
    };
    setManualHolidays(prev => [...prev, newHItem]);
    logAction(
      'Holiday Exception Added',
      `Registered "${h.name}" on ${h.date.split('-').reverse().join('/')} as a hard schedule exclusion day.`
    );
  };

  const handleRemoveManualHoliday = (id: string) => {
    const found = manualHolidays.find(h => h.id === id);
    setManualHolidays(prev => prev.filter(h => h.id !== id));
    if (found) {
      logAction(
        'Holiday Exception Removed',
        `Restored class scheduling permissions on ${found.date.split('-').reverse().join('/')} ("${found.name}").`
      );
    }
  };

  // 5. Load Built-In Sample Template (for instant testability)
  const handleLoadSample = () => {
    const sampleTables = getSampleParsedTables();
    const sampleConfig = getSampleCourseConfig();
    const sampleWeekly = getSampleWeeklyConfig();
    const sampleHolidays = getSampleHolidays().map(h => ({
      ...h,
      id: generateId(),
    })) as Holiday[];

    setConfig(sampleConfig);
    setWeekly(sampleWeekly);
    setHolidays(sampleHolidays);
    setTables(sampleTables);
    setLoadedDocxName('Core_University_Syllabus_Template.docx');
    setDocxFile(null); // mock file
    setDocxParserRef(null);
    setIsUsingSample(true);
    setDateOverrides(new Map());
    localStorage.removeItem('schedule_docx_base64');

    logAction('Sample Template Loaded', 'Loaded industrial mock UI course template ("User Interface Engineering") and calendar preset.');
  };

  // 6. Interactive Day overrides / Toggles
  const handleOverrideDate = (tableIdx: number, rowIdx: number, ddmmyyyyDateStr: string) => {
    const key = `t-${tableIdx}-r-${rowIdx}`;
    setDateOverrides(prev => {
      const nextMap = new Map(prev);
      nextMap.set(key, ddmmyyyyDateStr);
      return nextMap;
    });

    logAction(
      'Manual Date Override',
      `Overrode Table #${tableIdx + 1}, Row #${rowIdx + 1} appointment schedule to custom date: ${ddmmyyyyDateStr}.`
    );
  };

  const handleToggleLectureRow = (tableIdx: number, rowIdx: number) => {
    setTables(prevTables => {
      return prevTables.map((t, tIdx) => {
        if (tIdx !== tableIdx) return t;
        return {
          ...t,
          rows: t.rows.map((r, rIdx) => {
            if (rIdx !== rowIdx) return r;
            const nextState = !r.isLectureRow;
            logAction(
              'Row Role Toggled',
              `Marked Table #${tableIdx + 1}, Row #${rowIdx + 1} as ${nextState ? 'Class Slot' : 'Static Item'}.`
            );
            return {
              ...r,
              isLectureRow: nextState,
            };
          }),
        };
      });
    });
  };

  const handleResetOverrides = () => {
    setDateOverrides(new Map());
    logAction('Schedule Reset', 'Wiped all custom cell-level manual date overrides, returning to sequential calculations.');
  };

  // 7. Combined Scheduling Calculations
  // Compile all holidays and exceptions
  const activeExclusionHolidays = useMemo(() => {
    return [...holidays, ...manualHolidays];
  }, [holidays, manualHolidays]);

  const scheduleResult = useMemo(() => {
    return generateSchedule(config, weekly, activeExclusionHolidays, blockedPeriods);
  }, [config, weekly, activeExclusionHolidays, blockedPeriods]);

  // Prepare full date maps (merging sequential calculations & cell manual overrides)
  const finalDateMappings = useMemo(() => {
    const mappings = new Map<string, string>();
    let generatedClassIndex = 0;

    tables.forEach((t) => {
      t.rows.forEach((r) => {
        if (r.isLectureRow) {
          const key = `t-${t.index}-r-${r.index}`;
          // Prioritize manual override
          if (dateOverrides.has(key)) {
            mappings.set(key, dateOverrides.get(key) || '');
          } else {
            // Sequential date allocation
            const matchedClass = scheduleResult.classes[generatedClassIndex];
            if (matchedClass) {
              mappings.set(key, matchedClass.formattedDate);
            } else {
              mappings.set(key, 'Unscheduled');
            }
          }
          generatedClassIndex++;
        }
      });
    });

    return mappings;
  }, [tables, dateOverrides, scheduleResult.classes]);

  // Calendar dates highlights index list for the custom DatePicker components
  const calendarHighlights = useMemo(() => {
    const list: { date: string; label: string; color: string }[] = [];

    // Map holidays
    activeExclusionHolidays.forEach((h) => {
      list.push({ date: h.date, label: `Holiday: ${h.name}`, color: '#0ea5e9' }); // sky-500
    });

    // Map sessional blocks
    blockedPeriods.forEach((bp) => {
      if (bp.startDate && bp.endDate) {
        // Simple loop to add all dates in sessional block
        const curr = new Date(bp.startDate);
        const limit = new Date(bp.endDate);
        let safetyCount = 0;
        while (curr <= limit && safetyCount < 30) {
          safetyCount++;
          list.push({
            date: formatYYYYMMDD(curr),
            label: `Exam Period: ${bp.name}`,
            color: '#ec4899', // pink-500
          });
          curr.setDate(curr.getDate() + 1);
        }
      }
    });

    return list;
  }, [activeExclusionHolidays, blockedPeriods]);

  // 8. Document Exporter
  const handleExportDocx = async () => {
    try {
      let docBlob: Blob;

      if (isUsingSample || !docxParserRef) {
        // Generate document completely from scratch
        logAction('Export Started', 'Compiling whole new standard academic Word schema matching requested sequential layout.');
        docBlob = await createStandardDocx(
          tables,
          config.courseTitle,
          config.courseCode,
          config.academicYear,
          config.semesterName,
          weekly.lectureHours,
          weekly.tutorialHours,
          weekly.practicalHours,
          weekly.clinicsHours,
          weekly.credits
        );
        // We still need to replace dates in-place in that generated document
        const newRef = {
          zip: await import('jszip').then(m => new m.default()),
          xmlDoc: new DOMParser().parseFromString(
            await docBlob.arrayBuffer().then(b => new TextDecoder().decode(b)),
            "application/xml"
          ),
          tables,
          xmlString: '',
        };
        // wait, let's parse the newly created standard docx so we replace dates beautifully
        const { parseDocxFile } = await import('./utils/docxParser');
        const fileObj = new File([docBlob], 'temp.docx');
        const tempParsed = await parseDocxFile(fileObj);
        docBlob = await rebuildDocxFile(tempParsed, tables, finalDateMappings);
      } else {
        // Rebuild existing file with updated dates
        logAction('Export Started', 'Packaging updated tables structure into original document format container.');
        docBlob = await rebuildDocxFile(docxParserRef, tables, finalDateMappings);
      }

      // Download file in browser
      const cleanFileName = (config.courseCode || 'Course') + '_Schedule_Updated.docx';
      const downloadUrl = window.URL.createObjectURL(docBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = cleanFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      logAction('Export Completed', `Successfully serialized and exported "${cleanFileName}" download to filesystem.`);
    } catch (e: any) {
      console.error('Export failed', e);
      logAction('Export Failure', `Error during package recompilation: ${e.message}`);
    }
  };

  return (
    <div id="application-container" className="min-h-screen bg-slate-50 text-slate-850 p-4 md:p-8 font-sans antialiased text-left select-text">
      
      {/* GLOBAL BANNER */}
      <header className="max-w-7xl mx-auto mb-8 bg-white rounded-2xl border border-slate-250 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-md">
            <BookOpen className="h-6 w-6 font-bold" />
          </div>
          <div>
            <h1 className="font-sans font-bold text-2xl tracking-tight text-slate-900">
              Semester Class Schedule Generator
            </h1>
            <p className="font-sans text-xs text-slate-400 mt-1">
              Automated in-place Word schedule modifier for university faculty members.
            </p>
          </div>
        </div>

        {loadedDocxName && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-205">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-505 animate-pulse" />
            <span className="font-mono text-2xs font-semibold text-slate-600 truncate max-w-44" title={loadedDocxName}>
              {loadedDocxName}
            </span>
          </div>
        )}
      </header>

      {/* CORE WORKSPACE CONTENT */}
      <main className="max-w-7xl mx-auto space-y-8">
        
        {/* STEP 1: Upload Documents Section */}
        <section id="step-one-uploads">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-white text-3xs font-bold">1</span>
            <h2 className="font-sans font-semibold text-slate-800 text-sm uppercase tracking-wide">
              Document Setup & Reference Files
            </h2>
          </div>
          <UploadSection
            onDocxLoaded={handleDocxLoaded}
            onHolidaysLoaded={handleHolidaysLoaded}
            onLoadSample={handleLoadSample}
            loadedDocxName={loadedDocxName}
            loadedHolidaysCount={holidays.length > 0 ? holidays.length : null}
            tableCount={tables.length}
            rowCount={tables.reduce((acc, t) => acc + t.rows.length, 0)}
          />
        </section>

        {/* STEP 2: Parameters Panel */}
        <section id="step-two-parameters">
          <div className="flex items-center gap-2 mb-4">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-white text-3xs font-bold">2</span>
            <h2 className="font-sans font-semibold text-slate-800 text-sm uppercase tracking-wide">
              Semester Rules & Constraints Configuration
            </h2>
          </div>
          <ConfigPanel
            config={config}
            onConfigChange={setConfig}
            weekly={weekly}
            onWeeklyChange={setWeekly}
            blockedPeriods={blockedPeriods}
            onBlockedPeriodsChange={setBlockedPeriods}
            manualHolidays={manualHolidays}
            onAddManualHoliday={handleAddManualHoliday}
            onRemoveManualHoliday={handleRemoveManualHoliday}
            highlights={calendarHighlights}
          />
        </section>

        {/* SCHEDULE ACTION CENTER & SUBMISSION PANEL */}
        <section id="schedule-submission-center" className="max-w-7xl mx-auto">
          <div className="bg-slate-900 text-white rounded-2xl border border-slate-850 p-6 md:p-8 shadow-lg flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute left-0 bottom-0 -translate-x-12 translate-y-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

            <div className="text-left max-w-xl z-10 w-full">
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-bold px-2.5 py-1 rounded-full border border-indigo-500/30 uppercase tracking-widest inline-flex items-center gap-1.5 mb-3">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Intelligent Scheduling Processor
              </span>
              <h3 className="font-sans font-bold text-lg md:text-xl text-slate-100 tracking-tight">
                Submit Parameters & Re-calculate Dates
              </h3>
              <p className="font-sans text-xs text-slate-350 mt-1 leading-relaxed">
                Applies specified date ranges, weekly class patterns, and university holiday exclusions. Reconciles sessional exam intervals to compute the optimal class schedules.
              </p>

              {/* LIVE HARMONY STATUS BADGE */}
              <div className="flex flex-wrap items-center gap-3 mt-4">
                {isCalculatedDirty ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-500/10 text-amber-300 px-3 py-1 rounded-lg border border-amber-500/25">
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    Pending user submission
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-300 px-3 py-1 rounded-lg border border-emerald-500/25">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Dates actively synced ({lastUpdatedTime || 'Current'})
                  </span>
                )}
                
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/50">
                  {scheduleResult.totalClassesGenerated} / {scheduleResult.totalClassesNeeded} Lectures Mapped
                </span>
              </div>
            </div>

            {/* ACTION TRIGGERS CONTROLS */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 z-10 w-full lg:w-auto shrink-0">
              <button
                type="button"
                id="submit-calculation-btn"
                onClick={() => {
                  setIsUpdating(true);
                  setTimeout(() => {
                    setIsUpdating(false);
                    setIsCalculatedDirty(false);
                    setLastUpdatedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
                    logAction('Scheduler Executed', `Recalculated active semester calendar rules. System successfully mapped ${scheduleResult.totalClassesGenerated} of ${scheduleResult.totalClassesNeeded} required slots.`);
                    
                    const el = document.getElementById('step-three-preview');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }, 500);
                }}
                disabled={isUpdating}
                className="flex items-center justify-center gap-2 py-3 px-6 text-sm font-bold text-white bg-indigo-650 hover:bg-indigo-600 active:bg-indigo-700 rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isUpdating ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing Rules...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4.5 w-4.5" />
                    Submit & Generate Dates
                  </>
                )}
              </button>

              <button
                type="button"
                id="direct-download-docx-btn"
                onClick={handleExportDocx}
                className="flex items-center justify-center gap-2 py-3 px-6 text-sm font-bold text-slate-800 bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-500 rounded-xl transition-all shadow-md cursor-pointer text-center"
              >
                <Download className="h-4.5 w-4.5" />
                Download Updated Word Document
              </button>
            </div>
          </div>
        </section>

        {/* STEP 3: Preview and Export tables */}
        {tables.length > 0 ? (
          <section id="step-three-preview">
            <div className="flex items-center gap-2 mb-4 animate-fade-in">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-indigo-650 text-white text-3xs font-bold">3</span>
              <h2 className="font-sans font-semibold text-slate-800 text-sm uppercase tracking-wide">
                Interactive Schedule Review
              </h2>
            </div>
            <TablePreview
              tables={tables}
              classes={scheduleResult.classes}
              skippedDates={scheduleResult.skippedDates}
              dateMappings={finalDateMappings}
              onOverrideDate={handleOverrideDate}
              onToggleLectureRow={handleToggleLectureRow}
              onExportDocx={handleExportDocx}
              onResetOverrides={handleResetOverrides}
              isCompleted={scheduleResult.isCompleted}
              totalClassesNeeded={scheduleResult.totalClassesNeeded}
              totalClassesGenerated={scheduleResult.totalClassesGenerated}
              auditLogs={auditLogs}
              highlights={calendarHighlights}
              semesterEndDate={config.endDate}
            />
          </section>
        ) : (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 border-dashed max-w-4xl mx-auto shadow-2xs font-sans">
            <CalendarRange className="h-12 w-12 text-slate-350 mx-auto mb-4" />
            <h3 className="text-base font-semibold text-slate-800">No Reference Table Loaded</h3>
            <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-normal">
              Upload your institution's previous semester schedule (.docx format) or choose 
              <button onClick={handleLoadSample} className="text-indigo-600 hover:underline font-semibold ml-1">"Load Sample Template"</button> above to inspect the calendar logic and testing grid instantly.
            </p>
          </div>
        )}
      </main>

      {/* FOOTER METADATA */}
      <footer className="max-w-7xl mx-auto mt-16 pt-6 border-t border-slate-200 text-center flex flex-col md:flex-row items-center justify-between text-4xs font-semibold text-slate-400 uppercase tracking-widest gap-4">
        <span>© 2026 Academic Schedule Automation Core Engine</span>
        <span>Secure Local Sandboxed Client Context</span>
      </footer>
    </div>
  );
}

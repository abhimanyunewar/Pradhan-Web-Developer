import React, { useState, useRef } from 'react';
import { Upload, FileText, CalendarRange, X, CheckCircle2, ShieldCheck, HelpCircle } from 'lucide-react';
import { ParsedTable } from '../types';

interface UploadSectionProps {
  onDocxLoaded: (file: File, tables: ParsedTable[], rawData: any) => void;
  onHolidaysLoaded: (holidays: any[]) => void;
  onLoadSample: () => void;
  loadedDocxName: string | null;
  loadedHolidaysCount: number | null;
  tableCount: number;
  rowCount: number;
}

export default function UploadSection({
  onDocxLoaded,
  onHolidaysLoaded,
  onLoadSample,
  loadedDocxName,
  loadedHolidaysCount,
  tableCount,
  rowCount,
}: UploadSectionProps) {
  const [isDraggingDocx, setIsDraggingDocx] = useState(false);
  const [isDraggingHolidays, setIsDraggingHolidays] = useState(false);
  const [docxError, setDocxError] = useState<string | null>(null);
  const [holidayError, setHolidayError] = useState<string | null>(null);

  const docxInputRef = useRef<HTMLInputElement>(null);
  const holidayInputRef = useRef<HTMLInputElement>(null);

  // Parse DOCX
  const handleDocxFile = async (file: File) => {
    setDocxError(null);
    if (!file.name.endsWith('.docx')) {
      setDocxError('Invalid file type. Please upload a Microsoft Word (.docx) file.');
      return;
    }

    try {
      const { parseDocxFile } = await import('../utils/docxParser');
      const parsed = await parseDocxFile(file);
      if (parsed.tables.length === 0) {
        setDocxError('We found no tables in this Word document. Schedules must be in table format.');
        return;
      }
      onDocxLoaded(file, parsed.tables, parsed);
    } catch (err: any) {
      setDocxError(err.message || 'Error parsing Word file. Ensure it is a valid .docx structure.');
    }
  };

  // Parse Holiday List
  const handleHolidayFile = async (file: File) => {
    setHolidayError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls' && ext !== 'pdf') {
      setHolidayError('Invalid file type. Please upload a PDF (.pdf), CSV (.csv) or Excel (.xlsx/.xls) file.');
      return;
    }

    try {
      const { parseHolidayFile } = await import('../utils/holidayParser');
      const parsedHolidays = await parseHolidayFile(file);
      onHolidaysLoaded(parsedHolidays);
    } catch (err: any) {
      setHolidayError(err.message || 'Error parsing holiday list. Ensure table has date and name columns.');
    }
  };

  const onDragOver = (e: React.DragEvent, setDragState: (s: boolean) => void) => {
    e.preventDefault();
    setDragState(true);
  };

  const onDragLeave = (setDragState: (s: boolean) => void) => {
    setDragState(false);
  };

  const onDrop = (
    e: React.DragEvent,
    setDragState: (s: boolean) => void,
    handleFile: (file: File) => void
  ) => {
    e.preventDefault();
    setDragState(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div id="upload-panel" className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      {/* Word template upload card */}
      <div 
        id="docx-upload-card"
        className={`relative flex flex-col justify-between p-6 rounded-2xl border-2 transition-all duration-300 bg-white ${
          isDraggingDocx
            ? 'border-indigo-600 bg-indigo-50/40 shadow-inner'
            : loadedDocxName
            ? 'border-emerald-200 shadow-sm bg-stone-50/30'
            : 'border-slate-250 border-dashed hover:border-slate-400 hover:shadow-md'
        }`}
        onDragOver={(e) => onDragOver(e, setIsDraggingDocx)}
        onDragLeave={() => onDragLeave(setIsDraggingDocx)}
        onDrop={(e) => onDrop(e, setIsDraggingDocx, handleDocxFile)}
      >
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-sans font-semibold text-slate-800 text-lg flex items-center gap-2">
              <FileText className={`h-5 w-5 ${loadedDocxName ? 'text-emerald-500' : 'text-slate-500'}`} />
              Course Schedule Template (.docx)
            </h3>
            {loadedDocxName && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                <CheckCircle2 className="h-3 w-3" /> Ready
              </span>
            )}
          </div>

          <p className="font-sans text-xs text-slate-500 leading-relaxed mb-6">
            Upload your previous semester schedule in Word table layout. The system will detect and sequentially swap only the date column (4th column in the table), preserving page layouts, headers, and cell formatting.
          </p>

          {!loadedDocxName ? (
            <div 
              onClick={() => docxInputRef.current?.click()}
              className="group cursor-pointer flex flex-col items-center justify-center p-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed transition-all hover:bg-slate-100/75 hover:border-slate-300"
            >
              <Upload className="h-8 w-8 text-slate-400 mb-3 group-hover:text-indigo-500 transition-colors" />
              <p className="font-sans text-sm font-medium text-slate-700">
                Drag & drop or <span className="text-indigo-600 group-hover:underline">browse</span>
              </p>
              <span className="font-sans text-2xs text-slate-400 mt-1">Accepts and modifies Microsoft Word files (.docx) only</span>
              <input 
                ref={docxInputRef}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => e.target.files && handleDocxFile(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2.5 overflow-hidden">
                  <div className="p-2 bg-emerald-100/75 text-emerald-700 rounded-lg shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-sans text-sm font-semibold text-slate-800 truncate" title={loadedDocxName}>
                      {loadedDocxName}
                    </p>
                    <p className="font-mono text-2xs text-slate-500 mt-0.5">
                      Tables Detected: {tableCount} ({rowCount} total rows found)
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (docxInputRef.current) docxInputRef.current.value = '';
                    onDocxLoaded(null as any, [], null);
                  }}
                  className="p-1 hover:bg-emerald-100 hover:text-red-600 rounded text-slate-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {docxError && (
            <p className="font-sans text-xs font-medium text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-3 mt-4">
              {docxError}
            </p>
          )}
        </div>

        {/* Demo trigger */}
        {!loadedDocxName && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="font-sans text-2xs text-slate-400 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-400" /> Secure offline local processing
            </span>
            <button
              onClick={onLoadSample}
              className="font-sans text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
            >
              Load Sample Template
            </button>
          </div>
        )}
      </div>

      {/* University Holiday List Card */}
      <div 
        id="holidays-upload-card"
        className={`relative flex flex-col justify-between p-6 rounded-2xl border-2 transition-all duration-300 bg-white ${
          isDraggingHolidays
            ? 'border-indigo-600 bg-indigo-50/40 shadow-inner'
            : loadedHolidaysCount !== null
            ? 'border-cyan-200 shadow-sm bg-stone-50/30'
            : 'border-slate-250 border-dashed hover:border-slate-400 hover:shadow-md'
        }`}
        onDragOver={(e) => onDragOver(e, setIsDraggingHolidays)}
        onDragLeave={() => onDragLeave(setIsDraggingHolidays)}
        onDrop={(e) => onDrop(e, setIsDraggingHolidays, handleHolidayFile)}
      >
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-sans font-semibold text-slate-800 text-lg flex items-center gap-2">
              <CalendarRange className={`h-5 w-5 ${loadedHolidaysCount !== null ? 'text-cyan-500' : 'text-slate-500'}`} />
              University Holiday Circular (.pdf, .png, .jpg, .xlsx, .csv)
            </h3>
            {loadedHolidaysCount !== null && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-100">
                <CheckCircle2 className="h-3 w-3" /> Imported
              </span>
            )}
          </div>

          <p className="font-sans text-xs text-slate-500 leading-relaxed mb-6">
            Upload institutional academic planners, scanned circular lists, or screenshot images. The system auto-detects date sequences to suppress allocations, or you can enter them manually.
          </p>

          {loadedHolidaysCount === null ? (
            <div 
              onClick={() => holidayInputRef.current?.click()}
              className="group cursor-pointer flex flex-col items-center justify-center p-8 bg-slate-50 rounded-xl border border-slate-200 border-dashed transition-all hover:bg-slate-100/75 hover:border-slate-300"
            >
              <Upload className="h-8 w-8 text-slate-400 mb-3 group-hover:text-cyan-500 transition-colors" />
              <p className="font-sans text-sm font-medium text-slate-700">
                Drag & drop or <span className="text-cyan-600 group-hover:underline">browse</span>
              </p>
              <span className="font-sans text-2xs text-slate-400 mt-1">Accepts PDFs, scanned circulars, images (PNG, JPG), CSV or Excel</span>
              <input 
                ref={holidayInputRef}
                type="file"
                accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => e.target.files && handleHolidayFile(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-4 bg-cyan-50/40 border border-cyan-100 rounded-xl">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2.5 overflow-hidden">
                  <div className="p-2 bg-cyan-100/75 text-cyan-700 rounded-lg shrink-0">
                    <CalendarRange className="h-5 w-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-sans text-sm font-semibold text-slate-800">
                      Academic Holidays Loaded
                    </p>
                    <p className="font-mono text-2xs text-slate-500 mt-0.5">
                      Successfully parsed {loadedHolidaysCount} days to skip
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (holidayInputRef.current) holidayInputRef.current.value = '';
                    onHolidaysLoaded([]);
                  }}
                  className="p-1 hover:bg-cyan-100 hover:text-red-600 rounded text-slate-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {holidayError && (
            <p className="font-sans text-xs font-medium text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-3 mt-4">
              {holidayError}
            </p>
          )}
        </div>

        {/* Info label */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-2xs text-slate-400">
          <span className="flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5" /> Flipped row lists auto-resolved
          </span>
          <span>PDF, CSV, XLS compatible</span>
        </div>
      </div>
    </div>
  );
}

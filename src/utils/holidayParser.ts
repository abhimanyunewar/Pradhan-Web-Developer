import * as XLSX from 'xlsx';
import { Holiday } from '../types';
import { formatYYYYMMDD } from './scheduler';

// Import pdf.js directly from installed pdfjs-dist package with ts-ignore for types
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// Import pdfjs worker using Vite's native worker loader
// @ts-ignore
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

try {
  if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();
  }
} catch (e) {
  console.warn('Could not set PDFJS workerPort on load, trying CDN fallback...', e);
  try {
    if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.7.284/pdf.worker.min.js';
    }
  } catch (err) {
    console.warn('Fallback workerSrc allocation failed', err);
  }
}

// Resilient text scanner that extracts dates and holiday names regardless of formatting styles
function parseTextHolidays(fullText: string): Omit<Holiday, 'id'>[] {
  let detectedYear = 2026; // Default fallback year
  const yearMatch = fullText.match(/\b(202[4-9]|2030)\b/);
  if (yearMatch) {
    detectedYear = parseInt(yearMatch[1], 10);
  }

  const lines = fullText.split('\n');
  const holidays: Omit<Holiday, 'id'>[] = [];
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.length < 5) continue;

    const lowerLine = line.toLowerCase();
    
    // Skip visible header/footer system metadata lines
    if (
      lowerLine.includes('holiday list') || 
      lowerLine.includes('academic calendar') || 
      lowerLine.includes('list of holidays') ||
      lowerLine.includes('page ') ||
      lowerLine.match(/^\s*date\s+holiday\s*$/i) ||
      (lowerLine.includes('university') && lowerLine.includes('year') && lowerLine.includes('semester'))
    ) {
      continue;
    }

    let parsedDate: Date | null = null;
    let matchedDateStr = '';

    // A. Match pure numeric DMY format: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    const dmyRegex = /\b(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})\b/;
    const dmyMatch = line.match(dmyRegex);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      let year = parseInt(dmyMatch[3], 10);
      if (year < 100) year += 2000;
      parsedDate = new Date(Date.UTC(year, month, day));
      matchedDateStr = dmyMatch[0];
    }

    // B. Match pure numeric YMD format: YYYY-MM-DD
    if (!parsedDate) {
      const ymdRegex = /\b(\d{4})[-./](\d{1,2})[-./](\d{1,2})\b/;
      const ymdMatch = line.match(ymdRegex);
      if (ymdMatch) {
        const year = parseInt(ymdMatch[1], 10);
        const month = parseInt(ymdMatch[2], 10) - 1;
        const day = parseInt(ymdMatch[3], 10);
        parsedDate = new Date(Date.UTC(year, month, day));
        matchedDateStr = ymdMatch[0];
      }
    }

    // C. Natural/textual dates: Match directly on the original line so we can capture and remove commas/punctuation
    if (!parsedDate) {
      const originalLineNoDoubleSpace = line.replace(/\s+/g, ' ');
      
      for (let mIdx = 0; mIdx < months.length; mIdx++) {
        const mName = months[mIdx];
        
        // C1. Textual Month with Year: e.g. "26 January 2026", "26th Jan, 2026", "26-Jan-2026"
        const monthRegex1 = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[-\\s.,/]+${mName}[a-z]*[-\\s.,/]+(\\d{4})\\b`, 'i');
        const m1 = originalLineNoDoubleSpace.match(monthRegex1);
        if (m1) {
          const day = parseInt(m1[1], 10);
          const year = parseInt(m1[2], 10);
          parsedDate = new Date(Date.UTC(year, mIdx, day));
          matchedDateStr = m1[0];
          break;
        }

        // C2. Textual Month with Year reverse order: e.g. "January 26, 2026", "Jan 26th, 2026"
        const monthRegex2 = new RegExp(`\\b${mName}[a-z]*[-\\s.,/]+(\\d{1,2})(?:st|nd|rd|th)?[-\\s.,/]+(\\d{2,4})\\b`, 'i');
        const m2 = originalLineNoDoubleSpace.match(monthRegex2);
        if (m2) {
          const day = parseInt(m2[1], 10);
          let year = parseInt(m2[2], 10);
          if (year < 100) year += 2000;
          parsedDate = new Date(Date.UTC(year, mIdx, day));
          matchedDateStr = m2[0];
          break;
        }

        // C3. Textual Month without Year: e.g. "26 January", "26th Jan", "January 26"
        const monthRegex3 = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[-\\s.,/]+${mName}[a-z]*\\b`, 'i');
        const m3 = originalLineNoDoubleSpace.match(monthRegex3);
        if (m3) {
          const day = parseInt(m3[1], 10);
          parsedDate = new Date(Date.UTC(detectedYear, mIdx, day));
          matchedDateStr = m3[0];
          break;
        }

        const monthRegex4 = new RegExp(`\\b${mName}[a-z]*[-\\s.,/]+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i');
        const m4 = originalLineNoDoubleSpace.match(monthRegex4);
        if (m4) {
          const day = parseInt(m4[1], 10);
          parsedDate = new Date(Date.UTC(detectedYear, mIdx, day));
          matchedDateStr = m4[0];
          break;
        }
      }
    }

    if (parsedDate && !isNaN(parsedDate.getTime())) {
      // Isolate the remaining text as the holiday name block
      let holidayName = line;
      if (matchedDateStr) {
        // Remove the matched date text from the line
        const idx = holidayName.toLowerCase().indexOf(matchedDateStr.toLowerCase());
        if (idx !== -1) {
          holidayName = holidayName.substring(0, idx) + ' ' + holidayName.substring(idx + matchedDateStr.length);
        } else {
          // Fallback simple replace using safe escaping
          const escaped = matchedDateStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          holidayName = holidayName.replace(new RegExp(escaped, 'gi'), ' ');
        }
      }

      // Also clean up weekday noise (Monday, Tuesday etc.), year descriptors, parentheses, and punctuation
      holidayName = holidayName.replace(/\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi, '');
      holidayName = holidayName.replace(/\b(202[4-9]|2030)\b/g, ''); // Skip year number
      holidayName = holidayName.replace(/[\(\)\[\]\-:,\.\/\\|*•+]/g, ' '); // Clean punctuation characters
      holidayName = holidayName.replace(/\s+/g, ' ').trim();

      // Ensure name isn't too short or empty
      if (holidayName.length >= 2) {
        const hLower = holidayName.toLowerCase();
        if (hLower !== 'holiday' && hLower !== 'holidays' && hLower !== 'day' && hLower !== 'date') {
          holidays.push({
            date: formatYYYYMMDD(parsedDate),
            name: holidayName,
            type: 'holiday'
          });
        }
      }
    }
  }

  const uniqueHolidays: Omit<Holiday, 'id'>[] = [];
  const seenDates = new Set<string>();
  for (const h of holidays) {
    if (!seenDates.has(h.date)) {
      seenDates.add(h.date);
      uniqueHolidays.push(h);
    }
  }

  return uniqueHolidays;
}

export async function parsePdfHolidayFile(file: File): Promise<Omit<Holiday, 'id'>[]> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Process items with layout coordinates to handle out-of-order columns cleanly
    const items = textContent.items as any[];
    const validItems = items
      .filter(item => item && typeof item.str === 'string')
      .map(item => {
        const x = item.transform ? item.transform[4] : 0;
        const y = item.transform ? item.transform[5] : 0;
        return { str: item.str, x, y };
      });

    // Group items into rows of text based on their vertical (Y) coordinate height (with thin 6 points tolerance)
    const rows: { str: string; x: number; y: number }[][] = [];
    
    // Sort all primarily by vertical position descending (top of page first)
    validItems.sort((a, b) => b.y - a.y);
    
    for (const item of validItems) {
      let added = false;
      for (const row of rows) {
        if (row.length > 0 && Math.abs(row[0].y - item.y) <= 6) {
          row.push(item);
          added = true;
          break;
        }
      }
      if (!added) {
        rows.push([item]);
      }
    }
    
    // Build actual page lines by sorting items left-to-right (X ascending) within each horizontal row
    const pageLines: string[] = [];
    for (const row of rows) {
      row.sort((a, b) => a.x - b.x);
      const lineStr = row.map(item => item.str).join(' ');
      pageLines.push(lineStr);
    }
    
    fullText += pageLines.join('\n') + '\n';
  }
  
  const parsed = parseTextHolidays(fullText);
  if (parsed.length === 0) {
    // SCANNED PDF FALLBACK TO SERVER GEMINI MULTIMODAL API!
    console.log('No direct embedded text layer found in PDF. Initiating secure Gemini Server OCR scan...');
    try {
      return await parseHolidayWithServerGenAI(file);
    } catch (apiError: any) {
      throw new Error(`Scanned PDF detected. Direct text layer was empty, and our server-side AI parsing fallback also failed: ${apiError.message}`);
    }
  }
  return parsed;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

export async function parseHolidayWithServerGenAI(file: File): Promise<Omit<Holiday, 'id'>[]> {
  try {
    const base64Data = await fileToBase64(file);
    const mimeType = file.type || 'application/pdf';
    
    const response = await fetch('/api/parse-holiday', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        base64Data,
        mimeType,
        fileName: file.name,
      }),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error || `Server returned error status ${response.status}`);
    }

    const data = await response.json();
    if (!data.holidays || !Array.isArray(data.holidays)) {
      throw new Error('Server returned invalid holiday entries format.');
    }

    return data.holidays.map((h: any) => ({
      date: h.date,
      name: h.name,
      type: 'holiday' as const,
    }));
  } catch (error: any) {
    console.error('Error in parseHolidayWithServerGenAI:', error);
    throw new Error(`AI parse failed: ${error.message || error}`);
  }
}

// Simple CSV parsing, XLS/XLSX, PDF, or Images (PNG, JPG, WebP)
export async function parseHolidayFile(file: File): Promise<Omit<Holiday, 'id'>[]> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'pdf') {
    return parsePdfHolidayFile(file);
  } else if (extension && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) {
    // IMAGE FORMATS DIRECTLY SOLVED BY AI OCR BACKEND!
    console.log(`Image holiday file detected (.${extension}). Routing to secure server Gemini multimodal parse...`);
    return parseHolidayWithServerGenAI(file);
  } else if (extension === 'csv') {
    const text = await file.text();
    return parseCSVHolidays(text);
  } else {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    return parseSpreadsheetHolidays(jsonData);
  }
}

// Parses standard CSV string
function parseCSVHolidays(csvText: string): Omit<Holiday, 'id'>[] {
  const lines = csvText.split('\n');
  const holidays: Omit<Holiday, 'id'>[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple split (handles simple double quote strings)
    const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (columns.length < 2) continue;
    
    // Skip header row
    if (i === 0 && (columns[0].toLowerCase().includes('date') || columns[1].toLowerCase().includes('holiday') || columns[0].toLowerCase().includes('holiday'))) {
      continue;
    }
    
    const parsedDate = parseAnyDate(columns[0]);
    const holidayName = columns[1]?.replace(/^"|"$/g, '').trim() || 'Holiday';
    
    if (parsedDate) {
      holidays.push({
        date: formatYYYYMMDD(parsedDate),
        name: holidayName,
        type: 'holiday'
      });
    } else {
      // Try reverse columns
      const parsedDateAlt = parseAnyDate(columns[1]);
      const holidayNameAlt = columns[0]?.replace(/^"|"$/g, '').trim() || 'Holiday';
      if (parsedDateAlt) {
        holidays.push({
          date: formatYYYYMMDD(parsedDateAlt),
          name: holidayNameAlt,
          type: 'holiday'
        });
      }
    }
  }
  
  return holidays;
}

// Parse JS Array representing rows and cells
function parseSpreadsheetHolidays(rows: any[][]): Omit<Holiday, 'id'>[] {
  const holidays: Omit<Holiday, 'id'>[] = [];
  if (rows.length < 1) return [];

  let dateColIdx = 0;
  let nameColIdx = 1;

  // Let's identify which column holds the Date and which holds the Holiday Name by examining the first 2-3 rows
  const headerRow = rows[0];
  let foundHeaders = false;
  
  if (headerRow) {
    for (let c = 0; c < headerRow.length; c++) {
      const val = String(headerRow[c] || '').toLowerCase();
      if (val.includes('date') || val.includes('dated') || val.includes('day')) {
        dateColIdx = c;
        foundHeaders = true;
      }
      if (val.includes('holiday') || val.includes('festival') || val.includes('description') || val.includes('event') || val.includes('name')) {
        nameColIdx = c;
        foundHeaders = true;
      }
    }
  }

  // If we couldn't find obvious headers, scan the first row containing a valid cell date
  const startRowIdx = foundHeaders ? 1 : 0;

  for (let r = startRowIdx; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    // Retrieve cells
    let dateVal = row[dateColIdx];
    let nameVal = row[nameColIdx];

    // Double check if cells got flipped or we can parse any cell in row
    let parsedDate: Date | null = null;
    let holidayName = 'Holiday';

    if (dateVal instanceof Date) {
      parsedDate = dateVal;
    } else if (dateVal !== undefined && dateVal !== null) {
      parsedDate = parseAnyDate(String(dateVal));
    }

    if (nameVal !== undefined && nameVal !== null) {
      holidayName = String(nameVal).trim();
    }

    // Fallbacks if columns didn't match perfectly
    if (!parsedDate) {
      // Loop cells to locate a date
      for (let c = 0; c < row.length; c++) {
        if (row[c] instanceof Date) {
          parsedDate = row[c];
          holidayName = String(row[c === 0 ? 1 : 0] || 'Holiday').trim();
          break;
        } else {
          const checkD = parseAnyDate(String(row[c]));
          if (checkD) {
            parsedDate = checkD;
            holidayName = String(row[c === 0 ? 1 : 0] || 'Holiday').trim();
            break;
          }
        }
      }
    }

    if (parsedDate && !isNaN(parsedDate.getTime())) {
      holidays.push({
        date: formatYYYYMMDD(parsedDate),
        name: holidayName || 'Holiday',
        type: 'holiday'
      });
    }
  }

  return holidays;
}

// Utility to parse any date string formats to Date objects (e.g. DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, Word formats)
export function parseAnyDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  const val = dateStr.trim();

  // Try standard iso YYYY-MM-DD
  const isoMatch = val.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    return new Date(Date.UTC(year, month, day));
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmMatch = val.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const month = parseInt(dmMatch[2], 10) - 1;
    const year = parseInt(dmMatch[3], 10);
    return new Date(Date.UTC(year, month, day));
  }

  // Native parse fallback
  const p = Date.parse(val);
  if (!isNaN(p)) {
    const d = new Date(p);
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }

  return null;
}


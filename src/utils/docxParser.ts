import JSZip from 'jszip';
import { ParsedTable, ParsedRow } from '../types';

// Helper to check if a string looks like a date or a date placeholder
export function detectIsDateLike(text: string): boolean {
  if (!text) return false;
  const cleaned = text.trim();
  
  // Matches 15/07/2025, 15-07-2025, 15.07.2025, 5/08/2025, 6.01.2026, 12/05, etc.
  const dateRegex = /\b\d{1,2}[\/\-\.]\d{1,2}([\/\-\.]\d{2,4})?\b/;
  if (dateRegex.test(cleaned)) {
    return true;
  }
  
  const placeholders = [
    'dd/mm', 
    'date', 
    'dated', 
    'd.o', 
    'dd-mm', 
    'dd/mm/yyyy', 
    'dd.mm.yyyy', 
    'dd-mm-yyyy', 
    'session date', 
    'class date',
    'schedule date'
  ];
  if (placeholders.some(p => cleaned.toLowerCase() === p)) {
    return true;
  }
  return false;
}

// Extract string text from an XML element (like w:tc), keeping spacer lines representation if needed
function getElementText(node: Element): string {
  const textNodes = node.getElementsByTagName('w:t');
  let text = '';
  for (let i = 0; i < textNodes.length; i++) {
    text += textNodes[i].textContent || '';
  }
  return text;
}

// Detect if any cells in a row indicate the row represents a Special Event (Exams, sessional, tests, etc.)
export function checkIsSpecialEventRow(cells: string[]): boolean {
  const lowercaseMarks = [
    'mid sessional',
    'mid-sessional',
    'unit test',
    'internal assessment',
    'examination',
    'exam marker',
    'mid term',
    'mid-term',
    'sessional exam',
    'assessment'
  ];
  return cells.some(text => {
    const cleaned = text.toLowerCase();
    return lowercaseMarks.some(mark => cleaned.includes(mark));
  });
}

export interface ParsedDocx {
  zip: JSZip;
  xmlDoc: Document;
  xmlString: string;
  tables: ParsedTable[];
}

// Main parser to unzip and extract table info
export async function parseDocxFile(file: File): Promise<ParsedDocx> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) {
    throw new Error("Invalid document formatting: Could not locate word/document.xml in the uploaded Word file.");
  }

  const xmlString = await docXmlFile.async("string");
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "application/xml");

  const tables: ParsedTable[] = [];
  const tableNodes = xmlDoc.getElementsByTagName('w:tbl');

  for (let tIdx = 0; tIdx < tableNodes.length; tIdx++) {
    const tableNode = tableNodes[tIdx];
    const rowNodes = tableNode.getElementsByTagName('w:tr');
    const numRows = rowNodes.length;
    
    // Step A: Determine if this table is an editable 'Teaching Schedule Table' or 'Course Information Table'
    // We scan columns to find a Date Header or columns containing date patterns.
    let detectedDateColIdx = -1;
    
    // Header keywords search in row 0 & 1
    const headerKeywords = [
      'date',
      'dates',
      'session date',
      'class date',
      'schedule date',
      'schedule',
      'calendar',
      'dated',
      'day & date',
      'date & day',
      'day/date'
    ];

    for (let rIdx = 0; rIdx < Math.min(2, numRows); rIdx++) {
      const rowNode = rowNodes[rIdx];
      if (!rowNode) continue;
      const cellNodes = rowNode.getElementsByTagName('w:tc');
      for (let cIdx = 0; cIdx < cellNodes.length; cIdx++) {
        const text = getElementText(cellNodes[cIdx]).trim().toLowerCase();
        if (
          headerKeywords.includes(text) ||
          text === 'date' ||
          text === 'dates' ||
          text.includes('session date') ||
          text.includes('class date') || 
          text.includes('schedule date') ||
          (text.includes('date') && !text.includes('effective') && !text.includes('birth') && !text.includes('outcome'))
        ) {
          detectedDateColIdx = cIdx;
          break;
        }
      }
      if (detectedDateColIdx !== -1) break;
    }

    // Secondary scan: If still not found, check columns for multiple cell date patterns
    if (detectedDateColIdx === -1 && numRows > 1) {
      let maxCols = 0;
      for (let rIdx = 0; rIdx < numRows; rIdx++) {
        const cellCount = rowNodes[rIdx].getElementsByTagName('w:tc').length;
        if (cellCount > maxCols) maxCols = cellCount;
      }

      for (let cIdx = maxCols - 1; cIdx >= 0; cIdx--) {
        let dateCountInCol = 0;
        for (let rIdx = 1; rIdx < numRows; rIdx++) {
          const cellNodes = rowNodes[rIdx].getElementsByTagName('w:tc');
          if (cIdx < cellNodes.length) {
            const cellText = getElementText(cellNodes[cIdx]);
            if (detectIsDateLike(cellText)) {
              dateCountInCol++;
            }
          }
        }
        // If we found multiple dates or at least 1 date-like pattern in a column, consider it the date column
        if (dateCountInCol >= 1) {
          detectedDateColIdx = cIdx;
          break;
        }
      }
    }

    // A table is considered editable only if we detected a valid DATE column containing schedule appointments
    const isTableEditable = detectedDateColIdx !== -1;

    const parsedRows: ParsedRow[] = [];

    for (let rIdx = 0; rIdx < numRows; rIdx++) {
      const rowNode = rowNodes[rIdx];
      const cellNodes = rowNode.getElementsByTagName('w:tc');
      const cells: string[] = [];

      for (let cIdx = 0; cIdx < cellNodes.length; cIdx++) {
        cells.push(getElementText(cellNodes[cIdx]));
      }

      const isHeaderRow = (rIdx === 0);
      const isSpecialEvent = checkIsSpecialEventRow(cells);
      
      let isLectureRow = false;
      let originalDateText = '';

      if (isTableEditable && !isHeaderRow) {
        // Double check it's not a special event row (MID-SESSIONAL, UNIT TEST, examine markers etc.)
        if (!isSpecialEvent && cellNodes.length > detectedDateColIdx) {
          originalDateText = cells[detectedDateColIdx] || '';
          
          // Row holds teaching details if there's topic or lecture contents
          const hasContent = cells.some(c => c.trim().length > 0);
          if (hasContent) {
            isLectureRow = true;
          }
        }
      }

      const originalXmlId = `t-${tIdx}-r-${rIdx}`;

      parsedRows.push({
        index: rIdx,
        cells,
        isLectureRow,
        originalDateText,
        originalXmlId,
        dateColIdx: detectedDateColIdx
      });
    }

    tables.push({
      index: tIdx,
      rows: parsedRows,
      // Custom typings extension for UI previews
      isEditable: isTableEditable,
      dateColIdx: detectedDateColIdx
    } as ParsedTable & { isEditable?: boolean; dateColIdx?: number });
  }

  return {
    zip,
    xmlDoc,
    xmlString,
    tables
  };
}

// Modify XML and repack ZIP to create new .docx file download
export async function rebuildDocxFile(
  parsedDocx: ParsedDocx,
  updatedTables: ParsedTable[],
  dateMappings: Map<string, string> // Map originalXmlId -> New Date String
): Promise<Blob> {
  const { zip, xmlDoc } = parsedDocx;
  const tableNodes = xmlDoc.getElementsByTagName('w:tbl');

  for (let tIdx = 0; tIdx < updatedTables.length; tIdx++) {
    const updatedTable = updatedTables[tIdx];
    const tableNode = tableNodes[updatedTable.index];
    if (!tableNode) continue;

    // Check if table is marked editable in our references (otherwise protect by skipping)
    const mockCastTable = updatedTable as any;
    if (mockCastTable.isEditable === false) {
      // Preserve Course Information table exactly
      continue;
    }

    const rowNodes = tableNode.getElementsByTagName('w:tr');

    for (let rIdx = 0; rIdx < updatedTable.rows.length; rIdx++) {
      const updatedRow = updatedTable.rows[rIdx];
      const rowNode = rowNodes[updatedRow.index];
      if (!rowNode) continue;

      const cellNodes = rowNode.getElementsByTagName('w:tc');
      
      // Determine date column index for this row
      const dateColIdx = updatedRow.dateColIdx !== undefined && updatedRow.dateColIdx !== -1 ? updatedRow.dateColIdx : 3;
      if (cellNodes.length <= dateColIdx) continue; // No column at that index to modify

      const cellNode = cellNodes[dateColIdx];
      const key = `t-${updatedTable.index}-r-${updatedRow.index}`;

      if (dateMappings.has(key)) {
        const newDateText = dateMappings.get(key) || '';

        // If it's Unscheduled style or blank, or matches a mapping
        let pNode = cellNode.getElementsByTagName('w:p')[0];
        if (!pNode) {
          pNode = xmlDoc.createElement('w:p');
          cellNode.appendChild(pNode);
        }

        // Get run properties (w:rPr) if they exist anywhere in this cell to protect original styling and fonts
        let rPrNode: Element | null = null;
        const existingRPrs = cellNode.getElementsByTagName('w:rPr');
        if (existingRPrs.length > 0) {
          rPrNode = existingRPrs[0].cloneNode(true) as Element;
        }

        // Remove all children elements inside the first paragraph (to wipe out old fragmented text)
        while (pNode.firstChild) {
          pNode.removeChild(pNode.firstChild);
        }

        // Create a new run (w:r)
        const rNode = xmlDoc.createElement('w:r');
        
        // Append run properties (font/style/borders) if we found them
        if (rPrNode) {
          rNode.appendChild(rPrNode);
        }

        // Create text node (w:t)
        const tNode = xmlDoc.createElement('w:t');
        tNode.textContent = newDateText;

        // Force xml:space="preserve" so Word preserves spacing
        tNode.setAttribute('xml:space', 'preserve');

        rNode.appendChild(tNode);
        pNode.appendChild(rNode);

        // Remove any secondary paragraphs in this date cell to prevent vertical stretching
        const pNodes = cellNode.getElementsByTagName('w:p');
        for (let i = pNodes.length - 1; i > 0; i--) {
          cellNode.removeChild(pNodes[i]);
        }
      }
    }
  }

  // Serialize DOM back to XML
  const serializer = new XMLSerializer();
  const newXmlString = serializer.serializeToString(xmlDoc);

  // Update ZIP with new document.xml
  zip.file("word/document.xml", newXmlString);

  // Generate ZIP file for browser download
  const outputBlob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  return outputBlob;
}

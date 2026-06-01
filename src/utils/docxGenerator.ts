import JSZip from 'jszip';
import { ParsedTable, ParsedRow } from '../types';

// Default static XML files to bootstrap a standard compliance DOCX document from scratch
const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const DOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

// Helper to construct custom styled table row XML with support for newlines inside cell text
function createCustomRowXml(
  cells: string[],
  options: {
    isBoldList?: boolean[];
    isHeader?: boolean;
    aligns?: string[];
    bgColors?: string[];
    fontSizes?: string[];
  } = {}
): string {
  const rowCellXML = cells.map((cellTxt, cIdx) => {
    const isBold = options.isHeader || (options.isBoldList ? options.isBoldList[cIdx] : (cIdx === 0));
    const fontName = "Calibri";
    const fontSize = options.fontSizes?.[cIdx] || (options.isHeader ? "22" : "20"); // 11pt, 10pt
    const align = options.aligns?.[cIdx] || "left";
    const bgColor = options.bgColors?.[cIdx] || (options.isHeader ? "F1F5F9" : "FFFFFF");

    // Clean cell text to handle newlines nicely inside separate w:p layout structures
    const paragraphs = (cellTxt || '').split('\n').map(line => {
      // Escape special XML characters in line text securely
      const escapedLine = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
        
      return `
        <w:p>
          <w:pPr>
            <w:jc w:val="${align}"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/>
              ${isBold ? '<w:b/>' : ''}
              <w:sz w:val="${fontSize}"/>
            </w:rPr>
            <w:t xml:space="preserve">${escapedLine}</w:t>
          </w:r>
        </w:p>
      `;
    }).join('');

    return `
      <w:tc>
        <w:tcPr>
          <w:shd w:val="clear" w:color="auto" w:fill="${bgColor}"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        ${paragraphs}
      </w:tc>
    `;
  }).join('');

  return `<w:tr>${rowCellXML}</w:tr>`;
}

// Generate the fully structured document.xml string containing all four beautiful syllabus tables
export function generateDocumentXml(
  tables: ParsedTable[],
  courseTitle: string,
  courseCode: string,
  academicYear: string,
  semesterName: string,
  lectureHours = 30,
  tutorialHours = 0,
  practicalHours = 0,
  clinicsHours = 0,
  credits = 2
): string {
  const faceToFaceHours = (lectureHours || 0) + (tutorialHours || 0) + (practicalHours || 0) + (clinicsHours || 0);
  const creditsValueText = `${credits} Credits (${faceToFaceHours} Hours)`;

  // Table 1 XML (Syllabus Parameters: 2 columns, 4 rows)
  const table1XML = `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="475569"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="475569"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="475569"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="475569"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="120" w:type="dxa"/>
          <w:left w:w="150" w:type="dxa"/>
          <w:bottom w:w="120" w:type="dxa"/>
          <w:right w:w="150" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      ${createCustomRowXml(["COURSE TITLE", courseTitle || 'N/A'], { isBoldList: [true, false], bgColors: ["F8FAFC", "FFFFFF"], aligns: ["left", "left"] })}
      ${createCustomRowXml(["COURSE CODE", courseCode || 'N/A'], { isBoldList: [true, false], bgColors: ["F8FAFC", "FFFFFF"], aligns: ["left", "left"] })}
      ${createCustomRowXml(["YEAR / SEMESTER", semesterName ? `${academicYear} / ${semesterName}` : (academicYear || 'N/A')], { isBoldList: [true, false], bgColors: ["F8FAFC", "FFFFFF"], aligns: ["left", "left"] })}
      ${createCustomRowXml(["CREDIT VALUE (Hours)", creditsValueText], { isBoldList: [true, false], bgColors: ["F8FAFC", "FFFFFF"], aligns: ["left", "left"] })}
    </w:tbl>
  `;

  // Table 2 XML (Course Outcomes: 1 row, 2 columns)
  const outcomesText = `At the end of the course, students will be able to:
CO1: Provide excellent patient care during radiography (C3).
CO2: Understand the need of good communication and demonstrate good communication techniques (C3).
CO3: Identify contrast reaction and their treatment (C2).
CO4: Apply radiation safety and MRI safety measures (C3).
CO5: Practice radiography ethically and legally including understanding and distinguishing various types of consent (C4)
CO6: Explain infection control in radiology department (C2).`;

  const table2XML = `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="475569"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="475569"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="475569"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="475569"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="120" w:type="dxa"/>
          <w:left w:w="150" w:type="dxa"/>
          <w:bottom w:w="120" w:type="dxa"/>
          <w:right w:w="150" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      ${createCustomRowXml(["COURSE OUTCOMES", outcomesText], { isBoldList: [true, false], bgColors: ["F8FAFC", "FFFFFF"], aligns: ["left", "left"] })}
    </w:tbl>
  `;

  // Table 3 XML (Credit Workload totals: 2 rows, 5 columns)
  const table3XML = `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="475569"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="475569"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="475569"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="475569"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="120" w:type="dxa"/>
          <w:left w:w="150" w:type="dxa"/>
          <w:bottom w:w="120" w:type="dxa"/>
          <w:right w:w="150" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      ${createCustomRowXml(["FACE TO FACE", "LECTURE", "TUTORIAL", "PRACTICAL", "CLINICS"], { isHeader: true, bgColors: ["E2E8F0", "F1F5F9", "F1F5F9", "F1F5F9", "F1F5F9"], aligns: ["center", "center", "center", "center", "center"] })}
      ${createCustomRowXml([
        "TOTAL HOURS",
        `${lectureHours} Hours`,
        `${tutorialHours} Hours`,
        `${practicalHours} Hours`,
        `${clinicsHours} Hours`
      ], { isBoldList: [true, false, false, false, false], bgColors: ["F8FAFC", "FFFFFF", "FFFFFF", "FFFFFF", "FFFFFF"], aligns: ["center", "center", "center", "center", "center"] })}
    </w:tbl>
  `;

  // Table 4 XML (Core calendar schedule list table)
  const table4XMLs = tables.map((t) => {
    const bodyRowsXML = t.rows.map((r) => {
      // Coerce columns structure to make sure it contains exactly 5 columns
      let cellValues = [...r.cells];
      if (cellValues.length === 4) {
        // Shifting date to 5th column, placing default "Lecture" as delivery mode
        cellValues = [cellValues[0], cellValues[1], cellValues[2], "Lecture", cellValues[3]];
      } else if (cellValues.length < 4) {
        while (cellValues.length < 5) cellValues.push('');
      } else if (cellValues.length > 5) {
        cellValues = cellValues.slice(0, 5);
      }

      const isHeaderRow = r.index === 0 || r.cells[0]?.toLowerCase().includes("sl");

      return createCustomRowXml(cellValues, {
        isHeader: isHeaderRow,
        bgColors: isHeaderRow ? ["F1F5F9", "F1F5F9", "F1F5F9", "F1F5F9", "F1F5F9"] : undefined,
        isBoldList: isHeaderRow ? undefined : [false, false, false, false, true],
        aligns: ["center", "center", "left", "center", "center"]
      });
    }).join('');

    return `
      <w:tbl>
        <w:tblPr>
          <w:tblW w:w="5000" w:type="pct"/>
          <w:tblBorders>
            <w:top w:val="single" w:sz="6" w:space="0" w:color="475569"/>
            <w:left w:val="single" w:sz="6" w:space="0" w:color="475569"/>
            <w:bottom w:val="single" w:sz="6" w:space="0" w:color="475569"/>
            <w:right w:val="single" w:sz="6" w:space="0" w:color="475569"/>
            <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
            <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          </w:tblBorders>
          <w:tblCellMar>
            <w:top w:w="120" w:type="dxa"/>
            <w:left w:w="150" w:type="dxa"/>
            <w:bottom w:w="120" w:type="dxa"/>
            <w:right w:w="150" w:type="dxa"/>
          </w:tblCellMar>
        </w:tblPr>
        ${bodyRowsXML}
      </w:tbl>
    `;
  }).join('<w:p><w:r><w:t xml:space="preserve">&#160;</w:t></w:r></w:p>');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document 
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:wne="http://schemas.openxmlformats.org/wordprocessingml/2006/education">
  <w:body>
    <!-- TOP CENTER HEADER ALIGNMENT -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:sz w:val="28"/>
        </w:rPr>
        <w:t xml:space="preserve">DEPARTMENT OF MEDICAL IMAGING TECHNOLOGY</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:sz w:val="24"/>
        </w:rPr>
        <w:t xml:space="preserve">MANIPAL COLLEGE OF HEALTH PROFESSIONS</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:sz w:val="20"/>
        </w:rPr>
        <w:t xml:space="preserve">MAHE, MANIPAL</w:t>
      </w:r>
    </w:p>
    <w:p><w:r><w:t xml:space="preserve">&#160;</w:t></w:r></w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
          <w:b/>
          <w:sz w:val="26"/>
        </w:rPr>
        <w:t xml:space="preserve">Class Schedule</w:t>
      </w:r>
    </w:p>
    
    <w:p><w:r><w:t xml:space="preserve">&#160;</w:t></w:r></w:p>

    <!-- FIRST TABLE (Syllabus Parameters) -->
    ${table1XML}

    <w:p><w:r><w:t xml:space="preserve">&#160;</w:t></w:r></w:p>

    <!-- SECOND TABLE (Course Outcomes) -->
    ${table2XML}

    <w:p><w:r><w:t xml:space="preserve">&#160;</w:t></w:r></w:p>

    <!-- THIRD TABLE (Credit Workload Totals) -->
    ${table3XML}

    <w:p><w:r><w:t xml:space="preserve">&#160;</w:t></w:r></w:p>

    <!-- FOURTH & MAIN TABLE (Topics & Calendar Dates) -->
    ${table4XMLs}

    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/> <!-- A4 landscape sizing (dxa unit) -->
      <w:pgMargin w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

// Generate complete docx blob from scratch for sample reference
export async function createStandardDocx(
  tables: ParsedTable[],
  courseTitle: string,
  courseCode: string,
  academicYear: string,
  semesterName: string,
  lectureHours?: number,
  tutorialHours?: number,
  practicalHours?: number,
  clinicsHours?: number,
  credits?: number
): Promise<Blob> {
  const zip = new JSZip();

  // Create document relations and settings
  zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
  zip.file("_rels/.rels", DOT_RELS);

  // Generate main XML
  const mainXmlString = generateDocumentXml(
    tables, 
    courseTitle, 
    courseCode, 
    academicYear, 
    semesterName,
    lectureHours,
    tutorialHours,
    practicalHours,
    clinicsHours,
    credits
  );
  zip.file("word/document.xml", mainXmlString);

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });

  return blob;
}

// Generates high quality mock default database structured data for first turn immediate play
export function getSampleParsedTables(): ParsedTable[] {
  return [
    {
      index: 0,
      rows: [
        {
          index: 0,
          cells: ["Sl.No", "Unit", "Topic", "Mode of Delivery", "Date"],
          isLectureRow: false,
          originalDateText: "Date",
          originalXmlId: "t-0-r-0",
          dateColIdx: 4
        },
        {
          index: 1,
          cells: ["1", "UNIT I", "Introduction to Radiographic Equipment and Tube Construction", "Lecture", "DD/MM"],
          isLectureRow: true,
          originalDateText: "DD/MM",
          originalXmlId: "t-0-r-1",
          dateColIdx: 4
        },
        {
          index: 2,
          cells: ["2", "UNIT I", "Patient Positioning, Care & Identification in Radiography", "Lecture", "DD/MM"],
          isLectureRow: true,
          originalDateText: "DD/MM",
          originalXmlId: "t-0-r-2",
          dateColIdx: 4
        },
        {
          index: 3,
          cells: ["3", "UNIT I", "Communication Strategies, Patient Education & Care Needs", "Lecture", "DD/MM"],
          isLectureRow: true,
          originalDateText: "DD/MM",
          originalXmlId: "t-0-r-3",
          dateColIdx: 4
        },
        {
          index: 4,
          cells: ["-", "-", "FIRST SESSIONAL EXAM PREPARATION BLOCK", "-", "-"],
          isLectureRow: false,
          originalDateText: "-",
          originalXmlId: "t-0-r-4"
        },
        {
          index: 5,
          cells: ["4", "UNIT II", "Contrast Media Physics: Identification of Adverse Reactions", "Lecture", "DD/MM"],
          isLectureRow: true,
          originalDateText: "DD/MM",
          originalXmlId: "t-0-r-5",
          dateColIdx: 4
        },
        {
          index: 6,
          cells: ["5", "UNIT II", "Treatment of Contrast Reactions & Emergency Radiology Protocol", "Practical", "DD/MM"],
          isLectureRow: true,
          originalDateText: "DD/MM",
          originalXmlId: "t-0-r-6",
          dateColIdx: 4
        },
        {
          index: 7,
          cells: ["6", "UNIT II", "Radiation Safety: ALARA Principles, Shading & Occupational Limits", "Lecture", "DD/MM"],
          isLectureRow: true,
          originalDateText: "DD/MM",
          originalXmlId: "t-0-r-7",
          dateColIdx: 4
        },
        {
          index: 8,
          cells: ["7", "UNIT III", "MRI Safety: Magnetic Field Shielding & Biological Effects", "Lecture", "DD/MM/YYYY"],
          isLectureRow: true,
          originalDateText: "DD/MM/YYYY",
          originalXmlId: "t-0-r-8",
          dateColIdx: 4
        },
        {
          index: 9,
          cells: ["8", "UNIT III", "Infection Control Measures in Imaging Departments & Sterile Zones", "Lecture", "DD/MM/YYYY"],
          isLectureRow: true,
          originalDateText: "DD/MM/YYYY",
          originalXmlId: "t-0-r-9",
          dateColIdx: 4
        },
        {
          index: 10,
          cells: ["9", "UNIT III", "Ethical & Legal Practice: Informed Consent, Audits & Liabilities", "Tutorial", "DD/MM/YYYY"],
          isLectureRow: true,
          originalDateText: "DD/MM/YYYY",
          originalXmlId: "t-0-r-10",
          dateColIdx: 4
        }
      ]
    }
  ];
}
export function getSampleCourseConfig() {
  return {
    courseTitle: "Clinical Radiography & Special Procedures",
    courseCode: "MIT-401",
    semesterName: "Fifth Semester",
    academicYear: "2026-27",
    startDate: "2026-08-10", // Fall start date
    endDate: "2026-10-30",   // Fall end date
  };
}

export function getSampleWeeklyConfig() {
  return {
    selectedDays: [2, 4], // Tuesday, Thursday
    lectureDuration: 1.5, // 1.5 hours
    credits: 2, // 2 credits = 30 hours total workload
    lectureHours: 30, // 30 hours of lectures
    tutorialHours: 0,
    practicalHours: 0,
    clinicsHours: 0
  };
}

export function getSampleHolidays() {
  return [
    { date: "2026-08-15", name: "Independence Day", type: "holiday" },
    { date: "2026-09-07", name: "Janmashtami Festival", type: "holiday" },
    { date: "2026-10-02", name: "Gandhi Jayanti", type: "holiday" },
    { date: "2026-10-23", name: "Dussehra Break", type: "holiday" },
  ];
}

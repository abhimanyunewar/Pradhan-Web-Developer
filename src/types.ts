export interface SemesterConfig {
  courseTitle: string;
  courseCode: string;
  semesterName: string;
  academicYear: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface WeeklyConfig {
  selectedDays: number[]; // 0 = Sunday, 1 = Monday, 2 = Tuesday, etc. (we skip Sundays by default)
  lectureDuration: number; // in hours, e.g., 1, 1.5, 2
  credits: number; // e.g., 3 credits = 45 hours
  lectureHours?: number;
  tutorialHours?: number;
  practicalHours?: number;
  clinicsHours?: number;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: 'holiday' | 'exam_mid' | 'exam_sec' | 'custom_block' | 'sunday' | 'third_saturday';
}

export interface BlockedPeriod {
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  type: 'exam_mid' | 'exam_sec' | 'second_sessional' | 'custom_block';
}

export interface ParsedCell {
  text: string;
  xmlNode: any; // Reference to original XML node for replacement
}

export interface ParsedRow {
  index: number;
  cells: string[];
  isLectureRow: boolean; // Does it have 4+ cells and contain valid sequence/content?
  originalDateText: string; // Original content of cell index 3 (4th column)
  originalXmlId: string; // Unique marker/ref so we can re-inject
  dateColIdx?: number; // Detected date column index
}

export interface ParsedTable {
  index: number;
  tableName?: string;
  rows: ParsedRow[];
  isEditable?: boolean;
  dateColIdx?: number;
}

export interface GeneratedClass {
  lectureIndex: number; // 1-based index of classes
  date: string; // YYYY-MM-DD
  formattedDate: string; // DD/MM/YYYY
  dayOfWeek: string; // e.g., "Tuesday"
  topic?: string; // Pulled from document column 3
}

export interface SkipRecord {
  date: string; // YYYY-MM-DD
  reason: string; // e.g., "independence Day (University Holiday)", "Third Saturday"
  dayOfWeek: string;
  type: 'holiday' | 'exam' | 'third_saturday' | 'sunday';
}

export interface ScheduleGenerationResult {
  classes: GeneratedClass[];
  skippedDates: SkipRecord[];
  totalHoursNeeded: number;
  totalClassesNeeded: number;
  totalClassesGenerated: number;
  isCompleted: boolean;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  action: string; // e.g. "Generate Schedule", "Manual Date Override", "Import Holiday List"
  details: string;
}

export interface SavedTemplate {
  id: string;
  name: string;
  createdAt: string;
  config: SemesterConfig;
  weekly: WeeklyConfig;
  holidays: Omit<Holiday, 'id'>[];
  blockedPeriods: BlockedPeriod[];
}

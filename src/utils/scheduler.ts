import { SemesterConfig, WeeklyConfig, Holiday, BlockedPeriod, ScheduleGenerationResult, GeneratedClass, SkipRecord } from '../types';

// Helper to convert DD/MM/YYYY string to Date object
export function parseDDMMYYYY(dateStr: string): Date {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed month
    const year = parseInt(parts[2], 10);
    return new Date(Date.UTC(year, month, day));
  }
  return new Date(dateStr); // fallback to native
}

// Helper to format Date as DD/MM/YYYY
export function formatDDMMYYYY(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

// Helper to format Date as YYYY-MM-DD (local calendar input format)
export function formatYYYYMMDD(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

// Checker for third Saturday of month
export function isThirdSaturday(date: Date): boolean {
  if (date.getUTCDay() !== 6) return false; // 6 = Saturday
  const day = date.getUTCDate();
  // 3rd Saturday always falls between 15th and 21st (inclusive)
  return day >= 15 && day <= 21;
}

export function generateSchedule(
  config: SemesterConfig,
  weekly: WeeklyConfig,
  holidays: Holiday[],
  blockedPeriods: BlockedPeriod[]
): ScheduleGenerationResult {
  const classes: GeneratedClass[] = [];
  const skippedDates: SkipRecord[] = [];

  const start = new Date(config.startDate);
  const end = new Date(config.endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return {
      classes: [],
      skippedDates: [],
      totalHoursNeeded: 0,
      totalClassesNeeded: 0,
      totalClassesGenerated: 0,
      isCompleted: false,
    };
  }

  // Define total hours needed. 1 Credit = 15 Lecture Hours
  const totalHoursNeeded = weekly.credits * 15;
  const classesNeeded = Math.ceil(totalHoursNeeded / weekly.lectureDuration);

  // Map holidays and sessional exam periods for quick lookup
  const holidayMap = new Map<string, string>(); // YYYY-MM-DD -> Name
  holidays.forEach((h) => {
    holidayMap.set(h.date, h.name);
  });

  const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  let current = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  const endLimit = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));

  let lectureIndex = 1;

  // Let's protect against infinite loops with a max calendar day iteration of 500
  let loopCount = 0;
  const maxLoops = 500;

  while (current <= endLimit && lectureIndex <= classesNeeded && loopCount < maxLoops) {
    loopCount++;
    const currentStr = formatYYYYMMDD(current);
    const dayOfWeekIndex = current.getUTCDay();
    const isSun = dayOfWeekIndex === 0;
    const isSat = dayOfWeekIndex === 6;

    // Check if Sunday - automatically skip
    if (isSun) {
      skippedDates.push({
        date: currentStr,
        dayOfWeek: "Sunday",
        reason: "Sunday",
        type: 'sunday',
      });
      // Move to next day
      current.setUTCDate(current.getUTCDate() + 1);
      continue;
    }

    // Check if Third Saturday of month
    if (isSat && isThirdSaturday(current)) {
      skippedDates.push({
        date: currentStr,
        dayOfWeek: "Saturday",
        reason: "Third Saturday (Institutional Closure)",
        type: 'third_saturday',
      });
      current.setUTCDate(current.getUTCDate() + 1);
      continue;
    }

    // Check University Holiday List
    if (holidayMap.has(currentStr)) {
      skippedDates.push({
        date: currentStr,
        dayOfWeek: weekdayNames[dayOfWeekIndex],
        reason: `Holiday: ${holidayMap.get(currentStr)}`,
        type: 'holiday',
      });
      current.setUTCDate(current.getUTCDate() + 1);
      continue;
    }

    // Check Sessional Exams and Blocked Periods
    let isBlocked = false;
    let blockReason = "";
    for (const period of blockedPeriods) {
      const pStart = new Date(period.startDate);
      const pEnd = new Date(period.endDate);
      const curCheck = new Date(currentStr);
      if (curCheck >= pStart && curCheck <= pEnd) {
        isBlocked = true;
        blockReason = period.name || (period.type === 'exam_mid' ? 'Mid-Sessional Exams' : 'Second Sessional Exams');
        break;
      }
    }

    if (isBlocked) {
      skippedDates.push({
        date: currentStr,
        dayOfWeek: weekdayNames[dayOfWeekIndex],
        reason: `Exam Period: ${blockReason}`,
        type: 'exam',
      });
      current.setUTCDate(current.getUTCDate() + 1);
      continue;
    }

    // Check if this weekday is one of the teaching days selected
    if (weekly.selectedDays.includes(dayOfWeekIndex)) {
      // It's a valid teaching day, assign class here!
      classes.push({
        lectureIndex,
        date: currentStr,
        formattedDate: formatDDMMYYYY(current),
        dayOfWeek: weekdayNames[dayOfWeekIndex],
      });
      lectureIndex++;
    }

    // Advance 1 day
    current.setUTCDate(current.getUTCDate() + 1);
  }

  const isCompleted = classes.length >= classesNeeded;

  return {
    classes,
    skippedDates,
    totalHoursNeeded,
    totalClassesNeeded: classesNeeded,
    totalClassesGenerated: classes.length,
    isCompleted,
  };
}

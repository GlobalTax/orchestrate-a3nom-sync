import moment from "moment";

/**
 * Utility functions for schedule-related calculations
 */

export const ScheduleCalculations = {
  /**
   * Calculate hours between start and end time
   */
  calculateHours(startTime: string, endTime: string, date: string): number {
    const start = moment(`${date} ${startTime}`, "YYYY-MM-DD HH:mm");
    const end = moment(`${date} ${endTime}`, "YYYY-MM-DD HH:mm");
    
    // Handle shifts that cross midnight
    if (end.isBefore(start)) {
      end.add(1, 'day');
    }
    
    return end.diff(start, "hours", true);
  },

  /**
   * Validate that a shift is valid (end time is after start time)
   */
  isValidShift(startTime: string, endTime: string): boolean {
    const start = moment(startTime, "HH:mm");
    const end = moment(endTime, "HH:mm");
    
    // Consider shifts crossing midnight as valid
    return true;
  },

  /**
   * Get all dates in a week starting from given date
   */
  getWeekDates(date: Date): Date[] {
    const startOfWeek = moment(date).startOf('week');
    const dates: Date[] = [];
    
    for (let i = 0; i < 7; i++) {
      dates.push(startOfWeek.clone().add(i, 'days').toDate());
    }
    
    return dates;
  },

  /**
   * Get date range for a month
   */
  getMonthDateRange(year: number, month: number): { start: Date; end: Date } {
    const start = moment({ year, month: month - 1, day: 1 }).toDate();
    const end = moment({ year, month: month - 1 }).endOf('month').toDate();
    return { start, end };
  },

  /**
   * Format date to YYYY-MM-DD
   */
  formatDate(date: Date | string): string {
    return moment(date).format("YYYY-MM-DD");
  },

  /**
   * Format time to HH:mm
   */
  formatTime(time: Date | string): string {
    return moment(time).format("HH:mm");
  },

  /**
   * Check if two date ranges overlap
   */
  doPeriodsOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const s1 = moment(start1);
    const e1 = moment(end1);
    const s2 = moment(start2);
    const e2 = moment(end2);
    
    return s1.isBefore(e2) && s2.isBefore(e1);
  },

  /**
   * Calculate total hours for multiple shifts
   */
  calculateTotalHours(shifts: Array<{ startTime: string; endTime: string; date: string }>): number {
    return shifts.reduce((total, shift) => {
      return total + this.calculateHours(shift.startTime, shift.endTime, shift.date);
    }, 0);
  },

  /**
   * Get business days between two dates
   */
  getBusinessDays(startDate: Date, endDate: Date): number {
    const start = moment(startDate);
    const end = moment(endDate);
    let count = 0;
    
    while (start.isSameOrBefore(end)) {
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (start.day() !== 0 && start.day() !== 6) {
        count++;
      }
      start.add(1, 'day');
    }
    
    return count;
  },
};

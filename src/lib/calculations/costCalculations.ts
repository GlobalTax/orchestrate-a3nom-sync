/**
 * Utility functions for cost-related calculations
 */

export const CostCalculations = {
  /**
   * Calculate hourly cost from total cost and hours worked
   */
  calculateHourlyCost(totalCost: number, hoursWorked: number): number {
    return hoursWorked > 0 ? totalCost / hoursWorked : 0;
  },

  /**
   * Calculate absenteeism rate as a percentage
   */
  calculateAbsenteeismRate(absenceHours: number, plannedHours: number): number {
    return plannedHours > 0 ? (absenceHours / plannedHours) * 100 : 0;
  },

  /**
   * Calculate variance between actual and planned values
   */
  calculateVariance(actual: number, planned: number) {
    const diff = actual - planned;
    const percentage = planned > 0 ? (diff / planned) * 100 : 0;
    return { 
      diff, 
      percentage,
      isOverBudget: diff > 0 
    };
  },

  /**
   * Calculate cost efficiency (worked hours / total hours)
   */
  calculateEfficiency(workedHours: number, totalHours: number): number {
    return totalHours > 0 ? (workedHours / totalHours) * 100 : 0;
  },

  /**
   * Format currency amount to EUR
   */
  formatCurrency(amount: number, locale = "es-ES"): string {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  },

  /**
   * Format percentage with specified decimal places
   */
  formatPercentage(value: number, decimals = 2): string {
    return `${value.toFixed(decimals)}%`;
  },

  /**
   * Calculate average cost from an array of cost values
   */
  calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  },

  /**
   * Round to 2 decimal places
   */
  round(value: number, decimals = 2): number {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  },
};

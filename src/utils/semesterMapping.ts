/**
 * Utility functions for year-semester mapping
 */

export interface YearSemesterMapping {
  [year: string]: string[];
}

/**
 * Maps academic years to their corresponding semesters
 */
export const YEAR_SEMESTER_MAPPING: YearSemesterMapping = {
  '1': ['1', '2'],           // 1st year: Sem 1, 2
  '2': ['3', '4'],           // 2nd year: Sem 3, 4
  '3': ['5', '6'],           // 3rd year: Sem 5, 6
  '4': ['7', '8'],           // 4th year: Sem 7, 8
  '1st': ['1', '2'],         // Alternative format
  '2nd': ['3', '4'],         // Alternative format
  '3rd': ['5', '6'],         // Alternative format
  '4th': ['7', '8']          // Alternative format
};

/**
 * Get available semesters for a given year
 */
export const getAvailableSemesters = (year: string): string[] => {
  if (!year) return [];
  
  // Normalize year format (remove st, nd, rd, th if present)
  const normalizedYear = year.replace(/(st|nd|rd|th)/i, '');
  
  return YEAR_SEMESTER_MAPPING[normalizedYear] || YEAR_SEMESTER_MAPPING[year] || [];
};

/**
 * Check if a semester is valid for a given year
 */
export const isValidSemesterForYear = (year: string, semester: string): boolean => {
  const availableSemesters = getAvailableSemesters(year);
  return availableSemesters.includes(semester);
};

/**
 * Get the default semester for a given year (first available)
 */
export const getDefaultSemesterForYear = (year: string): string => {
  const availableSemesters = getAvailableSemesters(year);
  return availableSemesters[0] || '';
};

/**
 * Convert year format (1 -> 1st, 2 -> 2nd, etc.)
 */
export const formatYear = (year: string): string => {
  if (!year) return '';
  const yearMapping: { [key: string]: string } = {
    '1': '1st',
    '2': '2nd', 
    '3': '3rd',
    '4': '4th'
  };
  return yearMapping[year] || year;
};

/**
 * Convert year format (1st -> 1, 2nd -> 2, etc.)
 */
export const normalizeYear = (year: string): string => {
  if (!year) return '';
  const yearMapping: { [key: string]: string } = {
    '1st': '1',
    '2nd': '2', 
    '3rd': '3',
    '4th': '4'
  };
  return yearMapping[year] || year.replace(/(st|nd|rd|th)/i, '');
};

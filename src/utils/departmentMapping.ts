// Department name mapping utility
// Maps full department names to short codes used in Firestore collections

export const DEPARTMENT_MAP: { [key: string]: string } = {
  'Computer Science': 'CSE',
  'Information Technology': 'IT',
  'Electronics and Communication': 'ECE',
  'Electrical and Electronics': 'EEE',
  'Mechanical Engineering': 'ME',
  'Civil Engineering': 'CE',
  'Artificial Intelligence & Machine Learning': 'AI&ML',
  'Data Science': 'Data Science'
};

/**
 * Maps a full department name to its short code
 * @param departmentName - The full department name (e.g., "Computer Science")
 * @returns The short department code (e.g., "CSE")
 */
export const getDepartmentCode = (departmentName?: string): string => {
  if (!departmentName) return 'CSE';
  return DEPARTMENT_MAP[departmentName] || 'CSE';
};

/**
 * Maps a short department code to its full name
 * @param departmentCode - The short department code (e.g., "CSE")
 * @returns The full department name (e.g., "Computer Science")
 */
export const getDepartmentName = (departmentCode: string): string => {
  const entry = Object.entries(DEPARTMENT_MAP).find(([_, code]) => code === departmentCode);
  return entry ? entry[0] : departmentCode;
};

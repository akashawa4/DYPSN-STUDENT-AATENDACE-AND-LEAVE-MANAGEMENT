import * as XLSX from 'xlsx';

// Sample student data for template
const templateData = [
  {
    name: 'John Doe',
    email: 'john.doe@dypsn.edu',
    phone: '+91 90000 00001',
    gender: 'Male',
    rollNumber: 'CS001',
    year: '2nd',
    sem: '3',
    div: 'A',
    department: 'Computer Science'
  },
  {
    name: 'Jane Smith',
    email: 'jane.smith@dypsn.edu',
    phone: '+91 90000 00002',
    gender: 'Female',
    rollNumber: 'CS002',
    year: '2nd',
    sem: '3',
    div: 'A',
    department: 'Computer Science'
  },
  {
    name: 'Mike Johnson',
    email: 'mike.johnson@dypsn.edu',
    phone: '+91 90000 00003',
    gender: 'Male',
    rollNumber: 'CS003',
    year: '2nd',
    sem: '3',
    div: 'A',
    department: 'Computer Science'
  }
];

// Create workbook and worksheet
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(templateData);

// Add worksheet to workbook
XLSX.utils.book_append_sheet(wb, ws, 'Students');

// Write to file
XLSX.writeFile(wb, 'student_import_template.xlsx');

console.log('✅ Student import template generated: student_import_template.xlsx');
console.log('\n📋 Template includes the following columns:');
console.log('- name (required): Full name of the student');
console.log('- email (required): Email address');
console.log('- phone (optional): Phone number');
console.log('- gender (optional): Male/Female/Other');
console.log('- rollNumber (required): Student roll number');
console.log('- year (optional): 1st/2nd/3rd/4th (default: 2nd)');
console.log('- sem (optional): 1/2/3/4/5/6/7/8 (default: 3)');
console.log('- div (optional): A/B/C/D (default: A)');
console.log('- department (optional): Department name (default: Computer Science)'); 
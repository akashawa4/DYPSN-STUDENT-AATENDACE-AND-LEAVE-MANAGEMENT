# Teacher Management System Guide

## Overview
The Teacher Management System allows HODs (Heads of Department) to manage faculty members in the CSE Attendance and Leave System. It provides comprehensive teacher information management, bulk import capabilities, and automatic authentication setup.

## Features

### 1. Teacher Information Management
- **Personal Details**: Name, email, phone, date of birth, gender, blood group
- **Academic Information**: Qualification, specialization, experience
- **Employment Details**: Department, designation, joining date, salary
- **Contact Information**: Address, emergency contact
- **Status Management**: Active/Inactive status

### 2. Bulk Operations
- **Import Teachers**: Upload Excel/CSV files with teacher data
- **Download Template**: Get a pre-filled template for bulk import
- **Export Data**: Download teacher information for external use

### 3. Search and Filter
- Search by name, email, or phone number
- Filter by department and designation
- Real-time search results

### 4. Mobile-Optimized Interface
- Responsive grid layout for mobile devices
- Touch-friendly interface
- Professional mobile design similar to popular apps

## Usage Instructions

### Adding Individual Teachers
1. Click "Add Teacher" button
2. Fill in all required fields
3. Click "Save" to create the teacher

### Bulk Import Teachers
1. Click "Excel Template" to download the template
2. Fill in teacher data in the template
3. Click "Import Excel" and select your file
4. The system will automatically import all teachers

### Managing Teachers
- **View Details**: Tap on any teacher card to see full information
- **Edit**: Click the edit icon on any teacher card
- **Delete**: Click the delete icon to remove a teacher
- **Search**: Use the search bar to find specific teachers
- **Filter**: Use department and designation filters to narrow results

## Data Structure

### Required Fields
- `name`: Full name of the teacher
- `email`: Email address (used as username for login)
- `phone`: Phone number (used as password for login)
- `department`: Department assignment
- `designation`: Academic rank/position

### Optional Fields
- `qualification`: Highest degree obtained
- `specialization`: Area of expertise
- `experience`: Years of experience
- `joiningDate`: Date of joining
- `salary`: Salary information
- `address`: Residential address
- `emergencyContact`: Emergency contact number
- `bloodGroup`: Blood group
- `dateOfBirth`: Date of birth
- `gender`: Gender
- `isActive`: Active status (true/false)

## Authentication Setup

### Automatic Login Creation
When teachers are added to the system:
1. **Username**: Teacher's email address
2. **Password**: Teacher's phone number
3. **Role**: Automatically set to 'teacher'
4. **Access Level**: Set to 'approver' for leave management

### Manual Authentication Setup
For existing teachers, run the Node.js script:
```bash
cd scripts
node createTeacherAuthUsers.js
```

**Prerequisites:**
- Firebase Admin SDK service account key
- Node.js and npm installed
- Firebase Admin SDK package installed

## File Formats

### Template Structure

The Excel template includes:
- Proper column widths for better readability
- Sample data for reference
- Formatted headers with clear descriptions
- Support for all teacher information fields

#### Sample Data Format
```csv
Name,Email,Phone,Department,Designation,Qualification,Specialization,Experience (Years),Joining Date (YYYY-MM-DD),Address,Emergency Contact,Blood Group,Date of Birth (YYYY-MM-DD),Gender,Is Active (true/false)
Dr. Aakash Patil,aakash.patil@college.edu,+91 9876543210,CSE,Assistant Professor,Ph.D.,Machine Learning,6,2020-07-01,Pune Maharashtra,+91 9123456780,O+,1985-05-12,Male,true
```

### Supported Import Formats
- `.xlsx` (Excel)
- `.xls` (Excel)
- `.csv` (Comma Separated Values)

## Security Features

### Role-Based Access
- Only HODs can access teacher management
- Teachers can view their own information
- Students cannot access teacher data

### Data Validation
- Email format validation
- Phone number validation
- Required field validation
- Duplicate email prevention

## Mobile Optimization

### Responsive Design
- Mobile-first approach
- Touch-friendly interface
- Optimized for small screens
- Professional app-like experience

### Navigation
- Bottom navigation bar
- Swipe gestures
- Touch feedback
- Smooth animations

## Troubleshooting

### Common Issues

1. **Import Fails**
   - Check file format (.xlsx, .xls, .csv)
   - Ensure all required fields are filled
   - Verify email format is correct

2. **Teacher Not Showing**
   - Check if teacher is marked as active
   - Verify department and designation filters
   - Ensure search terms match teacher data

3. **Authentication Issues**
   - Verify email and phone number are correct
   - Check if Firebase Auth user was created
   - Ensure teacher is marked as active

### Support
For technical support or questions:
- Check the console for error messages
- Verify Firebase configuration
- Ensure all required packages are installed

## Best Practices

### Data Management
- Keep teacher information up to date
- Use consistent naming conventions
- Regular backup of teacher data
- Validate data before import

### Security
- Regularly update passwords
- Monitor access logs
- Use strong authentication
- Limit admin access

### Performance
- Use bulk import for large datasets
- Implement proper indexing
- Optimize search queries
- Cache frequently accessed data

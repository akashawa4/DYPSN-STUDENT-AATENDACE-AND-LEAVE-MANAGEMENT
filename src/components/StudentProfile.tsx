import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface StudentProfileProps {
  name: string;
  gender: string;
  mobile: string;
  email: string;
  div: string;
  year: string;
  sem: string;
}

const StudentProfile: React.FC<StudentProfileProps> = (props) => {
  const { user } = useAuth();

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md p-8 border border-gray-200 mt-8">
      <h2 className="text-2xl font-bold text-blue-900 mb-6 text-center">Student Profile</h2>
      <div className="space-y-4">
        <div className="flex justify-between">
          <span className="font-semibold text-gray-700">Student Name:</span>
          <span className="text-gray-900">{props.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-gray-700">Gender:</span>
          <span className="text-gray-900">{props.gender}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-gray-700">Mobile No:</span>
          <span className="text-gray-900">{props.mobile}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-gray-700">E-Mail ID:</span>
          <span className="text-gray-900">{props.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-gray-700">Division:</span>
          <span className="text-gray-900">{props.div}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-gray-700">Year:</span>
          <span className="text-gray-900">{props.year}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-semibold text-gray-700">Semester:</span>
          <span className="text-gray-900">{props.sem}</span>
        </div>
      </div>
    </div>
  );
};

export default StudentProfile; 
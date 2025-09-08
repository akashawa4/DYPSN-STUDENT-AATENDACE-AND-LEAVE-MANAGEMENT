import React from 'react';
import { resultService, subjectService } from '../../firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { ResultRecord } from '../../types';
import { getDepartmentCode } from '../../utils/departmentMapping';

const EXAM_TYPES = ['UT1', 'UT2', 'Practical', 'Viva', 'Midterm', 'Endsem'];

const MyResults: React.FC = () => {
  const { user } = useAuth();
  const [results, setResults] = React.useState<ResultRecord[]>([]);
  const [filteredResults, setFilteredResults] = React.useState<ResultRecord[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [availableSubjects, setAvailableSubjects] = React.useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = React.useState<boolean>(false);
  const [selectedSubject, setSelectedSubject] = React.useState<string>('Advanced Database Systems');
  const [selectedExamType, setSelectedExamType] = React.useState<string>('UT1');

  React.useEffect(() => {
    const run = async () => {
      if (!user) return;
      setLoading(true);
      const data = await resultService.getMyResults(user.id);
      setResults(data);
      setFilteredResults(data);
      setLoading(false);
    };
    run();
  }, [user?.id]);

  // Load available subjects based on user's department and year
  React.useEffect(() => {
    const loadSubjects = async () => {
      if (!user) return;
      try {
        setSubjectsLoading(true);
        const deptCode = getDepartmentCode(user.department);
        const subs = await subjectService.getSubjectsByDepartment(deptCode, user.year || '1st', user.sem || '1');
        const names = subs.map(s => s.subjectName).sort();
        setAvailableSubjects(names);
      } catch (error) {
        console.error('Error loading subjects:', error);
        setAvailableSubjects([]);
      } finally {
        setSubjectsLoading(false);
      }
    };
    loadSubjects();
  }, [user?.department, user?.year, user?.sem]);

  // Filter results based on selected subject and exam type
  React.useEffect(() => {
    let filtered = results;
    
    // Only show results if both subject and exam type are selected
    if (selectedSubject && selectedExamType) {
      filtered = filtered.filter(r => r.subject === selectedSubject && r.examType === selectedExamType);
    } else {
      filtered = []; // Show no results if filters are not complete
    }
    
    setFilteredResults(filtered);
  }, [results, selectedSubject, selectedExamType]);

  // Group filtered results by subject => examType
  const grouped = React.useMemo(() => {
    const map: { [subject: string]: { [examType: string]: ResultRecord[] } } = {};
    filteredResults.forEach(r => {
      map[r.subject] = map[r.subject] || {};
      map[r.subject][r.examType] = map[r.subject][r.examType] || [];
      map[r.subject][r.examType].push(r);
    });
    return map;
  }, [filteredResults]);

  const clearFilters = () => {
    setSelectedSubject('Advanced Database Systems');
    setSelectedExamType('UT1');
  };

  return (
    <div className="bg-white p-4 rounded-lg border border-blue-200 shadow mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Results</h2>
          <p className="text-gray-600">View your academic results by subject and exam type</p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
            disabled={subjectsLoading}
          >
            {subjectsLoading ? (
              <option value="">Loading subjects...</option>
            ) : availableSubjects.length > 0 ? (
              availableSubjects.map(subject => (
                <option key={subject} value={subject}>{subject}</option>
              ))
            ) : (
              <option value="Advanced Database Systems">Advanced Database Systems</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
          <select
            value={selectedExamType}
            onChange={(e) => setSelectedExamType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2.5 sm:p-2 touch-manipulation"
          >
            {EXAM_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            onClick={clearFilters}
            className="w-full bg-gray-600 text-white px-4 py-2.5 sm:py-2 rounded-lg hover:bg-gray-700 touch-manipulation active:scale-95 transition-transform"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-gray-600 text-sm">Loading...</div>
      ) : filteredResults.length === 0 ? (
        <div className="text-center text-gray-500 py-6">
          {results.length === 0 ? (
            <div>
              <p className="text-lg font-medium mb-2">No results found</p>
              <p className="text-sm">Your results will appear here once they are entered by your teachers.</p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-medium mb-2">No results found for {selectedSubject} - {selectedExamType}</p>
              <p className="text-sm">Try selecting a different subject or exam type.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(grouped).sort().map(subject => (
            <div key={subject} className="border border-gray-200 rounded-lg">
              <div className="px-4 py-2 bg-gray-50 border-b text-sm font-semibold text-gray-800 flex items-center justify-between">
                <span>{subject}</span>
              </div>
              <div className="p-4 space-y-4">
                {Object.keys(grouped[subject]).sort().map(examType => (
                  <div key={examType}>
                    <div className="text-sm font-semibold text-gray-700 mb-2">{examType}</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Attempt</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Marks</th>
                            <th className="px-3 py-2 text-left font-medium text-gray-600">Percentage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grouped[subject][examType].map((r, idx) => (
                            <tr key={`${r.id}_${idx}`} className="border-t border-gray-100">
                              <td className="px-3 py-2 text-gray-800">{idx + 1}</td>
                              <td className="px-3 py-2 text-gray-800">{r.marksObtained} / {r.maxMarks}</td>
                              <td className="px-3 py-2 text-gray-700">{typeof r.percentage === 'number' ? `${r.percentage.toFixed(1)}%` : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyResults;



import React, { useState } from 'react';
import { userService } from '../firebase/firestore';
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
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ ...props });
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setSuccess('');
    try {
      await userService.updateUser(user.id, {
        name: form.name,
        gender: form.gender,
        phone: form.mobile,
        email: form.email,
        div: form.div,
        year: form.year,
        sem: form.sem
      });
      setSuccess('Profile updated successfully!');
      setEditMode(false);
    } catch (err) {
      setSuccess('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({ ...props });
    setEditMode(false);
    setSuccess('');
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-md p-8 border border-gray-200 mt-8">
      <h2 className="text-2xl font-bold text-blue-900 mb-6 text-center">Student Profile</h2>
      {success && <div className={`mb-4 p-2 rounded text-center ${success.includes('success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{success}</div>}
      <div className="space-y-4">
        {editMode ? (
          <>
            <div className="flex flex-col">
              <label className="font-semibold text-gray-700 mb-1">Student Name</label>
              <input name="name" value={form.name} onChange={handleChange} className="border rounded p-2" disabled={isSaving} />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-gray-700 mb-1">Gender</label>
              <select name="gender" value={form.gender} onChange={handleChange} className="border rounded p-2" disabled={isSaving}>
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-gray-700 mb-1">Mobile No</label>
              <input name="mobile" value={form.mobile} onChange={handleChange} className="border rounded p-2" disabled={isSaving} />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-gray-700 mb-1">E-Mail ID</label>
              <input name="email" value={form.email} onChange={handleChange} className="border rounded p-2" disabled={isSaving} />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-gray-700 mb-1">Division</label>
              <input name="div" value={form.div} onChange={handleChange} className="border rounded p-2" disabled={isSaving} />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-gray-700 mb-1">Year</label>
              <input name="year" value={form.year} onChange={handleChange} className="border rounded p-2" disabled={isSaving} />
            </div>
            <div className="flex flex-col">
              <label className="font-semibold text-gray-700 mb-1">Semester</label>
              <input name="sem" value={form.sem} onChange={handleChange} className="border rounded p-2" disabled={isSaving} />
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button onClick={handleCancel} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300" disabled={isSaving}>Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">Student Name:</span>
              <span className="text-gray-900">{form.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">Gender:</span>
              <span className="text-gray-900">{form.gender}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">Mobile No:</span>
              <span className="text-gray-900">{form.mobile}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">E-Mail ID:</span>
              <span className="text-gray-900">{form.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">Division:</span>
              <span className="text-gray-900">{form.div}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">Year:</span>
              <span className="text-gray-900">{form.year}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-700">Semester:</span>
              <span className="text-gray-900">{form.sem}</span>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setEditMode(true)} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Edit</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StudentProfile; 
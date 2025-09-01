import React, { useState } from 'react';
import { LogIn, Mail, Smartphone } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login, isLoading } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await login(email, password);
      setSuccess('Login successful!');
    } catch (err: any) {
      // Provide more specific error messages
      if (err.message.includes('phone number')) {
        setError('Student account found but phone number is missing. Please contact administrator.');
      } else if (err.message.includes('Invalid password')) {
        setError('Invalid password. Please check your credentials.');
      } else if (err.message.includes('User not found')) {
        setError('User not found. Please check your email or contact administrator.');
      } else {
        setError(err.message || 'Invalid credentials. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-mobile">
            <span className="text-white font-bold text-3xl">D</span>
          </div>
          <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">DYPSN Portal</h2>
          <p className="text-gray-600 text-sm lg:text-base">Digital Leave & Attendance System</p>
          
          {/* Mobile indicator */}
          <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-gray-500">
            <Smartphone className="w-4 h-4" />
            <span>Mobile Optimized</span>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-mobile-lg border border-gray-200 overflow-hidden">
          <div className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label-mobile">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-mobile"
                  placeholder="Enter your email address"
                  required
                />
              </div>
              
              <div>
                <label className="label-mobile">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-mobile"
                  placeholder="Enter your password"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Students: Use your phone number as password
                  <br />
                  <span className="text-blue-600">Format: 10-digit number (e.g., 9876543210)</span>
                </p>
              </div>
              
              {error && (
                <div className="error-mobile">
                  <p className="text-sm">{error}</p>
                </div>
              )}
              
              {success && (
                <div className="success-mobile">
                  <p className="text-sm">{success}</p>
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading}
                className="btn-mobile w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    <span>Sign In</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 space-y-2">
          <p>Optimized for mobile devices</p>
          <p>© 2025 DYPSN. All rights reserved.</p>
          <p>
            Designed and Developed by{' '}
            <span className="font-semibold text-blue-600">
              Akash.Solution
            </span>
            {' '}
            <span className="text-gray-500">
              (Akash Vijay Awachar)
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
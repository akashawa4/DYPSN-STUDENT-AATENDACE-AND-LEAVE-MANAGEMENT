import React, { useState } from 'react';
import { LogIn, Mail, User, Smartphone, Monitor } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<'email' | 'demo'>('email');
  const { sendEmailLink, login, isLoading, ensureDemoUsersInFirestore } = useAuth();

  const handleEmailLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await sendEmailLink(email);
      setSuccess('Sign-in link sent! Check your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to send sign-in link.');
    }
  };

  const handleDemoLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await login(email, 'demo123');
    } catch (err: any) {
      setError('Invalid credentials. Please try again.');
    }
  };

  const handleEnsureDemoUsers = async () => {
    setError('');
    setSuccess('');
    try {
      await ensureDemoUsersInFirestore();
      setSuccess('All demo users have been ensured in Firestore!');
    } catch (err: any) {
      setError('Failed to ensure demo users in Firestore.');
    }
  };

  const demoUsers = [
    { role: 'Student', email: 'student.demo@dypsn.edu', password: 'demo123' },
    { role: 'Teacher', email: 'teacher.demo@dypsn.edu', password: 'demo123' },
    { role: 'HOD', email: 'hod.demo@dypsn.edu', password: 'demo123' }
  ];

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
          {/* Tab Navigation */}
          <div className="flex bg-gray-50">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 ${
                activeTab === 'email' 
                  ? 'bg-white text-blue-600 shadow-mobile border-t-2 border-blue-600' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">Email Link</span>
                <span className="sm:hidden">Email</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('demo')}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-200 ${
                activeTab === 'demo' 
                  ? 'bg-white text-blue-600 shadow-mobile border-t-2 border-blue-600' 
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center justify-center space-x-2">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Demo Account</span>
                <span className="sm:hidden">Demo</span>
              </div>
            </button>
          </div>

          {/* Form Content */}
          <div className="p-6">
            {activeTab === 'email' && (
              <form onSubmit={handleEmailLink} className="space-y-4">
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
                      <span>Sending link...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-5 h-5" />
                      <span>Send Sign-In Link</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {activeTab === 'demo' && (
              <form onSubmit={handleDemoLogin} className="space-y-4">
                <div>
                  <label className="label-mobile">
                    Demo Account
                  </label>
                  
                  {/* Demo Account Quick Select */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {demoUsers.map((user, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setEmail(user.email)}
                        className={`text-xs py-2 px-2 rounded-lg font-medium transition-all duration-200 active:scale-95 ${
                          email === user.email
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {user.role}
                      </button>
                    ))}
                  </div>
                  
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-mobile"
                    placeholder="Demo account email"
                    required
                  />
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
                
                <div className="space-y-3">
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
                        <User className="w-5 h-5" />
                        <span>Sign In as Demo</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleEnsureDemoUsers}
                    className="btn-mobile w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold hover:from-green-700 hover:to-emerald-700 text-sm"
                  >
                    <span>Ensure Demo Users in Firestore</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 space-y-2">
          <p>Optimized for mobile devices</p>
          <p>© 2024 DYPSN. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
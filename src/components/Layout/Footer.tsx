import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-4 px-4 lg:px-6 mt-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row items-center justify-between">
          <div className="text-center lg:text-left mb-2 lg:mb-0">
            <p className="text-sm text-gray-600">
              © 2025 DYPSN. All rights reserved.
            </p>
          </div>
          <div className="text-center lg:text-right">
            <p className="text-sm text-gray-600">
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
    </footer>
  );
};

export default Footer;

import React, { useState } from 'react';
import { Upload, Download, Clock, Users, CheckCircle, AlertTriangle, FileText, Settings } from 'lucide-react';
import { attendanceService } from '../../firebase/firestore';

interface ESLDevice {
  id: string;
  name: string;
  location: string;
  ipAddress: string;
  status: 'online' | 'offline';
  lastSync: Date;
}

const ESLBiometricIntegration: React.FC = () => {
  const [devices, setDevices] = useState<ESLDevice[]>([
    {
      id: 'ESL001',
      name: 'Main Gate Biometric',
      location: 'Main Entrance',
      ipAddress: '192.168.1.100',
      status: 'online',
      lastSync: new Date()
    },
    {
      id: 'ESL002',
      name: 'Staff Room Biometric',
      location: 'Staff Room',
      ipAddress: '192.168.1.101',
      status: 'online',
      lastSync: new Date()
    }
  ]);

  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [syncDate, setSyncDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const handleManualSync = async () => {
    if (!selectedDevice) {
      setSyncStatus({ type: 'error', message: 'Please select a device first' });
      return;
    }

    setIsSyncing(true);
    setSyncStatus({ type: 'info', message: 'Syncing attendance data...' });

    try {
      const startDate = new Date(syncDate);
      const endDate = new Date(syncDate);
      endDate.setDate(endDate.getDate() + 1);

      await attendanceService.syncESLAttendance(selectedDevice, startDate, endDate);
      
      setSyncStatus({ 
        type: 'success', 
        message: `Successfully synced attendance data for ${syncDate}` 
      });

      // Update device last sync time
      setDevices(prev => prev.map(device => 
        device.id === selectedDevice 
          ? { ...device, lastSync: new Date() }
          : device
      ));

    } catch (error) {
      setSyncStatus({ 
        type: 'error', 
        message: `Sync failed: ${error}` 
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBulkImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSyncing(true);
    setSyncStatus({ type: 'info', message: 'Importing attendance data...' });

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Parse ESL machine export format
      const eslData = lines.map((line, index) => {
        const parts = line.split(',');
        return {
          rollNumber: parts[0]?.trim(),
          employeeName: parts[1]?.trim(),
          date: parts[2]?.trim(),
          clockIn: parts[3]?.trim(),
          clockOut: parts[4]?.trim(),
          deviceId: parts[5]?.trim() || 'ESL001',
          location: parts[6]?.trim() || 'Main Gate'
        };
      }).filter(record => record.rollNumber && record.date);

      await attendanceService.importESLAttendanceData(eslData);
      
      setSyncStatus({ 
        type: 'success', 
        message: `Successfully imported ${eslData.length} attendance records` 
      });

    } catch (error) {
      setSyncStatus({ 
        type: 'error', 
        message: `Import failed: ${error}` 
      });
    } finally {
      setIsSyncing(false);
      event.target.value = '';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'online' ? 'text-green-600' : 'text-red-600';
  };

  const getStatusIcon = (status: string) => {
    return status === 'online' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ESL Biometric Integration</h1>
          <p className="text-gray-600">Manage attendance data from ESL biometric thumb scan machines</p>
        </div>
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5 text-gray-500" />
          <span className="text-sm text-gray-500">Device Management</span>
        </div>
      </div>

      {/* Device Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((device) => (
          <div key={device.id} className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{device.name}</h3>
              <div className={`flex items-center space-x-1 ${getStatusColor(device.status)}`}>
                {getStatusIcon(device.status)}
                <span className="text-sm font-medium capitalize">{device.status}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p><span className="font-medium">Location:</span> {device.location}</p>
              <p><span className="font-medium">IP Address:</span> {device.ipAddress}</p>
              <p><span className="font-medium">Last Sync:</span> {device.lastSync.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sync Controls */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Manual Sync</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Device
            </label>
            <select
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Choose a device</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} ({device.location})
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sync Date
            </label>
            <input
              type="date"
              value={syncDate}
              onChange={(e) => setSyncDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleManualSync}
              disabled={isSyncing || !selectedDevice}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isSyncing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Syncing...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Sync Data</span>
                </>
              )}
            </button>
          </div>
        </div>

        {syncStatus && (
          <div className={`p-4 rounded-lg ${
            syncStatus.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
            syncStatus.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
            'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            {syncStatus.message}
          </div>
        )}
      </div>

      {/* Bulk Import */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bulk Import</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Import ESL Export File
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleBulkImport}
                disabled={isSyncing}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              />
              <div className="text-sm text-gray-500">
                <p>Supported formats: CSV, TXT</p>
                <p>Expected columns: EmployeeID, Name, Date, ClockIn, ClockOut, DeviceID, Location</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Sample ESL Export Format:</h4>
            <pre className="text-sm text-gray-600 bg-white p-2 rounded border">
{`EMP001,John Doe,2024-03-22,09:15:00,17:30:00,ESL001,Main Gate
EMP002,Jane Smith,2024-03-22,08:45:00,17:15:00,ESL001,Main Gate
EMP003,Bob Johnson,2024-03-22,09:30:00,17:45:00,ESL002,Staff Room`}
            </pre>
          </div>
        </div>
      </div>

      {/* Integration Status */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Integration Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Connected Devices</h4>
            <div className="space-y-2">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{device.name}</p>
                    <p className="text-sm text-gray-600">{device.ipAddress}</p>
                  </div>
                  <div className={`flex items-center space-x-1 ${getStatusColor(device.status)}`}>
                    {getStatusIcon(device.status)}
                    <span className="text-sm font-medium">{device.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Recent Activity</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900">Last sync successful</p>
                  <p className="text-xs text-green-700">2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                <Clock className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Auto-sync scheduled</p>
                  <p className="text-xs text-blue-700">Every 30 minutes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ESLBiometricIntegration; 
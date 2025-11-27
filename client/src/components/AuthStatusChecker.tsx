import React, { useState } from 'react';
import { useAuth } from '../hooks/use-auth';
import { getCurrentUser, logAuthStatus, checkFirebaseConnection } from '../lib/authCheck';

const AuthStatusChecker: React.FC = () => {
  const { user, loading } = useAuth();
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState<string>('');

  const performDetailedCheck = async () => {
    setIsChecking(true);
    
    try {
      console.log('🔍 DETAILED AUTHENTICATION CHECK');
      console.log('=' .repeat(40));
      
      // Check current user from Firebase Auth directly
      const currentUser = getCurrentUser();
      console.log('🔐 Direct Firebase Auth user:', currentUser?.email || 'None');
      
      // Log detailed auth status
      logAuthStatus();
      
      // Check Firebase connection
      const connected = await checkFirebaseConnection();
      
      setLastCheck(new Date().toLocaleTimeString());
      
      if (currentUser && connected) {
        console.log('✅ ALL CHECKS PASSED - Ready for uploads');
      } else {
        console.log('❌ AUTHENTICATION OR CONNECTION ISSUES');
      }
      
    } catch (error) {
      console.error('❌ Auth check error:', error);
    } finally {
      setIsChecking(false);
    }
  };

  if (loading) {
    return <div className="text-blue-600">Checking authentication...</div>;
  }

  return (
    <div className="bg-gray-100 p-4 rounded-lg mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800">🔐 Authentication Status</h3>
        <button
          onClick={performDetailedCheck}
          disabled={isChecking}
          className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
            isChecking 
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isChecking ? '🔄 Checking...' : '🔍 Detailed Check'}
        </button>
      </div>
      
      {user ? (
        <div className="text-green-600 space-y-1">
          <div>✅ Authenticated as: {user.email}</div>
          <div>🆔 UID: {user.uid}</div>
          <div>👤 Role: {user.role}</div>
          <div>🔗 Provider: {user.providerId}</div>
          {lastCheck && <div className="text-xs text-gray-500">Last detailed check: {lastCheck}</div>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-red-600">❌ Not authenticated</div>
          <div className="text-sm text-red-700 bg-red-50 p-2 rounded">
            <strong>⚠️ Upload will fail!</strong> Please sign in before uploading images.
          </div>
        </div>
      )}
      
      {/* Upload readiness indicator */}
      <div className="mt-3 text-sm">
        {user ? (
          <div className="bg-green-50 border border-green-200 text-green-800 p-2 rounded">
            ✅ Ready for Firebase Storage uploads
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded">
            🚫 Not ready - Authentication required
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthStatusChecker;

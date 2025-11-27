import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { firestore, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RefreshCw, Database, User, CheckCircle, XCircle } from 'lucide-react';

interface FirebaseTestResult {
  connectionStatus: 'success' | 'error' | 'loading';
  userStatus: 'authenticated' | 'anonymous' | 'error';
  expeditionsCount: number;
  localStorageCount: number;
  error?: string;
}

export default function FirebaseExpeditionTest() {
  const [testResult, setTestResult] = useState<FirebaseTestResult>({
    connectionStatus: 'loading',
    userStatus: 'anonymous',
    expeditionsCount: 0,
    localStorageCount: 0
  });

  const runTest = async () => {
    setTestResult(prev => ({ ...prev, connectionStatus: 'loading' }));
    
    try {
      // Test user authentication status
      const userStatus = auth.currentUser ? 'authenticated' : 'anonymous';
      const currentUserId = auth.currentUser?.uid || 'USER123';
      
      // Count localStorage expeditions
      const savedExpeditions = localStorage.getItem('savedExpeditions');
      const localStorageCount = savedExpeditions ? JSON.parse(savedExpeditions).length : 0;
      
      // Test Firestore connection
      let expeditionsCount = 0;
      try {
        const q = query(
          collection(firestore, 'expeditions'),
          where('userId', '==', currentUserId),
          orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        expeditionsCount = querySnapshot.size;
        
        setTestResult({
          connectionStatus: 'success',
          userStatus,
          expeditionsCount,
          localStorageCount
        });
      } catch (firestoreError) {
        console.error('Firestore error:', firestoreError);
        setTestResult({
          connectionStatus: 'error',
          userStatus,
          expeditionsCount: 0,
          localStorageCount,
          error: firestoreError instanceof Error ? firestoreError.message : 'Unknown Firestore error'
        });
      }
    } catch (error) {
      setTestResult({
        connectionStatus: 'error',
        userStatus: 'error',
        expeditionsCount: 0,
        localStorageCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'authenticated':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'loading':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <XCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Firebase Expedition Test</h2>
        <Button onClick={runTest} disabled={testResult.connectionStatus === 'loading'}>
          <RefreshCw className={`h-4 w-4 mr-2 ${testResult.connectionStatus === 'loading' ? 'animate-spin' : ''}`} />
          Test Again
        </Button>
      </div>

      <div className="space-y-4">
        {/* Connection Status */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Database className="h-6 w-6 text-blue-500" />
              <div>
                <h3 className="font-semibold">Firebase Connection</h3>
                <p className="text-sm text-gray-500">
                  {testResult.connectionStatus === 'loading' ? 'Testing connection...' :
                   testResult.connectionStatus === 'success' ? 'Connected successfully' :
                   'Connection failed'}
                </p>
              </div>
            </div>
            {getStatusIcon(testResult.connectionStatus)}
          </div>
          {testResult.error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm text-red-700">{testResult.error}</p>
            </div>
          )}
        </Card>

        {/* User Status */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <User className="h-6 w-6 text-green-500" />
              <div>
                <h3 className="font-semibold">User Authentication</h3>
                <p className="text-sm text-gray-500">
                  {testResult.userStatus === 'authenticated' ? 
                    `Authenticated: ${auth.currentUser?.email || auth.currentUser?.uid}` :
                    'Using fallback user ID: USER123'}
                </p>
              </div>
            </div>
            {getStatusIcon(testResult.userStatus)}
          </div>
        </Card>

        {/* Data Counts */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{testResult.expeditionsCount}</div>
              <p className="text-sm text-gray-500">Firebase Expeditions</p>
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{testResult.localStorageCount}</div>
              <p className="text-sm text-gray-500">Local Storage Expeditions</p>
            </div>
          </Card>
        </div>

        {/* Instructions */}
        <Card className="p-4 bg-blue-50">
          <h3 className="font-semibold text-blue-800 mb-2">How Firebase Saving Works:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>Expedition Data:</strong> Saved to both Firebase Firestore and localStorage</li>
            <li>• <strong>PDF Files:</strong> Saved only to localStorage (due to CORS issues)</li>
            <li>• <strong>User ID:</strong> Uses authenticated user ID or fallback "USER123"</li>
            <li>• <strong>Fallback:</strong> Works offline with localStorage if Firebase fails</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

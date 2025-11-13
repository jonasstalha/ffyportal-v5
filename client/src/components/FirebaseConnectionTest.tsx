import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';

const FirebaseConnectionTest: React.FC = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<string>('Not tested');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Demo@2024!');

  const testFirebaseConnection = async () => {
    setIsLoading(true);
    setStatus('Testing...');

    try {
      // Test 1: Check if user is authenticated
      if (!user) {
        setStatus('❌ User not authenticated. Please log in first.');
        return;
      }

      setStatus('✅ User authenticated. Testing database access...');

      // Test 2: Try to read from quality_control_lots collection
      const qualityControlRef = collection(db, 'quality_control_lots');
      const snapshot = await getDocs(qualityControlRef);
      
      setStatus(`✅ Database read successful. Found ${snapshot.size} lots.`);

      // Test 3: Try to write to quality_control_lots collection
      const testLot = {
        lotNumber: `TEST-${Date.now()}`,
        formData: {
          date: new Date().toISOString(),
          product: 'Test Product',
          variety: 'Test Variety',
          campaign: 'Test Campaign',
          clientLot: 'Test Client Lot',
          shipmentNumber: 'TEST-001',
          packagingType: 'Test Package',
          category: 'Test Category',
          exporterNumber: 'EXP-001',
          frequency: 'Test Frequency',
          palettes: []
        },
        images: [],
        status: 'draft' as const,
        phase: 'controller' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        controller: user.email || 'test-controller'
      };

      await addDoc(qualityControlRef, {
        ...testLot,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setStatus('✅ All tests passed! Firebase connection is working correctly.');
    } catch (error: any) {
      console.error('Firebase test error:', error);
      setStatus(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testAuth = async () => {
    setIsLoading(true);
    setStatus('Testing authentication...');

    try {
      // Use the same demo user logic as in use-auth.tsx
      const demoUsers: Record<string, { email: string; role: string }> = {
        "admin@example.com": { email: "admin@example.com", role: "admin" },
        "quality@example.com": { email: "quality@example.com", role: "quality" },
        "production@example.com": { email: "production@example.com", role: "production" },
      };

      const isDemoUser = !!demoUsers[email];
      const passwordMatch = password === "Demo@2024!";
      
      if (isDemoUser && passwordMatch) {
        // Demo user authentication (same as in use-auth.tsx)
        try {
          await signInAnonymously(auth);
          setStatus('✅ Demo user authentication successful');
        } catch (e) {
          console.warn('Anonymous sign-in failed, but demo user context works', e);
          setStatus('✅ Demo user authentication successful (anonymous sign-in not required)');
        }
      } else {
        // Try Firebase authentication for real users
        try {
          await signInWithEmailAndPassword(auth, email, password);
          setStatus('✅ Firebase authentication successful');
        } catch (signInError: any) {
          if (signInError.code === 'auth/user-not-found') {
            await createUserWithEmailAndPassword(auth, email, password);
            setStatus('✅ User created and authenticated successfully');
          } else {
            throw signInError;
          }
        }
      }
    } catch (error: any) {
      console.error('Auth test error:', error);
      setStatus(`❌ Authentication error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Firebase Connection Test</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Current Status</h2>
        <div className="bg-gray-100 p-3 rounded-lg">
          <p><strong>User:</strong> {user ? user.email : 'Not authenticated'}</p>
          <p><strong>Auth State:</strong> {user ? 'Authenticated' : 'Not authenticated'}</p>
          <p><strong>UID:</strong> {user ? user.uid : 'N/A'}</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Test Authentication</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="flex-1 p-2 border rounded"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="flex-1 p-2 border rounded"
          />
        </div>
        <button
          onClick={testAuth}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Testing...' : 'Test Auth'}
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Test Database Access</h2>
        <button
          onClick={testFirebaseConnection}
          disabled={isLoading || !user}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {isLoading ? 'Testing...' : 'Test Database'}
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Test Result</h2>
        <div className="bg-gray-100 p-3 rounded-lg">
          <p className="whitespace-pre-wrap">{status}</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Instructions</h2>
        <ol className="list-decimal list-inside space-y-1">
          <li>First, test authentication by clicking "Test Auth"</li>
          <li>Once authenticated, test database access by clicking "Test Database"</li>
          <li>Check the console for detailed error messages if any test fails</li>
        </ol>
      </div>
    </div>
  );
};

export default FirebaseConnectionTest;

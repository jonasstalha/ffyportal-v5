import React, { useState } from 'react';
import { saveQualityControlLot } from '@/lib/qualityControlService';
import { useAuth } from '@/hooks/use-auth';

const QualityControlSaveTest: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testSaveWithUndefinedValues = async () => {
    if (!user) {
      setError('Please log in first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Create a test lot with undefined values that should be cleaned up
      const testLot = {
        id: `test-lot-${Date.now()}`,
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
        controller: user.email || 'test-controller',
        // These fields should be undefined for controller phase
        chief: undefined,
        chiefComments: undefined,
        chiefApprovalDate: undefined
      };

      const savedId = await saveQualityControlLot(testLot);
      setResult(`Successfully saved lot with ID: ${savedId}`);
    } catch (err: any) {
      console.error('Save test error:', err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const testSaveWithDefinedValues = async () => {
    if (!user) {
      setError('Please log in first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Create a test lot with all values defined
      const testLot = {
        id: `test-lot-${Date.now()}`,
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
        status: 'chief_approved' as const,
        phase: 'chief' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        controller: user.email || 'test-controller',
        chief: 'test-chief@example.com',
        chiefComments: 'Test approval comments',
        chiefApprovalDate: new Date().toISOString()
      };

      const savedId = await saveQualityControlLot(testLot);
      setResult(`Successfully saved lot with ID: ${savedId}`);
    } catch (err: any) {
      console.error('Save test error:', err);
      setError(err.message || 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Quality Control Save Test</h1>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">User Status</h2>
        <div className="bg-gray-100 p-3 rounded-lg">
          <p><strong>User:</strong> {user ? user.email : 'Not authenticated'}</p>
          <p><strong>UID:</strong> {user ? user.uid : 'N/A'}</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Test Scenarios</h2>
        
        <div className="space-y-3">
          <button
            onClick={testSaveWithUndefinedValues}
            disabled={isLoading || !user}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Testing...' : 'Test Save with Undefined Values (Controller Phase)'}
          </button>

          <button
            onClick={testSaveWithDefinedValues}
            disabled={isLoading || !user}
            className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {isLoading ? 'Testing...' : 'Test Save with Defined Values (Chief Phase)'}
          </button>
        </div>
      </div>

      {result && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Success Result</h2>
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {result}
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Error Result</h2>
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Test Description</h2>
        <div className="bg-gray-100 p-3 rounded-lg text-sm">
          <p className="mb-2">
            This test verifies that the Firebase save function properly handles undefined values:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Test 1:</strong> Controller phase lot with undefined chief fields</li>
            <li><strong>Test 2:</strong> Chief phase lot with all fields defined</li>
            <li>Both tests should succeed without "invalid data" errors</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default QualityControlSaveTest;

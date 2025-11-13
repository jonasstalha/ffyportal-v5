import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { firestore, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, Database, Plus, List, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function FirebaseExpeditionTestSimple() {
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [expeditions, setExpeditions] = useState<any[]>([]);
  const [transporteur, setTransporteur] = useState('Test Transporteur');
  const [destination, setDestination] = useState('Test Destination');

  const testFirebaseConnection = async () => {
    setIsLoading(true);
    setTestResult('');
    
    try {
      // Test 1: Create a test expedition
      const testExpedition = {
        id: `test_${Date.now()}`,
        name: `Test_${transporteur}_${new Date().toISOString().split('T')[0]}`,
        date: new Date().toISOString().split('T')[0],
        headerData: {
          transporteur,
          destination,
          date: new Date().toISOString().split('T')[0],
          heure: new Date().toLocaleTimeString()
        },
        rows: [
          { palletNo: 1, nbrColis: '10', produitVariete: 'Hass', calibre: '14-16' }
        ],
        userId: auth.currentUser?.uid || 'USER123',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Add to Firestore
      const docRef = await addDoc(collection(firestore, 'expeditions'), testExpedition);
      setTestResult(`✅ SUCCESS: Created expedition with ID: ${docRef.id}`);
      
      // Test 2: Read back the data
      await loadExpeditions();
      
      toast.success('Firebase test completed successfully!');
    } catch (error) {
      console.error('Firebase test failed:', error);
      setTestResult(`❌ ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast.error('Firebase test failed');
    } finally {
      setIsLoading(false);
    }
  };

  const loadExpeditions = async () => {
    try {
      const currentUserId = auth.currentUser?.uid || 'USER123';
      const q = query(
        collection(firestore, 'expeditions'),
        where('userId', '==', currentUserId)
      );
      
      const querySnapshot = await getDocs(q);
      const loadedExpeditions = querySnapshot.docs.map(doc => ({
        firestoreId: doc.id,
        ...doc.data()
      }));
      
      setExpeditions(loadedExpeditions);
      setTestResult(prev => prev + `\n✅ Loaded ${loadedExpeditions.length} expeditions from Firebase`);
    } catch (error) {
      console.error('Error loading expeditions:', error);
      setTestResult(prev => prev + `\n❌ Error loading: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const clearTestData = async () => {
    try {
      // Note: In a real app, you'd implement delete functionality
      // For this test, we'll just reload to see current state
      await loadExpeditions();
      toast.success('Refreshed expedition list');
    } catch (error) {
      toast.error('Error refreshing data');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Firebase Expedition Backend Test</h1>
        <p className="text-gray-600">Test if expedition data is properly saved to Firebase Firestore</p>
      </div>

      {/* Test Controls */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Database className="h-5 w-5" />
          Test Firebase Connection
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Transporteur</label>
            <Input
              value={transporteur}
              onChange={(e) => setTransporteur(e.target.value)}
              placeholder="Enter transporteur name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Destination</label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Enter destination"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={testFirebaseConnection}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Testing...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Test Expedition
              </>
            )}
          </Button>
          
          <Button 
            onClick={loadExpeditions}
            variant="outline"
            className="flex items-center gap-2"
          >
            <List className="h-4 w-4" />
            Load Expeditions
          </Button>
          
          <Button 
            onClick={clearTestData}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            Refresh Data
          </Button>
        </div>
      </Card>

      {/* Test Results */}
      {testResult && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            {testResult.includes('ERROR') ? (
              <XCircle className="h-5 w-5 text-red-500" />
            ) : (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            Test Results
          </h3>
          <pre className="bg-gray-100 p-4 rounded text-sm whitespace-pre-wrap overflow-x-auto">
            {testResult}
          </pre>
        </Card>
      )}

      {/* Current Expeditions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <List className="h-5 w-5" />
          Firebase Expeditions ({expeditions.length})
        </h3>
        
        {expeditions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No expeditions found in Firebase</p>
            <p className="text-sm">Create a test expedition to verify the connection</p>
          </div>
        ) : (
          <div className="space-y-3">
            {expeditions.map((exp, index) => (
              <div key={exp.firestoreId || index} className="border rounded p-4 bg-gray-50">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{exp.name}</h4>
                    <p className="text-sm text-gray-600">
                      {exp.headerData?.transporteur} → {exp.headerData?.destination}
                    </p>
                    <p className="text-xs text-gray-500">
                      Date: {exp.date} | Firebase ID: {exp.firestoreId}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      User ID: {exp.userId}
                    </div>
                    <div className="text-xs text-gray-500">
                      Rows: {exp.rows?.length || 0}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Instructions */}
      <Card className="p-6 bg-blue-50">
        <h3 className="text-lg font-semibold mb-2 text-blue-800">How to Use:</h3>
        <ol className="text-sm text-blue-700 space-y-1">
          <li>1. Click "Create Test Expedition" to save a test expedition to Firebase</li>
          <li>2. Check the test results to see if it was successful</li>
          <li>3. Click "Load Expeditions" to verify data is readable from Firebase</li>
          <li>4. Go to <a href="/logistique/fichedexpidition" className="underline">Fiche d'Expédition</a> to create real expeditions</li>
          <li>5. Go to <a href="/logistique/history" className="underline">History</a> to see all saved expeditions</li>
        </ol>
      </Card>
    </div>
  );
}

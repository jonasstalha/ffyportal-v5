import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { firestore, auth } from '@/lib/firebase';

export default function ExpeditionHistoryTest() {
  const [testResult, setTestResult] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = (message: string) => {
    setTestResult(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log(message);
  };

  const testFullFlow = async () => {
    setIsLoading(true);
    setTestResult([]);
    
    try {
      addLog('🧪 Starting complete expedition history test...');
      
      // Step 1: Create test expedition data
      const expeditionId = `test_hist_${Date.now()}`;
      const expeditionData = {
        id: expeditionId,
        name: `Test History Expedition ${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        headerData: {
          date: new Date().toISOString().split('T')[0],
          heure: new Date().toLocaleTimeString(),
          transporteur: 'Test Transporteur History',
          matricule: 'HIST123',
          tempCamion: '2',
          hygiene: 'Bon',
          odeur: 'Bon', 
          destination: 'Test Destination History',
          thermokingEtat: 'Bon'
        },
        rows: [
          {
            palletNo: 1,
            nbrColis: '15',
            produitVariete: 'Hass',
            calibre: '16-18',
            temperatureProduit: '2.0',
            etatPalette: 'C',
            conformiteEtiquettes: 'C',
            dessiccation: 'C'
          }
        ],
        pdfURL: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      addLog(`📝 Created test expedition data with ID: ${expeditionId}`);
      
      // Step 2: Save to localStorage (like expedition form does)
      const savedExpeditions = localStorage.getItem('savedExpeditions');
      let expeditionsArray = [];
      
      if (savedExpeditions) {
        expeditionsArray = JSON.parse(savedExpeditions);
      }
      expeditionsArray.push(expeditionData);
      localStorage.setItem('savedExpeditions', JSON.stringify(expeditionsArray));
      addLog(`💾 Saved to localStorage (${expeditionsArray.length} total expeditions)`);
      
      // Step 3: Save to Firebase (like expedition form does)
      try {
        const currentUserId = auth.currentUser?.uid || 'USER123';
        addLog(`👤 Using user ID: ${currentUserId}`);
        
        const docRef = await addDoc(collection(firestore, 'expeditions'), {
          ...expeditionData,
          userId: currentUserId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        addLog(`✅ Saved to Firebase with doc ID: ${docRef.id}`);
      } catch (firebaseError: any) {
        addLog(`❌ Firebase save failed: ${firebaseError?.message}`);
      }
      
      // Step 4: Test loading from localStorage (like history page does)
      addLog('🔍 Testing localStorage loading...');
      const testLocalStorage = localStorage.getItem('savedExpeditions');
      if (testLocalStorage) {
        const localExpeditions = JSON.parse(testLocalStorage);
        addLog(`📂 Found ${localExpeditions.length} expeditions in localStorage`);
        localExpeditions.forEach((exp: any, index: number) => {
          addLog(`  ${index + 1}. ${exp.name} (ID: ${exp.id})`);
        });
      } else {
        addLog('📂 No data in localStorage');
      }
      
      // Step 5: Test loading from Firebase (like history page does)
      addLog('🔍 Testing Firebase loading...');
      try {
        const currentUserId = auth.currentUser?.uid || 'USER123';
        const q = query(
          collection(firestore, 'expeditions'),
          where('userId', '==', currentUserId)
        );
        
        const querySnapshot = await getDocs(q);
        addLog(`🔥 Found ${querySnapshot.docs.length} expeditions in Firebase`);
        
        querySnapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          addLog(`  ${index + 1}. ${data.name} (ID: ${data.id}, Doc ID: ${doc.id})`);
        });
      } catch (firebaseError: any) {
        addLog(`❌ Firebase load failed: ${firebaseError?.message}`);
      }
      
      addLog('🎉 Test completed! Check the history page now.');
      
    } catch (error: any) {
      addLog(`💥 General error: ${error?.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearTestData = () => {
    // Clear localStorage test data
    const savedExpeditions = localStorage.getItem('savedExpeditions');
    if (savedExpeditions) {
      const expeditionsArray = JSON.parse(savedExpeditions);
      const filteredExpeditions = expeditionsArray.filter((exp: any) => !exp.id.includes('test_hist_'));
      localStorage.setItem('savedExpeditions', JSON.stringify(filteredExpeditions));
    }
    setTestResult([]);
    addLog('🧹 Cleared test data');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Expedition History Test</h1>
        <p className="text-gray-600 mb-6">
          Test the complete flow: Save expedition → Load in history page
        </p>
        
        <div className="flex gap-4 mb-6">
          <button
            onClick={testFullFlow}
            disabled={isLoading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Testing...
              </>
            ) : (
              'Run Full Test'
            )}
          </button>
          
          <button
            onClick={clearTestData}
            className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
          >
            Clear Test Data
          </button>
          
          <a 
            href="/logistique/history" 
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 text-center"
          >
            Open History Page
          </a>
        </div>
        
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
          {testResult.length === 0 ? (
            <div className="text-gray-500">No test results yet. Click "Run Full Test" to start.</div>
          ) : (
            testResult.map((message, index) => (
              <div key={index} className="mb-1">
                {message}
              </div>
            ))
          )}
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Test Flow:</h3>
          <ol className="text-blue-700 text-sm space-y-1">
            <li>1. Create test expedition data (same structure as form)</li>
            <li>2. Save to localStorage (like expedition form)</li>
            <li>3. Save to Firebase (like expedition form)</li>
            <li>4. Load from localStorage (like history page)</li>
            <li>5. Load from Firebase (like history page)</li>
            <li>6. Open history page to see if data appears</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

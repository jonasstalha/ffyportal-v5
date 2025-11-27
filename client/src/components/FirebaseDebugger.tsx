import React, { useState } from 'react';
import { collection, addDoc, getDocs, query, where, updateDoc, doc as firestoreDoc, serverTimestamp } from 'firebase/firestore';
import { firestore, auth } from '@/lib/firebase';

// This component replicates EXACTLY the same logic as the expedition form
export default function FirebaseDebugger() {
  const [debugOutput, setDebugOutput] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addDebugMessage = (message: string) => {
    setDebugOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log(message);
  };

  const testExpeditionSave = async () => {
    setIsLoading(true);
    setDebugOutput([]);
    
    try {
      addDebugMessage('🔄 Starting expedition save test...');
      
      // Replicate the exact same data structure as FichedExpidition.tsx
      const expeditionId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      addDebugMessage(`📝 Generated expedition ID: ${expeditionId}`);
      
      const headerData = {
        date: new Date().toISOString().split('T')[0],
        heure: new Date().toLocaleTimeString(),
        transporteur: 'Test Transporteur Debug',
        matricule: 'TEST123',
        tempCamion: '2',
        hygiene: 'Bon',
        odeur: 'Bon',
        destination: 'Test Destination Debug',
        thermokingEtat: 'Bon'
      };
      
      const rows = [
        {
          palletNo: 1,
          nbrColis: '10',
          produitVariete: 'Hass',
          calibre: '14-16',
          temperatureProduit: '2.5',
          etatPalette: 'C',
          conformiteEtiquettes: 'C',
          dessiccation: 'C'
        }
      ];
      
      const expeditionData = {
        id: expeditionId,
        name: `Expedition_${headerData.transporteur}_${headerData.date}`,
        date: headerData.date,
        headerData,
        rows,
        pdfURL: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      addDebugMessage('📦 Prepared expedition data structure');
      
      // Save to localStorage first (same as expedition form)
      const savedExpeditions = localStorage.getItem('savedExpeditions');
      let expeditionsArray = [];
      
      if (savedExpeditions) {
        expeditionsArray = JSON.parse(savedExpeditions);
      }
      expeditionsArray.push(expeditionData);
      localStorage.setItem('savedExpeditions', JSON.stringify(expeditionsArray));
      addDebugMessage(`💾 Saved to localStorage (${expeditionsArray.length} total expeditions)`);
      
      // Archive box save (same as expedition form)
      const archiveItem = {
        id: expeditionId,
        name: expeditionData.name,
        date: expeditionData.date,
        type: 'expedition',
        pdfURL: expeditionData.pdfURL
      };
      
      const savedArchiveBoxes = localStorage.getItem('archiveBoxes');
      let archiveBoxes = [];
      
      if (savedArchiveBoxes) {
        archiveBoxes = JSON.parse(savedArchiveBoxes);
      }
      archiveBoxes.push(archiveItem);
      localStorage.setItem('archiveBoxes', JSON.stringify(archiveBoxes));
      addDebugMessage(`📋 Saved to archive boxes (${archiveBoxes.length} total items)`);
      
      // Now try Firebase save (exact same logic as expedition form)
      try {
        const currentUserId = auth.currentUser?.uid || 'USER123';
        addDebugMessage(`👤 Using user ID: ${currentUserId} (authenticated: ${!!auth.currentUser})`);
        
        // Check if expedition already exists in Firestore
        addDebugMessage('🔍 Checking for existing expedition in Firestore...');
        const expeditionsRef = collection(firestore, 'expeditions');
        const q = query(expeditionsRef, where('id', '==', expeditionId));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          // Update existing document
          const docId = querySnapshot.docs[0].id;
          addDebugMessage(`🔄 Found existing document, updating ID: ${docId}`);
          await updateDoc(firestoreDoc(firestore, 'expeditions', docId), {
            ...expeditionData,
            userId: currentUserId,
            updatedAt: serverTimestamp()
          });
          addDebugMessage('✅ Successfully updated existing expedition in Firestore');
        } else {
          // Create new document
          addDebugMessage('📝 Creating new document in Firestore...');
          const docRef = await addDoc(expeditionsRef, {
            ...expeditionData,
            userId: currentUserId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          addDebugMessage(`✅ Successfully created new expedition in Firestore with doc ID: ${docRef.id}`);
        }
        
        addDebugMessage('🎉 Firebase save completed successfully!');
        
        // Test reading back the data
        addDebugMessage('🔍 Testing data retrieval from Firestore...');
        const readQuery = query(expeditionsRef, where('userId', '==', currentUserId));
        const readSnapshot = await getDocs(readQuery);
        addDebugMessage(`📖 Found ${readSnapshot.docs.length} expeditions for user ${currentUserId}`);
        
        readSnapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          addDebugMessage(`  ${index + 1}. ${data.name} (ID: ${data.id})`);
        });
        
      } catch (firestoreError: any) {
        addDebugMessage(`❌ Firebase error: ${firestoreError?.code || firestoreError?.message || 'Unknown error'}`);
        addDebugMessage(`❌ Full error details: ${JSON.stringify({
          code: firestoreError?.code,
          message: firestoreError?.message,
          stack: firestoreError?.stack?.substring(0, 200)
        })}`);
      }
      
    } catch (error: any) {
      addDebugMessage(`💥 General error: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      addDebugMessage('🏁 Test completed');
    }
  };

  const clearDebug = () => {
    setDebugOutput([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold mb-4">Firebase Expedition Debug Test</h1>
        <p className="text-gray-600 mb-6">
          This test replicates EXACTLY the same Firebase save logic as the expedition form.
        </p>
        
        <div className="flex gap-4 mb-6">
          <button
            onClick={testExpeditionSave}
            disabled={isLoading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Testing...
              </>
            ) : (
              'Run Debug Test'
            )}
          </button>
          
          <button
            onClick={clearDebug}
            className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
          >
            Clear Output
          </button>
        </div>
        
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
          {debugOutput.length === 0 ? (
            <div className="text-gray-500">No debug output yet. Click "Run Debug Test" to start.</div>
          ) : (
            debugOutput.map((message, index) => (
              <div key={index} className="mb-1">
                {message}
              </div>
            ))
          )}
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">What this test does:</h3>
          <ul className="text-blue-700 text-sm space-y-1">
            <li>• Creates the exact same data structure as the expedition form</li>
            <li>• Saves to localStorage first (like the expedition form)</li>
            <li>• Attempts to save to Firebase Firestore with the same logic</li>
            <li>• Shows detailed error messages if Firebase fails</li>
            <li>• Tests reading back the data from Firebase</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

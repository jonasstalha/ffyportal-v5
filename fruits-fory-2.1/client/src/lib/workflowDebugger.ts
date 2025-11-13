import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL, connectStorageEmulator } from 'firebase/storage';
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { firebaseConfig } from './firebase';

/**
 * Comprehensive workflow debugger for Firebase uploads
 * Tests each step: Upload → Storage → Firestore → PDF generation
 */

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);
const auth = getAuth(app);

export class WorkflowDebugger {
  
  /**
   * Step 1: Test Firebase Storage Upload
   */
  static async testFirebaseStorageUpload(file: File, reportId: string): Promise<string> {
    console.log('🔍 STEP 1: Testing Firebase Storage Upload');
    console.log('📁 File details:', {
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      type: file.type
    });
    
    try {
      // Test bucket connectivity first
      console.log('🔗 Testing bucket connectivity...');
      const testRef = ref(storage, 'test/connection-test.txt');
      const testBlob = new Blob(['test'], { type: 'text/plain' });
      await uploadBytes(testRef, testBlob);
      console.log('✅ Bucket connectivity: OK');
      
      // Upload to reports path
      const storageRef = ref(storage, `reports/${reportId}/${file.name}`);
      console.log('📍 Upload path:', `reports/${reportId}/${file.name}`);
      
      const uploadResult = await uploadBytes(storageRef, file);
      console.log('✅ Upload successful:', uploadResult.metadata.fullPath);
      
      // Get download URL
      const url = await getDownloadURL(storageRef);
      console.log('🔗 Download URL generated:', url);
      
      // Test URL accessibility
      const urlTest = await fetch(url, { method: 'HEAD' });
      console.log('🌐 URL accessibility test:', urlTest.status === 200 ? 'OK' : 'FAILED');
      
      return url;
      
    } catch (error) {
      console.error('❌ STEP 1 FAILED - Firebase Storage Upload:', error);
      
      // Detailed error analysis
      if (error instanceof Error) {
        if (error.message.includes('CORS')) {
          console.error('🚨 CORS Error Detected!');
          console.error('Solution: Run the following commands:');
          console.error('gsutil cors get gs://fruitsforyou-10acc.appspot.com');
          console.error('gsutil cors set ./cors.json gs://fruitsforyou-10acc.appspot.com');
        }
        
        if (error.message.includes('Permission denied')) {
          console.error('🚨 Permission Error!');
          console.error('Check Firebase Storage Rules and authentication');
        }
        
        if (error.message.includes('Network')) {
          console.error('🚨 Network Error!');
          console.error('Check internet connectivity and Firebase config');
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Step 2: Test Firestore Persistence
   */
  static async testFirestorePersistence(reportId: string, imageUrl: string): Promise<boolean> {
    console.log('🔍 STEP 2: Testing Firestore Persistence');
    console.log('📄 Report ID:', reportId);
    console.log('🔗 Image URL:', imageUrl);
    
    try {
      // Check if user is authenticated
      const user = auth.currentUser;
      if (!user) {
        console.warn('⚠️  No authenticated user - some operations may fail');
      } else {
        console.log('👤 Authenticated as:', user.email);
      }
      
      // Test Firestore connectivity
      console.log('🔗 Testing Firestore connectivity...');
      const testDoc = doc(db, 'test', 'connection');
      await setDoc(testDoc, { timestamp: new Date().toISOString() });
      console.log('✅ Firestore connectivity: OK');
      
      // Check if report document exists
      const reportRef = doc(db, 'reports', reportId);
      const reportSnapshot = await getDoc(reportRef);
      
      if (reportSnapshot.exists()) {
        console.log('📄 Report document exists, updating...');
        
        // Update with array union
        await updateDoc(reportRef, {
          images: arrayUnion(imageUrl),
          updatedAt: new Date().toISOString()
        });
      } else {
        console.log('📄 Creating new report document...');
        
        // Create new document
        await setDoc(reportRef, {
          id: reportId,
          images: [imageUrl],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      // Verify the data was saved
      const verifySnapshot = await getDoc(reportRef);
      const data = verifySnapshot.data();
      
      if (data && data.images && data.images.includes(imageUrl)) {
        console.log('✅ Firestore persistence: OK');
        console.log('📊 Document data:', {
          id: data.id,
          imageCount: data.images.length,
          latestImage: data.images[data.images.length - 1].substring(0, 50) + '...'
        });
        return true;
      } else {
        console.error('❌ Data verification failed');
        return false;
      }
      
    } catch (error) {
      console.error('❌ STEP 2 FAILED - Firestore Persistence:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Permission denied')) {
          console.error('🚨 Firestore Permission Error!');
          console.error('Check Firestore Security Rules');
        }
        
        if (error.message.includes('Network')) {
          console.error('🚨 Firestore Network Error!');
          console.error('Check internet connectivity and Firebase config');
        }
      }
      
      throw error;
    }
  }
  
  /**
   * Step 3: Test PDF Generation Access
   */
  static async testPDFGeneration(reportId: string): Promise<boolean> {
    console.log('🔍 STEP 3: Testing PDF Generation');
    
    try {
      // Get report data
      const reportRef = doc(db, 'reports', reportId);
      const reportSnapshot = await getDoc(reportRef);
      
      if (!reportSnapshot.exists()) {
        console.error('❌ Report not found for PDF generation');
        return false;
      }
      
      const reportData = reportSnapshot.data();
      console.log('📊 Report data for PDF:', {
        imageCount: reportData.images?.length || 0,
        hasImages: Array.isArray(reportData.images) && reportData.images.length > 0
      });
      
      if (!reportData.images || reportData.images.length === 0) {
        console.warn('⚠️  No images found for PDF generation');
        return false;
      }
      
      // Test image URL accessibility (CORS check)
      console.log('🌐 Testing image URL accessibility for PDF...');
      const testUrl = reportData.images[0];
      
      try {
        const response = await fetch(testUrl, { 
          method: 'HEAD',
          mode: 'cors' 
        });
        
        if (response.ok) {
          console.log('✅ Image URLs accessible for PDF generation');
          return true;
        } else {
          console.error('❌ Image URL not accessible:', response.status);
          return false;
        }
      } catch (fetchError) {
        console.error('❌ CORS Error when accessing image URL:', fetchError);
        console.error('🚨 This will prevent PDF generation!');
        console.error('Solution: Configure CORS for * origin with GET method');
        return false;
      }
      
    } catch (error) {
      console.error('❌ STEP 3 FAILED - PDF Generation Test:', error);
      throw error;
    }
  }
  
  /**
   * Complete workflow test
   */
  static async testCompleteWorkflow(file: File, reportId: string = `test-${Date.now()}`): Promise<void> {
    console.log('🚀 COMPLETE WORKFLOW TEST STARTING');
    console.log('=' .repeat(50));
    
    try {
      // Step 1: Upload to Firebase Storage
      const imageUrl = await this.testFirebaseStorageUpload(file, reportId);
      
      // Step 2: Save to Firestore
      await this.testFirestorePersistence(reportId, imageUrl);
      
      // Step 3: Test PDF generation readiness
      await this.testPDFGeneration(reportId);
      
      console.log('=' .repeat(50));
      console.log('🎉 COMPLETE WORKFLOW TEST: SUCCESS!');
      console.log('✅ All steps passed');
      console.log(`📄 Report ID: ${reportId}`);
      console.log(`🔗 Image URL: ${imageUrl}`);
      
    } catch (error) {
      console.log('=' .repeat(50));
      console.log('💥 COMPLETE WORKFLOW TEST: FAILED!');
      console.error('❌ Error at step:', error);
      
      // Provide specific debugging guidance
      console.log('\n🔧 DEBUGGING SUGGESTIONS:');
      
      if (error instanceof Error && error.message.includes('CORS')) {
        console.log('1. CORS Issue:');
        console.log('   gsutil cors get gs://fruitsforyou-10acc.appspot.com');
        console.log('   gsutil cors set ./cors.json gs://fruitsforyou-10acc.appspot.com');
      }
      
      console.log('2. Check Firebase Console:');
      console.log('   - Storage: https://console.firebase.google.com/project/fruitsforyou-10acc/storage');
      console.log('   - Firestore: https://console.firebase.google.com/project/fruitsforyou-10acc/firestore');
      
      console.log('3. Authentication:');
      console.log('   - Ensure user is logged in');
      console.log('   - Check Firebase Auth rules');
      
      throw error;
    }
  }
  
  /**
   * CORS preflight test (manual)
   */
  static async testCORSPreflight(): Promise<void> {
    console.log('🔍 TESTING CORS PREFLIGHT');
    
    const bucketUrl = 'https://storage.googleapis.com/fruitsforyou-10acc.appspot.com';
    
    try {
      const response = await fetch(bucketUrl, {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
          'Origin': window.location.origin
        }
      });
      
      console.log('✅ CORS Preflight Response:', response.status);
      console.log('🔗 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        console.log('✅ CORS is configured correctly');
      } else {
        console.error('❌ CORS preflight failed');
        console.error('🚨 Run: gsutil cors set ./cors.json gs://fruitsforyou-10acc.appspot.com');
      }
      
    } catch (error) {
      console.error('❌ CORS test failed:', error);
    }
  }
  
  /**
   * Quick test button for UI
   */
  static createTestButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.textContent = '🧪 Test Workflow';
    button.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 9999;
      padding: 10px 20px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: bold;
    `;
    
    button.onclick = async () => {
      // Create a test file
      const testFile = new File(['test content'], 'test-image.png', { type: 'image/png' });
      
      try {
        button.textContent = '🧪 Testing...';
        button.disabled = true;
        
        await WorkflowDebugger.testCompleteWorkflow(testFile);
        
        button.textContent = '✅ Test Passed';
        button.style.background = '#10b981';
      } catch (error) {
        button.textContent = '❌ Test Failed';
        button.style.background = '#ef4444';
        console.error('Test failed:', error);
      }
      
      setTimeout(() => {
        button.textContent = '🧪 Test Workflow';
        button.style.background = '#3b82f6';
        button.disabled = false;
      }, 3000);
    };
    
    document.body.appendChild(button);
    return button;
  }
}

// Auto-add test button in development
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    WorkflowDebugger.createTestButton();
  }, 1000);
}

export default WorkflowDebugger;

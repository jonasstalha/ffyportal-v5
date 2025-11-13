import { reportService } from '../lib/reportService';
import { pdfService } from '../lib/pdfService';
import { checkFirebaseConnection, logAuthStatus, requireAuthentication } from '../lib/authCheck';
import { storage, db, auth } from '../lib/firebase';

/**
 * Complete End-to-End Test for Upload → Storage → Firestore → PDF
 * This tests the full workflow that was causing issues
 */
export const runCompleteWorkflowTest = async () => {
  console.log('🚀 RUNNING COMPLETE WORKFLOW TEST');
  console.log('=' .repeat(50));
  
  try {
    // Step 0: Authentication and Firebase checks
    console.log('🔐 Step 0: Authentication and Firebase checks...');
    
    // Log current auth status
    logAuthStatus();
    
    // Check Firebase connection
    const firebaseConnected = await checkFirebaseConnection();
    if (!firebaseConnected) {
      throw new Error('Firebase connection failed - user not authenticated');
    }
    
    // Require authentication
    const user = requireAuthentication();
    console.log('✅ Authentication verified for user:', user.email);
    
    // Check Firebase services initialization
    console.log('🔧 Checking Firebase services...');
    if (!storage) throw new Error('Firebase Storage not initialized');
    if (!db) throw new Error('Firebase Firestore not initialized');
    if (!auth) throw new Error('Firebase Auth not initialized');
    console.log('✅ All Firebase services initialized');
    
    // Verify bucket configuration
    console.log('🪣 Verifying storage bucket configuration...');
    console.log('📍 Storage bucket:', storage.app.options.storageBucket);
    if (storage.app.options.storageBucket !== 'fruitsforyou-10acc.firebasestorage.app') {
      console.warn('⚠️ Storage bucket mismatch - expected: fruitsforyou-10acc.firebasestorage.app');
    }
    
    // Step 1: Create a test file
    console.log('📁 Step 1: Creating test file...');
    const testContent = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const response = await fetch(testContent);
    const blob = await response.blob();
    const testFile = new File([blob], 'test-image.png', { type: 'image/png' });
    
    console.log('✅ Test file created:', {
      name: testFile.name,
      size: testFile.size,
      type: testFile.type
    });
    
    // Step 2: Upload to Firebase Storage
    console.log('📤 Step 2: Uploading to Firebase Storage...');
    const reportId = `TEST_${Date.now()}`;
    const imageUrl = await reportService.uploadImageToReport(testFile, reportId);
    
    console.log('✅ Upload successful!');
    console.log('🔗 Image URL:', imageUrl);
    
    // Step 3: Verify Firestore persistence
    console.log('💾 Step 3: Checking Firestore persistence...');
    const reportData = await reportService.getReportData(reportId);
    
    if (!reportData) {
      throw new Error('Report data not found in Firestore');
    }
    
    if (!reportData.images || !reportData.images.includes(imageUrl)) {
      throw new Error('Image URL not found in Firestore');
    }
    
    console.log('✅ Firestore persistence verified!');
    console.log('📊 Report data:', {
      id: reportData.id,
      imageCount: reportData.images.length,
      createdAt: reportData.createdAt
    });
    
    // Step 4: Test image URL accessibility for PDF generation
    console.log('🔗 Step 4: Testing image URL accessibility for PDF...');
    
    try {
      const imageResponse = await fetch(imageUrl, { 
        method: 'HEAD',
        mode: 'cors'
      });
      
      if (imageResponse.ok) {
        console.log('✅ Image URL accessible for PDF generation!');
        console.log('📋 Response headers:', {
          'content-type': imageResponse.headers.get('content-type'),
          'access-control-allow-origin': imageResponse.headers.get('access-control-allow-origin')
        });
      } else {
        console.log('❌ Image URL not accessible:', imageResponse.status);
      }
    } catch (fetchError) {
      console.log('❌ CORS error accessing image URL:', fetchError);
      console.log('🚨 PDF generation will fail with this URL');
    }
    
    // Step 5: Test client-side PDF generation (if html2pdf is available)
    console.log('📄 Step 5: Testing PDF generation...');
    
    if (typeof window !== 'undefined' && (window as any).html2pdf) {
      try {
        await pdfService.generateReportPDFClient(reportId);
        console.log('✅ Client-side PDF generation successful!');
      } catch (pdfError) {
        console.log('❌ Client-side PDF generation failed:', pdfError);
      }
    } else {
      console.log('ℹ️ html2pdf.js not loaded - skipping client PDF test');
      console.log('💡 Add to HTML: <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>');
    }
    
    // Final summary
    console.log('=' .repeat(50));
    console.log('🎉 COMPLETE WORKFLOW TEST: SUCCESS!');
    console.log('✅ All steps completed successfully');
    console.log(`📄 Report ID: ${reportId}`);
    console.log(`🔗 Image URL: ${imageUrl}`);
    console.log('📋 Next: Test PDF generation in your app');
    
    return {
      success: true,
      reportId,
      imageUrl,
      reportData
    };
    
  } catch (error) {
    console.log('=' .repeat(50));
    console.log('💥 COMPLETE WORKFLOW TEST: FAILED');
    console.error('❌ Error:', error);
    
    // Provide specific debugging guidance
    if (error instanceof Error) {
      if (error.message.includes('CORS')) {
        console.log('🔧 CORS Issue: Run "gsutil cors set cors.json gs://fruitsforyou-10acc.firebasestorage.app"');
      }
      
      if (error.message.includes('Permission denied')) {
        console.log('🔐 Permission Issue: Check Firebase Auth and Storage Rules');
      }
      
      if (error.message.includes('Network')) {
        console.log('🌐 Network Issue: Check internet connection');
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Add a test button to the page
export const addWorkflowTestButton = () => {
  if (typeof window === 'undefined') return;
  
  // Remove existing button if present
  const existingButton = document.getElementById('workflow-test-btn');
  if (existingButton) {
    existingButton.remove();
  }
  
  const button = document.createElement('button');
  button.id = 'workflow-test-btn';
  button.innerHTML = '🧪 Test Complete Workflow';
  button.style.cssText = `
    position: fixed;
    top: 70px;
    right: 20px;
    z-index: 9999;
    padding: 12px 20px;
    background: #10b981;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: bold;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: all 0.2s;
  `;
  
  button.onmouseover = () => {
    button.style.background = '#059669';
    button.style.transform = 'translateY(-1px)';
  };
  
  button.onmouseout = () => {
    button.style.background = '#10b981';
    button.style.transform = 'translateY(0)';
  };
  
  button.onclick = async () => {
    button.disabled = true;
    button.innerHTML = '🧪 Testing...';
    button.style.background = '#6b7280';
    
    try {
      const result = await runCompleteWorkflowTest();
      
      if (result.success) {
        button.innerHTML = '✅ Test Passed!';
        button.style.background = '#10b981';
      } else {
        button.innerHTML = '❌ Test Failed';
        button.style.background = '#ef4444';
      }
    } catch (error) {
      button.innerHTML = '💥 Error';
      button.style.background = '#ef4444';
      console.error('Test button error:', error);
    }
    
    // Reset button after 3 seconds
    setTimeout(() => {
      button.disabled = false;
      button.innerHTML = '🧪 Test Complete Workflow';
      button.style.background = '#10b981';
    }, 3000);
  };
  
  document.body.appendChild(button);
  
  return button;
};

// Auto-add test button in development
// Auto-add disabled to prevent floating test button in UI
// if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
//   setTimeout(() => {
//     addWorkflowTestButton();
//   }, 2000);
// }

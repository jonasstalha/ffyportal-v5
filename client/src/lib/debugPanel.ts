/**
 * Simple CORS and Upload Test Utility
 * Add this to your page to test upload workflow step by step
 */

export const createDebugPanel = () => {
  // Create debug panel HTML
  const panel = document.createElement('div');
  panel.id = 'upload-debug-panel';
  panel.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      background: white;
      border: 2px solid #ccc;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      font-family: Arial, sans-serif;
      font-size: 14px;
    ">
      <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 12px;">
        <h3 style="margin: 0; color: #333;">🧪 Upload Debug Panel</h3>
        <button id="close-debug" style="background: #f44336; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer;">✕</button>
      </div>
      
      <div style="margin-bottom: 12px;">
        <input type="file" id="test-file" accept="image/*" style="width: 100%; margin-bottom: 8px;">
        <input type="text" id="report-id" placeholder="Report ID (e.g., LOT001)" value="LOT001" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 4px;">
      </div>
      
      <div style="display: grid; gap: 8px;">
        <button id="test-cors" style="background: #2196F3; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">
          1️⃣ Test CORS Preflight
        </button>
        <button id="test-upload" style="background: #4CAF50; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">
          2️⃣ Test Storage Upload
        </button>
        <button id="test-firestore" style="background: #FF9800; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">
          3️⃣ Test Firestore Save
        </button>
        <button id="test-all" style="background: #9C27B0; color: white; border: none; padding: 8px; border-radius: 4px; cursor: pointer;">
          🚀 Test Complete Workflow
        </button>
      </div>
      
      <div id="debug-results" style="
        margin-top: 12px;
        padding: 8px;
        background: #f5f5f5;
        border-radius: 4px;
        min-height: 100px;
        max-height: 200px;
        overflow-y: auto;
        font-family: monospace;
        font-size: 12px;
        white-space: pre-wrap;
      ">Ready to test...\n</div>
    </div>
  `;
  
  document.body.appendChild(panel);
  
  // Get elements
  const closeBtn = document.getElementById('close-debug') as HTMLButtonElement;
  const testFileInput = document.getElementById('test-file') as HTMLInputElement;
  const reportIdInput = document.getElementById('report-id') as HTMLInputElement;
  const corsBtn = document.getElementById('test-cors') as HTMLButtonElement;
  const uploadBtn = document.getElementById('test-upload') as HTMLButtonElement;
  const firestoreBtn = document.getElementById('test-firestore') as HTMLButtonElement;
  const testAllBtn = document.getElementById('test-all') as HTMLButtonElement;
  const resultsDiv = document.getElementById('debug-results') as HTMLDivElement;
  
  // Utility to log to results
  const log = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const emoji = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    resultsDiv.textContent += `[${timestamp}] ${emoji} ${message}\n`;
    resultsDiv.scrollTop = resultsDiv.scrollHeight;
  };
  
  // Close panel
  closeBtn.onclick = () => {
    document.body.removeChild(panel);
  };
  
  // Test 1: CORS Preflight
  corsBtn.onclick = async () => {
    log('Testing CORS preflight...');
    
    try {
      const response = await fetch('https://firebasestorage.googleapis.com/v0/b/fruitsforyou-10acc.appspot.com/o', {
        method: 'OPTIONS',
        headers: {
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
          'Origin': window.location.origin
        }
      });
      
      if (response.ok) {
        log('CORS preflight: OK', 'success');
        log(`Response status: ${response.status}`);
      } else {
        log(`CORS preflight failed: ${response.status}`, 'error');
        log('Run: gsutil cors set ./cors.json gs://fruitsforyou-10acc.appspot.com', 'error');
      }
      
    } catch (error) {
      log(`CORS test error: ${error}`, 'error');
    }
  };
  
  // Test 2: Storage Upload
  uploadBtn.onclick = async () => {
    const file = testFileInput.files?.[0];
    const reportId = reportIdInput.value || 'LOT001';
    
    if (!file) {
      log('Please select a file first', 'error');
      return;
    }
    
    log(`Testing storage upload: ${file.name} (${(file.size/1024/1024).toFixed(2)}MB)`);
    
    try {
      // Dynamic import to avoid bundling issues
      const { reportService } = await import('./reportService');
      
      const url = await reportService.uploadImageToReport(file, reportId);
      log(`Upload successful!`, 'success');
      log(`URL: ${url.substring(0, 80)}...`);
      
      // Store URL for next test
      (window as any).lastUploadUrl = url;
      (window as any).lastReportId = reportId;
      
    } catch (error) {
      log(`Upload failed: ${error}`, 'error');
      
      if (error instanceof Error && error.message.includes('CORS')) {
        log('CORS issue detected! Check CORS configuration.', 'error');
      }
    }
  };
  
  // Test 3: Firestore Save
  firestoreBtn.onclick = async () => {
    const reportId = (window as any).lastReportId || reportIdInput.value || 'LOT001';
    const url = (window as any).lastUploadUrl;
    
    if (!url) {
      log('Please run storage upload test first', 'error');
      return;
    }
    
    log(`Testing Firestore save for report: ${reportId}`);
    
    try {
      const { reportService } = await import('./reportService');
      
      const reportData = await reportService.getReportData(reportId);
      log(`Firestore test successful!`, 'success');
      log(`Report has ${reportData?.images?.length || 0} image(s)`);
      
    } catch (error) {
      log(`Firestore test failed: ${error}`, 'error');
    }
  };
  
  // Test 4: Complete Workflow
  testAllBtn.onclick = async () => {
    const file = testFileInput.files?.[0];
    const reportId = reportIdInput.value || 'LOT001';
    
    if (!file) {
      log('Please select a file first', 'error');
      return;
    }
    
    log('='.repeat(40));
    log('🚀 STARTING COMPLETE WORKFLOW TEST');
    log('='.repeat(40));
    
    try {
      // Step 1: Upload
      log('Step 1: Uploading to Firebase Storage...');
      const { reportService } = await import('./reportService');
      const url = await reportService.uploadImageToReport(file, reportId);
      log('✅ Upload successful', 'success');
      
      // Step 2: Verify Firestore
      log('Step 2: Checking Firestore persistence...');
      const reportData = await reportService.getReportData(reportId);
      if (reportData?.images?.includes(url)) {
        log('✅ Firestore persistence verified', 'success');
      } else {
        log('❌ Firestore persistence failed', 'error');
        return;
      }
      
      // Step 3: Test PDF generation readiness
      log('Step 3: Testing PDF generation access...');
      const testResponse = await fetch(url, { method: 'HEAD' });
      if (testResponse.ok) {
        log('✅ Image URLs accessible for PDF generation', 'success');
      } else {
        log('❌ Image URLs not accessible - PDF generation will fail', 'error');
      }
      
      log('='.repeat(40));
      log('🎉 COMPLETE WORKFLOW TEST: SUCCESS!', 'success');
      log(`📄 Report ID: ${reportId}`);
      log(`🔗 Image count: ${reportData?.images?.length || 0}`);
      
    } catch (error) {
      log('='.repeat(40));
      log('💥 WORKFLOW TEST FAILED!', 'error');
      log(`Error: ${error}`, 'error');
      
      if (error instanceof Error && error.message.includes('CORS')) {
        log('🔧 SOLUTION: Fix CORS configuration', 'error');
        log('gsutil cors set ./cors.json gs://fruitsforyou-10acc.appspot.com', 'error');
      }
    }
  };
  
  return panel;
};

// Auto-create debug panel in development
// Auto-injection disabled to keep UI clean
// if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
//   setTimeout(() => {
//     createDebugPanel();
//   }, 2000);
// }

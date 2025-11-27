# CORS Configuration Test and Setup Script (PowerShell)
# This script will test and configure CORS for Firebase Storage

Write-Host "🔍 Firebase Storage CORS Diagnostic Tool" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$PROJECT_ID = "fruitsforyou-10acc"
$BUCKET_NAME = "fruitsforyou-10acc.appspot.com"

Write-Host ""
Write-Host "📋 Current Project: $PROJECT_ID" -ForegroundColor White
Write-Host "🪣 Storage Bucket: $BUCKET_NAME" -ForegroundColor White
Write-Host ""

# Check if gsutil is installed
try {
    $gsutilVersion = gsutil version 2>$null
    Write-Host "✅ gsutil found" -ForegroundColor Green
} catch {
    Write-Host "❌ gsutil is not installed or not in PATH" -ForegroundColor Red
    Write-Host "📥 Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install" -ForegroundColor Yellow
    exit 1
}

# Test authentication
Write-Host ""
Write-Host "🔐 Testing authentication..." -ForegroundColor Yellow
try {
    $testAccess = gsutil ls "gs://$BUCKET_NAME" 2>$null
    Write-Host "✅ Authentication successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Authentication failed" -ForegroundColor Red
    Write-Host "🔧 Run: gcloud auth login" -ForegroundColor Yellow
    Write-Host "🔧 Then: gcloud config set project $PROJECT_ID" -ForegroundColor Yellow
    exit 1
}

# Get current CORS configuration
Write-Host ""
Write-Host "📖 Current CORS configuration:" -ForegroundColor Yellow
Write-Host "------------------------------" -ForegroundColor Gray
try {
    $corsConfig = gsutil cors get "gs://$BUCKET_NAME" 2>$null
    Write-Host $corsConfig
    Write-Host ""
    Write-Host "✅ CORS configuration retrieved" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get CORS configuration or no CORS set" -ForegroundColor Red
}

# Test CORS with curl (OPTIONS request)
Write-Host ""
Write-Host "🌐 Testing CORS preflight (OPTIONS request):" -ForegroundColor Yellow
Write-Host "--------------------------------------------" -ForegroundColor Gray

$curlArgs = @(
    "-X", "OPTIONS",
    "-H", "Origin: http://localhost:5173",
    "-H", "Access-Control-Request-Method: POST", 
    "-H", "Access-Control-Request-Headers: content-type",
    "-v",
    "https://firebasestorage.googleapis.com/v0/b/$BUCKET_NAME/o"
)

try {
    $curlResult = & curl @curlArgs 2>&1 | Select-String -Pattern "(HTTP|Access-Control|origin)"
    Write-Host $curlResult -ForegroundColor Cyan
} catch {
    Write-Host "❌ CORS test failed" -ForegroundColor Red
}

Write-Host ""
Write-Host ""

# Apply CORS configuration
$applyCors = Read-Host "🔧 Do you want to apply the CORS configuration from cors.json? (y/N)"

if ($applyCors -match "^[Yy]$") {
    if (Test-Path "cors.json") {
        Write-Host "📝 Applying CORS configuration..." -ForegroundColor Yellow
        try {
            gsutil cors set cors.json "gs://$BUCKET_NAME"
            Write-Host "✅ CORS configuration applied successfully" -ForegroundColor Green
            
            Write-Host ""
            Write-Host "🔄 Testing CORS again after configuration:" -ForegroundColor Yellow
            Write-Host "------------------------------------------" -ForegroundColor Gray
            $curlResult = & curl @curlArgs 2>&1 | Select-String -Pattern "(HTTP|Access-Control|origin)"
            Write-Host $curlResult -ForegroundColor Cyan
        } catch {
            Write-Host "❌ Failed to apply CORS configuration" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ cors.json file not found" -ForegroundColor Red
        Write-Host "📁 Make sure cors.json exists in the current directory" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🔍 Final verification:" -ForegroundColor Yellow
Write-Host "---------------------" -ForegroundColor Gray
Write-Host "1. Check Firebase Console Storage: https://console.firebase.google.com/project/$PROJECT_ID/storage"
Write-Host "2. Test upload from your app at: http://localhost:5173"
Write-Host "3. Look for CORS errors in browser developer console"

Write-Host ""
Write-Host "✅ Diagnostic complete!" -ForegroundColor Green

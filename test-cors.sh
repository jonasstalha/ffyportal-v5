#!/bin/bash

# CORS Configuration Test and Setup Script
# This script will test and configure CORS for Firebase Storage

echo "🔍 Firebase Storage CORS Diagnostic Tool"
echo "=========================================="

PROJECT_ID="fruitsforyou-10acc"
BUCKET_NAME="fruitsforyou-10acc.appspot.com"

echo ""
echo "📋 Current Project: $PROJECT_ID"
echo "🪣 Storage Bucket: $BUCKET_NAME"
echo ""

# Check if gsutil is installed
if ! command -v gsutil &> /dev/null; then
    echo "❌ gsutil is not installed or not in PATH"
    echo "📥 Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    exit 1
else
    echo "✅ gsutil found"
fi

# Test authentication
echo ""
echo "🔐 Testing authentication..."
if gsutil ls gs://$BUCKET_NAME > /dev/null 2>&1; then
    echo "✅ Authentication successful"
else
    echo "❌ Authentication failed"
    echo "🔧 Run: gcloud auth login"
    echo "🔧 Then: gcloud config set project $PROJECT_ID"
    exit 1
fi

# Get current CORS configuration
echo ""
echo "📖 Current CORS configuration:"
echo "------------------------------"
if gsutil cors get gs://$BUCKET_NAME 2>/dev/null; then
    echo ""
    echo "✅ CORS configuration retrieved"
else
    echo "❌ Failed to get CORS configuration or no CORS set"
fi

# Test CORS with curl (OPTIONS request)
echo ""
echo "🌐 Testing CORS preflight (OPTIONS request):"
echo "--------------------------------------------"
curl -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type" \
  -v \
  "https://firebasestorage.googleapis.com/v0/b/$BUCKET_NAME/o" \
  2>&1 | grep -E "(HTTP|Access-Control|origin)"

echo ""
echo ""

# Apply CORS configuration
read -p "🔧 Do you want to apply the CORS configuration from cors.json? (y/N): " apply_cors

if [[ $apply_cors =~ ^[Yy]$ ]]; then
    if [ -f "cors.json" ]; then
        echo "📝 Applying CORS configuration..."
        if gsutil cors set cors.json gs://$BUCKET_NAME; then
            echo "✅ CORS configuration applied successfully"
            
            echo ""
            echo "🔄 Testing CORS again after configuration:"
            echo "------------------------------------------"
            curl -X OPTIONS \
              -H "Origin: http://localhost:5173" \
              -H "Access-Control-Request-Method: POST" \
              -H "Access-Control-Request-Headers: content-type" \
              -v \
              "https://firebasestorage.googleapis.com/v0/b/$BUCKET_NAME/o" \
              2>&1 | grep -E "(HTTP|Access-Control|origin)"
        else
            echo "❌ Failed to apply CORS configuration"
        fi
    else
        echo "❌ cors.json file not found"
        echo "📁 Make sure cors.json exists in the current directory"
    fi
fi

echo ""
echo "🔍 Final verification:"
echo "---------------------"
echo "1. Check Firebase Console Storage: https://console.firebase.google.com/project/$PROJECT_ID/storage"
echo "2. Test upload from your app at: http://localhost:5173"
echo "3. Look for CORS errors in browser developer console"

echo ""
echo "✅ Diagnostic complete!"

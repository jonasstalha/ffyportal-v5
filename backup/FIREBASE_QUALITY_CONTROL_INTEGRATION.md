# Firebase Quality Control Integration

## Overview
This document outlines the complete Firebase integration for the Quality Control system, including data persistence, synchronization, and real-time updates.

## Features Implemented

### 1. Data Persistence
- **Complete Form Data**: All quality control form data is saved with full details
- **Image Upload**: Images are uploaded to Firebase Storage with organized folder structure
- **Metadata Tracking**: Submission metadata, calculations, and averages are preserved
- **Version Control**: All data includes versioning and timestamps

### 2. Data Structure in Firebase

#### Quality Control Lots Collection (`quality_control_lots`)
```typescript
{
  id: string,
  lotNumber: string,
  formData: {
    date: string,
    product: string,
    variety: string,
    campaign: string,
    clientLot: string,
    shipmentNumber: string,
    packagingType: string,
    category: string,
    exporterNumber: string,
    frequency: string,
    palettes: Array<{
      firmness: string,
      rotting: string,
      foreignMatter: string,
      // ... all palette fields
      paletteIndex: number,
      timestamp: string
    }>,
    calculatedResults: {
      minCharacteristics: number,
      totalDefects: number,
      missingBrokenGrains: number,
      weightConformity: number,
      isConform: boolean
    },
    averages: {
      firmness: string,
      rotting: string,
      // ... all calculated averages
    },
    submissionMetadata: {
      submittedBy: string,
      submittedAt: string,
      paletteCount: number,
      activeTab: number,
      browserInfo: string,
      version: string
    }
  },
  images: string[], // Firebase Storage URLs
  status: 'draft' | 'completed' | 'submitted' | 'chief_approved' | 'chief_rejected',
  phase: 'controller' | 'chief',
  createdAt: Timestamp,
  updatedAt: Timestamp,
  controller?: string,
  chief?: string,
  chiefComments?: string,
  chiefApprovalDate?: string,
  firebaseMetadata: {
    lastSyncAt: Timestamp,
    syncVersion: string,
    dataSize: number,
    imageCount: number
  }
}
```

### 3. Firebase Storage Structure
```
quality_control/
├── lots/
│   └── {lotId}/
│       └── images/
│           ├── image1_timestamp.jpg
│           ├── image2_timestamp.png
│           └── ...
├── calibres/
│   └── {lotId}/
│       └── {calibre}/
│           ├── calibre_image1.jpg
│           └── ...
├── tests/
│   └── {lotId}/
│       └── {calibre}/
│           ├── test_image1.jpg
│           └── ...
├── reports/
│   └── {lotId}/
│       ├── rapport_{timestamp}.pdf
│       └── rapport_visuel_{timestamp}.pdf
├── archive/
│   └── {year}/
│       └── {month}/
│           └── {lotId}/
│               └── archived_files...
├── temp/
│   └── {userId}/
│       └── {uploadId}
└── backups/
    └── {backupId}/
        └── backup_files...
```

### 4. Firebase Storage Security Rules
The storage rules (`storage.rules`) provide comprehensive security:

#### Key Features:
- **Authentication Required**: All operations require authenticated users
- **File Type Validation**: Only approved image formats (JPEG, PNG, WebP) and PDFs
- **Size Limits**: 10MB for images, 20MB for PDFs, 2MB for profile pictures
- **Path Structure Validation**: Enforces organized folder structure
- **Role-Based Access**: Support for controller, chief, admin, and system roles
- **Ownership Checks**: Users can only access their authorized lots
- **Archive Protection**: Special rules for long-term storage
- **Temporary Upload Management**: Secure handling of temporary files

#### Protected Paths:
- `/quality_control/lots/{lotId}/images/` - Lot images
- `/quality_control/calibres/{lotId}/{calibre}/` - Calibre-specific images
- `/quality_control/tests/{lotId}/{calibre}/` - Test result images
- `/quality_control/reports/{lotId}/` - Generated PDF reports
- `/quality_control/archive/{year}/{month}/` - Archived data
- `/quality_control/temp/{userId}/` - Temporary uploads
- `/quality_control/backups/` - System backups (admin only)

#### Deployment:
```bash
# Deploy storage rules
firebase deploy --only storage

# Test with emulator
firebase emulators:start --only storage
```
### 5. Firestore Security Rules
The Firestore rules include:
- **Authentication Required**: All operations require user authentication
- **Data Validation**: Comprehensive validation for lot data structure
- **Role-Based Access**: Support for controller and chief phases
- **Storage Security**: Organized and secure image storage

### 6. API Functions

#### Core Functions
- `saveQualityControlLot(lot)`: Save/update complete lot data
- `getQualityControlLots(phase?)`: Retrieve lots with optional phase filtering
- `getQualityControlLot(lotId)`: Get specific lot by ID
- `uploadQualityControlImage(file, lotId, type, calibre?)`: Upload images
- `deleteQualityControlLot(lotId)`: Delete lot and associated images

#### Advanced Functions
- `bulkSaveQualityControlLots(lots)`: Bulk save multiple lots
- `getQualityControlLotByNumber(lotNumber)`: Find lot by number
- `syncLocalDataToFirebase(localLots)`: Sync offline data
- `getQualityControlStatistics()`: Get comprehensive statistics

### 7. Enhanced Save Functionality

When clicking "Sauvegarder", the system:

1. **Validates** all required fields
2. **Prepares comprehensive data** including:
   - All form data with palette details
   - Calculated results and averages
   - Submission metadata
   - Palette indexing and timestamps
3. **Uploads images** to Firebase Storage
4. **Saves to Firestore** with error handling
5. **Updates local state** with sync status
6. **Provides detailed feedback** to user
7. **Maintains backwards compatibility** with localStorage

### 8. Sync Capabilities

#### Push to Firebase (Save)
- Comprehensive data validation
- Image upload with progress tracking
- Error handling with retry capabilities
- Local backup in case of failure

#### Pull from Firebase (Sync)
- Load existing lots on app start
- Manual sync button for real-time updates
- Merge remote and local data intelligently
- Preserve unsaved local changes

### 9. Error Handling

- **Network Issues**: Graceful fallback to local storage
- **Authentication Errors**: Clear error messages
- **Validation Failures**: Specific field-level feedback
- **Storage Errors**: Image upload retry mechanisms
- **Sync Conflicts**: Smart merging strategies

### 10. Testing

Use the `QualityControlFirebaseTest` component to verify:
- Authentication connectivity
- Data save/retrieve operations
- Image upload functionality
- Statistics and sync operations
- Error handling scenarios

### 11. Usage Instructions

#### For Controllers:
1. Fill out the quality control form completely
2. Add any relevant images
3. Click "Sauvegarder" to save and sync to Firebase
4. Use "Sync Firebase" to get latest updates
5. Monitor sync status indicators

#### For System Administrators:
1. Ensure Firebase project is properly configured
2. Deploy updated Firestore rules
3. Monitor Firebase usage and storage
4. Use test component for system verification

### 12. Benefits

- **Real-time Collaboration**: Multiple users can work simultaneously
- **Data Integrity**: Comprehensive validation and backup
- **Offline Support**: Works offline with sync when online
- **Audit Trail**: Complete history and metadata tracking
- **Scalability**: Cloud-based storage grows with usage
- **Security**: Role-based access and encrypted storage

### 13. Migration Notes

- Existing localStorage data is preserved during transition
- Data is saved to both Firebase and localStorage for compatibility
- No data loss during the migration process
- Progressive enhancement approach ensures backward compatibility

## Configuration Required

1. **Firebase Project**: Ensure Firebase project is properly set up
2. **Authentication**: Configure Firebase Authentication
3. **Firestore**: Enable Firestore database
4. **Storage**: Enable Firebase Storage
5. **Security Rules**: Deploy both Firestore and Storage rules
6. **Environment**: Set up environment variables for Firebase config

### Security Rules Deployment

#### Deploy Firestore Rules:
```bash
firebase deploy --only firestore:rules
```

#### Deploy Storage Rules:
```bash
firebase deploy --only storage
```

#### Deploy All Rules:
```bash
firebase deploy --only firestore:rules,storage
```

#### Test with Emulators:
```bash
# Test both Firestore and Storage rules
firebase emulators:start --only firestore,storage

# Test individual services
firebase emulators:start --only firestore
firebase emulators:start --only storage
```

#### Prerequisites for Emulators:
For Firebase emulators to work, you need Java installed:

**Windows:**
```bash
# Install Java via Chocolatey
choco install openjdk11

# Or download from Oracle/OpenJDK official sites
# Then add to system PATH
```

**Alternative without Java:**
```bash
# Test rules syntax only (no emulator needed)
firebase deploy --only storage --dry-run
firebase deploy --only firestore:rules --dry-run
```

#### Role Configuration:
For the storage rules to work properly, users must have roles set in their Firebase Auth custom claims:

```javascript
// Set custom claims for a user (Admin SDK)
admin.auth().setCustomUserClaims(uid, {
  role: 'controller', // or 'chief', 'quality_manager', 'admin', 'system'
  email_verified: true
});
```

This implementation provides a robust, scalable, and user-friendly quality control data management system with full Firebase integration and comprehensive security rules.

# Quality Control System Update

## Overview
The quality control system has been updated to support multiple lots management according to the user story requirements.

## New Features

### 1. Multi-Lot Management
- Quality controllers can now create and manage multiple lots simultaneously
- Each lot maintains its own data and images
- Lot tabs show status indicators (draft, completed, submitted)

### 2. Lot Operations
- **Create New Lot**: Add new lots with unique lot numbers
- **Duplicate Lot**: Copy data from existing lots to new ones
- **Delete Lot**: Remove lots (minimum 1 lot required)
- **Switch Between Lots**: Tab interface for easy navigation

### 3. Data Flow
```
Quality Control → Rapport Section → Archive Section
```

#### Quality Control Phase
- Controller fills data for each lot
- Can save individual lots (sends to Rapport section)
- Can add images to each lot
- Status: draft → completed

#### Rapport Section
- Receives completed lots from Quality Control
- Quality chief can add additional images and test results
- Data is organized by calibres
- Can submit to archive

#### Archive Section
- Final destination for all completed lots
- All lots stored in the same archive
- Comprehensive search and filter capabilities

### 4. Data Structure

#### QualityControlLot
```typescript
interface QualityControlLot {
  id: string;
  lotNumber: string;
  formData: FormData;
  images: File[];
  status: 'draft' | 'completed' | 'submitted';
  createdAt: string;
  updatedAt: string;
}
```

#### FormData (Same structure as before)
- Basic info (date, product, variety, etc.)
- Palette data for multiple palettes
- Tolerance settings

### 5. User Interface Changes

#### Header Section
- Lot management controls
- "Nouveau Lot" button to create lots
- "Soumettre tous les lots" to submit all completed lots
- Lot tabs with status indicators

#### Lot Status Indicators
- 🟡 Draft (yellow dot)
- 🟢 Completed (green dot) 
- 🟣 Submitted (purple dot)

#### Image Management
- Image upload section in Basic Info tab
- Preview images with delete option
- Images saved per lot

### 6. Storage
All data is stored in localStorage:
- `quality_rapports`: Completed lots sent to rapport section
- `archived_reports`: Final archived reports

### 7. Workflow
1. Controller creates new lot(s)
2. Fills quality control data for each lot
3. Adds images as needed
4. Saves individual lots (sends to rapport)
5. Submits all completed lots to archive
6. Data flows through: Quality Control → Rapport → Archive

## Technical Implementation
- Updated TypeScript interfaces for type safety
- Maintained existing form structure for compatibility
- Added image management per lot
- Enhanced PDF generation to work with current lot data
- Updated all form references to use current lot context

## Benefits
- Controllers can work on multiple lots simultaneously
- Better data organization and tracking
- Streamlined workflow from control to archive
- Enhanced image management per lot
- Maintains same quality control standards per lot

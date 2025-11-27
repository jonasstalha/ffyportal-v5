# Multi-Lot Management System - Usage Guide

## Overview
The enhanced system now supports working on multiple lots simultaneously with global accessibility and real-time collaboration features.

## Key Features

### 1. Multiple Lot Management
- Create and work on multiple lots at the same time
- Each lot maintains its own progress independently
- Switch between lots seamlessly

### 2. Global Accessibility
- All lots are saved globally in Firebase
- Accessible from any user account with proper permissions
- Real-time synchronization across all connected clients

### 3. Lot Status Management
- **Draft**: Newly created lot, work in progress
- **In Progress**: Lot with at least one completed step
- **Completed**: All 7 steps completed
- **Archived**: Completed lots moved to archive

### 4. Archive System
- Completed lots can be archived to keep the active workspace clean
- Archived lots remain accessible in the "Archives" tab
- Archive management through the lots page

## How to Use

### Creating a New Lot
1. Go to the New Entry page
2. Click "Nouveau lot" in the lot selector
3. Fill in the harvest information
4. The lot is automatically saved as draft

### Working on Existing Lots
1. Go to the New Entry page
2. Select an existing lot from the lot selector
3. Continue from where you left off
4. Progress is automatically saved

### Managing Lots
1. Go to the Lots page
2. View active lots in the "Lots Multiples" tab
3. View archived lots in the "Archives" tab
4. Use the dropdown menu on each lot card to:
   - Archive completed lots
   - Delete unwanted lots

### Lot Completion and Archiving
1. When all 7 steps are completed, the lot status changes to "Completed"
2. Completed lots no longer appear in the new entry page lot selector
3. Completed lots can be manually archived from the lots management page
4. Archived lots are kept for historical reference

## Technical Features

### Global Access
- All lots are stored in Firebase Firestore
- Real-time updates using Firestore subscriptions
- User authentication for access control

### Data Structure
- Each lot contains all 7 steps of avocado tracking
- Progress tracking with completed steps array
- Timestamp tracking for creation and updates
- User assignment and access control

### Performance
- Optimized queries for active vs archived lots
- Real-time updates without full page refreshes
- Efficient data fetching and caching

## Navigation

### New Entry Page
- Lot selector appears first
- Choose existing lot or create new
- Work on selected lot with full step navigation
- Auto-save functionality

### Lots Management Page
- Three tabs: Multi-Lots, Archives, Legacy
- Search functionality across all lots
- Quick actions through dropdown menus
- Status badges and progress indicators

## Data Migration
- Existing lots (legacy) remain accessible in the "Anciens Lots" tab
- New multi-lot system runs alongside existing system
- No data loss during transition

# Admin Interface Guide

## Overview

The PDF Packet Builder now includes an **Admin Interface** that allows you to upload and manage PDF documents directly within the application. This eliminates the need for external file hosting and prevents broken URL issues.

## Features

### 🔐 Secure Access
- Password-protected admin panel
- Default password: `admin123` (should be changed in production)

### 📤 File Upload
- Upload multiple PDF files at once
- Automatic document type detection based on filename
- Progress tracking during upload
- File validation (PDF only)

### 📝 Document Management
- View all uploaded documents
- Edit document metadata (name, type, description)
- Delete documents
- Document categorization by type (TDS, ESR, MSDS, LEED, etc.)

### 💾 Storage
- **IndexedDB**: Files are stored locally in the browser using IndexedDB
- **No External Dependencies**: No need for cloud storage or external servers
- **Persistent Storage**: Files remain available across browser sessions
- **Efficient**: Only selected documents are sent to the PDF generation worker

## Accessing the Admin Panel

### Method 1: Navigation Button
1. Open the PDF Packet Builder application
2. Click the **"Admin"** button in the top-right corner of the header
3. Enter the admin password

### Method 2: Direct URL
Navigate directly to: `http://localhost:5173/admin` (or your deployment URL + `/admin`)

## Using the Admin Interface

### 1. Login
- Enter the admin password: `admin123`
- Click "Login" to access the admin panel

### 2. Upload Documents
1. Click the upload area or "Click to upload PDF documents"
2. Select one or more PDF files from your computer
3. Wait for the upload progress to complete
4. Documents will appear in the list below

### 3. Edit Document Details
1. Click the **Edit** (pencil icon) button next to any document
2. Modify the following fields:
   - **Document Name**: Display name for the document
   - **Document Type**: Select from available types (TDS, ESR, MSDS, LEED, Installation, Warranty, Acoustic, PartSpec)
   - **Description**: Brief description of the document
3. Click **Save** to apply changes or **Cancel** to discard

### 4. Delete Documents
1. Click the **Delete** (trash icon) button next to any document
2. Confirm the deletion when prompted
3. Document will be removed from storage permanently

### 5. Return to Main App
Click the **"Close"** or **"Back to App"** button to return to the packet generator

## Document Types

The system supports the following document types:

| Type | Description | Icon |
|------|-------------|------|
| **TDS** | Technical Data Sheet | 📋 |
| **ESR** | Evaluation Service Report | ✅ |
| **MSDS** | Material Safety Data Sheet | ⚠️ |
| **LEED** | LEED Credit Guide | 🌿 |
| **Installation** | Installation Guide | 🔧 |
| **Warranty** | Limited Warranty | 🛡️ |
| **Acoustic** | Acoustical Performance | 🔊 |
| **PartSpec** | 3-Part Specifications | 📐 |

## How It Works

### Upload Process
1. **File Selection**: User selects PDF files
2. **Validation**: System validates that files are PDFs
3. **Type Detection**: System automatically detects document type from filename
4. **Storage**: 
   - File blob stored in IndexedDB (`files` store)
   - Metadata stored in IndexedDB (`documents` store)
5. **Confirmation**: Success message displayed

### Document Selection & Generation
1. User selects documents in the main app (Step 3)
2. When generating packet:
   - System checks if document has URL (legacy) or is uploaded
   - For uploaded documents: Retrieves from IndexedDB and encodes as base64
   - Sends document data to Cloudflare Worker
3. Worker processes both legacy (URL-based) and uploaded (base64) documents

### Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Frontend (React)                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐         ┌──────────────────┐   │
│  │ Admin Panel  │◄────────┤ Document Service │   │
│  └──────────────┘         └──────────────────┘   │
│         │                          │               │
│         │                          ▼               │
│         │                  ┌──────────────┐       │
│         │                  │  IndexedDB   │       │
│         │                  │  - documents │       │
│         │                  │  - files     │       │
│         │                  └──────────────┘       │
│         │                                          │
│  ┌──────▼──────────────────────────────────┐     │
│  │     Main App (Packet Generator)         │     │
│  └──────────────────────────────────────────┘     │
│         │                                          │
└─────────┼──────────────────────────────────────────┘
          │ (base64 encoded PDFs)
          ▼
┌─────────────────────────────────────────────────────┐
│           Cloudflare Worker (Backend)               │
├─────────────────────────────────────────────────────┤
│  • Decodes base64 PDFs (uploaded docs)              │
│  • Fetches URL-based PDFs (legacy docs)             │
│  • Merges all PDFs into final packet                │
│  • Returns generated PDF                            │
└─────────────────────────────────────────────────────┘
```

## Storage Details

### IndexedDB Stores

#### 1. `documents` Store
Stores document metadata:
```typescript
{
  id: string              // Unique document ID
  name: string            // Display name
  description: string     // Description
  filename: string        // Original filename
  url: string             // Empty for uploaded files
  size: number            // File size in bytes
  type: string            // Document type
  required: boolean       // Is required?
  products: string[]      // Applicable products
  productTypes: string[]  // Product types
}
```

#### 2. `files` Store
Stores actual PDF file blobs:
```typescript
{
  id: string      // Document ID (matches documents store)
  blob: Blob      // PDF file blob
}
```

## Migration from Legacy System

The system automatically supports both:
1. **Uploaded Documents**: Stored in IndexedDB (preferred)
2. **Legacy Documents**: Fetched from URLs in `documents.json` (fallback)

### Behavior:
- If uploaded documents exist → uses IndexedDB
- If no uploaded documents → falls back to legacy JSON
- Both types can be used in the same packet

## Security Considerations

### Current Implementation
- Simple password authentication (`admin123`)
- Password stored in frontend code
- Suitable for internal tools and trusted environments

### Production Recommendations
1. **Change Default Password**: Update `ADMIN_PASSWORD` in `AdminPanel.tsx`
2. **Use Environment Variables**: 
   ```typescript
   const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'default'
   ```
3. **Implement Backend Auth**: For production, implement proper authentication:
   - JWT tokens
   - OAuth integration
   - Backend API for admin operations
4. **Rate Limiting**: Add rate limiting to prevent brute force attacks
5. **Session Management**: Add session timeout and management

## Troubleshooting

### Issue: Documents Not Loading
**Solution**: 
- Check browser console for errors
- Verify IndexedDB is enabled in browser
- Try clearing browser data and re-uploading

### Issue: Upload Fails
**Solution**:
- Ensure file is a valid PDF
- Check file size (large files may take longer)
- Verify browser has sufficient storage quota

### Issue: Cannot Access Admin Panel
**Solution**:
- Verify URL is correct (`/admin`)
- Check that password is correct
- Clear browser cache and try again

### Issue: Generated PDF Missing Documents
**Solution**:
- Verify documents appear in admin panel
- Check browser console during generation
- Ensure worker is running (`npm run dev`)

## Browser Compatibility

IndexedDB is supported in all modern browsers:
- ✅ Chrome 24+
- ✅ Firefox 16+
- ✅ Safari 10+
- ✅ Edge 12+

## Storage Limits

IndexedDB storage limits vary by browser:
- **Chrome**: ~60% of available disk space
- **Firefox**: ~50% of available disk space
- **Safari**: ~1GB (user prompt for more)
- **Edge**: Similar to Chrome

For typical PDF documents:
- Small PDF (100KB): ~10,000 documents
- Medium PDF (1MB): ~1,000 documents
- Large PDF (10MB): ~100 documents

## Future Enhancements

Potential improvements for future versions:
1. Cloud storage integration (AWS S3, Azure Blob, etc.)
2. Multi-user support with roles and permissions
3. Document versioning and history
4. Batch upload with drag-and-drop
5. Document preview before upload
6. Export/import functionality for backups
7. Document search and filtering
8. Usage analytics and reporting

## Support

For issues or questions:
1. Check the browser console for error messages
2. Review this guide for troubleshooting steps
3. Contact your system administrator or development team


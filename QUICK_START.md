# Quick Start Guide - File Upload System

## 🚀 Getting Started in 5 Minutes

### Step 1: Start the Application
```bash
# Install dependencies (if not already done)
npm install

# Start both frontend and worker
npm run dev
```

The app will be available at: `http://localhost:5173`

### Step 2: Access the Admin Panel

**Option A: Click the Admin Button**
1. Look for the "Admin" button in the top-right corner
2. Click it to navigate to the admin panel

**Option B: Direct URL**
1. Navigate to: `http://localhost:5173/admin`

### Step 3: Login
1. Enter the password: `admin123`
2. Click "Login"

### Step 4: Upload Your First Document
1. Click on the upload area (or drag files into it)
2. Select one or more PDF files from your computer
3. Wait for the upload to complete (progress bar will show status)
4. Your documents will appear in the list below

### Step 5: Generate a Packet
1. Click "Close" or navigate back to the main app
2. Follow the normal workflow:
   - **Step 1**: Select product type
   - **Step 2**: Fill in project information
   - **Step 3**: Select your uploaded documents
   - **Step 4**: Generate the packet

🎉 **Done!** Your PDF packet will include your uploaded documents!

---

## 📋 Common Tasks

### Upload Multiple Documents
1. Go to Admin Panel (`/admin`)
2. Select multiple files at once
3. All files will upload simultaneously with individual progress tracking

### Edit Document Details
1. In Admin Panel, find the document you want to edit
2. Click the **pencil icon** (Edit button)
3. Modify:
   - Document Name
   - Document Type (TDS, ESR, MSDS, etc.)
   - Description
4. Click **Save**

### Delete a Document
1. In Admin Panel, find the document
2. Click the **trash icon** (Delete button)
3. Confirm the deletion
4. Document is permanently removed

### Change Admin Password
1. Open `src/components/AdminPanel.tsx`
2. Find the line: `const ADMIN_PASSWORD = 'admin123'`
3. Change to your desired password
4. Save the file
5. Restart the dev server

### Use Both Uploaded and Legacy Documents
The system automatically supports both:
- **Uploaded documents** (stored in IndexedDB) - **preferred**
- **Legacy documents** (from `documents.json`) - **fallback**

You can mix both types in the same packet!

---

## 🎯 Tips & Best Practices

### For Best Performance
- ✅ Keep PDF files under 10MB when possible
- ✅ Use descriptive filenames (auto-detected types work better)
- ✅ Upload documents in batches rather than one at a time

### Naming Conventions for Auto-Detection
Documents are automatically categorized based on filename:

| If filename contains... | Detected as... |
|------------------------|----------------|
| `TDS` or `technical data` | TDS |
| `ESR` or `evaluation` | ESR |
| `MSDS` or `safety data` | MSDS |
| `LEED` | LEED |
| `installation` or `install` | Installation |
| `warranty` | Warranty |
| `acoustic` or `ESL` | Acoustic |
| `spec` or `3-part` | PartSpec |

**Example good filenames:**
- `TDS-MAXTERRA-Floor-Panels.pdf` → Detected as TDS
- `ESR-5194-Structural-Floor.pdf` → Detected as ESR
- `Installation-Guide-v1.02.pdf` → Detected as Installation

### Document Organization
1. Upload all product-related documents together
2. Edit descriptions to make them searchable (future feature)
3. Use consistent naming patterns
4. Regularly review and remove outdated documents

### Backup Your Documents
**Current**: Files stored in browser IndexedDB
**Future**: Export/import feature coming

**For now**: Keep original PDF files backed up separately

---

## ⚠️ Troubleshooting

### "Cannot connect to PDF Worker"
**Solution**: Make sure worker is running
```bash
# Run both frontend and worker together
npm run dev

# OR run worker separately
cd worker
npm run dev
```

### "Invalid password"
**Solution**: Default password is `admin123` (case-sensitive)
If you changed it, use your custom password

### Upload Fails
**Possible causes**:
- ❌ File is not a PDF
- ❌ File is too large (> 50MB)
- ❌ File is corrupted
- ❌ Browser storage is full

**Solution**: 
1. Verify file is a valid PDF
2. Check file size
3. Try a different file
4. Clear browser data if storage is full

### Documents Not Appearing in Step 3
**Solution**:
1. Check that documents were successfully uploaded in Admin Panel
2. Verify product type matches (structural-floor vs underlayment)
3. Try refreshing the page
4. Check browser console for errors

### Admin Panel Won't Load
**Solution**:
1. Check URL is correct: `/admin`
2. Clear browser cache
3. Check browser console for errors
4. Verify IndexedDB is enabled in browser

---

## 🔧 Development Notes

### File Structure
```
src/
├── components/
│   ├── AdminPanel.tsx          # Admin interface
│   └── Layout.tsx              # Navigation with admin button
├── services/
│   ├── documentService.ts      # IndexedDB operations
│   └── pdfService.ts           # PDF generation
├── types/
│   └── index.ts                # TypeScript types
└── data/
    └── documents.ts            # Document loading logic

worker/
└── src/
    └── index.ts                # PDF processing (base64 support)
```

### Key Technologies
- **IndexedDB**: Browser storage for documents
- **React**: Frontend UI
- **TypeScript**: Type safety
- **Cloudflare Workers**: PDF processing
- **pdf-lib**: PDF manipulation
- **Lucide Icons**: UI icons
- **Framer Motion**: Animations

### API Overview

#### Document Service Methods
```typescript
// Upload a document
await documentService.uploadDocument(file, onProgress)

// Get all documents
const docs = await documentService.getAllDocuments()

// Update document
await documentService.updateDocument(id, updates)

// Delete document
await documentService.deleteDocument(id)

// Get file data as base64
const base64 = await documentService.exportDocumentAsBase64(id)
```

---

## 📚 Additional Resources

- **User Guide**: See `ADMIN_GUIDE.md` for detailed documentation
- **Technical Details**: See `IMPLEMENTATION_SUMMARY.md` for architecture
- **Main README**: See `README.md` for project overview

---

## 🆘 Need Help?

1. Check browser console for error messages
2. Review the troubleshooting section above
3. Check `ADMIN_GUIDE.md` for detailed documentation
4. Look at `IMPLEMENTATION_SUMMARY.md` for technical details
5. Contact your development team

---

## ✅ Checklist for First-Time Setup

- [ ] Run `npm install`
- [ ] Run `npm run dev`
- [ ] Access app at `http://localhost:5173`
- [ ] Navigate to `/admin`
- [ ] Login with `admin123`
- [ ] Upload a test PDF
- [ ] Verify document appears in list
- [ ] Return to main app
- [ ] Complete all 4 steps
- [ ] Generate a test packet
- [ ] Verify uploaded document is included

**If all steps complete successfully, you're ready to use the system!** 🎉

---

## 🎨 Customization

### Change Theme Colors
Edit `src/components/AdminPanel.tsx`:
- Modify Tailwind classes
- Update color schemes
- Customize animations

### Add Document Types
1. Update `src/types/index.ts`: Add to `DocumentType` enum
2. Update `src/data/documents.ts`: Add color/icon config
3. Update `src/services/documentService.ts`: Add detection logic

### Change Upload Limits
Edit `src/services/documentService.ts`:
```typescript
// Change max file size (default 50MB)
const MAX_SIZE = 50 * 1024 * 1024

// Change min file size (default 1KB)
if (file.size < 1024) { ... }
```

---

**Happy Document Management! 📄✨**


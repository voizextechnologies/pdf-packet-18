# Product Type Assignment Feature

## 🎯 Overview

Each document can now be assigned to specific product types (Structural Floor and/or Underlayment). This ensures that documents only appear in Step 3 when the appropriate product is selected.

## ✨ New Feature

### Product Type Assignment
When editing a document in the Admin Panel, you can now:
- ✅ Assign to **Structural Floor** only
- ✅ Assign to **Underlayment** only
- ✅ Assign to **Both** product types
- ✅ See product type badges in the document list

### How It Works

1. **Upload Document**
   - Documents are automatically assigned to both product types by default
   
2. **Edit Document** (Click pencil icon)
   - See two checkboxes: "Structural Floor" and "Underlayment"
   - Check/uncheck based on applicability
   - At least one must be selected
   
3. **View Document**
   - Green badge: "Structural Floor"
   - Purple badge: "Underlayment"
   - See which products the document applies to at a glance

4. **Document Filtering**
   - In Step 1, user selects product type
   - In Step 3, only documents matching that product type are shown
   - This prevents incorrect documents from appearing

## 📋 Usage Examples

### Example 1: Floor-Only Document
**Scenario**: ESR-5194 applies only to Structural Floor products

**Steps**:
1. Edit the document
2. Check ✅ "Structural Floor"
3. Uncheck ☐ "Underlayment"
4. Save

**Result**: Document only appears when "Structural Floor" is selected in Step 1

### Example 2: Underlayment-Only Document
**Scenario**: Installation guide specific to underlayment

**Steps**:
1. Edit the document
2. Uncheck ☐ "Structural Floor"
3. Check ✅ "Underlayment"
4. Save

**Result**: Document only appears when "Underlayment" is selected in Step 1

### Example 3: Universal Document
**Scenario**: MSDS applies to all products

**Steps**:
1. Edit the document
2. Check ✅ "Structural Floor"
3. Check ✅ "Underlayment"
4. Save

**Result**: Document appears for both product types

## 🎨 Visual Indicators

### In Admin Panel (View Mode)
```
Document Name: Technical Data Sheet
Type: TDS | 1.69 MB | TDS-MAXTERRA-Floor.pdf

Applies to: [Structural Floor] [Underlayment]
              ↑ Green badge    ↑ Purple badge
```

### In Edit Mode
```
Applicable Product Types
☑ Structural Floor    ☑ Underlayment
Select which product types this document applies to
```

## ⚠️ Validation

### Rules
1. **At least one product type must be selected**
   - Cannot save with both unchecked
   - Error message: "Please select at least one product type"

2. **Default behavior**
   - New uploads: Assigned to both types by default
   - Legacy documents: Both types (for backward compatibility)

## 🔄 Migration

### Existing Documents
All existing documents (uploaded before this feature) will:
- ✅ Automatically work with both product types
- ✅ Show both badges in the admin panel
- ✅ Appear in document selection for both products
- ℹ️ Can be edited to restrict to one type if needed

### Legacy Documents (from JSON)
Documents from `documents.json`:
- Already have `productTypes` field
- Will continue to work as configured
- No changes needed

## 💡 Best Practices

### Organizing Documents

1. **Review Each Document**
   - Check if it applies to one or both product types
   - Edit accordingly for better filtering

2. **Naming Convention**
   - Include product type in filename if specific
   - Example: "TDS-Structural-Floor.pdf"
   - Example: "Installation-Guide-Underlayment.pdf"

3. **Description Field**
   - Mention which product type in description
   - Example: "Technical specifications for structural floor panels"

## 🐛 Troubleshooting

### Issue: Document Not Appearing in Step 3
**Possible Causes**:
1. Product type not assigned correctly
2. Wrong product selected in Step 1

**Solution**:
1. Go to Admin Panel
2. Check document's product type badges
3. Edit if needed to include the correct product type

### Issue: Cannot Save Without Product Type
**Cause**: Validation requires at least one product type

**Solution**:
1. Check at least one checkbox (Structural Floor or Underlayment)
2. If document applies to both, check both

### Issue: Old Documents Have No Badges
**Cause**: Document uploaded before feature was added

**Solution**:
1. Edit the document
2. Select appropriate product types
3. Save

## 🔧 Technical Details

### Data Structure
```typescript
interface Document {
  // ... other fields
  productTypes: ProductType[]  // ['structural-floor', 'underlayment']
}

type ProductType = 'structural-floor' | 'underlayment'
```

### Default Values
```typescript
// On upload
productTypes: ['structural-floor', 'underlayment']

// Must have at least one
productTypes.length >= 1
```

### Filtering Logic
```typescript
// In Step 3, documents are filtered by:
document.productTypes.includes(selectedProductType)
```

## 📊 Benefits

### For Users
✅ **Better Organization** - Clear indication of document applicability
✅ **Fewer Mistakes** - Only see relevant documents for selected product
✅ **Easier Selection** - Reduced clutter in document list
✅ **Visual Clarity** - Color-coded badges for quick identification

### For System
✅ **Accurate Filtering** - Documents properly categorized
✅ **Flexible Configuration** - Per-document control
✅ **Backward Compatible** - Works with existing documents
✅ **Validation** - Prevents invalid configurations

## 🎯 Example Workflow

### Complete Example: Adding a New Structural Floor Document

1. **Upload**
   ```
   Navigate to Admin Panel (/admin)
   Upload: "ESR-5194-Structural-Floor.pdf"
   ✅ Uploaded with both product types by default
   ```

2. **Edit to Restrict**
   ```
   Click Edit (pencil icon)
   Document Name: "ESR-5194 Evaluation Report"
   Document Type: ESR
   Description: "Evaluation report for structural floor panels"
   Product Types:
     ✅ Structural Floor
     ☐ Underlayment  ← Uncheck this
   Click Save
   ```

3. **View Result**
   ```
   Document now shows:
   "Applies to: [Structural Floor]"  ← Only green badge
   ```

4. **Test in Main App**
   ```
   Step 1: Select "Structural Floor" product
   Step 3: ESR-5194 appears in document list ✅
   
   Step 1: Select "Underlayment" product
   Step 3: ESR-5194 does NOT appear ✅
   ```

## 📝 Summary

This feature provides **granular control** over document applicability, ensuring that users only see relevant documents based on their product selection. The visual indicators (green for Structural Floor, purple for Underlayment) make it easy to identify document categories at a glance.

**Key Points**:
- 🎯 Assign documents to Structural Floor, Underlayment, or both
- 🎨 Visual badges for quick identification
- ✅ Validation ensures at least one type is selected
- 🔄 Works with both new uploads and legacy documents
- 📊 Improves document organization and user experience

---

**Feature Added**: November 4, 2025
**Status**: ✅ Active and Tested


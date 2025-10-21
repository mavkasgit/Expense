# feat: Add exclusion words functionality for bulk import

## ✨ New Features
- **ExclusionSettings component**: Manage exclusion words with localStorage persistence
- **Integration in ColumnMappingModal**: New collapsible section for exclusions
- **Real-time filtering**: Preview excluded/included rows with live statistics
- **Clickable exclusions**: Click on exclusion word to see affected rows
- **Full preview modal**: View all data with filtering options

## 🎨 UI/UX Improvements
- **Consistent section styling**: All sections (Data, Exclusions, Test) have unified design
- **Collapsible sections**: Default collapsed state with localStorage persistence
- **Helpful tooltips**: Added question mark tooltips to all sections
- **Visual indicators**: Color-coded exclusion counts and status icons
- **Clean layout**: Fixed visual artifacts and spacing issues

## 🔧 Technical Implementation
- **localStorage integration**: Exclusion words persist between sessions
- **Import statistics**: Updated to show excluded rows count
- **Type safety**: Extended BuildExpensesStats with excludedRows field
- **Filtering logic**: Case-insensitive exclusion matching across all row data
- **Modal system**: Full preview with exclusion-specific filtering

## 📁 Files Modified
- `src/components/expense-input/bulk-input/components/ExclusionSettings.tsx` (new)
- `src/components/expense-input/bulk-input/components/ColumnMappingModal.tsx`
- `src/components/expense-input/bulk-input/utils/columnMappingWorkflow.ts`
- `src/components/expense-input/bulk-input/utils/importBuilder.ts`
- `src/components/expense-input/bulk-input/types.ts`
- `src/components/expense-input/bulk-input/BulkExpenseInput.tsx`

## 🎯 Usage
1. Open column mapping settings in bulk import
2. Find "🚫 Exclusion Words" section
3. Add words/phrases to exclude (e.g., "commission", "refund")
4. Preview excluded rows and apply settings
5. Excluded rows won't be imported

Ready for duplicate detection implementation! 🚀
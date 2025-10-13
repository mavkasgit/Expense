'use client'

import { Modal } from '@/components/ui/Modal'

interface TablePreviewModalProps {
  isOpen: boolean
  table: { description: string; rows: string[][] } | null
  onClose: () => void
}

export function TablePreviewModal({ isOpen, table, onClose }: TablePreviewModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={table ? `Предпросмотр: ${table.description}` : 'Предпросмотр таблицы'}
      size="xl"
    >
      {table && (
        <div className="max-h-[70vh] overflow-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-100 z-10">
              {table.rows[0] && (
                <tr>
                  {table.rows[0].map((cell, cellIndex) => (
                    <th
                      key={cellIndex}
                      className="border-b border-gray-300 p-2 text-left font-semibold text-gray-700"
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {table.rows.slice(1).map((row, rowIndex) => (
                <tr key={rowIndex} className="even:bg-gray-50">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="border-b border-gray-200 p-2">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

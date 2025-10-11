import type { ExpenseWithCategory } from './index'

// Общие типы для результатов server actions

export interface ActionResult<T = any> {
  success?: boolean
  data?: T
  error?: string
}

export interface ExpenseActionResult extends ActionResult {
  data?: ExpenseWithCategory
}

export interface BulkExpenseActionResult extends ActionResult {
  data?: ExpenseWithCategory[]
  stats?: {
    success: number
    failed: number
    uncategorized: number
    total: number
  }
  errors?: Array<{ row: number; message: string }>
}
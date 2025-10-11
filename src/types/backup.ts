// Общие типы для резервного копирования

export interface BackupData {
  metadata: {
    createdAt: string
    appName: string
    userEmail: string
    userId: string
  }
  expenses: any[]
  categories: any[]
  categoryGroups: any[]
  categoryKeywords: any[]
  keywordSynonyms: any[]
  cities: any[]
  citySynonyms: any[]
  unrecognizedCities: any[]
  unrecognizedKeywords: any[]
  bankStatements: any[]
}

export interface DataStats {
  expenses: number
  categories: number
  categoryGroups: number
  categoryKeywords: number
  keywordSynonyms: number
  cities: number
  citySynonyms: number
  unrecognizedCities: number
  unrecognizedKeywords: number
  bankStatements: number
  totalRecords: number
}

export interface RestoreResult {
  success: boolean
  message: string
  restored: {
    expenses: number
    categories: number
    categoryGroups: number
    categoryKeywords: number
    keywordSynonyms: number
    cities: number
    citySynonyms: number
    unrecognizedCities: number
    unrecognizedKeywords: number
    bankStatements: number
  }
}
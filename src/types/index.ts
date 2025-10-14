export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      bank_statements: {
        Row: {
          categorized_records: number | null
          error_message: string | null
          file_type: string
          filename: string
          id: string
          processed_at: string | null
          processed_records: number | null
          processing_log: Json | null
          status: string | null
          total_records: number | null
          uncategorized_records: number | null
          upload_date: string | null
          user_id: string | null
        }
        Insert: {
          categorized_records?: number | null
          error_message?: string | null
          file_type: string
          filename: string
          id?: string
          processed_at?: string | null
          processed_records?: number | null
          processing_log?: Json | null
          status?: string | null
          total_records?: number | null
          uncategorized_records?: number | null
          upload_date?: string | null
          user_id?: string | null
        }
        Update: {
          categorized_records?: number | null
          error_message?: string | null
          file_type?: string
          filename?: string
          id?: string
          processed_at?: string | null
          processed_records?: number | null
          processing_log?: Json | null
          status?: string | null
          total_records?: number | null
          uncategorized_records?: number | null
          upload_date?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          category_group_id: string | null
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category_group_id?: string | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category_group_id?: string | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_category_group_id_fkey"
            columns: ["category_group_id"]
            isOneToOne: false
            referencedRelation: "category_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      category_groups: {
        Row: {
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      category_keywords: {
        Row: {
          category_id: string | null
          created_at: string | null
          id: string
          keyword: string
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          keyword: string
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          id?: string
          keyword?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_keywords_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          coordinates: Json | null
          country_code: string | null
          created_at: string | null
          id: string
          is_favorite: boolean | null
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          coordinates?: Json | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          name: string
          updated_at: string
          user_id?: string | null
        }
        Update: {
          coordinates?: Json | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }

      city_synonyms: {
        Row: {
          city_id: string
          created_at: string
          id: number
          synonym: string
          user_id: string
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: number
          synonym: string
          user_id: string
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: number
          synonym?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "city_synonyms_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          auto_categorized: boolean | null
          batch_id: string | null
          category_id: string | null
          city_cyrillic: string | null
          city_id: string | null
          city_latin: string | null
          created_at: string | null
          description: string | null
          description_cyrillic: string | null
          description_latin: string | null
          expense_date: string
          expense_time: string | null
          id: string
          input_method: string | null
          keyword_cyrillic: string | null
          keyword_latin: string | null
          matched_keywords: string[] | null
          merchant: string | null
          notes: string | null
          original_data: Json | null
          raw_city_input: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          auto_categorized?: boolean | null
          batch_id?: string | null
          category_id?: string | null
          city_cyrillic?: string | null
          city_id?: string | null
          city_latin?: string | null
          created_at?: string | null
          description?: string | null
          description_cyrillic?: string | null
          description_latin?: string | null
          expense_date?: string
          expense_time?: string | null
          id?: string
          input_method?: string | null
          keyword_cyrillic?: string | null
          keyword_latin?: string | null
          matched_keywords?: string[] | null
          merchant?: string | null
          notes?: string | null
          original_data?: Json | null
          raw_city_input?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          auto_categorized?: boolean | null
          batch_id?: string | null
          category_id?: string | null
          city_cyrillic?: string | null
          city_id?: string | null
          city_latin?: string | null
          created_at?: string | null
          description?: string | null
          description_cyrillic?: string | null
          description_latin?: string | null
          expense_date?: string
          expense_time?: string | null
          id?: string
          input_method?: string | null
          keyword_cyrillic?: string | null
          keyword_latin?: string | null
          matched_keywords?: string[] | null
          merchant?: string | null
          notes?: string | null
          original_data?: Json | null
          raw_city_input?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      keyword_synonyms: {
        Row: {
          created_at: string | null
          id: string
          keyword_id: string | null
          synonym: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          keyword_id?: string | null
          synonym: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          keyword_id?: string | null
          synonym?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "keyword_synonyms_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "category_keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      unrecognized_cities: {
        Row: {
          first_seen: string | null
          frequency: number | null
          id: string
          last_seen: string | null
          name: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          first_seen?: string | null
          frequency?: number | null
          id?: string
          last_seen?: string | null
          name: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          first_seen?: string | null
          frequency?: number | null
          id?: string
          last_seen?: string | null
          name?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      unrecognized_keywords: {
        Row: {
          first_seen: string | null
          frequency: number | null
          id: string
          keyword: string
          last_seen: string | null
          source_type: string | null
          user_id: string | null
        }
        Insert: {
          first_seen?: string | null
          frequency?: number | null
          id?: string
          keyword: string
          last_seen?: string | null
          source_type?: string | null
          user_id?: string | null
        }
        Update: {
          first_seen?: string | null
          frequency?: number | null
          id?: string
          keyword?: string
          last_seen?: string | null
          source_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Application types
export type Category = Database['public']['Tables']['categories']['Row']
export type CategoryGroup = Database['public']['Tables']['category_groups']['Row']
export type Expense = Database['public']['Tables']['expenses']['Row']
export type City = Database['public']['Tables']['cities']['Row']

export type CitySynonym = Database['public']['Tables']['city_synonyms']['Row']
export type CitySynonymWithCity = CitySynonym & {
  city: Pick<City, 'id' | 'name' | 'coordinates' | 'is_favorite'> | null
}

export type CitySynonymOptionRecord = {
  id: number
  cityId: string
  cityName: string
  synonym: string
  markerPreset: string | null
  hasCoordinates: boolean
  isFavorite: boolean
}
export type UnrecognizedCity = Database['public']['Tables']['unrecognized_cities']['Row']

export type CategoryKeyword = Database['public']['Tables']['category_keywords']['Row']
export type KeywordSynonym = Database['public']['Tables']['keyword_synonyms']['Row']
export type UnrecognizedKeyword = Database['public']['Tables']['unrecognized_keywords']['Row']

export type CategoryKeywordWithSynonyms = CategoryKeyword & {
  keyword_synonyms?: KeywordSynonym[]
}

export type ExpenseWithCategory = Expense & {
  category: Category | null
  city?: Pick<City, 'id' | 'name' | 'coordinates'> | null
  bank_statements?: { filename: string } | null
}

export type CategoryWithKeywords = Category & {
  keywords: CategoryKeyword[]
}

export type ExistingKeyword = {
  keyword: string;
  keyword_synonyms: { synonym: string }[];
};

// Form types
export type CreateExpenseData = {
  amount: number
  description: string // Обязательно для категоризации
  notes?: string // Необязательное примечание
  category_id?: string // Необязательно - система сама определит
  expense_date: string
  expense_time?: string | null // Время транзакции (HH:MM)
  input_method?: 'single' | 'bulk_table'
  batch_id?: string
  city_id?: string | null // Ссылка на справочник городов
  city_input?: string | null // Исходный ввод города
}

export type CreateCategoryData = {
  name: string
  color?: string
  icon?: string
  category_group_id?: string | null
}

// Bulk input types
export type BulkExpenseRow = {
  amount: number
  description?: string
  category_id: string
  expense_date: string
  tempId?: string // для отслеживания в UI
  city_id?: string | null // Ссылка на справочник городов
}



// Типы для парсинга файлов (используется в bulk input)
export type ParsedBankData = {
  headers: string[]
  rows: string[][]
  totalRows: number
  selectedTableIndex?: number
  availableTables?: Array<{
    index: number
    description: string
    rowCount: number
    columnCount: number
    hasHeaders: boolean
    preview: string[][]
  }>
}

export type ExpenseInputMethod = 'single' | 'bulk_table'

// Column mapping types
export type ColumnMappingField =
  | 'amount'
  | 'description'
  | 'city'
  | 'expense_date'
  | 'expense_time'
  | 'notes'

export interface ColumnMapping {
  sourceIndex: number
  targetFields: ColumnMappingField[]
  enabled: boolean
  preview: string
  hidden?: boolean
  customSplitSeparator?: string
  customSplitParts?: Record<string, number> // field -> part index
  customSplitExample?: string // пример строки для демонстрации разделения
}

export type BulkImportResult = {
  success: number
  failed: number
  uncategorized: number
  errors: Array<{
    row: number
    message: string
  }>
}

// Auto-categorization types
export type KeywordMatch = {
  keyword: string
  category_id: string
}

export type CategorizationResult = {
  category_id: string | null
  matched_keywords: string[]
  auto_categorized: boolean
}

export type UncategorizedExpenseWithKeywords = Expense & {
  suggested_keywords: string[]
  potential_categories: Array<{
    category: Category
    confidence: number
    matched_keywords: string[]
  }>
}

// Keyword management types
export type CreateKeywordData = {
  keyword: string
  category_id: string
}

export type UpdateKeywordData = {
  keyword?: string
  category_id?: string
}

export type UpdateExpenseData = {
  amount?: number
  description?: string
  notes?: string
  category_id?: string
  expense_date?: string
  expense_time?: string | null
  city_id?: string | null // Ссылка на справочник городов
}

export type AssignKeywordData = {
  keyword: string
  category_id: string
}

// City management types
export type CreateCityData = {
  name: string
  coordinates?: { lat: number; lon: number } | null
  country_code?: string | null
  is_favorite?: boolean
}

export type UpdateCityData = {
  name?: string
  coordinates?: { lat: number; lon: number } | null
  country_code?: string | null
  is_favorite?: boolean
}

export type CreateCitySynonymData = {
  city_id: string
  synonym: string
}

export type CityWithSynonyms = City & {
  city_synonyms?: CitySynonym[]
}

export type ExpenseWithCity = Expense & {
  city?: City | null
}
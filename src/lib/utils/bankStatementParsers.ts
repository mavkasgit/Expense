import type { ParsedBankData } from '@/types'
import { extractCityFromDescription } from './cityParser'

/**
 * Парсер CSV файлов
 */
export function parseCSV(content: string): ParsedBankData {
  const lines = content.split('\n').filter(line => line.trim())
  
  if (lines.length === 0) {
    throw new Error('Файл пуст')
  }

  // Определяем разделитель (запятая, точка с запятой или табуляция)
  const firstLine = lines[0]
  let delimiter = ','
  
  if (firstLine.includes(';')) {
    delimiter = ';'
  } else if (firstLine.includes('\t')) {
    delimiter = '\t'
  }

  // Парсим строки
  const rows = lines.map((line, lineIndex) => {
    console.log(`parseCSV: обрабатываем строку ${lineIndex + 1}: "${line}"`)
    
    // Простой парсер CSV с учетом кавычек
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current.trim())
    const cleanedResult = result.map(cell => cell.replace(/^"|"$/g, '')) // Убираем кавычки
    
    console.log(`parseCSV: строка ${lineIndex + 1} разбита на ${cleanedResult.length} столбцов:`, cleanedResult)
    return cleanedResult
  })

  // Первая строка - заголовки
  const headers = rows[0] || []
  const dataRows = rows.slice(1)

  return {
    headers,
    rows: dataRows,
    totalRows: dataRows.length
  }
}

/**
 * Информация о найденной таблице
 */
export type TableInfo = {
  index: number
  element: Element
  description: string
  rowCount: number
  columnCount: number
  hasHeaders: boolean
  preview: string[][]
}

/**
 * Результат анализа HTML с найденными таблицами
 */
export type HTMLAnalysisResult = {
  tables: TableInfo[]
  totalTables: number
}

/**
 * Анализ HTML файла для поиска всех таблиц
 */
export function analyzeHTML(content: string): HTMLAnalysisResult {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/html')
  
  // Проверяем, является ли это файлом Excel (frameset)
  const isExcelFile = content.includes('Excel.Sheet') || content.includes('Microsoft Excel') || doc.querySelector('frameset')
  
  let allTables = Array.from(doc.querySelectorAll('table'))
  
  // Для Excel файлов пытаемся найти ссылки на отдельные листы
  if (isExcelFile && allTables.length === 0) {
    // Ищем ссылки на файлы листов
    const sheetLinks = Array.from(doc.querySelectorAll('link[href*="sheet"]'))
    if (sheetLinks.length > 0) {
      throw new Error('Это файл Excel с фреймами. Пожалуйста, сохраните файл как "Веб-страница, полная" или экспортируйте отдельный лист.')
    }
  }
  
  if (allTables.length === 0) {
    throw new Error('В HTML файле не найдено ни одной таблицы')
  }

  const tables: TableInfo[] = allTables.map((table, index) => {
    const rows = Array.from(table.querySelectorAll('tr'))
    const firstRow = rows[0]
    const cells = firstRow ? Array.from(firstRow.querySelectorAll('th, td')) : []
    
    // Определяем, есть ли заголовки
    const hasHeaders = firstRow ? firstRow.querySelectorAll('th').length > 0 : false
    
    // Создаем описание таблицы
    let description = `Таблица ${index + 1}`
    
    // Пытаемся найти описательную информацию
    const tableClass = table.className
    const tableId = table.id
    
    // Ищем заголовок таблицы в предыдущих элементах
    let prevElement = table.previousElementSibling
    let foundHeader = false
    
    // Проверяем несколько предыдущих элементов
    for (let i = 0; i < 3 && prevElement; i++) {
      if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'DIV'].includes(prevElement.tagName)) {
        const headerText = prevElement.textContent?.trim()
        if (headerText && headerText.length > 5 && headerText.length < 100) {
          // Проверяем, что это не просто число или короткий текст
          if (!/^\d+$/.test(headerText) && headerText.length > 10) {
            description = headerText
            foundHeader = true
            break
          }
        }
      }
      prevElement = prevElement.previousElementSibling
    }
    
    // Если не нашли заголовок, используем атрибуты таблицы
    if (!foundHeader) {
      if (tableClass && tableClass.length > 0) {
        description += ` (class: ${tableClass})`
      } else if (tableId && tableId.length > 0) {
        description += ` (id: ${tableId})`
      } else {
        // Пытаемся определить тип таблицы по содержимому заголовков
        if (firstRow) {
          const headerTexts = Array.from(firstRow.querySelectorAll('th, td'))
            .map(cell => cleanHtmlText(cell.textContent || '').toLowerCase())
            .filter(text => text.length > 0)
          
          // Проверяем специфичные классы банковских выписок
          if (tableClass.includes('section_3') || tableClass.includes('transactions')) {
            description = `Детальная информация по операциям (${index + 1})`
          } else if (tableClass.includes('section_2')) {
            description = `Сводная информация по счету (${index + 1})`
          } else if (tableClass.includes('section_1')) {
            description = `Информация о счете (${index + 1})`
          } else if (headerTexts.some(text => 
            text.includes('дата операции') || text.includes('дата отражения') || 
            text.includes('место операции') || text.includes('код авторизации')
          )) {
            description = `Детальная информация по операциям (${index + 1})`
          } else if (headerTexts.some(text => 
            text.includes('дата') || text.includes('сумма') || text.includes('операция') ||
            text.includes('date') || text.includes('amount') || text.includes('transaction')
          )) {
            description = `Таблица транзакций ${index + 1}`
          } else if (headerTexts.some(text =>
            text.includes('остаток') || text.includes('задолженность') || text.includes('период')
          )) {
            description = `Сводная информация (${index + 1})`
          } else if (headerTexts.length > 0) {
            description = `Таблица "${headerTexts.slice(0, 2).join(', ')}" (${index + 1})`
          }
        }
      }
    }

    // Создаем предпросмотр (первые 4 строки для лучшего понимания)
    const preview: string[][] = rows.slice(0, Math.min(4, rows.length)).map(row => 
      Array.from(row.querySelectorAll('th, td')).map(cell => {
        const text = cleanHtmlText(cell.textContent || '')
        return text.length > 30 ? text.substring(0, 30) + '...' : text
      })
    )

    return {
      index,
      element: table,
      description,
      rowCount: rows.length,
      columnCount: cells.length,
      hasHeaders,
      preview
    }
  })

  return {
    tables,
    totalTables: allTables.length
  }
}

/**
 * Парсер HTML файлов банковских выписок с выбранной таблицей
 */
export function parseHTML(content: string, selectedTableIndex?: number): ParsedBankData {
  const parser = new DOMParser()
  const doc = parser.parseFromString(content, 'text/html')
  
  let table: Element | null = null
  
  if (selectedTableIndex !== undefined) {
    // Используем выбранную таблицу
    const allTables = Array.from(doc.querySelectorAll('table'))
    table = allTables[selectedTableIndex] || null
  } else {
    // Автоматический поиск (старая логика для совместимости)
    const possibleSelectors = [
      'table.section_3', // Специфично для банковских выписок
      'table.transactions',
      'table[class*="transaction"]',
      'table[id*="transaction"]',
      'table[class*="operation"]',
      'table[id*="operation"]',
      '.transactions table',
      '.operations table',
      'table'
    ]
    
    for (const selector of possibleSelectors) {
      table = doc.querySelector(selector)
      if (table) break
    }
  }
  
  if (!table) {
    throw new Error('Не найдена таблица с транзакциями в HTML файле')
  }

  // Извлекаем заголовки
  const headerRow = table.querySelector('thead tr') || 
                   table.querySelector('tr:first-child') ||
                   table.querySelector('tr')
  
  if (!headerRow) {
    throw new Error('Не найдены заголовки таблицы')
  }

  const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => 
    cleanHtmlText(cell.textContent || '')
  )

  // Извлекаем строки данных
  const dataRows: string[][] = []
  const tbody = table.querySelector('tbody') || table
  const allRows = Array.from(tbody.querySelectorAll('tr'))
  
  // Определяем, есть ли отдельный thead
  const hasTheadSection = table.querySelector('thead') !== null
  const startIndex = hasTheadSection ? 0 : 1 // Пропускаем первую строку если нет thead
  
  const dataRowElements = allRows.slice(startIndex)

  dataRowElements.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll('td, th')).map(cell => {
      let text = cleanHtmlText(cell.textContent || '')
      
      // Специальная обработка для денежных сумм
      if (isMoneyCell(cell, text)) {
        text = cleanMoneyText(text)
      }
      
      return text
    })
    
    // Пропускаем строки с объединенными ячейками, которые являются заголовками разделов
    const hasColspan = Array.from(row.querySelectorAll('td, th')).some(cell => 
      cell.getAttribute('colspan') && parseInt(cell.getAttribute('colspan') || '1') > 1
    )
    
    // Пропускаем строки-разделители и итоговые строки
    const isSectionHeader = hasColspan && cells.some(cell => 
      cell.toLowerCase().includes('операции') || 
      cell.toLowerCase().includes('итого') ||
      cell.toLowerCase().includes('зачислено') ||
      cell.toLowerCase().includes('списано')
    )
    
    // Добавляем только строки с данными (не пустые, не итоговые, не разделители)
    if (cells.some(cell => cell.length > 0) && 
        !isFooterRow(cells) && 
        !isSectionHeader &&
        cells.length >= headers.length - 2) { // Допускаем небольшое расхождение в количестве колонок
      dataRows.push(cells)
    }
  })

  if (dataRows.length === 0) {
    throw new Error('Не найдены данные транзакций в таблице')
  }

  return {
    headers,
    rows: dataRows,
    totalRows: dataRows.length
  }
}

/**
 * Очистка текста от HTML артефактов
 */
function cleanHtmlText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Заменяем множественные пробелы на один
    .replace(/&nbsp;/g, ' ') // Заменяем неразрывные пробелы
    .replace(/&amp;/g, '&') // Декодируем амперсанды
    .replace(/&lt;/g, '<') // Декодируем меньше
    .replace(/&gt;/g, '>') // Декодируем больше
    .replace(/&quot;/g, '"') // Декодируем кавычки
    .trim()
}

/**
 * Проверка, является ли ячейка денежной суммой
 */
function isMoneyCell(cell: Element, text: string): boolean {
  // Проверяем класс ячейки
  const className = cell.className.toLowerCase()
  if (className.includes('debit') || className.includes('credit') || 
      className.includes('amount') || className.includes('sum')) {
    return true
  }
  
  // Проверяем содержимое на наличие денежных символов
  return /[\d\s,.-]+(?:руб|₽|RUB|rub)/i.test(text) || 
         /^\s*[\d\s,.-]+\s*$/.test(text)
}

/**
 * Очистка денежного текста
 */
function cleanMoneyText(text: string): string {
  // Сохраняем знак плюс или минус в начале
  const hasSign = text.trim().match(/^[+-]/)
  const sign = hasSign ? hasSign[0] : ''
  
  // Очищаем от всего кроме цифр, запятых, точек и пробелов (для разделения тысяч)
  let cleanText = text
    .replace(/[^\d,.\s-]/g, '') // Убираем все кроме цифр, запятых, точек, пробелов и минуса
    .replace(/\s+/g, ' ') // Нормализуем пробелы
    .trim()
  
  // Обрабатываем числа с пробелами как разделителями тысяч (например: "1 200,50")
  if (cleanText.includes(' ') && cleanText.includes(',')) {
    cleanText = cleanText.replace(/\s/g, '').replace(',', '.')
  } else if (cleanText.includes(' ') && !cleanText.includes(',') && !cleanText.includes('.')) {
    // Если только пробелы без запятых/точек, убираем пробелы
    cleanText = cleanText.replace(/\s/g, '')
  }
  
  // Возвращаем с сохраненным знаком
  return sign + cleanText
}

/**
 * Проверка, является ли строка итоговой/футерной
 */
function isFooterRow(cells: string[]): boolean {
  const rowText = cells.join(' ').toLowerCase()
  const footerKeywords = [
    'итого', 'всего', 'сумма', 'total', 'остаток', 'баланс',
    'выписка сформирована', 'количество операций', 'зачислено', 'списано',
    'задолженность', 'просроченная', 'вознаграждение', 'комиссия'
  ]
  
  // Проверяем, что строка содержит только итоговую информацию
  const hasFooterKeyword = footerKeywords.some(keyword => rowText.includes(keyword))
  
  // Дополнительная проверка: если строка содержит только числа и ключевые слова без даты
  const hasDate = /\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}/.test(rowText)
  
  return hasFooterKeyword && !hasDate
}

/**
 * Парсер XLSX файлов (упрощенная версия)
 * В реальном проекте лучше использовать библиотеку типа xlsx
 */
export function parseXLSX(arrayBuffer: ArrayBuffer): ParsedBankData {
  // Для демонстрации - простая заглушка
  // В реальном проекте здесь должна быть интеграция с библиотекой xlsx
  throw new Error('XLSX парсер не реализован. Используйте CSV формат.')
}

/**
 * Парсер OFX файлов (упрощенная версия)
 */
export function parseOFX(content: string): ParsedBankData {
  // Простой парсер OFX для демонстрации
  const transactions: string[][] = []
  
  // Ищем транзакции в OFX
  const transactionRegex = /<STMTTRN>(.*?)<\/STMTTRN>/g
  const matches = content.match(transactionRegex)
  
  if (!matches) {
    throw new Error('Не найдены транзакции в OFX файле')
  }

  matches.forEach(match => {
    const dateMatch = match.match(/<DTPOSTED>(\d{8})/)?.[1]
    const amountMatch = match.match(/<TRNAMT>([-\d.]+)/)?.[1]
    const memoMatch = match.match(/<MEMO>(.*?)</)?.[1]
    const nameMatch = match.match(/<NAME>(.*?)</)?.[1]
    
    if (dateMatch && amountMatch) {
      // Форматируем дату из YYYYMMDD в YYYY-MM-DD
      const formattedDate = `${dateMatch.slice(0, 4)}-${dateMatch.slice(4, 6)}-${dateMatch.slice(6, 8)}`
      const description = memoMatch || nameMatch || 'Транзакция'
      
      transactions.push([
        formattedDate,
        amountMatch,
        description,
        '' // balance - не всегда доступен в OFX
      ])
    }
  })

  return {
    headers: ['Дата', 'Сумма', 'Описание', 'Баланс'],
    rows: transactions,
    totalRows: transactions.length
  }
}

/**
 * Универсальная функция парсинга файла
 */
export async function parseBankStatementFile(
  file: File,
  selectedTableIndex?: number
): Promise<ParsedBankData> {
  const fileExtension = file.name.split('.').pop()?.toLowerCase()
  
  switch (fileExtension) {
    case 'csv':
    case 'txt':
      const csvContent = await file.text()
      return parseCSV(csvContent)
      
    case 'html':
    case 'htm':
      const htmlContent = await file.text()
      return parseHTML(htmlContent, selectedTableIndex)
      
    case 'xlsx':
    case 'xls':
      const xlsxBuffer = await file.arrayBuffer()
      return parseXLSX(xlsxBuffer)
      
    case 'ofx':
      const ofxContent = await file.text()
      return parseOFX(ofxContent)
      
    default:
      // Пытаемся парсить как текст для неизвестных форматов
      const content = await file.text()
      return parseCSV(content)
  }
}

/**
 * Определение типа файла по расширению
 */
export function getFileType(filename: string): 'csv' | 'xlsx' | 'ofx' | 'html' {
  const extension = filename.split('.').pop()?.toLowerCase()
  
  switch (extension) {
    case 'csv':
    case 'txt':
      return 'csv'
    case 'html':
    case 'htm':
      return 'html'
    case 'xlsx':
    case 'xls':
      return 'xlsx'
    case 'ofx':
      return 'ofx'
    default:
      // По умолчанию пытаемся обработать как CSV
      return 'csv'
  }
}

/**
 * Парсинг даты и времени из различных форматов
 */
export function parseDateAndTime(dateStr: string): { date: string; time: string | null } {
  if (!dateStr || typeof dateStr !== 'string') {
    return { date: new Date().toISOString().split('T')[0], time: null }
  }

  const cleanDate = dateStr.trim()
  
  if (!cleanDate) {
    return { date: new Date().toISOString().split('T')[0], time: null }
  }

  // Попробуем различные форматы с временем
  const formatsWithTime = [
    // Формат DD.MM.YYYY HH:MM
    {
      regex: /^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}$/,
      parser: (str: string) => {
        const [datePart, timePart] = str.split(' ')
        const [day, month, year] = datePart.split('.')
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        return { date, time: timePart }
      }
    },
    // Формат DD.MM.YYYY H:MM (без ведущего нуля в часах)
    {
      regex: /^\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}$/,
      parser: (str: string) => {
        const [datePart, timePart] = str.split(' ')
        const [day, month, year] = datePart.split('.')
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        // Нормализуем время к формату HH:MM
        const [hours, minutes] = timePart.split(':')
        const normalizedTime = `${hours.padStart(2, '0')}:${minutes}`
        return { date, time: normalizedTime }
      }
    },
    // Формат D.M.YYYY HH:MM (без ведущих нулей в дате)
    {
      regex: /^\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{2}$/,
      parser: (str: string) => {
        const [datePart, timePart] = str.split(' ')
        const [day, month, year] = datePart.split('.')
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        // Нормализуем время к формату HH:MM
        const [hours, minutes] = timePart.split(':')
        const normalizedTime = `${hours.padStart(2, '0')}:${minutes}`
        return { date, time: normalizedTime }
      }
    }
  ]

  // Пробуем форматы с временем
  for (const format of formatsWithTime) {
    if (format.regex.test(cleanDate)) {
      try {
        const result = format.parser(cleanDate)
        if (!isNaN(result.date.getTime()) && result.date.getFullYear() > 1900 && result.date.getFullYear() < 2100) {
          return {
            date: result.date.toISOString().split('T')[0],
            time: result.time
          }
        }
      } catch (error) {
        continue
      }
    }
  }

  // Если не найдено время, используем существующую логику parseDate
  return { date: parseDate(cleanDate), time: null }
}

/**
 * Парсинг даты из различных форматов (обратная совместимость)
 */
export function parseDate(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') {
    return new Date().toISOString().split('T')[0]
  }

  const cleanDate = dateStr.trim()
  
  if (!cleanDate) {
    return new Date().toISOString().split('T')[0]
  }

  // Попробуем различные форматы
  const formats = [
    // Формат YYYY-MM-DD (уже готов)
    {
      regex: /^\d{4}-\d{2}-\d{2}$/,
      parser: (str: string) => new Date(str)
    },
    // Формат DD.MM.YYYY HH:MM
    {
      regex: /^\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2}$/,
      parser: (str: string) => {
        const [datePart] = str.split(' ')
        const [day, month, year] = datePart.split('.')
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    },
    // Формат DD.MM.YYYY H:MM (без ведущего нуля в часах)
    {
      regex: /^\d{2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}$/,
      parser: (str: string) => {
        const [datePart] = str.split(' ')
        const [day, month, year] = datePart.split('.')
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    },
    // Формат D.M.YYYY HH:MM (без ведущих нулей в дате)
    {
      regex: /^\d{1,2}\.\d{1,2}\.\d{4}\s+\d{1,2}:\d{2}$/,
      parser: (str: string) => {
        const [datePart] = str.split(' ')
        const [day, month, year] = datePart.split('.')
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    },
    // Формат DD.MM.YYYY
    {
      regex: /^\d{2}\.\d{2}\.\d{4}$/,
      parser: (str: string) => {
        const [day, month, year] = str.split('.')
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    },
    // Формат DD/MM/YYYY
    {
      regex: /^\d{2}\/\d{2}\/\d{4}$/,
      parser: (str: string) => {
        const [day, month, year] = str.split('/')
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    },
    // Формат DD-MM-YYYY
    {
      regex: /^\d{2}-\d{2}-\d{4}$/,
      parser: (str: string) => {
        const [day, month, year] = str.split('-')
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    },
    // Формат YYYYMMDD
    {
      regex: /^\d{8}$/,
      parser: (str: string) => {
        const year = parseInt(str.slice(0, 4))
        const month = parseInt(str.slice(4, 6)) - 1
        const day = parseInt(str.slice(6, 8))
        return new Date(year, month, day)
      }
    },
    // Формат D.M.YYYY (без ведущих нулей)
    {
      regex: /^\d{1,2}\.\d{1,2}\.\d{4}$/,
      parser: (str: string) => {
        const [day, month, year] = str.split('.')
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    },
    // Формат YYYY.MM.DD
    {
      regex: /^\d{4}\.\d{2}\.\d{2}$/,
      parser: (str: string) => {
        const [year, month, day] = str.split('.')
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
      }
    }
  ]

  // Пробуем каждый формат
  for (const format of formats) {
    if (format.regex.test(cleanDate)) {
      try {
        const date = format.parser(cleanDate)
        if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
          return date.toISOString().split('T')[0]
        }
      } catch (error) {
        // Продолжаем с следующим форматом
        continue
      }
    }
  }

  // Последняя попытка - стандартный парсер Date
  try {
    const date = new Date(cleanDate)
    if (!isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100) {
      return date.toISOString().split('T')[0]
    }
  } catch (error) {
    // Игнорируем ошибку
  }

  // Если ничего не сработало, возвращаем текущую дату
  return new Date().toISOString().split('T')[0]
}

/**
 * Парсинг времени из различных форматов
 */
export function parseTimeValue(timeStr: string): string | null {
  if (!timeStr || typeof timeStr !== 'string') {
    return null
  }

  const cleanTime = timeStr
    .trim()
    .replace(/[\u00A0\s]+/g, '') // убираем пробелы и неразрывные пробелы

  if (!cleanTime) {
    return null
  }

  // Преобразуем распространенные разделители в двоеточие
  const normalizedSeparators = cleanTime
    .replace(/[.,;-]/g, ':')

  // Формат HH:MM или H:MM
  const timeWithColonMatch = normalizedSeparators.match(/^(\d{1,2}):(\d{2})$/)
  if (timeWithColonMatch) {
    const hours = parseInt(timeWithColonMatch[1], 10)
    const minutes = parseInt(timeWithColonMatch[2], 10)

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    }
  }

  // Формат HHMM или HMM (без разделителей)
  const digitsOnly = normalizedSeparators.replace(/[^\d]/g, '')
  if (digitsOnly.length === 3 || digitsOnly.length === 4) {
    const hours = parseInt(digitsOnly.slice(0, digitsOnly.length - 2), 10)
    const minutes = parseInt(digitsOnly.slice(-2), 10)

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    }
  }

  return null
}

/**
 * Парсинг суммы из строки
 */
export function parseAmount(amountStr: string): number {
  if (!amountStr || typeof amountStr !== 'string') {
    throw new Error(`Пустая или неверная сумма: ${amountStr}`)
  }

  let cleanAmount = amountStr.trim()
  
  if (!cleanAmount) {
    throw new Error(`Пустая сумма: ${amountStr}`)
  }

  // Сохраняем знак
  const isNegative = cleanAmount.startsWith('-') || cleanAmount.startsWith('(')
  
  // Убираем все кроме цифр, точек, запятых и пробелов
  cleanAmount = cleanAmount.replace(/[^\d.,\s]/g, '')
  
  // Обрабатываем различные форматы
  if (cleanAmount.includes(' ')) {
    // Формат с пробелами как разделителями тысяч: "1 234,56" или "1 234.56"
    if (cleanAmount.includes(',')) {
      // Европейский формат: "1 234,56"
      cleanAmount = cleanAmount.replace(/\s/g, '').replace(',', '.')
    } else {
      // Американский формат с пробелами: "1 234.56"
      cleanAmount = cleanAmount.replace(/\s/g, '')
    }
  } else if (cleanAmount.includes(',') && cleanAmount.includes('.')) {
    // Формат "1,234.56" (американский) или "1.234,56" (европейский)
    const lastComma = cleanAmount.lastIndexOf(',')
    const lastDot = cleanAmount.lastIndexOf('.')
    
    if (lastDot > lastComma) {
      // Американский формат: "1,234.56"
      cleanAmount = cleanAmount.replace(/,/g, '')
    } else {
      // Европейский формат: "1.234,56"
      cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.')
    }
  } else if (cleanAmount.includes(',')) {
    // Только запятая - может быть десятичным разделителем или разделителем тысяч
    const commaCount = (cleanAmount.match(/,/g) || []).length
    if (commaCount === 1) {
      const parts = cleanAmount.split(',')
      if (parts[1].length <= 2) {
        // Десятичный разделитель: "123,45"
        cleanAmount = cleanAmount.replace(',', '.')
      } else {
        // Разделитель тысяч: "1,234"
        cleanAmount = cleanAmount.replace(',', '')
      }
    } else {
      // Несколько запятых - разделители тысяч: "1,234,567"
      cleanAmount = cleanAmount.replace(/,/g, '')
    }
  }
  
  const amount = parseFloat(cleanAmount)
  
  if (isNaN(amount)) {
    throw new Error(`Не удалось распарсить сумму: ${amountStr} -> ${cleanAmount}`)
  }
  
  return isNegative ? -Math.abs(amount) : Math.abs(amount)
}

/**
 * Дедупликация записей на основе даты, суммы и описания
 */
export function deduplicateTransactions(
  newTransactions: Array<{ date: string; amount: number; description: string }>,
  existingTransactions: Array<{ expense_date: string; amount: number; description: string }>
): Array<{ date: string; amount: number; description: string; isDuplicate: boolean }> {
  
  return newTransactions.map(newTx => {
    const isDuplicate = existingTransactions.some(existingTx => 
      existingTx.expense_date === newTx.date &&
      Math.abs(existingTx.amount - newTx.amount) < 0.01 && // Учитываем погрешность в копейках
      existingTx.description?.toLowerCase().trim() === newTx.description.toLowerCase().trim()
    )
    
    return {
      ...newTx,
      isDuplicate
    }
  })
}

const HEADER_KEYWORDS = [
  'amount', 'сумм', 'sum', 'debet', 'credit', 'дата', 'date', 'опис', 'description',
  'city', 'город', 'time', 'время', 'note', 'примеч'
];

function normalizeRow(row: string[] = []): string[] {
  return row.map(cell => (cell ?? '').trim());
}

function removeEmptyRows(rows: string[][], preserveFirstRow = false): string[][] {
  return rows.filter((row, index) => {
    if (preserveFirstRow && index === 0) {
      return true;
    }
    return row.some(cell => cell && cell.trim().length > 0);
  });
}

function detectHeaderRow(headerRow: string[], firstDataRow?: string[]): boolean {
  if (!headerRow || headerRow.length === 0) {
    return false;
  }
  const normalizedHeader = headerRow.map(cell => cell.trim().toLowerCase());
  const headerHasKeywords = normalizedHeader.some(cell =>
    HEADER_KEYWORDS.some(keyword => cell.includes(keyword))
  );
  if (headerHasKeywords) {
    return true;
  }
  const headerHasDigits = headerRow.some(cell => /\d/.test(cell));
  const dataHasDigits = firstDataRow ? firstDataRow.some(cell => /\d/.test(cell)) : false;
  return !headerHasDigits && dataHasDigits;
}

export function prepareParsedDataset(parsed: ParsedBankData): { rows: string[][]; hasHeader: boolean } {
  const headerRow = normalizeRow(parsed.headers || []);
  const dataRows = (parsed.rows || []).map(normalizeRow);
  const firstDataRow = dataRows[0];

  const headerHasContent = headerRow.some(cell => cell.length > 0);
  const hasHeader = headerHasContent && detectHeaderRow(headerRow, firstDataRow);

  if (hasHeader) {
    return {
      rows: removeEmptyRows([headerRow, ...dataRows], true),
      hasHeader: true
    };
  }

  if (headerHasContent) {
    return {
      rows: removeEmptyRows([headerRow, ...dataRows]),
      hasHeader: false
    };
  }

  return {
    rows: removeEmptyRows(dataRows),
    hasHeader: false
  };
}
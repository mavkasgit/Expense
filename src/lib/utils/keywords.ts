// Извлечение ключевых слов из описания
export function extractKeywords(description: string): string[] {
  if (!description) return []
  
  const cleanedDescription = description.trim()

  if (cleanedDescription.length === 0) {
    return []
  }
  
  // Возвращаем всё описание как одно "ключевое слово"
  return [cleanedDescription]
}

// Стоп-слова (можно расширить)
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'и', 'в', 'на', 'с', 'по', 'для', 'от', 'до', 'из', 'к', 'о', 'об', 'за', 'под', 'над', 'при', 'без',
    'через', 'между', 'среди', 'около', 'возле', 'вокруг', 'после', 'перед', 'во', 'со', 'ко', 'ото',
    'что', 'как', 'где', 'когда', 'почему', 'зачем', 'куда', 'откуда', 'сколько', 'который', 'какой',
    'чей', 'чья', 'чьё', 'чьи', 'этот', 'эта', 'это', 'эти', 'тот', 'та', 'то', 'те', 'такой', 'такая',
    'такое', 'такие', 'весь', 'вся', 'всё', 'все', 'каждый', 'каждая', 'каждое', 'каждые', 'любой',
    'любая', 'любое', 'любые', 'другой', 'другая', 'другое', 'другие', 'один', 'одна', 'одно', 'одни',
    'два', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'
  ])
  
  return stopWords.has(word)
}

// Нормализация ключевого слова
export function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase().trim()
}

// Проверка валидности ключевого слова
export function isValidKeyword(keyword: string): boolean {
  const normalized = normalizeKeyword(keyword)
  return normalized.length > 2 && !isStopWord(normalized)
}

// Извлечение и фильтрация ключевых слов
export function extractValidKeywords(description: string): string[] {
  const keywords = extractKeywords(description)
  return keywords.filter(isValidKeyword)
}
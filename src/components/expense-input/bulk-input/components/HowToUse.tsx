'use client'

export function HowToUse() {
  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-lg">
      <h3 className="font-medium text-blue-900 mb-2">Как использовать:</h3>
      <ul className="text-sm text-blue-800 space-y-1">
        <li>• Добавляйте строки кнопкой &quot;Добавить строку&quot;</li>
        <li>• Копируйте данные из Excel/Google Sheets и вставляйте (Ctrl+V)</li>
        <li>• Загружайте файлы любых форматов: CSV, HTML, XLSX, OFX и другие</li>
        <li>• Для HTML файлов (банковские выписки) система найдет все таблицы и предложит выбрать нужную</li>
        <li>• <strong>Выбор таблицы запоминается</strong> - при следующей загрузке будет использована та же таблица</li>
        <li>• Используйте &quot;Настройка столбцов&quot; для изменения порядка полей</li>
        <li>• Система автоматически определит категории по описанию</li>
      </ul>
    </div>
  );
}

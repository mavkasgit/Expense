export type Preset = {
  name: string;
  description: string;
  emoji: string;
  groups: Array<{
    name: string;
    icon: string;
    color: string;
  }>;
  categories: Array<{
    name: string;
    icon: string;
    group: string;
  }>;
};

export const presets = [
  {
    name: 'Базовый',
    description: '4 группы и 8 категорий для основного учета.',
    emoji: '🌱',
    groups: [
      { name: 'Еда', icon: 'food', color: '#f59e0b' },
      { name: 'Транспорт', icon: 'car', color: '#3b82f6' },
      { name: 'Дом', icon: 'home', color: '#10b981' },
      { name: 'Личные расходы', icon: 'shopping-bag', color: '#6366f1' },
    ],
    categories: [
      { name: 'Продукты', icon: 'shopping-bag', group: 'Еда' },
      { name: 'Кафе и рестораны', icon: 'restaurant', group: 'Еда' },
      { name: 'Общественный транспорт', icon: 'bus', group: 'Транспорт' },
      { name: 'Такси', icon: 'taxi', group: 'Транспорт' },
      { name: 'Коммунальные платежи', icon: 'bills', group: 'Дом' },
      { name: 'Аптека', icon: 'pharmacy', group: 'Личные расходы' },
      { name: 'Одежда', icon: 'clothes', group: 'Личные расходы' },
      { name: 'Развлечения', icon: 'entertainment', group: 'Личные расходы' },
    ]
  },
  {
    name: 'Продвинутый',
    description: '6 групп и 20 категорий для более детального анализа.',
    emoji: '🚀',
    groups: [
      { name: 'Еда и напитки', icon: 'food', color: '#f59e0b' },
      { name: 'Транспорт', icon: 'car', color: '#3b82f6' },
      { name: 'Дом и быт', icon: 'home', color: '#10b981' },
      { name: 'Личные расходы', icon: 'shopping-bag', color: '#6366f1' },
      { name: 'Здоровье и спорт', icon: 'health', color: '#ef4444' },
      { name: 'Платежи и финансы', icon: 'bills', color: '#6b7280' },
    ],
    categories: [
      { name: 'Продукты', icon: 'shopping-bag', group: 'Еда и напитки' },
      { name: 'Бары и рестораны', icon: 'restaurant', group: 'Еда и напитки' },
      { name: 'Фастфуд', icon: 'food', group: 'Еда и напитки' },
      { name: 'Доставка еды', icon: 'pizza', group: 'Еда и напитки' },
      { name: 'Личный автомобиль', icon: 'car', group: 'Транспорт' },
      { name: 'Общественный транспорт', icon: 'bus', group: 'Транспорт' },
      { name: 'Такси', icon: 'taxi', group: 'Транспорт' },
      { name: 'Аренда и ипотека', icon: 'rent', group: 'Дом и быт' },
      { name: 'Коммунальные услуги', icon: 'bills', group: 'Дом и быт' },
      { name: 'Мебель и техника', icon: 'laptop', group: 'Дом и быт' },
      { name: 'Одежда и аксессуары', icon: 'clothes', group: 'Личные расходы' },
      { name: 'Косметика и уход', icon: 'beauty', group: 'Личные расходы' },
      { name: 'Подарки', icon: 'gift', group: 'Личные расходы' },
      { name: 'Развлечения', icon: 'entertainment', group: 'Личные расходы' },
      { name: 'Хобби', icon: 'game', group: 'Личные расходы' },
      { name: 'Образование', icon: 'education', group: 'Личные расходы' },
      { name: 'Врачи и аптеки', icon: 'doctor', group: 'Здоровье и спорт' },
      { name: 'Спортзал', icon: 'gym', group: 'Здоровье и спорт' },
      { name: 'Банковские комиссии', icon: 'bank', group: 'Платежи и финансы' },
      { name: 'Налоги', icon: 'bills', group: 'Платежи и финансы' },
    ]
  },
  {
    name: 'Глубокий',
    description: '12 групп и 40+ категорий для максимальной детализации.',
    emoji: '💎',
    groups: [
      { name: 'Продукты', icon: 'shopping-bag', color: '#10b981' },
      { name: 'Еда вне дома', icon: 'food', color: '#f59e0b' },
      { name: 'Транспорт', icon: 'car', color: '#3b82f6' },
      { name: 'Жилье', icon: 'home', color: '#14b8a6' },
      { name: 'Личные вещи', icon: 'clothes', color: '#6366f1' },
      { name: 'Здоровье', icon: 'health', color: '#ef4444' },
      { name: 'Красота', icon: 'beauty', color: '#ec4899' },
      { name: 'Досуг и хобби', icon: 'entertainment', color: '#8b5cf6' },
      { name: 'Образование', icon: 'education', color: '#a855f7' },
      { name: 'Финансы', icon: 'bank', color: '#6b7280' },
      { name: 'Семья и дети', icon: 'baby', color: '#f97316' },
      { name: 'Прочее', icon: 'other', color: '#78716c' },
    ],
    categories: [
      { name: 'Супермаркет', icon: 'shopping-bag', group: 'Продукты' },
      { name: 'Рынок', icon: 'other', group: 'Продукты' },
      { name: 'Рестораны', icon: 'restaurant', group: 'Еда вне дома' },
      { name: 'Кафе и фастфуд', icon: 'food', group: 'Еда вне дома' },
      { name: 'Кофе с собой', icon: 'coffee', group: 'Еда вне дома' },
      { name: 'Доставка', icon: 'pizza', group: 'Еда вне дома' },
      { name: 'Личный автомобиль', icon: 'car', group: 'Транспорт' },
      { name: 'Бензин', icon: 'gas', group: 'Транспорт' },
      { name: 'Общественный транспорт', icon: 'bus', group: 'Транспорт' },
      { name: 'Такси', icon: 'taxi', group: 'Транспорт' },
      { name: 'Аренда/Ипотека', icon: 'rent', group: 'Жилье' },
      { name: 'Коммунальные услуги', icon: 'bills', group: 'Жилье' },
      { name: 'Интернет и ТВ', icon: 'internet', group: 'Жилье' },
      { name: 'Ремонт', icon: 'tools', group: 'Жилье' },
      { name: 'Одежда', icon: 'clothes', group: 'Личные вещи' },
      { name: 'Обувь', icon: 'clothes', group: 'Личные вещи' },
      { name: 'Аксессуары', icon: 'other', group: 'Личные вещи' },
      { name: 'Аптека и лекарства', icon: 'pharmacy', group: 'Здоровье' },
      { name: 'Врачи и анализы', icon: 'doctor', group: 'Здоровье' },
      { name: 'Стоматология', icon: 'dentist', group: 'Здоровье' },
      { name: 'Спорт', icon: 'gym', group: 'Здоровье' },
      { name: 'Стрижка', icon: 'beauty', group: 'Красота' },
      { name: 'Косметика', icon: 'beauty', group: 'Красота' },
      { name: 'Маникюр/Педикюр', icon: 'beauty', group: 'Красота' },
      { name: 'Подписки (Кино, Музыка)', icon: 'music', group: 'Досуг и хобби' },
      { name: 'Книги', icon: 'book', group: 'Досуг и хобби' },
      { name: 'Игры', icon: 'game', group: 'Досуг и хобби' },
      { name: 'Путешествия', icon: 'travel', group: 'Досуг и хобби' },
      { name: 'Курсы', icon: 'education', group: 'Образование' },
      { name: 'Мастер-классы', icon: 'other', group: 'Образование' },
      { name: 'Банковское обслуживание', icon: 'bank', group: 'Финансы' },
      { name: 'Кредиты', icon: 'bank', group: 'Финансы' },
      { name: 'Налоги', icon: 'bills', group: 'Финансы' },
      { name: 'Инвестиции', icon: 'bank', group: 'Финансы' },
      { name: 'Детские товары', icon: 'baby', group: 'Семья и дети' },
      { name: 'Образование детей', icon: 'school', group: 'Семья и дети' },
      { name: 'Игрушки', icon: 'game', group: 'Семья и дети' },
      { name: 'Подарки', icon: 'gift', group: 'Прочее' },
      { name: 'Благотворительность', icon: 'other', group: 'Прочее' },
      { name: 'Канцтовары', icon: 'tools', group: 'Прочее' },
    ]
  }
]
// Question bank for the «Географ» mini-game: which country does this belong to?
// Own short prompts; answers are country names (also used as distractors).
export interface GeoQuestion {
  icon: string;
  prompt: string;
  answer: string;
}

export const GEO_QUESTIONS: readonly GeoQuestion[] = [
  { icon: '🗼', prompt: 'Эйфелева башня', answer: 'Франция' },
  { icon: '🏛️', prompt: 'Колизей', answer: 'Италия' },
  { icon: '🔺', prompt: 'Пирамиды Гизы', answer: 'Египет' },
  { icon: '🕌', prompt: 'Тадж-Махал', answer: 'Индия' },
  { icon: '⛪', prompt: 'Саграда Фамилия', answer: 'Испания' },
  { icon: '🗻', prompt: 'Гора Фудзи', answer: 'Япония' },
  { icon: '🗽', prompt: 'Статуя Свободы', answer: 'США' },
  { icon: '🕰️', prompt: 'Биг-Бен', answer: 'Великобритания' },
  { icon: '🎭', prompt: 'Сиднейский оперный театр', answer: 'Австралия' },
  { icon: '⛰️', prompt: 'Мачу-Пикчу', answer: 'Перу' },
  { icon: '🧱', prompt: 'Великая стена', answer: 'Китай' },
  { icon: '🙌', prompt: 'Статуя Христа-Искупителя', answer: 'Бразилия' },
  { icon: '🔺', prompt: 'Пирамида Чичен-Ица', answer: 'Мексика' },
  { icon: '🕌', prompt: 'Голубая мечеть', answer: 'Турция' },
  { icon: '🏛️', prompt: 'Акрополь', answer: 'Греция' },
  { icon: '🚪', prompt: 'Бранденбургские ворота', answer: 'Германия' },
  { icon: '🏜️', prompt: 'Город в скалах Петра', answer: 'Иордания' },
  { icon: '🛕', prompt: 'Храм Ангкор-Ват', answer: 'Камбоджа' },
  { icon: '🗼', prompt: 'Падающая башня в Пизе', answer: 'Италия' },
  { icon: '🏰', prompt: 'Дворец Альгамбра', answer: 'Испания' },
  { icon: '🖼️', prompt: 'Музей Лувр', answer: 'Франция' },
  { icon: '🎈', prompt: 'Воздушные шары Каппадокии', answer: 'Турция' },
  { icon: '🌮', prompt: 'Тако', answer: 'Мексика' },
  { icon: '🍣', prompt: 'Суши', answer: 'Япония' },
  { icon: '🥘', prompt: 'Паэлья', answer: 'Испания' },
  { icon: '🍕', prompt: 'Пицца «Маргарита»', answer: 'Италия' },
  { icon: '🥐', prompt: 'Круассан', answer: 'Франция' },
  { icon: '🍛', prompt: 'Масала и карри', answer: 'Индия' },
  { icon: '🍜', prompt: 'Пад-тай', answer: 'Таиланд' },
  { icon: '🥙', prompt: 'Дёнер-кебаб', answer: 'Турция' },
  { icon: '🦘', prompt: 'Кенгуру', answer: 'Австралия' },
  { icon: '🐼', prompt: 'Большая панда', answer: 'Китай' },
  { icon: '🌸', prompt: 'Праздник цветения сакуры', answer: 'Япония' },
  { icon: '💃', prompt: 'Фламенко', answer: 'Испания' },
  { icon: '🎬', prompt: 'Болливуд', answer: 'Индия' },
  { icon: '🎺', prompt: 'Мариачи', answer: 'Мексика' },
  { icon: '🥁', prompt: 'Карнавал и самба', answer: 'Бразилия' },
  { icon: '🌷', prompt: 'Тюльпаны и ветряные мельницы', answer: 'Нидерланды' },
  { icon: '🐫', prompt: 'Город Каир', answer: 'Египет' },
  { icon: '🏙️', prompt: 'Город Мумбаи', answer: 'Индия' },
  { icon: '🏖️', prompt: 'Курорт Канкун', answer: 'Мексика' },
  { icon: '🌉', prompt: 'Город Стамбул', answer: 'Турция' },
  { icon: '🍊', prompt: 'Город Валенсия', answer: 'Испания' },
  { icon: '🌋', prompt: 'Неаполь и Везувий', answer: 'Италия' },
  { icon: '⛵', prompt: 'Город Ницца', answer: 'Франция' },
  { icon: '🏯', prompt: 'Город Киото', answer: 'Япония' },
  { icon: '🌴', prompt: 'Штат Гоа', answer: 'Индия' },
  { icon: '🐠', prompt: 'Курорт Хургада', answer: 'Египет' },
  { icon: '🏔️', prompt: 'Город Рио-де-Жанейро', answer: 'Бразилия' },
  { icon: '🍁', prompt: 'Кленовый лист на флаге', answer: 'Канада' },
  { icon: '💃', prompt: 'Танго, Буэнос-Айрес', answer: 'Аргентина' },
  { icon: '🐘', prompt: 'Город Бангкок', answer: 'Таиланд' },
  { icon: '🍺', prompt: 'Карлов мост, Прага', answer: 'Чехия' },
];

/** All countries that appear as answers (distractor pool). */
export const GEO_COUNTRIES: readonly string[] = [...new Set(GEO_QUESTIONS.map((q) => q.answer))];

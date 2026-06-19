/**
 * search.js
 * -----------------------------------------------------------------------
 * Поиск веществ по базе: имя, синонимы, CAS-номер.
 * Используется для автодополнения в поле ввода.
 * -----------------------------------------------------------------------
 */

let SUBSTANCES = [];

/**
 * Загружает базу веществ из JSON.
 * @returns {Promise<Array>}
 */
async function loadSubstances() {
  if (SUBSTANCES.length > 0) return SUBSTANCES;
  const resp = await fetch('data/substances.json');
  if (!resp.ok) {
    throw new Error('Не удалось загрузить базу веществ (data/substances.json)');
  }
  SUBSTANCES = await resp.json();
  return SUBSTANCES;
}

/**
 * Ищет вещества по запросу (имя, синонимы, CAS).
 * Регистронезависимый поиск по подстроке.
 * @param {string} query
 * @param {number} limit максимальное число результатов
 * @returns {Array} массив найденных веществ
 */
function searchSubstances(query, limit = 15) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const results = [];
  for (const s of SUBSTANCES) {
    let score = null;

    const nameLower = s.name.toLowerCase();
    const casLower = (s.cas || '').toLowerCase();

    if (casLower === q || nameLower === q) {
      score = 0;               // точное совпадение CAS или названия
    } else if (nameLower.startsWith(q)) {
      score = 1;               // название начинается с запроса
    } else {
      // Поиск по синонимам — точное совпадение синонима важнее подстроки в названии
      for (const syn of s.synonyms) {
        const synLower = syn.toLowerCase();
        if (synLower === q) {
          score = 0; break;    // точное совпадение синонима
        } else if (synLower.startsWith(q)) {
          score = 2; break;    // синоним начинается с запроса
        } else if (synLower.includes(q)) {
          score = 3; break;
        }
      }
      // Подстрочное совпадение в названии — ниже синонимов
      if (score === null && nameLower.includes(q)) {
        score = 4;
      }
    }

    if (score !== null) {
      results.push({ substance: s, score });
    }
  }

  // Сортировка: по приоритету совпадения, затем по длине названия (короче — выше)
  results.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    return a.substance.name.length - b.substance.name.length;
  });

  return results.slice(0, limit).map((r) => r.substance);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { loadSubstances, searchSubstances };
}

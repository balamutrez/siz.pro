/**
 * app.js
 * -----------------------------------------------------------------------
 * Точка входа приложения: инициализация, обработка событий поиска,
 * управление состоянием выбранных веществ, вызов подбора и отрисовки.
 * -----------------------------------------------------------------------
 */

// Состояние: список выбранных веществ с концентрациями
// [{ substance: {...}, concentration: number|null }]
let selections = [];

// DOM-элементы
const searchInput = document.getElementById('search-input');
const suggestionsList = document.getElementById('suggestions');
const selectionContainer = document.getElementById('selection-list');
const resultContainer = document.getElementById('result');
const calcButton = document.getElementById('calc-button');

/**
 * Инициализация приложения.
 */
async function init() {
  try {
    await loadSubstances();
  } catch (err) {
    showLoadError(err);
    return;
  }

  renderSelectionList(selectionContainer, selections, handleRemove, handleConcentrationChange);

  searchInput.addEventListener('input', handleSearchInput);
  searchInput.addEventListener('keydown', handleSearchKeydown);
  document.addEventListener('click', (e) => {
    if (!suggestionsList.contains(e.target) && e.target !== searchInput) {
      hideSuggestions();
    }
  });

  calcButton.addEventListener('click', handleCalculate);
}

function showLoadError(err) {
  resultContainer.classList.remove('hidden');
  resultContainer.innerHTML = `
    <div class="result-block">
      <h3>Ошибка загрузки данных</h3>
      <p class="note warning">${err.message}</p>
    </div>`;
}

/**
 * Обработка ввода в поле поиска: показывает подсказки.
 */
function handleSearchInput(e) {
  const query = e.target.value;
  const results = searchSubstances(query);
  renderSuggestions(results);
}

/**
 * Навигация по подсказкам с клавиатуры (Enter добавляет первый вариант).
 */
function handleSearchKeydown(e) {
  if (e.key === 'Enter') {
    const first = suggestionsList.querySelector('.suggestion-item');
    if (first) {
      first.click();
      e.preventDefault();
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
}

/**
 * Отрисовывает выпадающий список подсказок.
 */
function renderSuggestions(results) {
  suggestionsList.innerHTML = '';

  if (results.length === 0) {
    hideSuggestions();
    return;
  }

  results.forEach((substance) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';

    const name = document.createElement('div');
    name.className = 'suggestion-name';
    name.textContent = substance.name;
    item.appendChild(name);

    if (substance.synonyms && substance.synonyms.length > 0) {
      const syn = document.createElement('div');
      syn.className = 'suggestion-synonyms';
      syn.textContent = 'Также известен как: ' + substance.synonyms.join(', ');
      item.appendChild(syn);
    }

    item.addEventListener('click', () => {
      addSubstance(substance);
      searchInput.value = '';
      hideSuggestions();
      searchInput.focus();
    });

    suggestionsList.appendChild(item);
  });

  suggestionsList.classList.remove('hidden');
}

function hideSuggestions() {
  suggestionsList.classList.add('hidden');
  suggestionsList.innerHTML = '';
}

/**
 * Добавляет вещество в список выбранных (если ещё не добавлено).
 */
function addSubstance(substance) {
  const exists = selections.some((s) => s.substance.id === substance.id);
  if (exists) return;

  selections.push({ substance, concentration: null });
  renderSelectionList(selectionContainer, selections, handleRemove, handleConcentrationChange);
}

/**
 * Удаляет вещество из списка по индексу.
 */
function handleRemove(index) {
  selections.splice(index, 1);
  renderSelectionList(selectionContainer, selections, handleRemove, handleConcentrationChange);
  // Сбрасываем результат, если список изменился
  renderResult(resultContainer, null);
}

/**
 * Обновляет концентрацию вещества по индексу.
 */
function handleConcentrationChange(index, value) {
  selections[index].concentration = value;
}

/**
 * Запускает подбор СИЗОД и отрисовывает результат.
 */
function handleCalculate() {
  if (selections.length === 0) {
    renderResult(resultContainer, null);
    return;
  }
  const result = getRecommendation(selections);
  renderResult(resultContainer, result);
  resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('DOMContentLoaded', init);

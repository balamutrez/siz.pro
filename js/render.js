/**
 * render.js — отрисовка интерфейса.
 */

function renderSelectionList(container, selections, onRemove, onConcentrationChange) {
  container.innerHTML = '';

  if (selections.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-hint';
    empty.textContent = 'Добавьте вещества из воздуха рабочей зоны, используя поиск выше.';
    container.appendChild(empty);
    return;
  }

  selections.forEach((sel, index) => {
    const row = document.createElement('div');
    row.className = 'selection-row';

    const info = document.createElement('div');
    info.className = 'selection-info';

    const name = document.createElement('div');
    name.className = 'selection-name';
    name.textContent = sel.substance.name;
    info.appendChild(name);

    // Meta line: PDK + formula + CAS + filter mark
    const metaParts = [];
    if (sel.substance.pdk_value !== null) {
      metaParts.push(`ПДК ${formatNumber(sel.substance.pdk_value)} мг/м³`);
    } else {
      metaParts.push('ПДК не уст.');
    }
    if (sel.substance.formula) metaParts.push(sel.substance.formula);
    if (sel.substance.cas) metaParts.push(`CAS ${sel.substance.cas}`);
    metaParts.push(`Марка: ${sel.substance.filter_mark}`);

    const meta = document.createElement('div');
    meta.className = 'selection-meta';
    meta.textContent = metaParts.join(' · ');
    info.appendChild(meta);

    const concWrap = document.createElement('div');
    concWrap.className = 'concentration-wrap';

    const concLabel = document.createElement('label');
    concLabel.textContent = 'Концентрация, мг/м³';
    concLabel.htmlFor = `conc-${index}`;

    const concInput = document.createElement('input');
    concInput.type = 'number';
    concInput.id = `conc-${index}`;
    concInput.min = '0';
    concInput.step = 'any';
    concInput.placeholder = '0.0';
    concInput.value = sel.concentration !== null && sel.concentration !== undefined
      ? sel.concentration : '';
    concInput.addEventListener('input', (e) => {
      const val = e.target.value === '' ? null : parseFloat(e.target.value);
      onConcentrationChange(index, val);
    });

    concWrap.appendChild(concLabel);
    concWrap.appendChild(concInput);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.setAttribute('aria-label', `Удалить ${sel.substance.name}`);
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => onRemove(index));

    row.appendChild(info);
    row.appendChild(concWrap);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });
}

function renderResult(container, result) {
  container.innerHTML = '';
  if (!result) { container.classList.add('hidden'); return; }
  container.classList.remove('hidden');

  // --- Предупреждение: фильтры неприменимы для некоторых веществ ---
  if (result.notApplicableItems && result.notApplicableItems.length > 0) {
    const warnBlock = document.createElement('div');
    warnBlock.className = 'result-block warning-block';
    const warnTitle = document.createElement('h3');
    warnTitle.textContent = '⚠ Внимание';
    warnBlock.appendChild(warnTitle);
    result.notApplicableItems.forEach((s) => {
      const p = document.createElement('p');
      p.className = 'note warning';
      p.textContent = s.filter_not_applicable_reason || `Для "${s.name}" фильтрующие СИЗОД неэффективны. Требуются изолирующие СИЗОД.`;
      warnBlock.appendChild(p);
    });
    container.appendChild(warnBlock);
  }

  // Если после исключения неприменимых нет активных марок — только предупреждение
  if (!result.marks || result.marks.length === 0) {
    const infoBlock = document.createElement('div');
    infoBlock.className = 'result-block';
    const p = document.createElement('p');
    p.className = 'note';
    p.textContent = 'По введённым веществам фильтрующие СИЗОД не рекомендуются. '
      + 'Обратитесь к специалисту по охране труда.';
    infoBlock.appendChild(p);
    container.appendChild(infoBlock);
    appendRatioTable(container, result);
    appendDisclaimer(container);
    return;
  }

  // --- Блок: марка фильтра ---
  const filterBlock = document.createElement('div');
  filterBlock.className = 'result-block';

  const filterTitle = document.createElement('h3');
  filterTitle.textContent = result.hasRecommendedOnly
    ? 'Рекомендуемая марка фильтра (концентрации ниже ПДК)'
    : 'Рекомендуемая марка фильтра';
  filterBlock.appendChild(filterTitle);

  if (result.hasRecommendedOnly) {
    const belowNote = document.createElement('p');
    belowNote.className = 'note below-pdk-note';
    belowNote.textContent =
      'Все введённые концентрации ниже ПДК — фильтр не является обязательным. '
      + 'Использование СИЗОД рекомендуется в качестве дополнительной меры защиты '
      + 'или при работе в нестабильных условиях.';
    filterBlock.appendChild(belowNote);
  }

  const filterBadge = document.createElement('div');
  filterBadge.className = 'filter-badge' + (result.hasRecommendedOnly ? ' filter-badge--recommended' : '');
  filterBadge.textContent = result.combinedFilter || '—';
  filterBlock.appendChild(filterBadge);

  const marksList = document.createElement('ul');
  marksList.className = 'marks-list';
  result.marks.forEach((mark) => {
    const li = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.className = 'mark-swatch';
    swatch.style.backgroundColor = (FILTER_INFO[mark] && FILTER_INFO[mark].color) || '#ccc';
    li.appendChild(swatch);
    const label = document.createElement('span');
    label.textContent = (FILTER_INFO[mark] && FILTER_INFO[mark].label) || mark;
    li.appendChild(label);
    marksList.appendChild(li);
  });
  filterBlock.appendChild(marksList);

  // Примечания по отдельным веществам (например, «кислота, но достаточно A»)
  result.items.forEach((item) => {
    if (item.substance.filter_note && !item.notApplicable) {
      const fnote = document.createElement('p');
      fnote.className = 'note filter-note';
      fnote.textContent = `💡 ${item.substance.name.split('(')[0].trim()}: ${item.substance.filter_note}`;
      filterBlock.appendChild(fnote);
    }
  });

  if (result.hasGasOrVapor && result.hasAerosol) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent =
      'В воздухе одновременно присутствуют газы/пары и аэрозоли. '
      + 'Класс предфильтра (P1/P2/P3) выберите исходя из условий применения — '
      + 'на практике чаще всего используется P2.';
    filterBlock.appendChild(note);
  }

  container.appendChild(filterBlock);

  // --- Блок: лицевая часть ---
  const faceBlock = document.createElement('div');
  faceBlock.className = 'result-block';
  const faceTitle = document.createElement('h3');
  faceTitle.textContent = 'Лицевая часть';
  faceBlock.appendChild(faceTitle);

  if (result.fullOnly) {
    const badge = document.createElement('div');
    badge.className = 'face-badge face-badge--full-only';
    badge.textContent = 'Только полнолицевая маска';
    faceBlock.appendChild(badge);

    // Показываем каждую причину отдельной строкой
    if (result.fullMaskReasons && result.fullMaskReasons.length > 0) {
      const reasonsList = document.createElement('ul');
      reasonsList.className = 'full-mask-reasons';
      result.fullMaskReasons.forEach(({ name, reason }) => {
        const li = document.createElement('li');
        const nameSpan = document.createElement('strong');
        nameSpan.textContent = name.split("(")[0].trim();
        li.appendChild(nameSpan);
        li.appendChild(document.createTextNode(" — " + reason));
        reasonsList.appendChild(li);
      });
      faceBlock.appendChild(reasonsList);
    }
  } else {
    const optionsWrap = document.createElement('div');
    optionsWrap.className = 'face-options';

    const halfBadge = document.createElement('div');
    halfBadge.className = 'face-badge face-badge--option';
    halfBadge.textContent = 'Полумаска';
    optionsWrap.appendChild(halfBadge);

    const orLabel = document.createElement('span');
    orLabel.className = 'face-or';
    orLabel.textContent = 'или';
    optionsWrap.appendChild(orLabel);

    const fullBadge = document.createElement('div');
    fullBadge.className = 'face-badge face-badge--option';
    fullBadge.textContent = 'Полнолицевая маска';
    optionsWrap.appendChild(fullBadge);

    faceBlock.appendChild(optionsWrap);

    const faceReason = document.createElement('p');
    faceReason.className = 'note';
    faceReason.textContent = result.facePieceReason;
    faceBlock.appendChild(faceReason);
  }
  container.appendChild(faceBlock);

  // --- FFP для чистого аэрозоля (не показываем если требуется только маска) ---
  if (result.isPureAerosol && !result.fullOnly) {
    const ffpBlock = document.createElement('div');
    ffpBlock.className = 'result-block';
    const ffpTitle = document.createElement('h3');
    ffpTitle.textContent = 'Фильтрующая полумаска (альтернатива)';
    ffpBlock.appendChild(ffpTitle);

    if (result.ffp && result.ffp.class) {
      const ffpBadge = document.createElement('div');
      ffpBadge.className = 'filter-badge ffp-badge';
      ffpBadge.textContent = result.ffp.class;
      ffpBlock.appendChild(ffpBadge);
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent =
        `Максимальная кратность превышения ПДК: ${formatNumber(result.ffp.maxRatio)}. `
        + `В воздухе только аэрозоли — допустимо использовать фильтрующую полумаску `
        + `класса ${result.ffp.class} вместо полумаски со сменным фильтром P.`;
      ffpBlock.appendChild(note);
    } else if (result.ffp && result.ffp.insufficientFFP) {
      const note = document.createElement('p');
      note.className = 'note warning';
      note.textContent =
        `Кратность превышения ПДК (${formatNumber(result.ffp.maxRatio)}) превышает 50. `
        + `Фильтрующая полумаска (FFP) недостаточна — используйте полумаску/маску со сменным фильтром P3.`;
      ffpBlock.appendChild(note);
    } else {
      const note = document.createElement('p');
      note.className = 'note';
      note.textContent =
        'Введите концентрацию, чтобы получить рекомендацию по классу FFP (FFP1/FFP2/FFP3).';
      ffpBlock.appendChild(note);
    }
    container.appendChild(ffpBlock);
  }

  // --- Доп. опция: FFP с угольным слоем ---
  if (result.ffpCarbonOption && result.ffpCarbonOption.applicable) {
    const carbonBlock = document.createElement('div');
    carbonBlock.className = 'result-block';
    const carbonTitle = document.createElement('h3');
    carbonTitle.textContent = 'Дополнительная опция';
    carbonBlock.appendChild(carbonTitle);
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = result.ffpCarbonOption.note;
    carbonBlock.appendChild(note);
    container.appendChild(carbonBlock);
  }

  // --- Таблица кратностей ---
  appendRatioTable(container, result);
  appendDisclaimer(container);
}

function appendRatioTable(container, result) {
  const detailsBlock = document.createElement('div');
  detailsBlock.className = 'result-block';
  const title = document.createElement('h3');
  title.textContent = 'Кратность превышения ПДК (справочно)';
  detailsBlock.appendChild(title);

  const table = document.createElement('table');
  table.className = 'ratio-table';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Вещество</th><th>Конц., мг/м³</th><th>ПДК, мг/м³</th><th>Кратность</th><th>Статус</th></tr>';
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  result.items.forEach((item) => {
    const tr = document.createElement('tr');
    if (item.belowPdk) tr.classList.add('row-below-pdk');
    if (item.notApplicable) tr.classList.add('row-not-applicable');

    const tdName = document.createElement('td');
    tdName.textContent = item.substance.name;
    tr.appendChild(tdName);

    const tdConc = document.createElement('td');
    tdConc.textContent = item.concentration !== null && item.concentration !== undefined
      ? formatNumber(item.concentration) : '—';
    tr.appendChild(tdConc);

    const tdPdk = document.createElement('td');
    tdPdk.textContent = item.pdkUsed !== null ? formatNumber(item.pdkUsed) : 'не уст.';
    tr.appendChild(tdPdk);

    const tdRatio = document.createElement('td');
    if (item.ratio !== null) {
      tdRatio.textContent = formatNumber(item.ratio) + '×';
      if (!item.belowPdk) {
        if (item.ratio > 50) tdRatio.classList.add('ratio-high');
        else if (item.ratio > 1) tdRatio.classList.add('ratio-medium');
      }
    } else {
      tdRatio.textContent = '—';
    }
    tr.appendChild(tdRatio);

    const tdStatus = document.createElement('td');
    if (item.notApplicable) {
      tdStatus.textContent = 'Фильтр неприменим';
      tdStatus.classList.add('status-na');
    } else if (item.belowPdk) {
      tdStatus.textContent = '✓ ниже ПДК';
      tdStatus.classList.add('status-ok');
    } else if (item.ratio !== null && item.ratio >= 1) {
      tdStatus.textContent = '⚠ выше ПДК';
      tdStatus.classList.add('status-warn');
    } else {
      tdStatus.textContent = '—';
    }
    tr.appendChild(tdStatus);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  detailsBlock.appendChild(table);
  container.appendChild(detailsBlock);
}

function appendDisclaimer(container) {
  const disclaimer = document.createElement('div');
  disclaimer.className = 'disclaimer';
  disclaimer.textContent =
    'Результат подбора носит рекомендательный характер и не заменяет заключение '
    + 'специалиста по охране труда. Перед применением СИЗОД оцените все факторы '
    + 'рабочего места и проконсультируйтесь со специалистом.';
  container.appendChild(disclaimer);
}

function formatNumber(n) {
  if (n === null || n === undefined) return '—';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(3).replace(/\.?0+$/, '');
}

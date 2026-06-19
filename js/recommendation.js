/**
 * recommendation.js — логика подбора СИЗОД по ГОСТ 12.4.235-2019.
 */

const FFP_THRESHOLDS = [
  { ratio: 4,  class: 'FFP1' },
  { ratio: 12, class: 'FFP2' },
  { ratio: 50, class: 'FFP3' },
];

const FILTER_ORDER = ['A', 'AX', 'B', 'E', 'K', 'SX', 'NOP3', 'HgP3', 'P'];

const FILTER_INFO = {
  A:    { color: '#8B5A2B', label: 'A — органические пары (т.кип. > 65°C)' },
  AX:   { color: '#A87C50', label: 'AX — органические пары (т.кип. ≤ 65°C, одноразовый)' },
  B:    { color: '#7A7A7A', label: 'B — неорганические газы и пары' },
  E:    { color: '#D6C100', label: 'E — кислые газы (SO₂, HCl, HF и др.)' },
  K:    { color: '#3E8E4F', label: 'K — аммиак и амины' },
  SX:   { color: '#8E44AD', label: 'SX — монооксид углерода и специфические' },
  NOP3: { color: '#3B6FB6', label: 'NOP3 — оксиды азота (спец. марка, включает P3)' },
  HgP3: { color: '#C0392B', label: 'HgP3 — пары ртути (спец. марка, включает P3)' },
  P:    { color: '#BFBFBF', label: 'P — противоаэрозольный фильтр' },
};

function parseMarks(filterMarkStr) {
  return filterMarkStr.split(',').map((s) => s.trim()).filter(Boolean);
}

function calcRatio(concentration, pdkValue) {
  if (pdkValue === null || pdkValue === undefined || pdkValue <= 0) return null;
  if (!concentration || concentration <= 0) return null;
  return concentration / pdkValue;
}

function ffpClassForRatio(ratio) {
  if (ratio === null) return null;
  for (const t of FFP_THRESHOLDS) {
    if (ratio <= t.ratio) return t.class;
  }
  return null;
}

function formatRatioInline(ratio) {
  if (ratio === null) return '?';
  if (Number.isInteger(ratio)) return ratio + '×';
  return ratio.toFixed(2).replace(/\.?0+$/, '') + '×';
}

function getRecommendation(selections) {
  if (!selections || selections.length === 0) return null;

  const items = [];
  const allMarksSet = new Set();
  const mandatoryMarksSet = new Set();
  const notApplicableItems = [];

  // fullMaskReasons: array of { name, reason }
  const fullMaskReasons = [];

  for (const sel of selections) {
    const { substance, concentration } = sel;

    // Вещества, для которых фильтрующие СИЗОД неприменимы
    if (substance.filter_not_applicable) {
      notApplicableItems.push(substance);
      items.push({
        substance,
        concentration,
        marks: [],
        ratio: calcRatio(concentration, substance.pdk_value),
        pdkUsed: substance.pdk_value,
        notApplicable: true,
        belowPdk: false,
        requiresFullMask: false,
      });
      continue;
    }

    const marks = parseMarks(substance.filter_mark);
    const ratio = calcRatio(concentration, substance.pdk_value);
    const belowPdk = (ratio !== null && ratio < 1);
    const hazardClass = parseInt(substance.hazard_class, 10);

    marks.forEach((m) => allMarksSet.add(m));
    if (!belowPdk) {
      marks.forEach((m) => mandatoryMarksSet.add(m));
    }

    // ── Определяем требование «только маска» ───────────────────────────
    let requiresFullMask = false;

    // 1. Раздражение глаз или кожи
    if (substance.face_piece === 'full') {
      requiresFullMask = true;
      fullMaskReasons.push({
        name: substance.name,
        reason: 'раздражение глаз или кожи',
      });
    }

    // 2. Класс опасности 1 + концентрация введена + превышает ПДК
    if (hazardClass === 1 && !requiresFullMask) {
      const concAbovePdk = ratio !== null && ratio >= 1;
      if (concAbovePdk) {
        requiresFullMask = true;
        fullMaskReasons.push({
          name: substance.name,
          reason: `1 класс опасности, концентрация превышает ПДК (${formatRatioInline(ratio)})`,
        });
      }
    }

    items.push({
      substance,
      concentration,
      marks,
      ratio,
      pdkUsed: substance.pdk_value,
      notApplicable: false,
      belowPdk,
      requiresFullMask,
    });
  }

  // ── Итоговые марки фильтра ─────────────────────────────────────────
  const mandatoryMarks = FILTER_ORDER.filter((m) => mandatoryMarksSet.has(m));
  const allMarks = FILTER_ORDER.filter((m) => allMarksSet.has(m));
  const activeMarks = mandatoryMarks.length > 0 ? mandatoryMarks : allMarks;
  const hasRecommendedOnly = mandatoryMarks.length === 0 && allMarks.length > 0;

  const isPureAerosol = activeMarks.length === 1 && activeMarks[0] === 'P';
  const hasGasOrVapor = activeMarks.some((m) => m !== 'P');
  const hasAerosol = allMarksSet.has('P') && (mandatoryMarksSet.has('P') || hasRecommendedOnly);

  let combinedFilter = '';
  if (activeMarks.length === 0) {
    combinedFilter = '—';
  } else if (hasGasOrVapor && hasAerosol) {
    combinedFilter = activeMarks.filter((m) => m !== 'P').join('') + 'P';
  } else {
    combinedFilter = activeMarks.join('');
  }

  // ── Лицевая часть ─────────────────────────────────────────────────
  const fullOnly = fullMaskReasons.length > 0;
  let facePieceReason = '';

  if (fullOnly) {
    const lines = fullMaskReasons.map(({ name, reason }) =>
      `${name.split('(')[0].trim()} — ${reason}`
    );
    facePieceReason = lines.join('; ');
  } else {
    facePieceReason =
      'Оба варианта допустимы. Полнолицевая маска обеспечивает дополнительную защиту глаз.';
  }

  // ── FFP (только чистый аэрозоль) ─────────────────────────────────
  let ffp = null;
  if (isPureAerosol) {
    const ratios = items
      .filter((it) => it.marks.includes('P') && !it.belowPdk)
      .map((it) => it.ratio)
      .filter((r) => r !== null);
    const maxRatio = ratios.length > 0 ? Math.max(...ratios) : null;
    ffp = {
      maxRatio,
      class: maxRatio !== null ? ffpClassForRatio(maxRatio) : null,
      insufficientFFP: maxRatio !== null && maxRatio > 50,
    };
  }

  // ── Доп. опция: FFP с угольным слоем ──────────────────────────────
  let ffpCarbonOption = null;
  if (hasAerosol && hasGasOrVapor) {
    const gasRatios = items
      .filter((it) => it.marks.some((m) => m !== 'P') && !it.notApplicable)
      .map((it) => it.ratio)
      .filter((r) => r !== null);
    const maxGasRatio = gasRatios.length > 0 ? Math.max(...gasRatios) : null;
    if (maxGasRatio === null || maxGasRatio <= 1) {
      ffpCarbonOption = {
        applicable: true,
        note:
          'Концентрации газов/паров невысоки. Как альтернативу можно рассмотреть '
          + 'фильтрующую полумаску с дополнительным угольным слоем (защита от запаха).',
      };
    }
  }

  return {
    combinedFilter,
    marks: activeMarks,
    allMarks,
    hasRecommendedOnly,
    fullOnly,
    facePieceReason,
    fullMaskReasons,
    isPureAerosol,
    hasGasOrVapor,
    hasAerosol,
    ffp,
    ffpCarbonOption,
    notApplicableItems,
    items,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getRecommendation, parseMarks, calcRatio,
    ffpClassForRatio, FILTER_INFO, FFP_THRESHOLDS,
  };
}

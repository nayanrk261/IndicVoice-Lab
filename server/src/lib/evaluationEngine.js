const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00A0/g, ' ')
    .replace(/\u200B/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeUnicode = (value) => String(value ?? '').normalize('NFC');

export function normalizeText(value, options = {}) {
  const {
    trim = true,
    collapseWhitespace = true,
    unicodeForm = 'NFC',
    preserveCase = true,
    stripZeroWidth = true
  } = options;

  let normalized = normalizeUnicode(value);
  if (trim) {
    normalized = normalized.trim();
  }
  if (collapseWhitespace) {
    normalized = normalized.replace(/\r\n?/g, '\n').replace(/\u00A0/g, ' ');
    normalized = normalized.replace(/\s+/g, ' ');
  }
  if (stripZeroWidth) {
    normalized = normalized.replace(/\u200B/g, '');
  }
  if (!preserveCase) {
    normalized = normalized.toLocaleLowerCase();
  }
  return normalized.normalize(unicodeForm);
}

const parseScalarEntityValue = (value) => {
  const text = normalizeText(value);
  if (!text) return '';
  return text.replace(/[,\s]/g, '');
};

const parseNumericValue = (value) => {
  const text = normalizeText(value, { collapseWhitespace: true, trim: true });
  if (!text) return Number.NaN;

  const cleaned = text.replace(/₹|Rs\.?|INR|\s|,/g, '');
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
};

const inferEntityType = (key, maybeValue) => {
  const label = String(key || '').toLowerCase();
  if (label.includes('name') || label.includes('person') || label.includes('customer')) return 'person';
  if (label.includes('location') || label.includes('place') || label.includes('city') || label.includes('state')) return 'location';
  if (label.includes('date') || label.includes('day') || label.includes('time')) return 'date';
  if (label.includes('amount') || label.includes('price') || label.includes('currency') || label.includes('rupee')) return 'amount';
  if (label.includes('number') || label.includes('count') || label.includes('qty') || label.includes('quantity')) return 'number';

  if (maybeValue === null || maybeValue === undefined) return 'unknown';
  const text = String(maybeValue).trim();
  if (/^\d+[.,]?\d*$/.test(text) || /^₹?\d+[.,]?\d*$/.test(text)) return 'number';
  return 'unknown';
};

const normalizeEntityValue = (entityType, value) => {
  const text = normalizeText(value);
  if (!text) return '';

  if (entityType === 'amount' || entityType === 'number') {
    const numeric = parseNumericValue(value);
    return Number.isNaN(numeric) ? text : String(numeric);
  }

  if (entityType === 'date') {
    return text;
  }

  return text;
};

export function computeEditOperations(expected, actual) {
  const left = Array.isArray(expected) ? expected.map(String) : Array.from(expected ?? '');
  const right = Array.isArray(actual) ? actual.map(String) : Array.from(actual ?? '');

  const dp = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => ({
      substitutions: 0,
      deletions: 0,
      insertions: 0,
      distance: 0
    }))
  );

  for (let i = 0; i <= left.length; i += 1) {
    dp[i][0] = { substitutions: 0, deletions: i, insertions: 0, distance: i };
  }

  for (let j = 0; j <= right.length; j += 1) {
    dp[0][j] = { substitutions: 0, deletions: 0, insertions: j, distance: j };
  }

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      if (left[i - 1] === right[j - 1]) {
        dp[i][j] = { ...dp[i - 1][j - 1] };
        continue;
      }

      const substitution = {
        ...dp[i - 1][j - 1],
        substitutions: dp[i - 1][j - 1].substitutions + 1,
        distance: dp[i - 1][j - 1].distance + 1
      };

      const deletion = {
        ...dp[i - 1][j],
        deletions: dp[i - 1][j].deletions + 1,
        distance: dp[i - 1][j].distance + 1
      };

      const insertion = {
        ...dp[i][j - 1],
        insertions: dp[i][j - 1].insertions + 1,
        distance: dp[i][j - 1].distance + 1
      };

      const candidates = [substitution, deletion, insertion];
      dp[i][j] = candidates.reduce((best, candidate) => {
        if (candidate.distance < best.distance) return candidate;
        if (candidate.distance === best.distance) {
          const currentScore = candidate.substitutions + candidate.deletions + candidate.insertions;
          const bestScore = best.substitutions + best.deletions + best.insertions;
          return currentScore < bestScore ? candidate : best;
        }
        return best;
      }, candidates[0]);
    }
  }

  return dp[left.length][right.length];
}

export function wordErrorRate(expected, actual) {
  const normalizedExpected = normalizeText(expected).split(/\s+/).filter(Boolean);
  const normalizedActual = normalizeText(actual).split(/\s+/).filter(Boolean);

  const referenceCount = normalizedExpected.length;
  const hypothesisCount = normalizedActual.length;
  const denominator = referenceCount || hypothesisCount || 1;
  const metrics = computeEditOperations(normalizedExpected, normalizedActual);

  return {
    referenceWordCount: referenceCount,
    hypothesisWordCount: hypothesisCount,
    substitutions: metrics.substitutions,
    deletions: metrics.deletions,
    insertions: metrics.insertions,
    distance: metrics.distance,
    errorRate: metrics.distance / denominator
  };
}

export function characterErrorRate(expected, actual) {
  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);
  const expectedCharacters = Array.from(normalizedExpected);
  const actualCharacters = Array.from(normalizedActual);

  const referenceCount = expectedCharacters.length;
  const hypothesisCount = actualCharacters.length;
  const denominator = referenceCount || hypothesisCount || 1;
  const metrics = computeEditOperations(expectedCharacters, actualCharacters);

  return {
    referenceCharacterCount: referenceCount,
    hypothesisCharacterCount: hypothesisCount,
    substitutions: metrics.substitutions,
    deletions: metrics.deletions,
    insertions: metrics.insertions,
    distance: metrics.distance,
    errorRate: metrics.distance / denominator
  };
}

export function compareCriticalEntities(expectedEntities, actualEntities) {
  const expectedEntries = expectedEntities ?? {};
  const actualEntries = actualEntities ?? {};
  const keys = Array.from(new Set([...Object.keys(expectedEntries), ...Object.keys(actualEntries)]));

  const items = keys.map((key) => {
    const source = expectedEntries[key];
    const target = actualEntries[key];
    const inferredType = inferEntityType(key, source ?? target);
    const expectedValue = normalizeEntityValue(inferredType, source ?? '');
    const predictedValue = normalizeEntityValue(inferredType, target ?? '');
    const match = expectedValue === predictedValue;

    return {
      key,
      entityType: inferredType,
      expected: expectedValue,
      predicted: predictedValue,
      actual: predictedValue,
      match
    };
  });

  return {
    total: items.length,
    matches: items.filter((item) => item.match).length,
    mismatches: items.filter((item) => !item.match).length,
    items
  };
}

export function evaluateTranscript(expected, actual, criticalEntities = {}) {
  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);

  const wordMetrics = wordErrorRate(normalizedExpected, normalizedActual);
  const characterMetrics = characterErrorRate(normalizedExpected, normalizedActual);
  const criticalEntitySummary = compareCriticalEntities(
    criticalEntities.expected ?? criticalEntities,
    criticalEntities.actual ?? {}
  );

  const status =
    wordMetrics.errorRate === 0 &&
    characterMetrics.errorRate === 0 &&
    criticalEntitySummary.mismatches === 0
      ? 'pass'
      : 'fail';

  return {
    normalizedExpected,
    normalizedActual,
    referenceWordCount: wordMetrics.referenceWordCount,
    hypothesisWordCount: wordMetrics.hypothesisWordCount,
    referenceCharacterCount: characterMetrics.referenceCharacterCount,
    hypothesisCharacterCount: characterMetrics.hypothesisCharacterCount,
    substitutions: wordMetrics.substitutions,
    deletions: wordMetrics.deletions,
    insertions: wordMetrics.insertions,
    wordErrorRate: wordMetrics.errorRate,
    characterErrorRate: characterMetrics.errorRate,
    criticalEntities: criticalEntitySummary,
    status
  };
}

export { normalizeWhitespace };

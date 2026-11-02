const toNormalizedString = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFC').replace(/\r\n?/g, '\n').replace(/\s+/g, ' ').trim();
};

export function normalizeText(value) {
  return toNormalizedString(value);
}

export function computeEditOperations(expected, actual) {
  const left = Array.isArray(expected) ? expected.map(String) : Array.from(expected ?? '');
  const right = Array.isArray(actual) ? actual.map(String) : Array.from(actual ?? '');

  const memo = new Map();

  function solve(i, j) {
    const key = `${i}:${j}`;
    if (memo.has(key)) {
      return memo.get(key);
    }

    if (i === left.length && j === right.length) {
      const result = { substitutions: 0, deletions: 0, insertions: 0, distance: 0 };
      memo.set(key, result);
      return result;
    }

    if (i === left.length) {
      const result = {
        substitutions: 0,
        deletions: 0,
        insertions: right.length - j,
        distance: right.length - j
      };
      memo.set(key, result);
      return result;
    }

    if (j === right.length) {
      const result = {
        substitutions: 0,
        deletions: left.length - i,
        insertions: 0,
        distance: left.length - i
      };
      memo.set(key, result);
      return result;
    }

    if (left[i] === right[j]) {
      const result = solve(i + 1, j + 1);
      memo.set(key, result);
      return result;
    }

    const substitutionCandidate = solve(i + 1, j + 1);
    const deletionCandidate = solve(i + 1, j);
    const insertionCandidate = solve(i, j + 1);

    const candidates = [
      {
        ...substitutionCandidate,
        substitutions: substitutionCandidate.substitutions + 1,
        distance: substitutionCandidate.distance + 1
      },
      {
        ...deletionCandidate,
        deletions: deletionCandidate.deletions + 1,
        distance: deletionCandidate.distance + 1
      },
      {
        ...insertionCandidate,
        insertions: insertionCandidate.insertions + 1,
        distance: insertionCandidate.distance + 1
      }
    ];

    const best = candidates.reduce((currentBest, candidate) => {
      if (!currentBest || candidate.distance < currentBest.distance) {
        return candidate;
      }

      if (candidate.distance === currentBest.distance) {
        const score = candidate.substitutions + candidate.deletions + candidate.insertions;
        const currentScore = currentBest.substitutions + currentBest.deletions + currentBest.insertions;
        return score < currentScore ? candidate : currentBest;
      }

      return currentBest;
    }, null);

    memo.set(key, best);
    return best;
  }

  return solve(0, 0);
}

export function wordErrorRate(expected, actual) {
  const normalizedExpected = normalizeText(expected).split(/\s+/).filter(Boolean);
  const normalizedActual = normalizeText(actual).split(/\s+/).filter(Boolean);

  const denominator = normalizedExpected.length || normalizedActual.length || 1;
  const metrics = computeEditOperations(normalizedExpected, normalizedActual);

  return {
    expectedWordCount: normalizedExpected.length,
    actualWordCount: normalizedActual.length,
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
  const expectedCharacters = normalizedExpected ? Array.from(normalizedExpected) : [];
  const actualCharacters = normalizedActual ? Array.from(normalizedActual) : [];

  const denominator = expectedCharacters.length || actualCharacters.length || 1;
  const metrics = computeEditOperations(expectedCharacters, actualCharacters);

  return {
    expectedCharacterCount: expectedCharacters.length,
    actualCharacterCount: actualCharacters.length,
    substitutions: metrics.substitutions,
    deletions: metrics.deletions,
    insertions: metrics.insertions,
    distance: metrics.distance,
    errorRate: metrics.distance / denominator
  };
}

export function compareCriticalEntities(expectedEntities, actualEntities) {
  const expected = expectedEntities || {};
  const actual = actualEntities || {};
  const entries = Object.keys(expected).map((key) => {
    const expectedValue = normalizeText(expected[key]);
    const actualValue = normalizeText(actual[key]);
    const match = expectedValue === actualValue;

    return {
      key,
      expected: expectedValue,
      actual: actualValue,
      match
    };
  });

  return {
    total: entries.length,
    matches: entries.filter((entry) => entry.match).length,
    mismatches: entries.filter((entry) => !entry.match).length,
    items: entries
  };
}

export function evaluateTranscript(expected, actual, criticalEntities = {}) {
  const normalizedExpected = normalizeText(expected);
  const normalizedActual = normalizeText(actual);

  return {
    normalizedExpected,
    normalizedActual,
    word: wordErrorRate(normalizedExpected, normalizedActual),
    character: characterErrorRate(normalizedExpected, normalizedActual),
    criticalEntities: compareCriticalEntities(criticalEntities.expected || {}, criticalEntities.actual || {})
  };
}

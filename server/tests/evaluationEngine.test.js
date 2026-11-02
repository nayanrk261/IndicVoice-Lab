import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeText,
  computeEditOperations,
  wordErrorRate,
  characterErrorRate,
  compareCriticalEntities
} from '../src/lib/evaluationEngine.js';

test('normalizeText collapses whitespace without stripping meaningful characters', () => {
  assert.equal(normalizeText('  नमस्ते   दुनिया  '), 'नमस्ते दुनिया');
  assert.equal(normalizeText('  Hello,  world!  '), 'Hello, world!');
});

test('computeEditOperations counts substitutions, deletions, and insertions correctly', () => {
  assert.deepEqual(computeEditOperations('abc', 'axc'), {
    substitutions: 1,
    deletions: 0,
    insertions: 0,
    distance: 1
  });

  assert.deepEqual(computeEditOperations('abc', 'ab'), {
    substitutions: 0,
    deletions: 1,
    insertions: 0,
    distance: 1
  });

  assert.deepEqual(computeEditOperations('abc', 'abcd'), {
    substitutions: 0,
    deletions: 0,
    insertions: 1,
    distance: 1
  });
});

test('wordErrorRate reports the expected error and count values', () => {
  const result = wordErrorRate('hello world', 'hello there world');
  assert.equal(result.errorRate, 0.5);
  assert.equal(result.substitutions, 0);
  assert.equal(result.deletions, 0);
  assert.equal(result.insertions, 1);
});

test('characterErrorRate computes the edit-distance rate over characters', () => {
  const result = characterErrorRate('abc', 'axc');
  assert.equal(result.errorRate, 1 / 3);
  assert.equal(result.substitutions, 1);
  assert.equal(result.deletions, 0);
  assert.equal(result.insertions, 0);
});

test('compareCriticalEntities matches entity values and reports mismatches', () => {
  const result = compareCriticalEntities(
    { name: 'Amit Sharma', amount: '₹1000', date: '2024-11-02', location: 'Delhi' },
    { name: 'Amit Sharma', amount: '₹1500', date: '2024-11-02', location: 'Mumbai' }
  );

  assert.equal(result.total, 4);
  assert.equal(result.matches, 2);
  assert.equal(result.mismatches, 2);
  assert.deepEqual(result.items, [
    { key: 'name', expected: 'Amit Sharma', actual: 'Amit Sharma', match: true },
    { key: 'amount', expected: '₹1000', actual: '₹1500', match: false },
    { key: 'date', expected: '2024-11-02', actual: '2024-11-02', match: true },
    { key: 'location', expected: 'Delhi', actual: 'Mumbai', match: false }
  ]);
});

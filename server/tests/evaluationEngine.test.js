import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeText,
  computeEditOperations,
  wordErrorRate,
  characterErrorRate,
  compareCriticalEntities,
  evaluateTranscript
} from '../src/lib/evaluationEngine.js';

test('normalizeText collapses whitespace without stripping meaningful characters', () => {
  assert.equal(normalizeText('  नमस्ते   दुनिया  '), 'नमस्ते दुनिया');
  assert.equal(normalizeText('  Hello,  world!  '), 'Hello, world!');
  assert.equal(normalizeText('क\t\n  hello   world'), 'क hello world');
});

test('normalizeText preserves punctuation and unicode and is deterministic', () => {
  assert.equal(normalizeText('हेल्लो!!!  नमस्ते—दुनिया'), 'हेल्लो!!! नमस्ते—दुनिया');
  assert.equal(normalizeText('  मुंबई, महाराष्ट्र  '), 'मुंबई, महाराष्ट्र');
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

  assert.deepEqual(computeEditOperations('', 'abc'), {
    substitutions: 0,
    deletions: 0,
    insertions: 3,
    distance: 3
  });
});

test('wordErrorRate reports the expected error and count values', () => {
  const result = wordErrorRate('hello world', 'hello there world');
  assert.equal(result.errorRate, 0.5);
  assert.equal(result.substitutions, 0);
  assert.equal(result.deletions, 0);
  assert.equal(result.insertions, 1);
  assert.equal(result.referenceWordCount, 2);
});

test('characterErrorRate computes the edit-distance rate over characters', () => {
  const result = characterErrorRate('abc', 'axc');
  assert.equal(result.errorRate, 1 / 3);
  assert.equal(result.substitutions, 1);
  assert.equal(result.deletions, 0);
  assert.equal(result.insertions, 0);
});

test('word and character metrics handle empty reference and empty hypothesis', () => {
  assert.equal(wordErrorRate('', '').errorRate, 0);
  assert.equal(wordErrorRate('', 'hello there').errorRate, 1);
  assert.equal(characterErrorRate('', '').errorRate, 0);
  assert.equal(characterErrorRate('', 'abc').errorRate, 1);
});

test('compareCriticalEntities matches entity values and reports mismatches', () => {
  const result = compareCriticalEntities(
    { personName: 'Amit Sharma', amount: '₹1000', date: '2024-11-02', location: 'Delhi' },
    { personName: 'Amit Sharma', amount: '₹1500', date: '2024-11-02', location: 'Mumbai' }
  );

  assert.equal(result.total, 4);
  assert.equal(result.matches, 2);
  assert.equal(result.mismatches, 2);
  assert.equal(result.items[0].entityType, 'person');
  assert.equal(result.items[1].entityType, 'amount');
  assert.equal(result.items[2].entityType, 'date');
  assert.equal(result.items[3].entityType, 'location');
});

test('numeric values are not silently treated as equivalent', () => {
  const result = compareCriticalEntities({ amount: '₹1000', count: '10' }, { amount: '₹1001', count: '10' });
  assert.equal(result.mismatches, 1);
  assert.equal(result.matches, 1);
  assert.equal(result.items[0].match, false);
  assert.equal(result.items[1].match, true);
});

test('Hindi, Marathi and Hinglish texts remain stable through normalization and metrics', () => {
  assert.equal(normalizeText('  नमस्ते  दुनिया  '), 'नमस्ते दुनिया');
  assert.equal(normalizeText('   मुंबई   शहर  '), 'मुंबई शहर');
  assert.equal(wordErrorRate('नमस्ते दुनिया', 'नमस्ते दुनिया').errorRate, 0);
  assert.equal(wordErrorRate('hello world', 'hello').errorRate, 0.5);
  assert.equal(characterErrorRate('मराठी', 'मराठीत').errorRate, 1 / 5);
});

test('evaluateTranscript produces the structured summary and status', () => {
  const result = evaluateTranscript(
    'नमस्ते दुनिया',
    'नमस्ते दुनिया',
    {
      expected: { personName: 'Amit Sharma', location: 'Delhi' },
      actual: { personName: 'Amit Sharma', location: 'Delhi' }
    }
  );

  assert.equal(result.status, 'pass');
  assert.equal(result.wordErrorRate, 0);
  assert.equal(result.characterErrorRate, 0);
  assert.equal(result.criticalEntities.mismatches, 0);
  assert.equal(result.referenceWordCount, 2);
  assert.equal(result.referenceCharacterCount, 13);
});

test('evaluateTranscript fails when transcripts differ or numeric entities mismatch', () => {
  const result = evaluateTranscript(
    'अमित ने 1000 रुपये दिए',
    'अमित ने 1001 रुपये दिए',
    {
      expected: { amount: '₹1000' },
      actual: { amount: '₹1001' }
    }
  );

  assert.equal(result.status, 'fail');
  assert.equal(result.criticalEntities.mismatches, 1);
  assert.ok(result.wordErrorRate > 0 || result.characterErrorRate > 0);
});

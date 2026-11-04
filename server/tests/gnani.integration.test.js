import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';

import { env } from '../src/config/env.js';
import { transcribeAudioFromFile } from '../src/services/gnaniService.js';

test('Gnani transcription service uses native FormData and parses the transcript', async () => {
  const originalFetch = global.fetch;
  const originalApiKeyId = env.gnani.apiKeyId;
  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/sample-audio.wav');

  env.gnani.apiKeyId = 'test-key-id';

  const fetchMock = async (url, options) => {
    assert.equal(url, 'https://api.vachana.ai/stt/v3');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-API-Key-ID'], 'test-key-id');
    assert.ok(options.signal instanceof AbortSignal);
    assert.ok(options.body instanceof FormData);
    assert.ok(!Object.prototype.hasOwnProperty.call(options.headers, 'Content-Type'));

    const formEntries = [];
    for (const [key, value] of options.body.entries()) {
      formEntries.push({ key, valueType: value instanceof Blob ? 'blob' : typeof value, filename: value instanceof Blob ? value.name || 'unnamed' : undefined, value });
    }

    assert.ok(formEntries.some((entry) => entry.key === 'audio_file' && entry.valueType === 'blob'));
    assert.ok(formEntries.some((entry) => entry.key === 'language_code' && entry.value === 'hi-IN'));
    assert.ok(formEntries.some((entry) => entry.key === 'preferred_language' && entry.value === 'hi-IN'));
    assert.ok(formEntries.some((entry) => entry.key === 'format' && entry.value === 'transcribe'));
    assert.ok(formEntries.some((entry) => entry.key === 'itn_native_numerals' && entry.value === 'true'));

    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({ success: true, transcript: 'नमस्ते दुनिया' });
      }
    };
  };

  try {
    global.fetch = fetchMock;
    const result = await transcribeAudioFromFile(fixturePath, {
      originalName: 'sample-audio.wav',
      contentType: 'audio/wav'
    });

    assert.equal(result, 'नमस्ते दुनिया');
  } finally {
    global.fetch = originalFetch;
    env.gnani.apiKeyId = originalApiKeyId;
  }
});

test('Gnani transcription service forwards each supported language selection to the API request', async () => {
  const originalFetch = global.fetch;
  const originalApiKeyId = env.gnani.apiKeyId;
  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/sample-audio.wav');

  env.gnani.apiKeyId = 'test-key-id';

  for (const selectedLanguage of ['hi-IN', 'mr-IN', 'en-IN']) {
    const fetchMock = async (url, options) => {
      const formEntries = [];
      for (const [key, value] of options.body.entries()) {
        formEntries.push({ key, value });
      }

      assert.ok(formEntries.some((entry) => entry.key === 'language_code' && entry.value === selectedLanguage));
      assert.ok(formEntries.some((entry) => entry.key === 'preferred_language' && entry.value === selectedLanguage));

      return {
        ok: true,
        status: 200,
        async text() {
          return JSON.stringify({ success: true, transcript: 'ok' });
        }
      };
    };

    global.fetch = fetchMock;
    await transcribeAudioFromFile(fixturePath, {
      originalName: 'sample-audio.wav',
      contentType: 'audio/wav',
      languageCode: selectedLanguage,
      preferredLanguage: selectedLanguage
    });
  }

  global.fetch = originalFetch;
  env.gnani.apiKeyId = originalApiKeyId;
});

test('Gnani transcription service rejects unsupported language selections', async () => {
  const originalFetch = global.fetch;
  const originalApiKeyId = env.gnani.apiKeyId;
  const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/sample-audio.wav');

  env.gnani.apiKeyId = 'test-key-id';
  global.fetch = async () => {
    throw new Error('fetch should not be called for an unsupported language');
  };

  try {
    await assert.rejects(
      () => transcribeAudioFromFile(fixturePath, {
        originalName: 'sample-audio.wav',
        contentType: 'audio/wav',
        languageCode: 'fr-FR',
        preferredLanguage: 'fr-FR'
      }),
      /unsupported gnani language/i
    );
  } finally {
    global.fetch = originalFetch;
    env.gnani.apiKeyId = originalApiKeyId;
  }
});

test('Gnani transcription service throws when the API responds with a non-success payload', async () => {
  const originalFetch = global.fetch;
  const originalApiKeyId = env.gnani.apiKeyId;

  env.gnani.apiKeyId = 'test-key-id';
  global.fetch = async () => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify({ success: false, message: 'bad request' });
    }
  });

  try {
    await assert.rejects(
      () => transcribeAudioFromFile('tests/fixtures/sample-audio.wav', {
        originalName: 'sample-audio.wav',
        contentType: 'audio/wav'
      }),
      /unsuccessful response/i
    );
  } finally {
    global.fetch = originalFetch;
    env.gnani.apiKeyId = originalApiKeyId;
  }
});

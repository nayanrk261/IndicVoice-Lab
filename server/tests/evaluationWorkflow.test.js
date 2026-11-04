import test from 'node:test';
import assert from 'node:assert/strict';

import app from '../src/app.js';

const startServer = async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  return server;
};

const buildAudioForm = (fileName = 'sample.wav', mimeType = 'audio/wav') => {
  const form = new FormData();
  form.append('audio', new Blob([Buffer.from('RIFF....WAVE', 'ascii')], { type: mimeType }), fileName);
  return form;
};

const routeFetchMock = (originalFetch, response) => async (url, options) => {
  if (String(url).startsWith('http://127.0.0.1')) {
    return originalFetch(url, options);
  }

  return {
    ok: response.ok,
    status: response.status,
    async text() {
      return JSON.stringify(response.body);
    }
  };
};

test('successful complete evaluation returns a structured report', async () => {
  const originalFetch = global.fetch;
  const server = await startServer();
  const port = server.address().port;

  global.fetch = routeFetchMock(originalFetch, {
    ok: true,
    status: 200,
    body: { success: true, transcript: 'नमस्ते दुनिया' }
  });

  try {
    const form = buildAudioForm();
    form.append('expectedTranscript', 'नमस्ते दुनिया');
    form.append('language', 'hi-IN');
    form.append(
      'expectedEntities',
      JSON.stringify({
        expected: { personName: 'Amit Sharma', location: 'Delhi' },
        actual: { personName: 'Amit Sharma', location: 'Delhi' }
      })
    );

    const response = await fetch(`http://127.0.0.1:${port}/api/evaluations`, {
      method: 'POST',
      body: form
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.equal(payload.data.expectedTranscript, 'नमस्ते दुनिया');
    assert.equal(payload.data.actualTranscript, 'नमस्ते दुनिया');
    assert.equal(payload.data.status, 'pass');
    assert.equal(payload.data.criticalEntities.mismatches, 0);
    assert.equal(payload.data.processing.language, 'hi-IN');
  } finally {
    global.fetch = originalFetch;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('selected UI language is forwarded to the Gnani request for each supported account language', async () => {
  const originalFetch = global.fetch;
  const server = await startServer();
  const port = server.address().port;

  for (const selectedLanguage of ['hi-IN', 'mr-IN', 'en-IN']) {
    global.fetch = routeFetchMock(originalFetch, {
      ok: true,
      status: 200,
      body: { success: true, transcript: 'नमस्ते दुनिया' }
    });

    const form = buildAudioForm();
    form.append('expectedTranscript', 'नमस्ते दुनिया');
    form.append('language', selectedLanguage);
    form.append('expectedEntities', JSON.stringify({ expected: {}, actual: {} }));

    const response = await fetch(`http://127.0.0.1:${port}/api/evaluations`, {
      method: 'POST',
      body: form
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.data.processing.language, selectedLanguage);
  }

  global.fetch = originalFetch;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('unsupported language values are rejected before contacting Gnani', async () => {
  const originalFetch = global.fetch;
  const server = await startServer();
  const port = server.address().port;

  global.fetch = routeFetchMock(originalFetch, {
    ok: true,
    status: 200,
    body: { success: true, transcript: 'नमस्ते दुनिया' }
  });

  try {
    const form = buildAudioForm();
    form.append('expectedTranscript', 'नमस्ते दुनिया');
    form.append('language', 'fr-FR');
    form.append('expectedEntities', JSON.stringify({ expected: {}, actual: {} }));

    const response = await fetch(`http://127.0.0.1:${port}/api/evaluations`, {
      method: 'POST',
      body: form
    });

    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.match(payload.error.message, /unsupported gnani language/i);
  } finally {
    global.fetch = originalFetch;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('Gnani API failure returns a server error response', async () => {
  const originalFetch = global.fetch;
  const server = await startServer();
  const port = server.address().port;

  global.fetch = routeFetchMock(originalFetch, {
    ok: false,
    status: 500,
    body: { success: false, message: 'Gnani unavailable' }
  });

  try {
    const form = buildAudioForm();
    form.append('expectedTranscript', 'नमस्ते दुनिया');
    form.append('expectedEntities', JSON.stringify({ expected: {}, actual: {} }));

    const response = await fetch(`http://127.0.0.1:${port}/api/evaluations`, {
      method: 'POST',
      body: form
    });

    const payload = await response.json();
    assert.equal(response.status, 500);
    assert.equal(payload.success, false);
    assert.match(payload.error.message, /Gnani API request failed/i);
  } finally {
    global.fetch = originalFetch;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('missing expected transcript is rejected', async () => {
  const originalFetch = global.fetch;
  const server = await startServer();
  const port = server.address().port;

  global.fetch = routeFetchMock(originalFetch, {
    ok: true,
    status: 200,
    body: { success: true, transcript: 'नमस्ते दुनिया' }
  });

  try {
    const form = buildAudioForm();
    form.append('expectedEntities', JSON.stringify({ expected: { location: 'Delhi' }, actual: { location: 'Delhi' } }));

    const response = await fetch(`http://127.0.0.1:${port}/api/evaluations`, {
      method: 'POST',
      body: form
    });

    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.match(payload.error.message, /expected transcript/i);
  } finally {
    global.fetch = originalFetch;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('invalid entity JSON is rejected', async () => {
  const originalFetch = global.fetch;
  const server = await startServer();
  const port = server.address().port;

  global.fetch = routeFetchMock(originalFetch, {
    ok: true,
    status: 200,
    body: { success: true, transcript: 'नमस्ते दुनिया' }
  });

  try {
    const form = buildAudioForm();
    form.append('expectedTranscript', 'नमस्ते दुनिया');
    form.append('expectedEntities', '{invalid json');

    const response = await fetch(`http://127.0.0.1:${port}/api/evaluations`, {
      method: 'POST',
      body: form
    });

    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.match(payload.error.message, /expectedEntities|JSON/i);
  } finally {
    global.fetch = originalFetch;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('critical entity mismatch is reported in the evaluation report', async () => {
  const originalFetch = global.fetch;
  const server = await startServer();
  const port = server.address().port;

  global.fetch = routeFetchMock(originalFetch, {
    ok: true,
    status: 200,
    body: { success: true, transcript: 'अमित ने 1001 रुपये दिए' }
  });

  try {
    const form = buildAudioForm();
    form.append('expectedTranscript', 'अमित ने 1000 रुपये दिए');
    form.append(
      'expectedEntities',
      JSON.stringify({
        expected: { amount: '₹1000' },
        actual: { amount: '₹1001' }
      })
    );

    const response = await fetch(`http://127.0.0.1:${port}/api/evaluations`, {
      method: 'POST',
      body: form
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.data.criticalEntities.mismatches, 1);
    assert.equal(payload.data.status, 'fail');
  } finally {
    global.fetch = originalFetch;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('empty transcript is rejected before evaluation', async () => {
  const originalFetch = global.fetch;
  const server = await startServer();
  const port = server.address().port;

  global.fetch = routeFetchMock(originalFetch, {
    ok: true,
    status: 200,
    body: { success: true, transcript: '' }
  });

  try {
    const form = buildAudioForm();
    form.append('expectedTranscript', 'नमस्ते दुनिया');
    form.append('expectedEntities', JSON.stringify({ expected: {}, actual: {} }));

    const response = await fetch(`http://127.0.0.1:${port}/api/evaluations`, {
      method: 'POST',
      body: form
    });

    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.match(payload.error.message, /empty.*transcript|transcript/i);
  } finally {
    global.fetch = originalFetch;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('Hindi and Marathi unicode text evaluates correctly', async () => {
  const originalFetch = global.fetch;
  const server = await startServer();
  const port = server.address().port;

  global.fetch = routeFetchMock(originalFetch, {
    ok: true,
    status: 200,
    body: { success: true, transcript: 'मुंबई शहर' }
  });

  try {
    const form = buildAudioForm();
    form.append('expectedTranscript', 'मुंबई शहर');
    form.append('language', 'mr-IN');
    form.append(
      'expectedEntities',
      JSON.stringify({
        expected: { location: 'मुंबई' },
        actual: { location: 'मुंबई' }
      })
    );

    const response = await fetch(`http://127.0.0.1:${port}/api/evaluations`, {
      method: 'POST',
      body: form
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.data.status, 'pass');
    assert.equal(payload.data.criticalEntities.mismatches, 0);
    assert.equal(payload.data.processing.language, 'mr-IN');
  } finally {
    global.fetch = originalFetch;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

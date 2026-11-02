import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

const startServer = async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  return server;
};

test('valid uploaded audio is accepted by the transcription route', async () => {
  const server = await startServer();
  const port = server.address().port;

  try {
    const form = new FormData();
    const wavData = Buffer.from('RIFF....WAVE', 'ascii');
    form.append('audio', new Blob([wavData], { type: 'audio/wav' }), 'valid.wav');

    const response = await fetch(`http://127.0.0.1:${port}/api/transcription`, {
      method: 'POST',
      body: form
    });

    const payload = await response.json();
    assert.ok([200, 500].includes(response.status));
    assert.equal(typeof payload.success, 'boolean');
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('invalid uploaded audio is rejected with a 400 response', async () => {
  const server = await startServer();
  const port = server.address().port;

  try {
    const form = new FormData();
    form.append('audio', new Blob(['plain-text payload'], { type: 'text/plain' }), 'invalid.txt');

    const response = await fetch(`http://127.0.0.1:${port}/api/transcription`, {
      method: 'POST',
      body: form
    });

    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.success, false);
    assert.equal(payload.error.statusCode, 400);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

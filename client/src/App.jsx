import { useMemo, useState } from 'react';
import { getApiUrl } from './lib/api';

const languageOptions = [
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'mr-IN', label: 'Marathi' },
  { value: 'en-IN', label: 'Hinglish' }
];

const createEntity = () => ({
  id: crypto.randomUUID(),
  name: '',
  type: 'name',
  expectedValue: '',
  predictedValue: ''
});

export default function App() {
  const [audioFile, setAudioFile] = useState(null);
  const [language, setLanguage] = useState('hi-IN');
  const [expectedTranscript, setExpectedTranscript] = useState('नमस्ते दुनिया');
  const [entities, setEntities] = useState([createEntity()]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  const payloadEntities = useMemo(() => {
    const expected = {};
    const actual = {};

    entities.forEach((entity) => {
      const name = entity.name.trim();
      if (!name) {
        return;
      }

      expected[name] = entity.expectedValue.trim();
      actual[name] = entity.predictedValue.trim();
    });

    return { expected, actual };
  }, [entities]);

  const updateEntity = (id, field, value) => {
    setEntities((current) =>
      current.map((entity) => (entity.id === id ? { ...entity, [field]: value } : entity))
    );
  };

  const addEntity = () => {
    setEntities((current) => [...current, createEntity()]);
  };

  const removeEntity = (id) => {
    setEntities((current) => {
      if (current.length === 1) {
        return [createEntity()];
      }

      return current.filter((entity) => entity.id !== id);
    });
  };

  const runAnotherEvaluation = () => {
    setReport(null);
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!audioFile) {
      setError('Please upload an audio file before running the evaluation.');
      return;
    }

    if (!expectedTranscript.trim()) {
      setError('Expected transcript is required.');
      return;
    }

    const formData = new FormData();
    formData.append('audio', audioFile);
    formData.append('expectedTranscript', expectedTranscript.trim());
    formData.append('language', language);
    formData.append('expectedEntities', JSON.stringify(payloadEntities));

    try {
      setIsLoading(true);
      setError('');

      const response = await fetch(getApiUrl('/api/evaluations'), {
        method: 'POST',
        body: formData
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message || 'The evaluation request failed.');
      }

      setReport(payload.data);
    } catch (caughtError) {
      setReport(null);
      setError(caughtError?.message || 'Unable to complete the evaluation.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="panel layout-grid">
        <div className="panel-header">
          <div>
            <p className="eyebrow">IndicVoice Lab</p>
            <h1>Speech evaluation workspace</h1>
          </div>
          {report && (
            <button type="button" className="secondary-button" onClick={runAnotherEvaluation}>
              Run another evaluation
            </button>
          )}
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="field-group">
            <label htmlFor="audio">Audio file</label>
            <input
              id="audio"
              type="file"
              accept=".wav,.mp3,.m4a,.flac,.ogg,audio/wav,audio/mpeg,audio/mp4,audio/flac,audio/ogg"
              onChange={(event) => setAudioFile(event.target.files?.[0] || null)}
            />
            <small>Supported by backend validation: WAV, MP3, M4A, FLAC, OGG</small>
          </div>

          <div className="field-group">
            <label htmlFor="language">Language</label>
            <select id="language" value={language} onChange={(event) => setLanguage(event.target.value)}>
              {languageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group full-width">
            <label htmlFor="expectedTranscript">Expected/reference transcript</label>
            <textarea
              id="expectedTranscript"
              rows="5"
              value={expectedTranscript}
              onChange={(event) => setExpectedTranscript(event.target.value)}
              placeholder="Enter the expected transcript for this audio sample"
            />
          </div>

          <div className="entity-panel full-width">
            <div className="entity-header">
              <h2>Critical entities</h2>
              <button type="button" className="secondary-button" onClick={addEntity}>
                Add entity
              </button>
            </div>

            <div className="entity-list">
              {entities.map((entity, index) => (
                <div key={entity.id} className="entity-row">
                  <div className="field-group compact">
                    <label>Entity name</label>
                    <input
                      value={entity.name}
                      onChange={(event) => updateEntity(entity.id, 'name', event.target.value)}
                      placeholder={`Entity ${index + 1}`}
                    />
                  </div>

                  <div className="field-group compact">
                    <label>Type</label>
                    <select
                      value={entity.type}
                      onChange={(event) => updateEntity(entity.id, 'type', event.target.value)}
                    >
                      <option value="name">Name</option>
                      <option value="location">Location</option>
                      <option value="date">Date</option>
                      <option value="number">Number</option>
                      <option value="amount">Amount</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="field-group compact">
                    <label>Expected value</label>
                    <input
                      value={entity.expectedValue}
                      onChange={(event) => updateEntity(entity.id, 'expectedValue', event.target.value)}
                      placeholder="Expected"
                    />
                  </div>

                  <div className="field-group compact">
                    <label>Predicted value</label>
                    <input
                      value={entity.predictedValue}
                      onChange={(event) => updateEntity(entity.id, 'predictedValue', event.target.value)}
                      placeholder="Manual prediction"
                    />
                  </div>

                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => removeEntity(entity.id)}
                    aria-label={`Remove entity ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <div className="message error-message">{error}</div>}

          <div className="submit-row full-width">
            <button type="submit" className="primary-button" disabled={isLoading}>
              {isLoading ? 'Evaluating…' : 'Evaluate transcript'}
            </button>
            <span className="helper-text">Manual entity predictions are supplied by the user for now.</span>
          </div>
        </form>

        {report && (
          <section className="report-panel full-width">
            <div className="report-header">
              <div>
                <p className="eyebrow">Evaluation report</p>
                <h2>Result summary</h2>
              </div>
              <span className={`status-pill ${report.status}`}>{report.status}</span>
            </div>

            <div className="transcript-grid">
              <div className="transcript-block">
                <h3>Expected transcript</h3>
                <p>{report.expectedTranscript || '—'}</p>
              </div>
              <div className="transcript-block">
                <h3>Actual transcript</h3>
                <p>{report.actualTranscript || '—'}</p>
              </div>
            </div>

            <div className="metrics-grid">
              <div className="metric-card">
                <span>WER</span>
                <strong>{`${(Number(report.wordErrorRate || 0) * 100).toFixed(2)}%`}</strong>
                <small>Lower is better</small>
              </div>
              <div className="metric-card">
                <span>CER</span>
                <strong>{`${(Number(report.characterErrorRate || 0) * 100).toFixed(2)}%`}</strong>
                <small>Lower is better</small>
              </div>
              <div className="metric-card">
                <span>Substitutions</span>
                <strong>{report.substitutions ?? 0}</strong>
              </div>
              <div className="metric-card">
                <span>Deletions</span>
                <strong>{report.deletions ?? 0}</strong>
              </div>
              <div className="metric-card">
                <span>Insertions</span>
                <strong>{report.insertions ?? 0}</strong>
              </div>
              <div className="metric-card">
                <span>Entity matches</span>
                <strong>{report.criticalEntities?.matches ?? 0}</strong>
              </div>
              <div className="metric-card">
                <span>Entity mismatches</span>
                <strong>{report.criticalEntities?.mismatches ?? 0}</strong>
              </div>
            </div>

            {report.criticalEntities?.items?.length > 0 && (
              <div className="entity-summary">
                <h3>Critical entity comparison</h3>
                <div className="entity-table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Key</th>
                        <th>Expected</th>
                        <th>Actual</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.criticalEntities.items.map((item) => (
                        <tr key={item.key} className={item.match ? 'match' : 'mismatch'}>
                          <td>{item.key}</td>
                          <td>{item.expected || '—'}</td>
                          <td>{item.actual || '—'}</td>
                          <td>{item.match ? 'Match' : 'Mismatch'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {report.processing && (
              <div className="metadata-block">
                <h3>Processing metadata</h3>
                <ul>
                  <li><span>Language:</span> {report.processing.language}</li>
                  <li><span>File:</span> {report.processing.fileName}</li>
                  <li><span>Mime type:</span> {report.processing.mimeType}</li>
                  <li><span>Timestamp:</span> {new Date(report.processing.receivedAt).toLocaleString()}</li>
                </ul>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

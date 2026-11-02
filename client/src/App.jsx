import { useMemo, useRef, useState } from 'react';
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

const featureCards = [
  {
    title: 'Indian language evaluation',
    description: 'Test Hindi, Marathi and Hinglish speech recognition against real, developer-defined reference transcripts.'
  },
  {
    title: 'Word and character error rates',
    description: 'Measure transcription quality across tokens and characters to catch subtle recognition drift.'
  },
  {
    title: 'Critical entity evaluation',
    description: 'Review manually supplied entity values to check if the model preserves names, numbers and locations.'
  },
  {
    title: 'Reproducible testing',
    description: 'Preserve a repeatable evaluation flow for regressions, model changes and multilingual coverage.'
  }
];

const howItWorks = [
  'Upload audio.',
  'Compare against expected transcript.',
  'Analyze recognition errors.',
  'Inspect evaluation report.'
];

const formatPercentage = (value) => {
  const numericValue = Number(value ?? 0);
  if (!Number.isFinite(numericValue)) {
    return '0.00%';
  }

  return `${(numericValue * 100).toFixed(2)}%`;
};

const formatFileSize = (bytes = 0) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 KB';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatTimestamp = (value) => {
  if (!value) {
    return '—';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

export default function App() {
  const inputRef = useRef(null);
  const [audioFile, setAudioFile] = useState(null);
  const [language, setLanguage] = useState('hi-IN');
  const [expectedTranscript, setExpectedTranscript] = useState('नमस्ते दुनिया, मैं अपनी रिपोर्ट तैयार कर रहा हूँ।');
  const [entities, setEntities] = useState([createEntity()]);
  const [isDragging, setIsDragging] = useState(false);
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

  const handleFileSelection = (incomingFile) => {
    if (!incomingFile) {
      return;
    }

    const allowedTypes = [
      'audio/wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/m4a',
      'audio/flac',
      'audio/ogg'
    ];

    const extension = incomingFile.name.split('.').pop()?.toLowerCase();
    const isAllowedExtension = ['wav', 'mp3', 'm4a', 'flac', 'ogg'].includes(extension || '');

    if (!isAllowedExtension && !allowedTypes.includes(incomingFile.type)) {
      setError('Unsupported file type. Please upload WAV, MP3, M4A, FLAC or OGG audio.');
      return;
    }

    setAudioFile(incomingFile);
    setError('');
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    handleFileSelection(file);
  };

  const removeAudioFile = (event) => {
    if (event) {
      event.stopPropagation();
    }

    setAudioFile(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
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
      setReport(null);
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
    <div className="page-shell">
      <header className="site-header">
        <div className="brand-group">
          <div className="brand-mark">IV</div>
          <span>IndicVoice Lab</span>
        </div>

        <nav className="primary-nav" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#workspace">Workspace</a>
        </nav>

        <a href="#workspace" className="launch-button">
          Launch Workspace
        </a>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-copy">
            <span className="kicker">INDIAN LANGUAGE VOICE AI TESTING</span>
            <h1>Does your voice AI actually understand India?</h1>
            <p>
              Evaluate speech recognition quality across Hindi, Marathi and Hinglish with transparent test runs,
              word and character error metrics, and critical entity checks built for real-world voice products.
            </p>
            <div className="hero-actions">
              <a href="#workspace" className="primary-action">Start testing</a>
              <a href="#features" className="secondary-action">Explore features</a>
            </div>
            <div className="hero-meta">
              <span>Hindi</span>
              <span>Marathi</span>
              <span>Hinglish</span>
            </div>
          </div>

          <div className="hero-visual" aria-label="IndicVoice Lab product preview">
            <div className="preview-shell">
              <div className="preview-header">
                <span>Evaluation preview</span>
                <span className="demo-tag">Illustrative demo data</span>
              </div>

              <div className="preview-body">
                <div className="preview-row">
                  <div className="preview-label">Expected</div>
                  <div className="preview-label">Actual</div>
                </div>

                <div className="preview-text-row">
                  <p>नमस्ते टीम, कृपया मेरे पते की पुष्टि करें।</p>
                  <p>नमस्ते टीम, कृपया मेरे पता की पुष्टि करें।</p>
                </div>

                <div className="mini-metrics">
                  <div>
                    <span>WER</span>
                    <strong>12.50%</strong>
                  </div>
                  <div>
                    <span>CER</span>
                    <strong>6.40%</strong>
                  </div>
                  <div>
                    <span>Entities</span>
                    <strong>2/3</strong>
                  </div>
                </div>

                <div className="entity-badges">
                  <span className="pass-badge">Location match</span>
                  <span className="warning-badge">Name mismatch</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="features-section">
          <div className="section-heading">
            <span className="section-kicker">Platform</span>
            <h2>Built for multilingual voice quality testing.</h2>
          </div>

          <div className="feature-grid">
            {featureCards.map((feature) => (
              <article key={feature.title} className="feature-card">
                <div className="feature-icon">•</div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="steps-section">
          <div className="section-heading narrow-heading">
            <span className="section-kicker">How it works</span>
            <h2>Simple, repeatable evaluation flow.</h2>
          </div>

          <div className="steps-grid">
            {howItWorks.map((step, index) => (
              <div key={step} className="step-card">
                <span className="step-index">0{index + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="workspace" className="workspace-section">
          <div className="workspace-header">
            <div>
              <span className="section-kicker">Workspace</span>
              <h2>Evaluation console</h2>
            </div>
            {report && (
              <button type="button" className="secondary-action compact" onClick={runAnotherEvaluation}>
                Run another evaluation
              </button>
            )}
          </div>

          <div className="workspace-grid">
            <form className="evaluation-form" onSubmit={handleSubmit}>
              <div
                className={['dropzone', isDragging ? 'dragging' : ''].join(' ')}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    inputRef.current?.click();
                  }
                }}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".wav,.mp3,.m4a,.flac,.ogg,audio/wav,audio/mpeg,audio/mp4,audio/flac,audio/ogg"
                  hidden
                  onChange={(event) => handleFileSelection(event.target.files?.[0] || null)}
                />

                {audioFile ? (
                  <div className="selected-file-panel" onClick={(event) => event.stopPropagation()}>
                    <div className="file-badge">Audio</div>
                    <div className="file-meta">
                      <strong>{audioFile.name}</strong>
                      <span>{formatFileSize(audioFile.size)}</span>
                    </div>
                    <button type="button" className="file-remove-button" onClick={removeAudioFile}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="dropzone-content">
                    <span className="dropzone-icon">♪</span>
                    <strong>Drop your audio here</strong>
                    <span>or click to browse</span>
                    <small>WAV, MP3, M4A, FLAC, OGG</small>
                  </div>
                )}
              </div>

              <div className="field-grid">
                <label className="field-label">
                  <span>Language</span>
                  <select value={language} onChange={(event) => setLanguage(event.target.value)}>
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field-label transcript-field">
                <span>Reference transcript</span>
                <textarea
                  rows="7"
                  value={expectedTranscript}
                  onChange={(event) => setExpectedTranscript(event.target.value)}
                  placeholder="Enter the expected transcript for the recording"
                />
                <small className="field-note">{expectedTranscript.trim().split(/\s+/).filter(Boolean).length} words · {expectedTranscript.length} characters</small>
              </label>

              <div className="entity-manager">
                <div className="entity-manager-header">
                  <h3>Critical entities</h3>
                  <button type="button" className="ghost-button" onClick={addEntity}>Add entity</button>
                </div>

                <div className="entity-list">
                  {entities.map((entity, index) => (
                    <div key={entity.id} className="entity-row">
                      <label className="field-label small-field">
                        <span>Entity name</span>
                        <input
                          value={entity.name}
                          onChange={(event) => updateEntity(entity.id, 'name', event.target.value)}
                          placeholder={`Entity ${index + 1}`}
                        />
                      </label>

                      <label className="field-label small-field">
                        <span>Entity type</span>
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
                      </label>

                      <label className="field-label small-field">
                        <span>Expected value</span>
                        <input
                          value={entity.expectedValue}
                          onChange={(event) => updateEntity(entity.id, 'expectedValue', event.target.value)}
                          placeholder="Expected value"
                        />
                      </label>

                      <label className="field-label small-field">
                        <span>Predicted value</span>
                        <input
                          value={entity.predictedValue}
                          onChange={(event) => updateEntity(entity.id, 'predictedValue', event.target.value)}
                          placeholder="Manual prediction"
                        />
                      </label>

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

              {error && <div className="message-banner error-banner">{error}</div>}

              <div className="action-row">
                <button type="submit" className="submit-button" disabled={isLoading}>
                  {isLoading ? 'Evaluating…' : 'Evaluate transcript'}
                </button>
                {isLoading && <span className="inline-status">Processing audio…</span>}
              </div>
            </form>

            <aside className="results-panel">
              {!report ? (
                <div className="empty-state">
                  <div className="empty-card">
                    <span className="section-kicker">Awaiting evaluation</span>
                    <h3>Results will appear here</h3>
                    <p>Once a test completes, this panel shows error rates, transcript checks, and entity outcomes.</p>
                  </div>
                </div>
              ) : (
                <div className="report-shell">
                  <div className="results-header">
                    <div>
                      <span className="section-kicker">Report</span>
                      <h3>Evaluation summary</h3>
                    </div>
                    <span className={`status-badge ${report.status}`}>{report.status}</span>
                  </div>

                  <div className="metric-grid">
                    <div className="metric-box">
                      <span>WER</span>
                      <strong>{formatPercentage(report.wordErrorRate)}</strong>
                    </div>
                    <div className="metric-box">
                      <span>CER</span>
                      <strong>{formatPercentage(report.characterErrorRate)}</strong>
                    </div>
                    <div className="metric-box">
                      <span>Substitutions</span>
                      <strong>{report.substitutions ?? 0}</strong>
                    </div>
                    <div className="metric-box">
                      <span>Deletions</span>
                      <strong>{report.deletions ?? 0}</strong>
                    </div>
                    <div className="metric-box">
                      <span>Insertions</span>
                      <strong>{report.insertions ?? 0}</strong>
                    </div>
                    <div className="metric-box">
                      <span>Entity matches</span>
                      <strong>{report.criticalEntities?.matches ?? 0}</strong>
                    </div>
                  </div>

                  <div className="comparison-panel">
                    <div className="comparison-box">
                      <span>Expected transcript</span>
                      <p>{report.expectedTranscript || '—'}</p>
                    </div>
                    <div className="comparison-box">
                      <span>Actual transcript</span>
                      <p>{report.actualTranscript || '—'}</p>
                    </div>
                  </div>

                  <div className="report-note">
                    Differences are evaluated using the backend’s supported WER/CER and entity checks. Token-level word alignment is not returned by the API, so this view presents the exact supported comparison data.
                  </div>

                  {report.criticalEntities?.items?.length > 0 && (
                    <div className="entity-summary-box">
                      <h4>Critical entity evaluation</h4>
                      <div className="entity-results-list">
                        {report.criticalEntities.items.map((item) => (
                          <div key={item.key} className={`entity-result ${item.match ? 'match' : 'mismatch'}`}>
                            <div className="entity-result-header">
                              <strong>{item.key}</strong>
                              <span className={item.match ? 'entity-pass' : 'entity-fail'}>
                                {item.match ? 'Match' : 'Mismatch'}
                              </span>
                            </div>
                            <dl>
                              <div>
                                <dt>Type</dt>
                                <dd>{item.entityType || '—'}</dd>
                              </div>
                              <div>
                                <dt>Expected</dt>
                                <dd>{item.expected || '—'}</dd>
                              </div>
                              <div>
                                <dt>Predicted</dt>
                                <dd>{item.predicted || '—'}</dd>
                              </div>
                            </dl>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="metadata-box">
                    <div>
                      <span>Language</span>
                      <strong>{report.processing?.language || '—'}</strong>
                    </div>
                    <div>
                      <span>Audio file</span>
                      <strong>{report.processing?.fileName || '—'}</strong>
                    </div>
                    <div>
                      <span>Status</span>
                      <strong>{report.status || '—'}</strong>
                    </div>
                    <div>
                      <span>Received</span>
                      <strong>{formatTimestamp(report.processing?.receivedAt)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>
    </div>
  );
}

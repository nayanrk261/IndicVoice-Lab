# IndicVoice Lab benchmark runner

This directory contains a small, developer-side benchmark harness for evaluating recordings against the configured Gnani STT model using the existing transcription and evaluation logic in the app.

## Safety rules

- Do not commit any `.env` files.
- Do not print or persist API keys.
- Use the configured Gnani API only.
- Do not run live API benchmarks during unit tests.
- Do not fabricate results; the sample manifest entries below are placeholders until real audio and transcripts are added.

## Benchmark structure

- `manifest.json`: benchmark entry list and metadata
- `audio/`: audio recordings for benchmark runs
- `ground-truth/`: reference transcript files for each case
- `reports/`: generated benchmark JSON reports

## Manifest schema

Each benchmark case supports:

- `id`: unique test ID
- `language`: language bucket for grouped summaries
- `category`: scenario label
- `audioFile`: path to the audio file relative to `benchmarks/`
- `referenceTranscript`: optional inline transcript text
- `referenceTranscriptFile`: optional path to transcript file under `benchmarks/`
- `languageConfig`: per-case locale configuration used by the existing Gnani integration
- `expectedEntities`: optional critical entity values
- `notes`: recording notes
- `placeholder`: safety switch; when `true`, the case is skipped in both dry and live runs

## Add a recording

1. Place the WAV/MP3 file in `benchmarks/audio/`.
2. Keep the filename unique and deterministic.
3. Set `audioFile` in `manifest.json` to match the exact relative path.
4. Keep `placeholder: true` until both audio and transcript are verified.

## Add a transcript

1. Add or update the transcript in `benchmarks/ground-truth/CASE-ID.txt`.
2. Point `referenceTranscriptFile` to that file.
3. Keep text exact, including punctuation, numerals, and casing.

## Add a manifest entry

Each case should include:

- `id`: unique case ID
- `language`: language category, such as `hi-IN`, `mr-IN`, or `en-IN`
- `category`: scenario description
- `audioFile`: relative path to the recording under `benchmarks/`
- `referenceTranscript`: exact expected transcript string, or a `referenceTranscriptFile` path
- `languageConfig`: case locale options
- `expectedEntities`: optional object of critical entity expectations
- `notes`: optional notes about the sample or expected edge case
- `placeholder`: set to `false` only when the case is ready for live benchmarking

Example:

```json
{
  "id": "HI-01",
  "language": "hi-IN",
  "category": "Hindi conversation",
  "audioFile": "audio/HI-01.wav",
  "referenceTranscriptFile": "ground-truth/HI-01.txt",
  "languageConfig": {
    "languageCode": "hi-IN",
    "preferredLanguage": "hi-IN"
  },
  "placeholder": true,
  "expectedEntities": {
    "expected": {
      "city": "दिल्ली"
    },
    "actual": {
      "city": "दिल्ली"
    }
  },
  "notes": "Hindi validation sample."
}
```

## Run locally

Dry-run safety guard (no live API calls):

```bash
npm run benchmark
```

Run the real benchmark with the configured Gnani API:

```bash
npm run benchmark:live
```

Before a live run, update each real case to satisfy all of these:

1. `audioFile` points to an existing recording.
2. `referenceTranscript` or `referenceTranscriptFile` is populated with verified ground truth.
3. `languageConfig.languageCode` and `languageConfig.preferredLanguage` are set.
4. `placeholder` is changed from `true` to `false`.

Cases left with `placeholder: true` are always skipped and never sent to Gnani.

You can also override the manifest/report paths:

```bash
node ./scripts/runBenchmark.js --manifest ./benchmarks/manifest.json --report ./benchmarks/reports/latest-report.json --live
```

If the report file already exists, the runner writes to a timestamped sibling file by default to avoid accidental overwrites.
Use `--overwrite` only when you intentionally want to replace an existing report path.

## Report output

Reports are written to `benchmarks/reports/` by default. The JSON output contains:

- test ID and language
- expected and actual transcripts
- WER/CER summary
- edit operations and entity mismatches
- API success/failure
- model and locale metadata when available

## Initial dataset scaffold

The current six entries are scaffolding placeholders:

- `HI-01`: Hindi conversation
- `HI-02`: Hindi numbers and dates
- `MR-01`: Marathi conversation
- `MR-02`: Marathi names and locations
- `HX-01`: Hinglish conversational code-mixing
- `HX-02`: Hinglish with English technical terminology

These are not benchmark results and are intentionally skipped until replaced with real data.

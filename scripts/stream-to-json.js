/**
 * scripts/stream-to-json.js
 *
 * Runs ALONGSIDE `next dev`. Every cycle:
 *  1. Clears opticell_clean1.json → []
 *  2. Fetches all readings from MongoDB
 *  3. Appends them ONE BY ONE with a configurable delay
 *  4. Waits a pause, then restarts from the top
 *
 * Usage (auto-started via `npm run dev`):
 *   node scripts/stream-to-json.js
 */

const fs      = require('fs');
const path    = require('path');
const mongoose = require('mongoose');

// ── Config ────────────────────────────────────────────────────────────────────
const RECORD_INTERVAL_MS = 300;   // time between each record being written (ms)
const CYCLE_PAUSE_MS     = 5000;  // pause at the end before restarting the cycle
const JSON_FILE          = path.resolve(__dirname, '../public/data/opticell_clean1.json');

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key   = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI missing in .env.local');
  process.exit(1);
}

// ── Mongoose model ────────────────────────────────────────────────────────────
const ReadingSchema = new mongoose.Schema(
  {
    sensorId:  { type: Number  },
    data:      { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date    },
  },
  { collection: 'sensor_readings', versionKey: false }
);
const Reading =
  mongoose.models.Reading ?? mongoose.model('Reading', ReadingSchema);

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Write ONE record appended to the current JSON array on disk.
 */
function appendRecord(record) {
  let arr = [];
  try {
    const raw = fs.readFileSync(JSON_FILE, 'utf-8');
    arr = JSON.parse(raw);
    if (!Array.isArray(arr)) arr = [];
  } catch (_) {
    arr = [];
  }
  arr.push(record);
  fs.writeFileSync(JSON_FILE, JSON.stringify(arr, null, 2), 'utf-8');
}

// ── Main loop ─────────────────────────────────────────────────────────────────
async function streamCycle() {
  console.log('[stream] Fetching readings from MongoDB…');
  const readings = await Reading.find({})
    .sort({ timestamp: 1 })   // chronological order
    .lean();

  if (readings.length === 0) {
    console.warn('[stream] No readings in MongoDB. Did you run `node seed.js`?');
    return;
  }

  console.log(`[stream] Got ${readings.length} records — streaming to JSON (${RECORD_INTERVAL_MS}ms/record)…`);

  // Clear the file first
  fs.writeFileSync(JSON_FILE, '[]', 'utf-8');

  for (let i = 0; i < readings.length; i++) {
    const doc = readings[i];
    appendRecord({
      _id:       doc._id,
      sensorId:  doc.sensorId,
      data:      doc.data,
      timestamp: doc.timestamp,
    });

    if ((i + 1) % 50 === 0) {
      console.log(`[stream] Written ${i + 1}/${readings.length} records…`);
    }

    await sleep(RECORD_INTERVAL_MS);
  }

  console.log(`[stream] ✅ Cycle complete — ${readings.length} records written. Pausing ${CYCLE_PAUSE_MS / 1000}s then restarting…`);
}

async function run() {
  // Ensure output file exists
  if (!fs.existsSync(JSON_FILE)) {
    fs.writeFileSync(JSON_FILE, '[]', 'utf-8');
  }

  console.log('[stream] Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log('[stream] Connected ✅');

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await streamCycle();
    await sleep(CYCLE_PAUSE_MS);
  }
}

run().catch((err) => {
  console.error('[stream] Fatal:', err);
  process.exit(1);
});

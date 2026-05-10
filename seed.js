/**
 * seed.js — Reads opticell_clean1.csv, converts it to dynamic JSON,
 * inserts into MongoDB (sensor_readings collection), and exports
 * opticell_clean1.json as a backup file.
 *
 * Usage:
 *   node seed.js
 *
 * Requires MONGODB_URI to be set in .env.local
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');

// ─── Load .env.local manually ────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
} else {
  console.warn('⚠️  .env.local not found — make sure MONGODB_URI is set');
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI is not set. Add it to .env.local and retry.');
  process.exit(1);
}

// ─── Mongoose Schema ──────────────────────────────────────────────────────────
const ReadingSchema = new mongoose.Schema(
  {
    sensorId: { type: Number, required: true },
    data:     { type: mongoose.Schema.Types.Mixed, required: true },
    timestamp:{ type: Date, required: true },
  },
  { collection: 'sensor_readings', versionKey: false }
);
const Reading =
  mongoose.models.Reading ?? mongoose.model('Reading', ReadingSchema);

// ─── Parse CSV ────────────────────────────────────────────────────────────────
async function parseCSV(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let headers = null;
  const rows = [];
  let lineIndex = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const values = trimmed.split(',').map((v) => v.trim());

    if (lineIndex === 0) {
      // First line = headers (dynamic, no hardcoding)
      headers = values;
    } else {
      const dataObj = {};
      headers.forEach((header, i) => {
        const raw = values[i];
        const num = parseFloat(raw);
        dataObj[header] = isNaN(num) ? raw : num;
      });

      // Spread timestamps backwards so oldest row = oldest time
      const secondsAgo = (1000 - lineIndex) * 5; // 5 seconds apart
      const timestamp = new Date(Date.now() - Math.max(0, secondsAgo) * 1000);

      rows.push({
        sensorId: 1,
        data: dataObj,
        timestamp,
      });
    }
    lineIndex++;
  }

  return rows;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const csvFile = path.resolve(__dirname, 'public/data/opticell_clean1.csv');
  const jsonFile = path.resolve(__dirname, 'public/data/opticell_clean1.json');

  if (!fs.existsSync(csvFile)) {
    console.error(`❌  CSV not found at: ${csvFile}`);
    process.exit(1);
  }

  console.log('📖  Parsing CSV…');
  const records = await parseCSV(csvFile);
  console.log(`✅  Parsed ${records.length} rows`);

  // ── Write JSON backup ──────────────────────────────────────────────────────
  fs.writeFileSync(jsonFile, JSON.stringify(records, null, 2), 'utf-8');
  console.log(`💾  JSON backup written → ${jsonFile}`);

  // ── Connect to MongoDB ────────────────────────────────────────────────────
  console.log('🔌  Connecting to MongoDB…');
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log('✅  Connected');

  // ── Clear old data & insert ───────────────────────────────────────────────
  console.log('🗑️   Clearing existing sensor_readings…');
  await Reading.deleteMany({});

  console.log(`📤  Inserting ${records.length} records…`);
  await Reading.insertMany(records, { ordered: false });

  console.log('🎉  Done! All records are now in MongoDB.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  mongoose.disconnect();
  process.exit(1);
});

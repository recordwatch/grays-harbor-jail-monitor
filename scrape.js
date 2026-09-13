import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { scrapeRoster } from './scrapers/graysHarbor.js';
import { nowPST } from './utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const ROSTER_FILE = path.join(DATA_DIR, 'roster.json');
const LOG_FILE    = path.join(DATA_DIR, 'change_log.json');
const STATUS_FILE = path.join(DATA_DIR, 'status.json');

function readJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {}
  return fallback;
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data));
}

function buildEntry(b, firstSeen) {
  return {
    idnum: b.number,
    bookingNumber: b.number,
    name: b.name,
    status: 'in_custody',
    firstSeen,
    releasedAt: null,
    bookingDate: b.bookingDate,
    facility: b.facility,
    charges: b.charges,
    hasDetail: true,
  };
}

async function run() {
  console.log(`[${nowPST()}] Running Grays Harbor County scrape...`);

  let roster = readJSON(ROSTER_FILE, {});
  let log    = readJSON(LOG_FILE, []);

  let bookings;
  try {
    bookings = await scrapeRoster();
  } catch (err) {
    console.error('Roster fetch failed:', err.message);
    process.exit(1);
  }

  if (bookings.length === 0) {
    console.log('Got 0 bookings — skipping to avoid wiping data.');
    process.exit(0);
  }

  const currentIds  = new Set(bookings.map(b => b.number));
  const previousIds = new Set(Object.keys(roster));

  const newBookings = bookings.filter(b => !previousIds.has(b.number));
  console.log(`  ${newBookings.length} new booking(s) found`);

  const now = nowPST();
  for (const b of newBookings) {
    console.log(`  NEW: ${b.name}`);
    const entry = buildEntry(b, now);
    roster[b.number] = entry;
    log.unshift(entry);
  }

  // Refresh mutable fields for people still in custody: facility transfers
  // between GHCJ/APD/HPD, and charge detail (dispositions update as cases resolve).
  for (const b of bookings) {
    if (!previousIds.has(b.number)) continue;
    const existing = roster[b.number];
    existing.facility = b.facility;
    existing.charges = b.charges;
    const logEntry = log.find(e => e.idnum === b.number);
    if (logEntry) {
      logEntry.facility = existing.facility;
      logEntry.charges = existing.charges;
    }
  }

  // Releases — in previous roster but no longer on the current page.
  const releasedIds = [...previousIds].filter(id => !currentIds.has(id) && roster[id]?.status === 'in_custody');

  for (const id of releasedIds) {
    const inmate = roster[id];
    console.log(`  RELEASED: ${inmate.name}`);
    roster[id].status     = 'released';
    roster[id].releasedAt = now;
    const logEntry = log.find(e => e.idnum === id);
    if (logEntry) {
      logEntry.status     = 'released';
      logEntry.releasedAt = roster[id].releasedAt;
    }
  }

  writeJSON(ROSTER_FILE, roster);
  writeJSON(LOG_FILE, log);

  const inCustody = Object.values(roster).filter(i => i.status === 'in_custody').length;
  writeJSON(STATUS_FILE, { inCustody, lastUpdated: now });

  console.log(`[${nowPST()}] Done. ${newBookings.length} new, ${releasedIds.length} released. ${inCustody} in custody.`);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

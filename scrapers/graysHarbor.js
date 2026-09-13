import axios from 'axios';
import * as cheerio from 'cheerio';

// Grays Harbor's roster pages are static server-rendered HTML (the page itself
// refreshes every 30 min via <meta http-equiv="refresh">, not JS/AJAX), so this
// is a cheerio scrape, same shape as Kitsap/Pierce/Thurston — not an API like
// Whatcom, and not a PDF dump like Mason.
//
// GHRoster.html is the "County Wide" combined view: every row that appears on
// the county jail (GHCJRoster.html), Aberdeen PD (APDRoster.html), and Hoquiam
// PD (HPDRoster.html) rosters individually also shows up here in one table
// (confirmed: 103 + 14 + 16 = 133, matching the County Wide row count), so
// scraping this single page covers all three facilities in one request.
const ROSTER_URL = 'http://ghlea.com/JailRosters/GHRoster.html';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

function cleanText(raw) {
  return (raw || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseCharges($, row) {
  const subTable = $(row).next('tr').find('table.sub-table');
  if (!subTable.length) return [];

  const charges = [];
  subTable.find('tbody tr').each((_, tr) => {
    const tds = $(tr).find('td').map((_, td) => cleanText($(td).text())).get();
    if (tds.length < 9) return;
    const [arrestDate, arrestAgency, court, causeNumber, description, disposition, bond, bondType, bail] = tds;
    charges.push({
      charge: description || null,
      court: court || null,
      causeNumber: causeNumber || null,
      bail: bail || null,
      bondType: bondType || null,
      bond: bond || null,
      arrestAgency: arrestAgency || null,
      arrestDate: arrestDate || null,
      disposition: disposition || null,
    });
  });
  return charges;
}

// Returns raw booking objects scraped from the County Wide roster table.
// Field names are left close to the source columns — scrape.js maps them
// into the shared roster entry shape.
export async function scrapeRoster() {
  const res = await axios.get(ROSTER_URL, { headers: HEADERS, timeout: 20000 });
  const $ = cheerio.load(res.data);

  const bookings = [];
  $('#main-table tbody > tr.name').each((_, tr) => {
    const tds = $(tr).find('> td');
    const number = cleanText($(tds[1]).text());
    if (!number) return;

    bookings.push({
      number,
      name: cleanText($(tds[0]).text()),
      facility: cleanText($(tds[2]).text()),
      bookingDate: cleanText($(tds[3]).text()),
      released: cleanText($(tds[4]).text()) || null,
      charges: parseCharges($, tr),
    });
  });

  return bookings;
}

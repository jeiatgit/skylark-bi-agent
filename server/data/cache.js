/**
 * Data Cache Layer
 * Supports Monday.com GraphQL API as primary source with transparent
 * Excel fallback when board IDs are pending or API rate limits occur.
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { fetchAllItems } = require('./mondaySource');
const { normalizeDeals, normalizeWorkOrders } = require('./normalizer');

let cache = {
  deals: [],
  workOrders: [],
  dealWarnings: [],
  workOrderWarnings: [],
  source: 'none',
  lastSync: null,
};

function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
}

function loadFromLocalExcel() {
  console.log('[Cache] Loading from local Excel source...');
  const baseDir = path.join(__dirname, '../../../');
  
  // Deals
  const dealFile = path.join(baseDir, 'Deal funnel Data.xlsx');
  const dealWb = XLSX.readFile(dealFile);
  const dealWs = dealWb.Sheets[dealWb.SheetNames[0]];
  const dealRaw = XLSX.utils.sheet_to_json(dealWs, { header: 1 });

  const rawDeals = dealRaw.slice(1).map((row, idx) => ({
    id: `local_deal_${idx + 1}`,
    name: String(row[0] || 'Unknown Deal').trim(),
    'Owner Code': String(row[1] || '').trim(),
    'Client Code': String(row[2] || '').trim(),
    'Deal Status': String(row[3] || '').trim(),
    'Close Date': excelDateToISO(row[4]),
    'Closure Probability': String(row[5] || '').trim(),
    'Deal Value': row[6] || 0,
    'Tentative Close Date': excelDateToISO(row[7]),
    'Deal Stage': String(row[8] || '').trim(),
    'Product': String(row[9] || '').trim(),
    'Sector': String(row[10] || '').trim(),
    'Created Date': excelDateToISO(row[11]),
  }));

  // Work Orders
  const woFile = path.join(baseDir, 'Work_Order_Tracker Data.xlsx');
  const woWb = XLSX.readFile(woFile);
  const woWs = woWb.Sheets[woWb.SheetNames[0]];
  const woRaw = XLSX.utils.sheet_to_json(woWs, { header: 1 });

  const rawWOs = woRaw.slice(2).filter(r => r[0] || r[1] || r[2]).map((row, idx) => ({
    id: `local_wo_${idx + 1}`,
    name: String(row[0] || 'Unknown WO').trim(),
    'Customer Code': String(row[1] || '').trim(),
    'Serial Number': String(row[2] || '').trim(),
    'Nature of Work': String(row[3] || '').trim(),
    'Execution Status': String(row[5] || '').trim(),
    'Data Delivery Date': excelDateToISO(row[6]),
    'Date of PO/LOI': excelDateToISO(row[7]),
    'Document Type': String(row[8] || '').trim(),
    'Probable Start Date': excelDateToISO(row[9]),
    'Probable End Date': excelDateToISO(row[10]),
    'BD Personnel Code': String(row[11] || '').trim(),
    'Sector': String(row[12] || '').trim(),
    'Type of Work': String(row[13] || '').trim(),
    'Last Invoice Date': excelDateToISO(row[15]),
    'Latest Invoice No': String(row[16] || '').trim(),
    'Amount Excl GST': row[17] || 0,
    'Amount Incl GST': row[18] || 0,
    'Billed Excl GST': row[19] || 0,
    'Billed Incl GST': row[20] || 0,
    'Collected Amount': row[21] || 0,
    'Amount Receivable': row[24] || 0,
    'Invoice Status': String(row[30] || '').trim(),
    'WO Status': String(row[34] || '').trim(),
    'Collection Status': String(row[35] || '').trim(),
    'Billing Status': String(row[37] || '').trim(),
    'Quantity by Ops': String(row[26] || '').trim(),
    'Quantities as per PO': String(row[27] || '').trim(),
  }));

  const { data: deals, warnings: dw } = normalizeDeals(rawDeals);
  const { data: workOrders, warnings: wow } = normalizeWorkOrders(rawWOs);

  cache = {
    deals,
    workOrders,
    dealWarnings: dw,
    workOrderWarnings: wow,
    source: 'Excel (Fallback / Fast Boot)',
    lastSync: new Date().toISOString(),
  };

  return cache;
}

async function refreshCache() {
  console.log('[Cache] Refreshing data...');
  const dealsBoardId = process.env.DEALS_BOARD_ID;
  const woBoardId = process.env.WORK_ORDERS_BOARD_ID;

  if (!dealsBoardId || !woBoardId) {
    console.log('[Cache] Board IDs not set yet; initializing from local Excel file.');
    return loadFromLocalExcel();
  }

  try {
    const [rawDeals, rawWOs] = await Promise.all([
      fetchAllItems(dealsBoardId),
      fetchAllItems(woBoardId),
    ]);

    const { data: deals, warnings: dw } = normalizeDeals(rawDeals);
    const { data: workOrders, warnings: wow } = normalizeWorkOrders(rawWOs);

    cache = {
      deals,
      workOrders,
      dealWarnings: dw,
      workOrderWarnings: wow,
      source: 'monday.com (Live GraphQL API)',
      lastSync: new Date().toISOString(),
    };

    console.log(`[Cache] Successfully synced from monday.com: ${deals.length} deals, ${workOrders.length} work orders`);
    return cache;
  } catch (err) {
    console.warn(`[Cache] Warning: Failed to fetch from monday.com API (${err.message}). Falling back to local Excel dataset.`);
    return loadFromLocalExcel();
  }
}

function getCache() {
  if (!cache.deals.length && !cache.workOrders.length) {
    loadFromLocalExcel();
  }
  return cache;
}

module.exports = { refreshCache, getCache, loadFromLocalExcel };

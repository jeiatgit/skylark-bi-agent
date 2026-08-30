/**
 * Import Excel data into monday.com as two clean boards.
 * Run once: node scripts/import-to-monday.js
 * Updates .env with the created board IDs.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const XLSX = require('xlsx');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const MONDAY_TOKEN = process.env.MONDAY_API_TOKEN;
const EXCEL_DIR = path.join(__dirname, '../../');

async function mondayQuery(query, variables = {}) {
  const resp = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Authorization': MONDAY_TOKEN,
      'Content-Type': 'application/json',
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await resp.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
}

function normText(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

async function createBoard(name) {
  console.log(`  Creating board: ${name}`);
  const data = await mondayQuery(`
    mutation($name: String!) {
      create_board(board_name: $name, board_kind: public) { id name }
    }
  `, { name });
  return data.create_board.id;
}

async function createColumn(boardId, title, columnType) {
  await mondayQuery(`
    mutation($boardId: ID!, $title: String!, $type: ColumnType!) {
      create_column(board_id: $boardId, title: $title, column_type: $type) { id title }
    }
  `, { boardId, title, type: columnType });
}

async function createItem(boardId, itemName, columnValues) {
  await mondayQuery(`
    mutation($boardId: ID!, $name: String!, $vals: JSON!) {
      create_item(board_id: $boardId, item_name: $name, column_values: $vals) { id }
    }
  `, { boardId, name: itemName || 'Unnamed', vals: JSON.stringify(columnValues) });
}

// ══════════════════════════════════════════════════════════════════════════
// DEALS BOARD
// ══════════════════════════════════════════════════════════════════════════
async function importDeals() {
  console.log('\n📋 Importing Deal Funnel Data...');
  const wb = XLSX.readFile(path.join(EXCEL_DIR, 'Deal funnel Data.xlsx'));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const dataRows = rows.slice(1).filter(row => {
    const status = normText(row[3]);
    const stage = normText(row[8]);
    return status !== 'Deal Status' && stage !== 'Deal Stage' && (row[0] || row[1]);
  });

  console.log(`  Found ${dataRows.length} valid deal rows`);

  const boardId = await createBoard('Skylark - Deal Funnel Live');
  console.log(`  Board created: ${boardId}`);

  // Create columns as robust text/numbers/date
  const cols = [
    ['Owner Code', 'text'],
    ['Client Code', 'text'],
    ['Deal Status', 'text'],
    ['Close Date', 'date'],
    ['Closure Probability', 'text'],
    ['Deal Value', 'numbers'],
    ['Tentative Close Date', 'date'],
    ['Deal Stage', 'text'],
    ['Product', 'text'],
    ['Sector', 'text'],
    ['Created Date', 'date'],
  ];

  for (const [title, type] of cols) {
    await createColumn(boardId, title, type);
    await new Promise(r => setTimeout(r, 150));
  }

  const boardData = await mondayQuery(`query($id: ID!) { boards(ids: [$id]) { columns { id title } } }`, { id: boardId });
  const colMap = {};
  for (const col of boardData.boards[0].columns) {
    colMap[col.title] = col.id;
  }
  console.log('  Columns created, importing rows to monday.com...');

  let imported = 0;
  for (const row of dataRows) {
    const itemName = normText(row[0]) || 'Unknown Deal';
    const colVals = {};

    if (colMap['Owner Code'])           colVals[colMap['Owner Code']] = normText(row[1]);
    if (colMap['Client Code'])          colVals[colMap['Client Code']] = normText(row[2]);
    if (colMap['Deal Status'])          colVals[colMap['Deal Status']] = normText(row[3]);
    if (colMap['Close Date'] && row[4]) colVals[colMap['Close Date']] = { date: excelDateToISO(row[4]) };
    if (colMap['Closure Probability'])  colVals[colMap['Closure Probability']] = normText(row[5]);
    if (colMap['Deal Value'])           colVals[colMap['Deal Value']] = parseFloat(row[6]) || 0;
    if (colMap['Tentative Close Date'] && row[7]) colVals[colMap['Tentative Close Date']] = { date: excelDateToISO(row[7]) };
    if (colMap['Deal Stage'])           colVals[colMap['Deal Stage']] = normText(row[8]);
    if (colMap['Product'])              colVals[colMap['Product']] = normText(row[9]);
    if (colMap['Sector'])               colVals[colMap['Sector']] = normText(row[10]);
    if (colMap['Created Date'] && row[11]) colVals[colMap['Created Date']] = { date: excelDateToISO(row[11]) };

    try {
      await createItem(boardId, itemName, colVals);
      imported++;
      if (imported % 25 === 0) console.log(`  Imported ${imported}/${dataRows.length} deals to monday.com...`);
    } catch (e) {
      console.warn(`  ⚠ Skipped deal row: ${e.message.slice(0, 80)}`);
    }
    await new Promise(r => setTimeout(r, 120));
  }

  console.log(`  ✅ Deals successfully imported to monday.com: ${imported}/${dataRows.length}`);
  return boardId;
}

// ══════════════════════════════════════════════════════════════════════════
// WORK ORDERS BOARD
// ══════════════════════════════════════════════════════════════════════════
async function importWorkOrders() {
  console.log('\n📋 Importing Work Order Tracker Data...');
  const wb = XLSX.readFile(path.join(EXCEL_DIR, 'Work_Order_Tracker Data.xlsx'));
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const dataRows = rows.slice(2).filter(row => row[0] || row[1] || row[2]);
  console.log(`  Found ${dataRows.length} valid work order rows`);

  const boardId = await createBoard('Skylark - Work Orders Live');
  console.log(`  Board created: ${boardId}`);

  const cols = [
    ['Customer Code', 'text'],
    ['Serial Number', 'text'],
    ['Nature of Work', 'text'],
    ['Execution Status', 'text'],
    ['Data Delivery Date', 'date'],
    ['Date of PO/LOI', 'date'],
    ['Document Type', 'text'],
    ['Probable Start Date', 'date'],
    ['Probable End Date', 'date'],
    ['BD Personnel Code', 'text'],
    ['Sector', 'text'],
    ['Type of Work', 'text'],
    ['Last Invoice Date', 'date'],
    ['Latest Invoice No', 'text'],
    ['Amount Excl GST', 'numbers'],
    ['Amount Incl GST', 'numbers'],
    ['Billed Excl GST', 'numbers'],
    ['Billed Incl GST', 'numbers'],
    ['Collected Amount', 'numbers'],
    ['Amount Receivable', 'numbers'],
    ['Invoice Status', 'text'],
    ['WO Status', 'text'],
    ['Collection Status', 'text'],
    ['Billing Status', 'text'],
    ['Quantity by Ops', 'text'],
    ['Quantities as per PO', 'text'],
  ];

  for (const [title, type] of cols) {
    await createColumn(boardId, title, type);
    await new Promise(r => setTimeout(r, 150));
  }

  const boardData = await mondayQuery(`query($id: ID!) { boards(ids: [$id]) { columns { id title } } }`, { id: boardId });
  const colMap = {};
  for (const col of boardData.boards[0].columns) {
    colMap[col.title] = col.id;
  }
  console.log('  Columns created, importing rows to monday.com...');

  let imported = 0;
  for (const row of dataRows) {
    const itemName = normText(row[0]) || 'Unknown WO';
    const colVals = {};
    const safe = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

    if (colMap['Customer Code'])        colVals[colMap['Customer Code']] = normText(row[1]);
    if (colMap['Serial Number'])        colVals[colMap['Serial Number']] = normText(row[2]);
    if (colMap['Nature of Work'])       colVals[colMap['Nature of Work']] = normText(row[3]);
    if (colMap['Execution Status'])     colVals[colMap['Execution Status']] = normText(row[5]);
    if (colMap['Data Delivery Date'] && row[6]) colVals[colMap['Data Delivery Date']] = { date: excelDateToISO(row[6]) };
    if (colMap['Date of PO/LOI'] && row[7])     colVals[colMap['Date of PO/LOI']] = { date: excelDateToISO(row[7]) };
    if (colMap['Document Type'])        colVals[colMap['Document Type']] = normText(row[8]);
    if (colMap['Probable Start Date'] && row[9]) colVals[colMap['Probable Start Date']] = { date: excelDateToISO(row[9]) };
    if (colMap['Probable End Date'] && row[10])  colVals[colMap['Probable End Date']] = { date: excelDateToISO(row[10]) };
    if (colMap['BD Personnel Code'])    colVals[colMap['BD Personnel Code']] = normText(row[11]);
    if (colMap['Sector'])               colVals[colMap['Sector']] = normText(row[12]);
    if (colMap['Type of Work'])         colVals[colMap['Type of Work']] = normText(row[13]);
    if (colMap['Last Invoice Date'] && row[15]) colVals[colMap['Last Invoice Date']] = { date: excelDateToISO(row[15]) };
    if (colMap['Latest Invoice No'])    colVals[colMap['Latest Invoice No']] = normText(row[16]);
    if (colMap['Amount Excl GST'])      colVals[colMap['Amount Excl GST']] = safe(row[17]);
    if (colMap['Amount Incl GST'])      colVals[colMap['Amount Incl GST']] = safe(row[18]);
    if (colMap['Billed Excl GST'])      colVals[colMap['Billed Excl GST']] = safe(row[19]);
    if (colMap['Billed Incl GST'])      colVals[colMap['Billed Incl GST']] = safe(row[20]);
    if (colMap['Collected Amount'])     colVals[colMap['Collected Amount']] = safe(row[21]);
    if (colMap['Amount Receivable'])    colVals[colMap['Amount Receivable']] = safe(row[24]);
    if (colMap['Invoice Status'])       colVals[colMap['Invoice Status']] = normText(row[30]);
    if (colMap['WO Status'])            colVals[colMap['WO Status']] = normText(row[34]);
    if (colMap['Collection Status'])    colVals[colMap['Collection Status']] = normText(row[35]);
    if (colMap['Billing Status'])       colVals[colMap['Billing Status']] = normText(row[37]);
    if (colMap['Quantity by Ops'])      colVals[colMap['Quantity by Ops']] = normText(row[26]);
    if (colMap['Quantities as per PO']) colVals[colMap['Quantities as per PO']] = normText(row[27]);

    try {
      await createItem(boardId, itemName, colVals);
      imported++;
      if (imported % 25 === 0) console.log(`  Imported ${imported}/${dataRows.length} work orders to monday.com...`);
    } catch (e) {
      console.warn(`  ⚠ Skipped WO row: ${e.message.slice(0, 80)}`);
    }
    await new Promise(r => setTimeout(r, 120));
  }

  console.log(`  ✅ Work Orders successfully imported to monday.com: ${imported}/${dataRows.length}`);
  return boardId;
}

// ══════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('🚀 Skylark BI Agent — monday.com Live Import');
  console.log('═'.repeat(50));

  if (!MONDAY_TOKEN) {
    console.error('❌ MONDAY_API_TOKEN not set in .env');
    process.exit(1);
  }

  try {
    const dealsBoardId = await importDeals();
    const woBoardId = await importWorkOrders();

    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');
    envContent = envContent.replace(/DEALS_BOARD_ID=.*/, `DEALS_BOARD_ID=${dealsBoardId}`);
    envContent = envContent.replace(/WORK_ORDERS_BOARD_ID=.*/, `WORK_ORDERS_BOARD_ID=${woBoardId}`);
    fs.writeFileSync(envPath, envContent);

    console.log('\n═'.repeat(50));
    console.log('🎉 Live monday.com Boards Created & Populated!');
    console.log(`   Deals Board ID:       ${dealsBoardId}`);
    console.log(`   Work Orders Board ID: ${woBoardId}`);
    console.log('   .env updated automatically.');
  } catch (err) {
    console.error('❌ Import failed:', err.message);
    process.exit(1);
  }
}

main();

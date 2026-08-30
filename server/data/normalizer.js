/**
 * Data Normalizer
 * Cleans raw monday.com board data into structured, query-ready objects.
 * Tracks and returns data quality warnings.
 */

// ── Stage ordering for the deal funnel ──────────────────────────────────
const STAGE_ORDER = {
  'A. Lead Generated': 1,
  'B. Sales Qualified Leads': 2,
  'C. Demo Done': 3,
  'D. Feasibility': 4,
  'E. Proposal/Commercials Sent': 5,
  'F. Negotiations': 6,
  'G. Project Won': 7,
  'H. Work Order Received': 8,
  'I. POC': 9,
  'J. Invoice sent': 10,
  'K. Amount Accrued': 11,
  'L. Project Lost': 12,
  'M. Projects On Hold': 13,
  'N. Not relevant at the moment': 14,
  'O. Not Relevant at all': 15,
  'Project Completed': 16,
};

// ── String normalization helpers ──────────────────────────────────────────
function norm(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function normStatus(v) {
  const s = norm(v).toLowerCase();
  if (s === 'billed' || s === 'billed-' || s.startsWith('billed')) return 'Billed';
  if (s === 'pause / struck' || s === 'pause/struck') return 'Stuck';
  if (s === 'executed until current month') return 'Ongoing';
  return norm(v) || 'Unknown';
}

function normSector(v) {
  const s = norm(v).toLowerCase();
  if (!s || s === 'sector/service') return 'Unknown';
  return norm(v);
}

function normProbability(v) {
  const s = norm(v).toLowerCase();
  if (!s || s === 'closure probability') return 'Unknown';
  if (s === 'high') return 'High';
  if (s === 'medium') return 'Medium';
  if (s === 'low') return 'Low';
  return 'Unknown';
}

function normNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function normDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

// ── Parse messy quantity strings ──────────────────────────────────────────
function parseQuantity(v) {
  if (!v) return { value: null, unit: null, raw: v };
  const s = String(v).trim();
  const match = s.match(/^([\d,\.]+)\s*(.*)$/);
  if (match) {
    return {
      value: parseFloat(match[1].replace(/,/g, '')),
      unit: match[2].trim() || 'units',
      raw: s,
    };
  }
  return { value: null, unit: null, raw: s };
}

// ══════════════════════════════════════════════════════════════════════════
// NORMALIZE DEALS
// ══════════════════════════════════════════════════════════════════════════
function normalizeDeals(rawItems) {
  const warnings = [];
  const cleaned = [];

  for (const item of rawItems) {
    // Filter header-leak rows
    const dealStatus = norm(item['Deal Status']);
    const dealStage = norm(item['Deal Stage']);
    if (dealStatus === 'Deal Status' || dealStage === 'Deal Stage') continue;

    const sector = normSector(item['Sector']);
    const dealValue = normNumber(item['Deal Value']);
    const closeDate = normDate(item['Close Date']);
    const tentativeClose = normDate(item['Tentative Close Date']);
    const createdDate = normDate(item['Created Date']);
    const probability = normProbability(item['Closure Probability']);

    if (!closeDate && !tentativeClose) {
      warnings.push(`Deal "${item.name}" has no close date`);
    }
    if (dealValue === 0) {
      warnings.push(`Deal "${item.name}" has zero or missing value`);
    }

    cleaned.push({
      id: item.id,
      dealName: item.name,
      ownerCode: norm(item['Owner Code']),
      clientCode: norm(item['Client Code']),
      dealStatus: dealStatus || 'Unknown',
      closeDate,
      tentativeCloseDate: tentativeClose,
      closureProbability: probability,
      dealValue,
      dealStage: dealStage || 'Unknown',
      stageOrder: STAGE_ORDER[dealStage] || 99,
      product: norm(item['Product']),
      sector,
      createdDate,
      // Derived
      isActive: ['Open'].includes(dealStatus),
      isWon: dealStatus === 'Won' || ['G. Project Won', 'H. Work Order Received', 'I. POC', 'J. Invoice sent', 'K. Amount Accrued', 'Project Completed'].includes(dealStage),
      isLost: dealStatus === 'Dead' || dealStage === 'L. Project Lost',
      isOpen: dealStatus === 'Open',
    });
  }

  return { data: cleaned, warnings };
}

// ══════════════════════════════════════════════════════════════════════════
// NORMALIZE WORK ORDERS
// ══════════════════════════════════════════════════════════════════════════
function normalizeWorkOrders(rawItems) {
  const warnings = [];
  const cleaned = [];

  for (const item of rawItems) {
    const execStatus = normStatus(item['Execution Status']);
    const billingStatus = normStatus(item['Billing Status']);
    const invoiceStatus = norm(item['Invoice Status']);
    const woStatus = norm(item['WO Status']);
    const sector = normSector(item['Sector']);

    const amountExclGST = normNumber(item['Amount Excl GST']);
    const amountInclGST = normNumber(item['Amount Incl GST']);
    const billedExclGST = normNumber(item['Billed Excl GST']);
    const billedInclGST = normNumber(item['Billed Incl GST']);
    const collectedAmount = normNumber(item['Collected Amount']);
    const receivable = normNumber(item['Amount Receivable']);

    if (amountInclGST === 0) {
      warnings.push(`Work order "${item.name}" has zero contract value`);
    }

    const qty = parseQuantity(item['Quantity by Ops']);
    const qtyPO = parseQuantity(item['Quantities as per PO']);

    cleaned.push({
      id: item.id,
      dealName: item.name,
      customerCode: norm(item['Customer Code']),
      serialNumber: norm(item['Serial Number']),
      natureOfWork: norm(item['Nature of Work']),
      executionStatus: execStatus,
      dataDeliveryDate: normDate(item['Data Delivery Date']),
      dateOfPO: normDate(item['Date of PO/LOI']),
      documentType: norm(item['Document Type']),
      probableStartDate: normDate(item['Probable Start Date']),
      probableEndDate: normDate(item['Probable End Date']),
      bdPersonnelCode: norm(item['BD Personnel Code']),
      sector,
      typeOfWork: norm(item['Type of Work']),
      lastInvoiceDate: normDate(item['Last Invoice Date']),
      latestInvoiceNo: norm(item['Latest Invoice No']),
      amountExclGST,
      amountInclGST,
      billedExclGST,
      billedInclGST,
      collectedAmount,
      receivable,
      invoiceStatus: invoiceStatus || 'Unknown',
      woStatus: woStatus || 'Unknown',
      collectionStatus: norm(item['Collection Status']) || 'Unknown',
      billingStatus: billingStatus || 'Unknown',
      quantityByOps: qty,
      quantitiesPerPO: qtyPO,
      // Derived
      isCompleted: execStatus === 'Completed',
      isStuck: execStatus === 'Stuck',
      isOngoing: ['Ongoing', 'Executed until current month'].includes(execStatus),
      isFullyBilled: invoiceStatus === 'Fully Billed',
      unbilledAmount: amountInclGST - billedInclGST,
      collectionGap: billedInclGST - collectedAmount,
    });
  }

  return { data: cleaned, warnings };
}

module.exports = { normalizeDeals, normalizeWorkOrders };

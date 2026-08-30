/**
 * Analytics Engine — deterministic BI calculations.
 * All calculations happen here; the AI agent never touches raw data.
 */

const { getCache } = require('./cache');

function fmt(n) { return Math.round(n); }

// ══════════════════════════════════════════════════════════════════════════
// DEALS ANALYTICS
// ══════════════════════════════════════════════════════════════════════════

function queryDeals({ sector, dealStatus, dealStage, ownerCode, minValue, maxValue, groupBy, limit = 50 } = {}) {
  const { deals, dealWarnings } = getCache();
  let filtered = [...deals];

  // Apply filters
  if (sector && sector !== 'all') {
    const s = sector.toLowerCase();
    filtered = filtered.filter(d => d.sector.toLowerCase().includes(s));
  }
  if (dealStatus && dealStatus !== 'all') {
    filtered = filtered.filter(d => d.dealStatus.toLowerCase() === dealStatus.toLowerCase());
  }
  if (dealStage && dealStage !== 'all') {
    filtered = filtered.filter(d => d.dealStage.toLowerCase().includes(dealStage.toLowerCase()));
  }
  if (ownerCode && ownerCode !== 'all') {
    filtered = filtered.filter(d => d.ownerCode === ownerCode);
  }
  if (minValue) filtered = filtered.filter(d => d.dealValue >= minValue);
  if (maxValue) filtered = filtered.filter(d => d.dealValue <= maxValue);

  const totalValue = filtered.reduce((s, d) => s + d.dealValue, 0);
  const wonDeals = filtered.filter(d => d.isWon);
  const openDeals = filtered.filter(d => d.isOpen);
  const lostDeals = filtered.filter(d => d.isLost);
  const winRate = filtered.length ? Math.round((wonDeals.length / filtered.length) * 100) : 0;

  // Group by if requested
  let groups = null;
  if (groupBy) {
    const map = {};
    for (const d of filtered) {
      const key = d[groupBy] || 'Unknown';
      if (!map[key]) map[key] = { count: 0, totalValue: 0, wonCount: 0 };
      map[key].count++;
      map[key].totalValue += d.dealValue;
      if (d.isWon) map[key].wonCount++;
    }
    groups = Object.entries(map)
      .sort((a, b) => b[1].totalValue - a[1].totalValue)
      .map(([key, v]) => ({
        name: key,
        count: v.count,
        totalValue: fmt(v.totalValue),
        wonCount: v.wonCount,
        winRate: Math.round((v.wonCount / v.count) * 100),
      }));
  }

  // Stage breakdown
  const stageMap = {};
  for (const d of filtered) {
    const stage = d.dealStage || 'Unknown';
    if (!stageMap[stage]) stageMap[stage] = { count: 0, value: 0 };
    stageMap[stage].count++;
    stageMap[stage].value += d.dealValue;
  }
  const stageBreakdown = Object.entries(stageMap)
    .sort((a, b) => b[1].value - a[1].value)
    .map(([s, v]) => ({ stage: s, count: v.count, value: fmt(v.value) }));

  // Sector breakdown
  const sectorMap = {};
  for (const d of filtered) {
    const sec = d.sector || 'Unknown';
    if (!sectorMap[sec]) sectorMap[sec] = { count: 0, value: 0 };
    sectorMap[sec].count++;
    sectorMap[sec].value += d.dealValue;
  }
  const sectorBreakdown = Object.entries(sectorMap)
    .sort((a, b) => b[1].value - a[1].value)
    .map(([s, v]) => ({ sector: s, count: v.count, value: fmt(v.value) }));

  // Top deals
  const topDeals = [...filtered]
    .sort((a, b) => b.dealValue - a.dealValue)
    .slice(0, limit)
    .map(d => ({
      dealName: d.dealName,
      clientCode: d.clientCode,
      sector: d.sector,
      stage: d.dealStage,
      status: d.dealStatus,
      value: fmt(d.dealValue),
      probability: d.closureProbability,
      tentativeClose: d.tentativeCloseDate,
    }));

  return {
    summary: {
      totalDeals: filtered.length,
      totalValue: fmt(totalValue),
      wonDeals: wonDeals.length,
      wonValue: fmt(wonDeals.reduce((s, d) => s + d.dealValue, 0)),
      openDeals: openDeals.length,
      openValue: fmt(openDeals.reduce((s, d) => s + d.dealValue, 0)),
      lostDeals: lostDeals.length,
      winRate,
    },
    stageBreakdown,
    sectorBreakdown,
    groups,
    topDeals,
    dataWarnings: dealWarnings.slice(0, 5),
    filtersApplied: { sector, dealStatus, dealStage, ownerCode },
  };
}

// ══════════════════════════════════════════════════════════════════════════
// WORK ORDER ANALYTICS
// ══════════════════════════════════════════════════════════════════════════

function queryWorkOrders({ sector, executionStatus, invoiceStatus, billingStatus, groupBy, limit = 50 } = {}) {
  const { workOrders, workOrderWarnings } = getCache();
  let filtered = [...workOrders];

  if (sector && sector !== 'all') {
    const s = sector.toLowerCase();
    filtered = filtered.filter(w => w.sector.toLowerCase().includes(s));
  }
  if (executionStatus && executionStatus !== 'all') {
    filtered = filtered.filter(w => w.executionStatus.toLowerCase().includes(executionStatus.toLowerCase()));
  }
  if (invoiceStatus && invoiceStatus !== 'all') {
    filtered = filtered.filter(w => w.invoiceStatus.toLowerCase().includes(invoiceStatus.toLowerCase()));
  }
  if (billingStatus && billingStatus !== 'all') {
    filtered = filtered.filter(w => w.billingStatus.toLowerCase().includes(billingStatus.toLowerCase()));
  }

  const totalContract = filtered.reduce((s, w) => s + w.amountInclGST, 0);
  const totalBilled = filtered.reduce((s, w) => s + w.billedInclGST, 0);
  const totalCollected = filtered.reduce((s, w) => s + w.collectedAmount, 0);
  const totalReceivable = filtered.reduce((s, w) => s + w.receivable, 0);
  const totalUnbilled = filtered.reduce((s, w) => s + Math.max(0, w.amountInclGST - w.billedInclGST), 0);

  const completed = filtered.filter(w => w.isCompleted);
  const ongoing = filtered.filter(w => w.isOngoing);
  const stuck = filtered.filter(w => w.isStuck);
  const notStarted = filtered.filter(w => w.executionStatus === 'Not Started');

  // Sector breakdown
  const sectorMap = {};
  for (const w of filtered) {
    const sec = w.sector || 'Unknown';
    if (!sectorMap[sec]) sectorMap[sec] = { count: 0, contract: 0, billed: 0, collected: 0, receivable: 0 };
    sectorMap[sec].count++;
    sectorMap[sec].contract += w.amountInclGST;
    sectorMap[sec].billed += w.billedInclGST;
    sectorMap[sec].collected += w.collectedAmount;
    sectorMap[sec].receivable += w.receivable;
  }
  const sectorBreakdown = Object.entries(sectorMap)
    .sort((a, b) => b[1].contract - a[1].contract)
    .map(([sec, v]) => ({
      sector: sec,
      count: v.count,
      contractValue: fmt(v.contract),
      billedValue: fmt(v.billed),
      collectedValue: fmt(v.collected),
      receivableValue: fmt(v.receivable),
      billingRate: v.contract ? Math.round((v.billed / v.contract) * 100) : 0,
      collectionRate: v.billed ? Math.round((v.collected / v.billed) * 100) : 0,
    }));

  // Status breakdown
  const statusMap = {};
  for (const w of filtered) {
    const s = w.executionStatus || 'Unknown';
    if (!statusMap[s]) statusMap[s] = { count: 0, value: 0 };
    statusMap[s].count++;
    statusMap[s].value += w.amountInclGST;
  }
  const statusBreakdown = Object.entries(statusMap)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([s, v]) => ({ status: s, count: v.count, value: fmt(v.value) }));

  // Group by if requested
  let groups = null;
  if (groupBy) {
    const map = {};
    for (const w of filtered) {
      const key = w[groupBy] || 'Unknown';
      if (!map[key]) map[key] = { count: 0, contract: 0, billed: 0, collected: 0, receivable: 0 };
      map[key].count++;
      map[key].contract += w.amountInclGST;
      map[key].billed += w.billedInclGST;
      map[key].collected += w.collectedAmount;
      map[key].receivable += w.receivable;
    }
    groups = Object.entries(map)
      .sort((a, b) => b[1].contract - a[1].contract)
      .map(([key, v]) => ({
        name: key,
        count: v.count,
        contractValue: fmt(v.contract),
        billedValue: fmt(v.billed),
        collectedValue: fmt(v.collected),
        receivableValue: fmt(v.receivable),
      }));
  }

  // Top work orders by receivable
  const topWOs = [...filtered]
    .filter(w => w.receivable > 0)
    .sort((a, b) => b.receivable - a.receivable)
    .slice(0, limit)
    .map(w => ({
      dealName: w.dealName,
      customerCode: w.customerCode,
      sector: w.sector,
      executionStatus: w.executionStatus,
      invoiceStatus: w.invoiceStatus,
      contractValue: fmt(w.amountInclGST),
      billedValue: fmt(w.billedInclGST),
      collectedValue: fmt(w.collectedAmount),
      receivable: fmt(w.receivable),
    }));

  return {
    summary: {
      totalWorkOrders: filtered.length,
      totalContractValue: fmt(totalContract),
      totalBilled: fmt(totalBilled),
      totalCollected: fmt(totalCollected),
      totalReceivable: fmt(totalReceivable),
      totalUnbilled: fmt(totalUnbilled),
      completedCount: completed.length,
      ongoingCount: ongoing.length,
      stuckCount: stuck.length,
      notStartedCount: notStarted.length,
      billingRate: totalContract ? Math.round((totalBilled / totalContract) * 100) : 0,
      collectionRate: totalBilled ? Math.round((totalCollected / totalBilled) * 100) : 0,
    },
    sectorBreakdown,
    statusBreakdown,
    groups,
    topReceivables: topWOs,
    dataWarnings: workOrderWarnings.slice(0, 5),
    filtersApplied: { sector, executionStatus, invoiceStatus, billingStatus },
  };
}

// ══════════════════════════════════════════════════════════════════════════
// CROSS-BOARD SUMMARY (best-effort join on sector)
// ══════════════════════════════════════════════════════════════════════════

function crossBoardSummary({ sector } = {}) {
  const deals = queryDeals({ sector });
  const wos = queryWorkOrders({ sector });

  return {
    sector: sector || 'All Sectors',
    pipeline: deals.summary,
    operations: wos.summary,
    sectorPipelineBreakdown: deals.sectorBreakdown,
    sectorOperationsBreakdown: wos.sectorBreakdown,
    note: 'Cross-board join is by sector (best-effort). No shared unique key exists between boards.',
    dataWarnings: [...deals.dataWarnings, ...wos.dataWarnings],
  };
}

// ══════════════════════════════════════════════════════════════════════════
// TOP-LEVEL KPIs
// ══════════════════════════════════════════════════════════════════════════

function getKPIs() {
  const { deals, workOrders } = getCache();

  const openDeals = deals.filter(d => d.isOpen);
  const wonDeals = deals.filter(d => d.isWon);
  const totalPipeline = openDeals.reduce((s, d) => s + d.dealValue, 0);
  const wonValue = wonDeals.reduce((s, d) => s + d.dealValue, 0);
  const winRate = deals.length ? Math.round((wonDeals.length / deals.length) * 100) : 0;

  const totalContract = workOrders.reduce((s, w) => s + w.amountInclGST, 0);
  const totalReceivable = workOrders.reduce((s, w) => s + w.receivable, 0);
  const totalBilled = workOrders.reduce((s, w) => s + w.billedInclGST, 0);
  const totalCollected = workOrders.reduce((s, w) => s + w.collectedAmount, 0);
  const ongoingWOs = workOrders.filter(w => w.isOngoing || !w.isCompleted).length;
  const stuckWOs = workOrders.filter(w => w.isStuck).length;

  return {
    pipeline: {
      totalOpenDeals: openDeals.length,
      totalPipelineValue: fmt(totalPipeline),
      winRate,
      wonDealsCount: wonDeals.length,
      wonValue: fmt(wonValue),
    },
    operations: {
      totalWorkOrders: workOrders.length,
      totalContractValue: fmt(totalContract),
      totalBilled: fmt(totalBilled),
      totalCollected: fmt(totalCollected),
      totalReceivable: fmt(totalReceivable),
      ongoingWorkOrders: ongoingWOs,
      stuckWorkOrders: stuckWOs,
      billingRate: totalContract ? Math.round((totalBilled / totalContract) * 100) : 0,
      collectionRate: totalBilled ? Math.round((totalCollected / totalBilled) * 100) : 0,
    },
    lastSync: getCache().lastSync,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// LEADERSHIP SUMMARY
// ══════════════════════════════════════════════════════════════════════════

function getLeadershipSummary() {
  const kpis = getKPIs();
  const { deals, workOrders } = getCache();

  // Top sector by pipeline
  const sectorPipeline = {};
  for (const d of deals.filter(d => d.isOpen)) {
    const s = d.sector || 'Unknown';
    sectorPipeline[s] = (sectorPipeline[s] || 0) + d.dealValue;
  }
  const topPipelineSector = Object.entries(sectorPipeline).sort((a, b) => b[1] - a[1])[0];

  // Top sector by receivables
  const sectorReceivable = {};
  for (const w of workOrders) {
    const s = w.sector || 'Unknown';
    sectorReceivable[s] = (sectorReceivable[s] || 0) + w.receivable;
  }
  const topReceivableSector = Object.entries(sectorReceivable).sort((a, b) => b[1] - a[1])[0];

  // Risks
  const risks = [];
  const stuckWOs = workOrders.filter(w => w.isStuck);
  const highValueDeals = deals.filter(d => d.isOpen && d.dealValue > 5000000);
  const overdueReceivables = workOrders.filter(w => w.receivable > 1000000);

  if (stuckWOs.length > 0) risks.push(`${stuckWOs.length} work order(s) are stuck/paused`);
  if (highValueDeals.length > 0) risks.push(`${highValueDeals.length} high-value deals (>₹50L) still in pipeline`);
  if (overdueReceivables.length > 0) risks.push(`${overdueReceivables.length} work orders have receivables >₹10L`);

  // Top late-stage deals
  const lateStageDeals = deals
    .filter(d => d.isOpen && d.stageOrder >= 5 && d.stageOrder <= 8)
    .sort((a, b) => b.dealValue - a.dealValue)
    .slice(0, 5)
    .map(d => ({ name: d.dealName, sector: d.sector, value: fmt(d.dealValue), stage: d.dealStage }));

  return {
    pipeline: kpis.pipeline,
    operations: kpis.operations,
    topPipelineSector: topPipelineSector ? { sector: topPipelineSector[0], value: fmt(topPipelineSector[1]) } : null,
    topReceivableSector: topReceivableSector ? { sector: topReceivableSector[0], value: fmt(topReceivableSector[1]) } : null,
    lateStageDeals,
    risks,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { queryDeals, queryWorkOrders, crossBoardSummary, getKPIs, getLeadershipSummary };

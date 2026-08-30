/**
 * Tool Declarations for Gemini Function Calling
 * Describes the functions the AI agent can execute to retrieve business intelligence.
 */

const toolDeclarations = [
  {
    name: 'query_deals',
    description: 'Query sales pipeline and deals data. Filter by sector, deal status, deal stage, owner, or value. Returns total pipeline value, win rate, stage breakdown, sector breakdown, and top deals.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sector: {
          type: 'STRING',
          description: 'Sector to filter by (e.g., "Mining", "Renewables", "Railways", "Powerline", "Construction", "Others") or "all"',
        },
        dealStatus: {
          type: 'STRING',
          description: 'Deal status filter (e.g., "Open", "Won", "Dead", "On Hold") or "all"',
        },
        dealStage: {
          type: 'STRING',
          description: 'Funnel stage keyword (e.g., "Lead", "Proposal", "Negotiation", "Won", "Work Order")',
        },
        ownerCode: {
          type: 'STRING',
          description: 'Sales rep owner code (e.g., "OWNER_001", "OWNER_002")',
        },
        groupBy: {
          type: 'STRING',
          description: 'Grouping field: "sector", "dealStage", "ownerCode", or "closureProbability"',
        },
        limit: {
          type: 'INTEGER',
          description: 'Max number of individual deals to return (default 10)',
        },
      },
    },
  },
  {
    name: 'query_work_orders',
    description: 'Query operational work orders, project execution, billing, and receivables data. Returns contract values, billed amounts, collected cash, outstanding receivables, and execution status breakdown.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sector: {
          type: 'STRING',
          description: 'Sector filter (e.g., "Mining", "Renewables", "Railways", "Powerline")',
        },
        executionStatus: {
          type: 'STRING',
          description: 'Execution status (e.g., "Completed", "Ongoing", "Stuck", "Not Started", "Pause / struck")',
        },
        invoiceStatus: {
          type: 'STRING',
          description: 'Invoice status (e.g., "Fully Billed", "Partially Billed", "Not billed yet", "Stuck")',
        },
        billingStatus: {
          type: 'STRING',
          description: 'Billing status (e.g., "Billed", "Update Required", "Not Billable", "Stuck")',
        },
        groupBy: {
          type: 'STRING',
          description: 'Grouping field: "sector", "executionStatus", "invoiceStatus", "bdPersonnelCode"',
        },
        limit: {
          type: 'INTEGER',
          description: 'Max number of work orders to return (default 10)',
        },
      },
    },
  },
  {
    name: 'cross_board_summary',
    description: 'Perform a cross-board correlation between sales pipeline (Deals) and operational execution / billing (Work Orders) grouped by sector or overall business.',
    parameters: {
      type: 'OBJECT',
      properties: {
        sector: {
          type: 'STRING',
          description: 'Specific sector to analyze across both boards, or omit for overall company overview',
        },
      },
    },
  },
  {
    name: 'get_kpis',
    description: 'Retrieve top-level executive KPIs including total pipeline value, total won deals, win rate, total work order value, billed amount, collected cash, and outstanding receivables.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_leadership_summary',
    description: 'Generate an executive leadership briefing summary covering pipeline health, operational delivery, receivables risks, high-priority opportunities, and strategic focus areas.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
];

module.exports = { toolDeclarations };

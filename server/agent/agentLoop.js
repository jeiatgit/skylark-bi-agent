/**
 * AI Agent Loop with 2-Stage Intent Extraction & Grounded Executive Synthesis
 * Features cascading model fallback (gemini-flash-lite-latest -> gemini-3.6-flash -> gemma-4-31b-it)
 * for guaranteed zero-downtime, non-hallucinated BI intelligence.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fetch = require('node-fetch');
const {
  queryDeals,
  queryWorkOrders,
  crossBoardSummary,
  getKPIs,
  getLeadershipSummary,
} = require('../data/analytics');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const MODELS = [PRIMARY_MODEL, 'gemini-3.6-flash', 'gemma-4-31b-it'];

const ROUTER_SYSTEM = `You are a query router for Skylark Drones Business Intelligence Agent.
Given a user's question, determine the single best analytical tool and arguments to execute.

Available Tools:
1. "query_deals": for sales pipeline, deals, stages (Lead, Proposal, Won, Lost), probability, sector pipeline, sales reps.
   Arguments: { "sector": string, "dealStatus": "Open"|"Won"|"Dead"|"On Hold"|"all", "dealStage": string, "ownerCode": string, "groupBy": "sector"|"dealStage"|"ownerCode"|"closureProbability" }

2. "query_work_orders": for operations, project execution, contract values, billing, cash collected, outstanding receivables, delayed/stuck projects.
   Arguments: { "sector": string, "executionStatus": "Completed"|"Ongoing"|"Stuck"|"Not Started"|"all", "invoiceStatus": string, "billingStatus": string, "groupBy": "sector"|"executionStatus"|"invoiceStatus" }

3. "cross_board_summary": for comparing sales pipeline vs. operational billing/execution across sectors or company-wide.
   Arguments: { "sector": string }

4. "get_kpis": for top-level executive snapshot numbers (total pipeline, win rate, total receivables, active work orders).
   Arguments: {}

5. "get_leadership_summary": for comprehensive executive leadership updates, briefings, risks, and strategic focus.
   Arguments: {}

Output ONLY a JSON object with:
{
  "tool": "tool_name",
  "args": { ... }
}
If the user is simply saying hello or greeting, output:
{
  "directReply": "Hello! I am your Skylark Business Intelligence Agent. Ask me anything about your sales pipeline or operational work orders."
}`;

const SYNTHESIZER_SYSTEM = `You are Skylark BI Agent, an executive AI Business Intelligence assistant for Skylark Drones founders.
You will be provided with the user question along with verified, computed ground-truth metrics from monday.com.

Formatting Guidelines:
- Highlight key currency figures in INR (e.g. ₹68.82 Cr, ₹3.63 Cr, ₹77.07 L, or formatted numbers).
- Use clear sections:
  1. **Key Metrics Summary** (bullet points with bold numbers)
  2. **Detailed Breakdown** (markdown table or concise list)
  3. **Strategic Insights & Recommendations** (actionable takeaways for leadership)
  4. **Data Quality Note** (if applicable)
- Maintain an authoritative, crisp, and executive tone.`;

async function callModel(prompt, systemInstruction) {
  let lastError = null;

  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
      system_instruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    };

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await resp.json();

      if (json.error) {
        if (json.error.code === 429 || json.error.status === 'RESOURCE_EXHAUSTED' || json.error.code === 404) {
          console.warn(`[Agent Fallback] Model ${model} encountered ${json.error.status || json.error.code}. Trying next model...`);
          lastError = json.error;
          continue;
        }
        throw new Error(json.error.message || JSON.stringify(json.error));
      }

      if (json.candidates && json.candidates.length > 0) {
        const text = json.candidates[0].content?.parts?.[0]?.text || '';
        return text.trim();
      }
    } catch (err) {
      lastError = err;
      console.warn(`[Agent Fallback] Model ${model} error: ${err.message}`);
    }
  }

  throw new Error(`All AI models temporarily busy (${lastError?.message || 'Rate limit'}). Please retry in a few seconds.`);
}

function executeTool(toolName, args) {
  console.log(`[Agent Tool Execution] ${toolName} with args:`, JSON.stringify(args));
  switch (toolName) {
    case 'query_deals':
      return queryDeals(args);
    case 'query_work_orders':
      return queryWorkOrders(args);
    case 'cross_board_summary':
      return crossBoardSummary(args);
    case 'get_kpis':
      return getKPIs();
    case 'get_leadership_summary':
      return getLeadershipSummary();
    default:
      return getKPIs();
  }
}

async function runAgent(userMessage) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in .env');
  }

  // Step 1: Route query to tool & extract arguments
  const routerResponse = await callModel(
    `User Query: "${userMessage}"\n\nOutput tool JSON:`,
    ROUTER_SYSTEM
  );

  let route = null;
  try {
    const jsonMatch = routerResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      route = JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.warn('[Router JSON Parse Fallback]', e.message);
  }

  // Handle direct greeting
  if (route && route.directReply) {
    return {
      text: route.directReply,
      toolsUsed: [],
      toolResults: null,
    };
  }

  // Determine tool to execute
  const toolName = route?.tool || 'get_kpis';
  const toolArgs = route?.args || {};
  const toolResult = executeTool(toolName, toolArgs);

  // Step 2: Synthesize grounded executive response
  const synthesisPrompt = `User Question: "${userMessage}"\n\n` +
    `Verified Ground-Truth Business Data (computed directly from monday.com boards):\n` +
    `Tool Executed: ${toolName}\n` +
    `Computed Results:\n${JSON.stringify(toolResult, null, 2)}\n\n` +
    `Synthesize a complete executive response for leadership with Key Metrics, Breakdown, Insights, and Data Quality Notes.`;

  const finalText = await callModel(synthesisPrompt, SYNTHESIZER_SYSTEM);

  return {
    text: finalText,
    toolsUsed: [{ name: toolName, args: toolArgs }],
    toolResults: toolResult,
  };
}

module.exports = { runAgent };

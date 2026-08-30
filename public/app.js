/**
 * Skylark BI Agent — Frontend Application Logic
 */

// Currency formatter for Indian Lakhs & Crores
function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
  const n = Math.abs(Number(amount));
  const sign = amount < 0 ? '-' : '';
  
  if (n >= 10000000) {
    return `${sign}₹${(n / 10000000).toFixed(2)} Cr`;
  }
  if (n >= 100000) {
    return `${sign}₹${(n / 100000).toFixed(2)} L`;
  }
  return `${sign}₹${n.toLocaleString('en-IN')}`;
}

// Simple Markdown parser for rich formatted BI answers
function renderMarkdown(md) {
  if (!md) return '';
  let html = md;

  // Escape basic HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2>$1</h2>');

  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Markdown Tables
  const lines = html.split('\n');
  let inTable = false;
  let tableHtml = '';
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHtml = '<table class="chat-table">';
      }
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (line.includes('---')) {
        continue; // delimiter row
      }
      const tag = tableHtml.includes('<tbody>') || tableHtml.includes('<tr>') ? 'td' : 'th';
      tableHtml += `<tr>${cells.map(c => `<${tag}>${c}</${tag}>`).join('')}</tr>`;
    } else {
      if (inTable) {
        inTable = false;
        tableHtml += '</table>';
        newLines.push(tableHtml);
      }
      newLines.push(lines[i]);
    }
  }
  if (inTable) {
    tableHtml += '</table>';
    newLines.push(tableHtml);
  }
  html = newLines.join('\n');

  // Bullet points
  html = html.replace(/^\s*[\-\*•]\s+(.*$)/gim, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/gims, '<ul>$1</ul>');

  // Numbered list
  html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

  // Paragraphs
  html = html.split('\n\n').map(p => {
    p = p.trim();
    if (!p) return '';
    if (p.startsWith('<h') || p.startsWith('<ul') || p.startsWith('<table')) return p;
    return `<p>${p.replace(/\n/g, '<br>')}</p>`;
  }).join('');

  return html;
}

// Application State
const state = {
  history: [],
  isLoading: false,
};

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const syncBtn = document.getElementById('syncBtn');
const sourceBadge = document.getElementById('sourceBadge');
const sourceText = document.getElementById('sourceText');
const suggestedChips = document.getElementById('suggestedChips');

// KPI Elements
const valPipeline = document.getElementById('valPipeline');
const subPipeline = document.getElementById('subPipeline');
const valWinRate = document.getElementById('valWinRate');
const subWinRate = document.getElementById('subWinRate');
const valReceivables = document.getElementById('valReceivables');
const subReceivables = document.getElementById('subReceivables');
const valWorkOrders = document.getElementById('valWorkOrders');
const subWorkOrders = document.getElementById('subWorkOrders');

// Fetch and render KPIs
async function loadKPIs() {
  try {
    const res = await fetch('/api/kpis');
    const json = await res.json();
    if (json.success && json.data) {
      const { pipeline, operations } = json.data;
      
      valPipeline.textContent = formatCurrency(pipeline.totalPipelineValue);
      subPipeline.textContent = `${pipeline.totalOpenDeals} Open Deals (${formatCurrency(pipeline.wonValue)} Won)`;

      valWinRate.textContent = `${pipeline.winRate}%`;
      subWinRate.textContent = `${pipeline.wonDealsCount} Won Opportunities`;

      valReceivables.textContent = formatCurrency(operations.totalReceivable);
      subReceivables.textContent = `Billed: ${formatCurrency(operations.totalBilled)} | Cash: ${formatCurrency(operations.totalCollected)}`;

      valWorkOrders.textContent = operations.totalWorkOrders;
      subWorkOrders.textContent = `${operations.ongoingWorkOrders} Active | ${operations.stuckWorkOrders} Stuck`;
    }
  } catch (err) {
    console.error('Failed to load KPIs:', err);
  }
}

// Fetch Sync Status
async function checkStatus() {
  try {
    const res = await fetch('/api/sync/status');
    const json = await res.json();
    if (json.success) {
      sourceText.textContent = json.source;
    }
  } catch (err) {
    sourceText.textContent = 'Local Standby';
  }
}

// Trigger Sync
syncBtn.addEventListener('click', async () => {
  syncBtn.classList.add('sync-spinning');
  sourceText.textContent = 'Syncing...';
  try {
    const res = await fetch('/api/sync', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      sourceText.textContent = json.source;
      await loadKPIs();
      appendSystemMessage(`🔄 Data synchronized successfully from <strong>${json.source}</strong>. (${json.dealsCount} deals, ${json.workOrdersCount} work orders loaded).`);
    } else {
      alert(`Sync failed: ${json.error}`);
    }
  } catch (err) {
    alert(`Sync error: ${err.message}`);
  } finally {
    syncBtn.classList.remove('sync-spinning');
  }
});

// Append User Message to UI
function appendUserMessage(text) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message user-message';
  msgDiv.innerHTML = `
    <div class="avatar user-avatar">You</div>
    <div class="message-content">
      <p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    </div>
  `;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Append Agent Message to UI
function appendAgentMessage(text, toolsUsed, toolResults) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message agent-message';

  let auditHtml = '';
  if (toolsUsed && toolsUsed.length > 0) {
    const toolNames = toolsUsed.map(t => t.name).join(', ');
    auditHtml += `
      <div class="tool-audit-badge" title="Verified deterministic tool execution against live monday.com dataset">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Tool Executed: ${toolNames}
      </div>
    `;
  }

  let warningsHtml = '';
  if (toolResults && toolResults.dataWarnings && toolResults.dataWarnings.length > 0) {
    warningsHtml = `
      <div class="data-warning-box">
        <strong>Data Quality Notice:</strong> ${toolResults.dataWarnings.slice(0, 2).join('; ')}
      </div>
    `;
  }

  msgDiv.innerHTML = `
    <div class="avatar agent-avatar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="10" rx="2"></rect>
        <circle cx="12" cy="5" r="2"></circle>
        <path d="M12 7v4"></path>
      </svg>
    </div>
    <div class="message-content">
      ${renderMarkdown(text)}
      ${auditHtml}
      ${warningsHtml}
    </div>
  `;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Append System Message
function appendSystemMessage(htmlText) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'message';
  msgDiv.innerHTML = `
    <div class="avatar agent-avatar">⚡</div>
    <div class="message-content" style="background: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.3);">
      <p>${htmlText}</p>
    </div>
  `;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Append Typing Indicator
function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message agent-message';
  typingDiv.id = 'typingIndicator';
  typingDiv.innerHTML = `
    <div class="avatar agent-avatar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="10" rx="2"></rect>
      </svg>
    </div>
    <div class="message-content">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

// Send Message Handler
async function sendMessage(text) {
  if (!text || state.isLoading) return;

  state.isLoading = true;
  userInput.value = '';
  appendUserMessage(text);
  showTypingIndicator();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: state.history,
      }),
    });

    const data = await res.json();
    removeTypingIndicator();

    if (data.success) {
      appendAgentMessage(data.reply, data.toolsUsed, data.toolResults);
      // Track history (keep last 8 turns)
      state.history.push({ role: 'user', text });
      state.history.push({ role: 'model', text: data.reply });
      if (state.history.length > 16) {
        state.history = state.history.slice(-16);
      }
    } else {
      appendAgentMessage(`❌ **Agent Error:** ${data.error || 'Unable to process query.'}`, [], null);
    }
  } catch (err) {
    removeTypingIndicator();
    appendAgentMessage(`❌ **Connection Error:** ${err.message}. Please verify the server is running.`, [], null);
  } finally {
    state.isLoading = false;
    userInput.focus();
  }
}

// Form Submission
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if (text) sendMessage(text);
});

// Clickable Prompt Chips
suggestedChips.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (chip && chip.dataset.query) {
    sendMessage(chip.dataset.query);
  }
});

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  loadKPIs();
  checkStatus();
  userInput.focus();
});

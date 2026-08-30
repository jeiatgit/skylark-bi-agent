/**
 * monday.com DataSource — GraphQL API adapter
 * Fetches all items from a board, handles pagination.
 */

const fetch = require('node-fetch');

const MONDAY_TOKEN = process.env.MONDAY_API_TOKEN;
const API_URL = 'https://api.monday.com/v2';

async function mondayQuery(query, variables = {}) {
  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: MONDAY_TOKEN,
      'Content-Type': 'application/json',
      'API-Version': '2024-01',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await resp.json();
  if (json.errors) {
    throw new Error(`monday.com API error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

/**
 * Fetch ALL items from a board (handles cursor pagination).
 * Returns array of { id, name, columnValues: { [title]: value } }
 */
async function fetchAllItems(boardId) {
  const items = [];
  let cursor = null;

  do {
    const query = cursor
      ? `query($boardId: ID!, $cursor: String!) {
           next_items_page(limit: 200, cursor: $cursor) {
             cursor
             items { id name column_values { id text column { title } } }
           }
         }`
      : `query($boardId: ID!) {
           boards(ids: [$boardId]) {
             items_page(limit: 200) {
               cursor
               items { id name column_values { id text column { title } } }
             }
           }
         }`;

    const vars = cursor ? { cursor } : { boardId };
    const data = await mondayQuery(query, vars);

    const page = cursor
      ? data.next_items_page
      : data.boards[0].items_page;

    cursor = page.cursor;

    for (const item of page.items) {
      const cols = {};
      for (const cv of item.column_values) {
        cols[cv.column.title] = cv.text || '';
      }
      items.push({ id: item.id, name: item.name, ...cols });
    }
  } while (cursor);

  return items;
}

module.exports = { mondayQuery, fetchAllItems };

const fetch = require('node-fetch');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function checkBoard() {
  const token = process.env.MONDAY_API_TOKEN;
  const boardId = '5030969793';
  
  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Authorization': token,
      'Content-Type': 'application/json',
      'API-Version': '2024-01',
    },
    body: JSON.stringify({
      query: `query { boards(ids: [${boardId}]) { id name items_count columns { id title type } } }`
    }),
  });
  const data = await res.json();
  console.log('Board structure:', JSON.stringify(data, null, 2));
}

checkBoard();

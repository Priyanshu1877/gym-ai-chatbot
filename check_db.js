const Database = require('better-sqlite3');
const db = new Database('./gym.db');

try {
  const users = db.prepare('SELECT * FROM users').all();
  console.log('--- USERS ---');
  console.log(users);

  const progress = db.prepare('SELECT * FROM progress').all();
  console.log('--- PROGRESS ---');
  console.log(progress);
} catch (e) {
  console.error(e);
}

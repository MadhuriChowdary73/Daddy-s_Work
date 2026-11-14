const bcrypt = require('bcryptjs');
const db = require('./db');

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log('Usage: node change-password.js <username> <new_password>');
  console.log('Example: node change-password.js admin newpassword123');
  process.exit(1);
}

const [username, newPassword] = args;

if (newPassword.length < 6) {
  console.error('Error: Password must be at least 6 characters long.');
  process.exit(1);
}

const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
if (!admin) {
  console.error(`Error: User "${username}" not found.`);
  process.exit(1);
}

const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync(newPassword, salt);

db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?').run(hash, username);
console.log(`Success: Password for user "${username}" has been updated successfully!`);


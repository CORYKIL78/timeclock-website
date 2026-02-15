#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CREDENTIALS_FILE = path.join(__dirname, 'admin-credentials.json');
const EXAMPLE_FILE = path.join(__dirname, 'admin-credentials.example.json');

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    console.log('\n❌ admin-credentials.json not found!\n');
    console.log('Please copy the example file and add your admin credentials:');
    console.log(`  cp ${EXAMPLE_FILE} ${CREDENTIALS_FILE}\n`);
    process.exit(1);
  }

  try {
    const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error('\n❌ Error parsing admin-credentials.json:', e.message);
    process.exit(1);
  }
}

function validateCredentials(creds) {
  if (!creds.admins || !Array.isArray(creds.admins)) {
    throw new Error('admins array not found in credentials file');
  }

  const errors = [];
  creds.admins.forEach((admin, idx) => {
    if (!admin.discordId) errors.push(`Admin ${idx}: missing discordId`);
    if (!admin.pin) errors.push(`Admin ${idx}: missing pin`);
    if (!admin.name) errors.push(`Admin ${idx}: missing name`);
  });

  if (errors.length > 0) {
    throw new Error('Validation errors:\n  ' + errors.join('\n  '));
  }

  return true;
}

function generateEnvFormat(creds) {
  let env = '# Cloudflare Worker Environment Variables\n';
  env += '# Add these to your wrangler.toml or .env file\n\n';

  creds.admins.forEach(admin => {
    env += `ADMIN_${admin.discordId}_PIN="${admin.pin}"\n`;
    env += `ADMIN_${admin.discordId}_NAME="${admin.name}"\n`;
  });

  return env;
}

function generateAuthJS(creds) {
  const adminsObj = {};
  creds.admins.forEach(admin => {
    adminsObj[admin.discordId] = {
      pin: admin.pin,
      name: admin.name
    };
  });

  return `// Auto-generated from admin-credentials.json
// This file is gitignored and only for local development
// For production, use Cloudflare environment variables

window.CONFIG = window.CONFIG || {};
window.CONFIG.ADMINS = ${JSON.stringify(adminsObj, null, 2)};

console.log('[ADMIN CONFIG] Loaded ${creds.admins.length} admin(s) from local credentials');
`;
}

function command(action) {
  const creds = loadCredentials();

  try {
    validateCredentials(creds);
  } catch (e) {
    console.error('\n❌ Validation failed:', e.message, '\n');
    process.exit(1);
  }

  console.log('\n✅ Admin credentials validated\n');
  console.log(`Found ${creds.admins.length} admin(s):\n`);
  creds.admins.forEach(admin => {
    console.log(`  📌 ${admin.name} (${admin.discordId})`);
  });
  console.log();

  switch (action) {
    case 'env':
      console.log('=== Environment Variable Format ===\n');
      console.log(generateEnvFormat(creds));
      console.log('Add these to your Cloudflare Worker environment (wrangler.toml or dashboard)\n');
      break;

    case 'dev':
      console.log('=== Generating .env-config.js for local development ===\n');
      const jsContent = generateAuthJS(creds);
      fs.writeFileSync(path.join(__dirname, '.env-config.js'), jsContent);
      console.log('✅ Generated .env-config.js');
      console.log('   This file is gitignored and for local development only\n');
      console.log('Add this to admin/backup.html <head> section:');
      console.log('  <script src="../.env-config.js"></script>\n');
      break;

    case 'add':
      const arg = process.argv[3];
      if (!arg) {
        console.log('❌ Usage: node setup-admins.js add "Discord ID" "Name" "PIN"');
        process.exit(1);
      }

      const [discordId, name, pin] = process.argv.slice(3);
      if (!discordId || !name || !pin) {
        console.log('❌ Usage: node setup-admins.js add "Discord ID" "Name" "PIN"');
        console.log('\nExample: node setup-admins.js add 1088907566844739624 "Marcus Ray" 061021\n');
        process.exit(1);
      }

      if (creds.admins.find(a => a.discordId === discordId)) {
        console.log(`\n❌ Admin with ID ${discordId} already exists\n`);
        process.exit(1);
      }

      creds.admins.push({ discordId, name, pin });
      fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2));
      console.log(`\n✅ Added admin: ${name} (${discordId})`);
      console.log('   Re-run "node setup-admins.js dev" to update .env-config.js\n');
      break;

    case 'remove':
      const id = process.argv[3];
      if (!id) {
        console.log('❌ Usage: node setup-admins.js remove "Discord ID"');
        process.exit(1);
      }

      const idx = creds.admins.findIndex(a => a.discordId === id);
      if (idx === -1) {
        console.log(`\n❌ Admin with ID ${id} not found\n`);
        process.exit(1);
      }

      const removed = creds.admins[idx];
      creds.admins.splice(idx, 1);
      fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2));
      console.log(`\n✅ Removed admin: ${removed.name}`);
      console.log('   Re-run "node setup-admins.js dev" to update .env-config.js\n');
      break;

    case 'list':
      console.log('=== All Admins ===\n');
      creds.admins.forEach((admin, i) => {
        console.log(`${i + 1}. ${admin.name}`);
        console.log(`   Discord ID: ${admin.discordId}`);
        console.log(`   PIN: ${admin.pin}`);
        console.log();
      });
      break;

    default:
      console.log('Usage: node setup-admins.js <command>\n');
      console.log('Commands:');
      console.log('  list              - List all admins');
      console.log('  add <id> <name> <pin> - Add new admin');
      console.log('  remove <id>       - Remove admin by Discord ID');
      console.log('  dev               - Generate .env-config.js for local development');
      console.log('  env               - Show environment variable format for production\n');
      console.log('Examples:');
      console.log('  node setup-admins.js list');
      console.log('  node setup-admins.js add 1088907566844739624 "Marcus Ray" 061021');
      console.log('  node setup-admins.js remove 1088907566844739624');
      console.log('  node setup-admins.js dev');
      console.log('  node setup-admins.js env\n');
      break;
  }
}

const action = process.argv[2] || 'list';
command(action);

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const STORAGE_DIR = path.join(process.cwd(), 'storage');
const BACKUPS_DIR = path.join(STORAGE_DIR, 'backups');
const EXPORTS_DIR = path.join(STORAGE_DIR, 'exports');
const RESEARCH_DIR = path.join(STORAGE_DIR, 'research');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[MIGRATE] Created directory: ${dir}`);
  }
}

function migrate() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🐳 WHALEBOT STORAGE MIGRATION UTILITY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!fs.existsSync(DATA_DIR)) {
    console.log('❌ No "data" directory found. Migration might already be completed or this is a fresh install.');
    return;
  }

  // 1. Create directories
  ensureDir(STORAGE_DIR);
  ensureDir(BACKUPS_DIR);
  ensureDir(EXPORTS_DIR);
  ensureDir(RESEARCH_DIR);

  // 2. Identify files to migrate
  const filesToMigrate = [
    'subscribers.json',
    'watchlists.json',
    'tokens.json',
    'alerts.json',
    'wallets.json',
    'accumulation.json',
    'maintenance.json',
    'research_stats.json'
  ];

  let successCount = 0;

  filesToMigrate.forEach(file => {
    const sourcePath = path.join(DATA_DIR, file);
    const destPath = path.join(STORAGE_DIR, file);
    const backupPath = path.join(BACKUPS_DIR, `pre_migration_${file}`);

    if (fs.existsSync(sourcePath)) {
      try {
        // Backup first
        fs.copyFileSync(sourcePath, backupPath);
        
        // Copy to new location
        fs.copyFileSync(sourcePath, destPath);

        // Verify file integrity
        const sourceData = fs.readFileSync(sourcePath, 'utf8');
        const destData = fs.readFileSync(destPath, 'utf8');

        if (sourceData === destData && JSON.parse(destData)) {
          console.log(`✅ Successfully migrated: ${file}`);
          successCount++;
          // Safe to remove old file since validation succeeded
          fs.unlinkSync(sourcePath);
        } else {
          console.log(`❌ Integrity check failed for: ${file}`);
        }
      } catch (err) {
        console.log(`❌ Error migrating ${file}: ${err.message}`);
      }
    } else {
      console.log(`ℹ️ Skipped ${file} (does not exist in data/)`);
    }
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Migration Complete: ${successCount} files migrated safely.`);
  console.log('You may now delete the empty "data/" directory if no longer needed.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

migrate();

# WhaleBot Deployment Guide

This document outlines the standard deployment workflow for the WhaleBot system, specifically focusing on handling the separation between application source code and runtime data.

## 1. Initial VPS Setup

Clone the repository to your VPS:
```bash
git clone https://github.com/0xfrostone/WhalebotAlert.git
cd WhalebotAlert
npm install
```

Copy the environment file and fill in your secrets:
```bash
cp .env.example .env
nano .env
```

If migrating from an older installation (with a `data/` directory):
```bash
npm run migrate-storage
```

Start the bot using PM2:
```bash
pm2 start index.js --name whalebot
pm2 save
```

## 2. Updating Code (Git Workflow)

Since runtime data is now isolated in the `storage/` directory and ignored by Git, pulling updates is completely safe and will not cause merge conflicts.

```bash
cd ~/WhalebotAlert
git pull origin main
npm install # if dependencies changed
pm2 restart whalebot
```

## 3. Storage Structure

- `storage/`: Contains all dynamic runtime JSON files (`subscribers.json`, `alerts.json`, etc.)
- `storage/backups/`: Contains daily automated backups of your critical JSON data.
- `storage/exports/`: Contains temporary raw CSV exports.
- `storage/research/`: Contains all thesis-oriented research datasets and summaries.

## 4. Backup & Restoration

### Automatic Backups
The bot automatically backs up your core user data (`watchlists.json`, `subscribers.json`, `tokens.json`) to `storage/backups/` every 24 hours. The system retains the latest 7 backups.

### Manual Restoration
If a file becomes corrupted, you can restore it from the backups directory:
```bash
pm2 stop whalebot
cp storage/backups/watchlists_2026-06-08.json storage/watchlists.json
pm2 start whalebot
```

## 5. Research Exports

When executing an export from the Telegram bot for your thesis, the files will be generated securely in:
- `storage/research/whale_research_dataset_YYYY-MM-DD.csv`
- `storage/research/whale_research_summary_YYYY-MM-DD.csv`

You can download these via `scp` or `sftp` from your VPS for Chapter 4 analysis.

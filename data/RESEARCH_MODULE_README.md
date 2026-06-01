// data/RESEARCH_MODULE_README.md
# 📊 WhaleBot Research Module - Panduan Penggunaan

## Gambaran Umum

Modul Research mengotomatisasi pengumpulan data whale transactions untuk keperluan penelitian BAB 4 skripsi. Sistem menyimpan setiap whale alert dalam format JSON dan CSV dengan metadata lengkap.

---

## 📁 Struktur File Baru

### Storage Layer
- **`src/storage/alertStore.js`** - Menyimpan alerts ke JSON dan CSV secara otomatis

### Services Layer  
- **`src/services/alertLogger.js`** - Service untuk logging alerts dengan enrichment data

### Handlers Layer
- **`src/handlers/researchHandler.js`** - Handle semua callback dari research menu

### Commands Layer
- **`src/commands/research.js`** - Perintah `/research` untuk akses menu research

### Utilities Layer
- **`src/utils/csvExporter.js`** - Export data ke CSV dengan analisis statistik

---

## 📝 Format Data Tersimpan

### JSON Format (`data/alerts.json`)
```json
[
  {
    "id": 1,
    "timestamp": "2026-05-31T10:30:45.123Z",
    "dateTime": "31/5/2026 17:30:45",
    "token": "UNI",
    "transactionType": "BUY",
    "valueUSD": 125000.50,
    "valueETH": 50.25,
    "whaleScore": 78,
    "whaleScoreBreakdown": {
      "txSize": 85,
      "lpImpact": 72,
      "walletRep": 0,
      "frequency": 45,
      "smartMoney": 80
    },
    "riskCategory": "HIGH",
    "liquidityImpactPct": 8.50,
    "poolTVL": 1500000,
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc2e7595f96cEd",
    "txHash": "0xabcd...ef01",
    "dex": "Uniswap V3",
    "tokenIn": "WETH",
    "tokenOut": "UNI",
    "amountIn": 50.25,
    "amountOut": 850,
    "tokenPrice": 6.50,
    "ethPrice": 2500,
    "metadata": {
      "poolVersion": "v3",
      "detectedAt": 1717151445123,
      "userSubscribers": 15
    }
  }
]
```

### CSV Format (`data/alerts.csv`)
Headers: ID, Timestamp, DateTime, Token, Transaction Type, Value (USD), Value (ETH), Whale Score, TX Size Score, LP Impact Score, Wallet Rep Score, Frequency Score, Smart Money Score, Risk Category, Liquidity Impact (%), Pool TVL (USD), Wallet Address, TX Hash, DEX, Token In, Token Out, Amount In, Amount Out, Token Price, ETH Price, Pool Version

Ideal untuk:
- Import ke Excel / Google Sheets
- Analisis dengan Python pandas
- Visualisasi dengan Tableau
- Machine learning datasets

---

## 🤖 Penggunaan dari Telegram Bot

### Akses Menu Research

#### Opsi 1: Command
```
/research
```

#### Opsi 2: Dari Menu Utama
Klik tombol **📜 Riwayat Alert** atau **📊 Statistik**

### Fitur yang Tersedia

#### 1. **📜 Riwayat Alert (Recent 10)**
```
Menampilkan:
• 10 alert terakhir dalam format ringkas
• Timestamp, token, tipe transaksi, nilai, whale score
• Risk category indicator

Tombol aksi:
• Klik nomor untuk lihat detail lengkap
• Export CSV untuk download semua data
• Statistik untuk melihat overview sistem
```

#### 2. **📊 Statistik Sistem**
```
Menampilkan:
• Total alerts terdeteksi
• Total volume USD
• Rata-rata whale score
• Distribusi BUY vs SELL
• Distribusi risk category (EXTREME/HIGH/MEDIUM/LOW)
• Top 5 token paling sering terdeteksi
• Top 5 wallet dengan activity paling tinggi
```

#### 3. **📥 Export CSV**
```
Membuat file CSV berisi:
• 500 alert terakhir (atau semua jika < 500)
• Semua metadata lengkap
• Format standar CSV untuk spreadsheet
• File dikirim via Telegram (auto-cleanup setelah 5 detik)
```

#### 4. **🔍 Token Analysis**
```
Klik token di Riwayat Alert untuk melihat:
• Total alert untuk token tersebut
• BUY count, SELL count
• Rata-rata whale score
• Total volume USD
• Risk distribution
```

---

## 📊 Statistik yang Dikoleksi

Sistem secara otomatis menghitung dan menyimpan:

```
✓ Alert count by type (BUY/SELL)
✓ Alert count by risk (EXTREME/HIGH/MEDIUM/LOW)
✓ Token frequency distribution
✓ Average whale score
✓ Total volume USD
✓ Top wallets by activity
✓ Time series analysis
✓ Correlation analysis (score vs impact)
```

---

## 📈 Data untuk BAB 4 Penelitian

### Dataset yang Dihasilkan

File `data/alerts.csv` berisi kolom untuk analisis:

```
✓ Temporal data: timestamp untuk analysis trend
✓ Price data: token price, ETH price saat alert
✓ Transaction metrics: value USD, amount in/out
✓ Risk metrics: whale score, score breakdown, risk category
✓ Market impact: liquidity impact %, pool TVL
✓ Behavioral data: transaction type (BUY/SELL), frequency
✓ Wallet data: address, transaction history
```

### Contoh Analisis BAB 4

```python
import pandas as pd

# Load data
df = pd.read_csv('data/alerts.csv')

# Analisis 1: Hubungan whale score dengan volatilitas harga
# Grup alerts by token, hitung correlation antara whale score dan price movement

# Analisis 2: Impact BUY vs SELL terhadap harga
# Filter by transactionType, compare average liquidity impact

# Analisis 3: Prediksi volatilitas berdasarkan whale activity
# Time series analysis dengan datetime, calculate rolling volatility

# Analisis 4: Token characteristics yang influential
# Compare whale score breakdown across different tokens

# Analisis 5: Smart money vs regular whale behavior
# Analyze smart money score dan success rate
```

---

## 🔄 Integration dengan Existing System

### Automatic Logging Flow

```
1. Blockchain Listener mendeteksi Swap event
   ↓
2. Detector menghitung whale score
   ↓
3. Alert lolos filter sistem & dikirim ke subscribers
   ↓
4. AlertLogger otomatis menyimpan ke JSON & CSV
   ↓
5. User dapat akses via Telegram menu Research
```

### Data Persistence

```
✓ Data tersimpan di data/alerts.json (in-memory cache)
✓ Setiap alert langsung di-export ke CSV
✓ Data persistent across bot restart
✓ Auto-backup struktur untuk redundancy
```

---

## 💾 Storage Limits & Optimization

- **JSON Storage**: Max 5000 alerts in memory (cycle oldest)
- **CSV Storage**: Append-only, unlimited (manually prune jika perlu)
- **Export Directory**: `data/exports/` untuk temporary files
- **Recommendation**: Run cleanup script mingguan untuk old exports

---

## 🛠️ Advanced: Export dengan Filter

Di future, implementasi bisa extend dengan:

```javascript
// Filter by token
alertLogger.exportAlerts({ token: 'UNI' })

// Filter by date range
alertLogger.exportAlerts({ 
  startDate: '2026-05-01', 
  endDate: '2026-05-31' 
})

// Filter by risk
alertLogger.exportAlerts({ riskCategory: 'HIGH' })

// Generate research report
const report = await alertLogger.generateResearchReport(
  '2026-05-01', 
  '2026-05-31'
)
```

---

## 📋 Checklist Sebelum Presentasi Skripsi

```
□ Bot sudah running minimal 1-2 minggu untuk collect sufficient data
□ CSV export sudah didownload dan diverifikasi
□ Data sudah dianalisis menggunakan Python/Excel
□ Visualisasi sudah dibuat (charts, graphs)
□ Correlation analysis sudah selesai
□ Dokumentasi findings siap
□ Sample whale transactions sudah diidentifikasi
□ Risk distribution analysis sudah dibuat
□ Time series analysis sudah selesai
□ Recommendations/findings sudah didokumentasi
```

---

## 🚀 Quick Start

1. **Start Bot dengan Research Module**
   ```bash
   npm start
   ```

2. **Let it run** untuk collect data (minimal 1 hari untuk testing)

3. **Access Research Menu**
   - Send `/research` to bot
   - Atau klik menu buttons

4. **Download Data**
   - Click "📥 Export CSV"
   - Save file ke komputer

5. **Analyze in Python**
   ```python
   import pandas as pd
   df = pd.read_csv('whale_alerts_export_2026-05-31.csv')
   print(df.describe())
   ```

---

## ⚠️ Important Notes

- Data mulai tercatat sejak modul ini diaktifkan
- Historical data dari sebelumnya tidak tersedia
- CSV di-update real-time saat alert terdeteksi
- Recommended untuk export sebelum stop bot
- Format tetap konsisten untuk research purposes

---

**Created**: 31 May 2026
**Module Version**: 1.0
**Status**: Production Ready ✅

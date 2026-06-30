# TMR Chain (TMR-2007)

A Proof-of-Authority blockchain with:
- **Total Supply:** 10,000,000,000 TMR (10 Billion)
- **Decimals:** 1
- **Token Standard:** TMR-2007
- **Chain ID:** 5524050 (0x544D52)
- **Consensus:** Proof-of-Authority, single validator, auto-mines a block every 6 seconds

---

## 📁 What's in this folder

```
tmr-chain/
├── api/
│   └── rpc.js          ← the blockchain + RPC server (Express)
├── package.json        ← dependencies
├── explorer.html        ← block explorer frontend (deploy separately)
└── data/                ← chain state gets saved here (auto-created)
```

---

## 🚀 Step 1 — Deploy the RPC server (Render.com, free)

1. Create a new GitHub repo (e.g. `tmr-chain`) and upload:
   - `api/rpc.js`
   - `package.json`
2. Go to [render.com](https://render.com) → **New** → **Web Service**
3. Connect your `tmr-chain` GitHub repo
4. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `node api/rpc.js`
   - **Instance Type:** Free
5. Click **Deploy**

Once deployed, your RPC will be live at:
```
https://YOUR-APP-NAME.onrender.com
```

### Endpoints you'll have:
| Endpoint | Description |
|---|---|
| `GET /health` | Server status |
| `GET /network` | Chain info (ID, symbol, decimals, supply) |
| `GET /tokens` | Token supply + holder stats |
| `GET /blocks?limit=10` | Latest blocks |
| `GET /block/:numberOrHash` | Single block |
| `GET /transactions?limit=10` | Latest transactions |
| `GET /tx/:hash` | Single transaction |
| `GET /balance/:address` | Address balance |
| `POST /tx/send` | Send TMR — body: `{from, to, amount}` |
| `POST /faucet` | Get 1000 test TMR — body: `{address}` |
| `GET /search/:query` | Search address / tx / block |

**Important — Render free tier notes:**
- Free instances **spin down after ~15 min of inactivity** and spin back up on the next request (with a ~30–60s cold start delay).
- The free tier disk is **ephemeral** — chain data (`data/chain.json`) resets whenever the service redeploys or restarts after spin-down. For data that persists permanently, you'd need a paid instance with a persistent disk, or an external database (e.g. free-tier Postgres/Mongo).

---

## 🌐 Step 2 — Deploy the Explorer

1. Open `explorer.html` and update this line near the bottom:
   ```js
   const RPC_BASE = 'https://YOUR-APP-NAME.onrender.com';
   ```
2. Deploy `explorer.html` anywhere static, e.g.:
   - **Vercel:** drag-and-drop the file, or `vercel deploy`
   - **Netlify:** drag-and-drop in the dashboard
   - **GitHub Pages:** push to a repo, enable Pages

---

## 💰 How balances work

- Genesis address `TMR000000000000000000000000000000GENESIS` starts with the full 10B supply.
- Use `POST /faucet` with any valid `TMR...` address to send yourself 1000 test TMR.
- Use `POST /tx/send` to transfer between addresses.
- All addresses must match the pattern `TMR` + 10-50 alphanumeric characters (this is a simple validator, not real cryptographic key-pair address generation — see "Next steps" below).

---

## ⚠️ What this is — and isn't

This is a **functional educational/demo blockchain**: real block production, real transaction pool, real balance ledger, persisted state, and a working REST API — good for learning, prototyping, or running an internal testnet.

It is **not** a production-grade or cryptographically secure chain. Notably:
- No private-key/signature verification on transactions (anyone can claim to send "from" any address in this demo — add ECDSA signing before using it for anything real)
- No peer-to-peer networking — single centralized server
- Single validator only (true PoA would rotate among multiple authorized validators)

## 🔜 Suggested next steps
- Add wallet keypair generation + signature verification (e.g. with `elliptic` or `tweetnacl`)
- Add multiple validators with round-robin block production
- Move state from a JSON file to Postgres/Mongo for real persistence
- Add rate limiting on `/faucet` and `/tx/send`

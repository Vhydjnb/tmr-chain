/**
 * TMR Chain — Proof-of-Authority RPC Server
 * Chain: TMR-2007
 * Supply: 10,000,000,000 TMR (10B)
 * Decimals: 1
 * Standard: TMR-20
 *
 * Single-validator PoA chain. Auto-mines a block every BLOCK_TIME ms.
 * Persists state to /data/chain.json so it survives restarts (best effort —
 * Render free tier has an ephemeral disk, so state resets on redeploy/spindown
 * unless you attach a persistent disk on a paid plan).
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ──────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────
const CHAIN_CONFIG = {
  name: 'TMR Chain Mainnet',
  symbol: 'TMR',
  standard: 'TMR-2007',
  chainIdHex: '0x544D52',
  chainIdDec: 5524050,
  decimals: 1,
  totalSupply: '10000000000', // 10B whole units (10,000,000,000.0 with 1 decimal)
  blockTimeMs: 6000,
  validator: 'TMR-VALIDATOR-01',
  genesisAddress: 'TMR000000000000000000000000000000GENESIS',
};

const DATA_FILE = path.join(__dirname, 'chain-data.json');

// ──────────────────────────────────────────────
// STATE
// ──────────────────────────────────────────────
let state = {
  blocks: [],
  txPool: [],       // pending transactions waiting for next block
  balances: {},      // address -> integer smallest units (1 decimal => value * 10)
  txIndex: {},        // txHash -> {blockNumber, ...tx}
};

const UNIT_MULTIPLIER = 10 ** CHAIN_CONFIG.decimals; // decimals = 1 => *10

function toSmallestUnits(amountTMR) {
  return Math.round(Number(amountTMR) * UNIT_MULTIPLIER);
}
function toDisplayUnits(smallest) {
  return (smallest / UNIT_MULTIPLIER).toFixed(CHAIN_CONFIG.decimals);
}

function loadState() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      state = JSON.parse(raw);
      console.log(`[TMR] Loaded state: ${state.blocks.length} blocks`);
      return;
    }
  } catch (e) {
    console.error('[TMR] Failed to load state, starting fresh:', e.message);
  }
  genesisInit();
}

function saveState() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(state));
  } catch (e) {
    console.error('[TMR] Failed to save state:', e.message);
  }
}

function genesisInit() {
  console.log('[TMR] Initializing genesis block...');
  const totalSmallest = toSmallestUnits(CHAIN_CONFIG.totalSupply);
  state.balances[CHAIN_CONFIG.genesisAddress] = totalSmallest;

  const genesisBlock = {
    number: 0,
    hash: hashBlock(0, '0x0', [], Date.now()),
    parentHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    timestamp: Date.now(),
    validator: CHAIN_CONFIG.validator,
    transactions: [],
    txCount: 0,
  };

  state.blocks = [genesisBlock];
  state.txPool = [];
  state.txIndex = {};
  saveState();
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function hashBlock(number, parentHash, txs, timestamp) {
  const data = `${number}|${parentHash}|${JSON.stringify(txs)}|${timestamp}`;
  return '0x' + crypto.createHash('sha256').update(data).digest('hex');
}

function hashTx(from, to, amount, nonce, timestamp) {
  const data = `${from}|${to}|${amount}|${nonce}|${timestamp}`;
  return '0x' + crypto.createHash('sha256').update(data).digest('hex');
}

function isValidAddress(addr) {
  return typeof addr === 'string' && /^TMR[a-zA-Z0-9]{10,50}$/.test(addr);
}

function getLatestBlock() {
  return state.blocks[state.blocks.length - 1];
}

function getBalance(address) {
  return state.balances[address] || 0;
}

// ──────────────────────────────────────────────
// CORE CHAIN LOGIC
// ──────────────────────────────────────────────
function submitTransaction({ from, to, amount }) {
  if (!isValidAddress(from) || !isValidAddress(to)) {
    throw { code: -32602, message: 'Invalid address format. Addresses must start with TMR.' };
  }
  const amt = Number(amount);
  if (!amt || amt <= 0) {
    throw { code: -32602, message: 'Invalid amount' };
  }

  const smallestAmt = toSmallestUnits(amt);
  const balance = getBalance(from);

  if (balance < smallestAmt) {
    throw { code: -32000, message: 'Insufficient balance' };
  }

  const timestamp = Date.now();
  const nonce = state.txPool.length + state.blocks.reduce((a, b) => a + b.txCount, 0);
  const txHash = hashTx(from, to, smallestAmt, nonce, timestamp);

  const tx = {
    hash: txHash,
    from,
    to,
    amount: toDisplayUnits(smallestAmt),
    amountSmallest: smallestAmt,
    fee: toDisplayUnits(UNIT_MULTIPLIER * 0), // fee = 0 on this PoA testnet config (adjust as needed)
    timestamp,
    status: 'pending',
  };

  // Optimistically reserve balance
  state.balances[from] = balance - smallestAmt;
  state.balances[to] = getBalance(to) + smallestAmt;

  state.txPool.push(tx);
  saveState();
  return tx;
}

function mineBlock() {
  const latest = getLatestBlock();
  const txsToInclude = state.txPool.splice(0, state.txPool.length);

  const timestamp = Date.now();
  const number = latest.number + 1;
  const parentHash = latest.hash;
  const hash = hashBlock(number, parentHash, txsToInclude, timestamp);

  txsToInclude.forEach(tx => {
    tx.status = 'confirmed';
    tx.blockNumber = number;
    state.txIndex[tx.hash] = { ...tx };
  });

  const block = {
    number,
    hash,
    parentHash,
    timestamp,
    validator: CHAIN_CONFIG.validator,
    transactions: txsToInclude,
    txCount: txsToInclude.length,
  };

  state.blocks.push(block);

  // Keep last 500 blocks in memory/storage to bound file size on free tier
  if (state.blocks.length > 500) {
    state.blocks = state.blocks.slice(state.blocks.length - 500);
  }

  saveState();
  console.log(`[TMR] Mined block #${number} (${txsToInclude.length} txs) hash=${hash.slice(0, 12)}...`);
  return block;
}

// ──────────────────────────────────────────────
// REST API ROUTES
// ──────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    chain: CHAIN_CONFIG.name,
    latestBlock: getLatestBlock().number,
    uptime: process.uptime(),
  });
});

// Network info
app.get('/network', (req, res) => {
  res.json({
    name: CHAIN_CONFIG.name,
    symbol: CHAIN_CONFIG.symbol,
    standard: CHAIN_CONFIG.standard,
    chainId: CHAIN_CONFIG.chainIdHex,
    chainIdDecimal: CHAIN_CONFIG.chainIdDec,
    decimals: CHAIN_CONFIG.decimals,
    totalSupply: CHAIN_CONFIG.totalSupply,
    validator: CHAIN_CONFIG.validator,
    consensus: 'Proof-of-Authority',
    blockTimeMs: CHAIN_CONFIG.blockTimeMs,
    latestBlock: getLatestBlock().number,
  });
});

// Token info (TMR-20 style)
app.get('/tokens', (req, res) => {
  res.json({
    name: 'TMR Token',
    symbol: CHAIN_CONFIG.symbol,
    standard: CHAIN_CONFIG.standard,
    decimals: CHAIN_CONFIG.decimals,
    totalSupply: CHAIN_CONFIG.totalSupply,
    circulatingSupply: toDisplayUnits(
      Object.entries(state.balances)
        .filter(([addr]) => addr !== CHAIN_CONFIG.genesisAddress)
        .reduce((sum, [, bal]) => sum + bal, 0)
    ),
    genesisAddress: CHAIN_CONFIG.genesisAddress,
    holders: Object.keys(state.balances).filter(a => getBalance(a) > 0).length,
  });
});

// Get latest N blocks
app.get('/blocks', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const blocks = state.blocks.slice(-limit).reverse().map(b => ({
    number: b.number,
    hash: b.hash,
    parentHash: b.parentHash,
    timestamp: b.timestamp,
    validator: b.validator,
    txCount: b.txCount,
  }));
  res.json({ blocks });
});

// Get single block by number or hash
app.get('/block/:id', (req, res) => {
  const id = req.params.id;
  let block;
  if (/^\d+$/.test(id)) {
    block = state.blocks.find(b => b.number === parseInt(id));
  } else {
    block = state.blocks.find(b => b.hash === id);
  }
  if (!block) return res.status(404).json({ error: 'Block not found' });
  res.json(block);
});

// Get latest N transactions
app.get('/transactions', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 100);
  const allTxs = [];
  for (let i = state.blocks.length - 1; i >= 0 && allTxs.length < limit; i--) {
    const b = state.blocks[i];
    for (let j = b.transactions.length - 1; j >= 0 && allTxs.length < limit; j--) {
      allTxs.push(b.transactions[j]);
    }
  }
  res.json({ transactions: allTxs });
});

// Get single transaction by hash
app.get('/tx/:hash', (req, res) => {
  const tx = state.txIndex[req.params.hash] ||
    state.txPool.find(t => t.hash === req.params.hash);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  res.json(tx);
});

// Get balance for an address
app.get('/balance/:address', (req, res) => {
  const address = req.params.address;
  if (!isValidAddress(address)) {
    return res.status(400).json({ error: 'Invalid address format' });
  }
  res.json({
    address,
    balance: toDisplayUnits(getBalance(address)),
    symbol: CHAIN_CONFIG.symbol,
  });
});

// Submit a transaction (send TMR)
app.post('/tx/send', (req, res) => {
  try {
    const { from, to, amount } = req.body;
    const tx = submitTransaction({ from, to, amount });
    res.json({ success: true, tx });
  } catch (err) {
    const code = err.code || -32603;
    res.status(400).json({ success: false, error: err.message || 'Internal error', code });
  }
});

// Generic search — address / tx hash / block number
app.get('/search/:query', (req, res) => {
  const q = req.params.query;

  if (/^\d+$/.test(q)) {
    const block = state.blocks.find(b => b.number === parseInt(q));
    if (block) return res.json({ type: 'block', result: block });
  }

  if (q.startsWith('0x')) {
    const tx = state.txIndex[q] || state.txPool.find(t => t.hash === q);
    if (tx) return res.json({ type: 'transaction', result: tx });
    const block = state.blocks.find(b => b.hash === q);
    if (block) return res.json({ type: 'block', result: block });
  }

  if (isValidAddress(q)) {
    return res.json({
      type: 'address',
      result: { address: q, balance: toDisplayUnits(getBalance(q)) },
    });
  }

  res.status(404).json({ error: 'No matching block, transaction, or address found' });
});

// Faucet — for testing only, gives free TMR from genesis
app.post('/faucet', (req, res) => {
  try {
    const { address } = req.body;
    if (!isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    const tx = submitTransaction({
      from: CHAIN_CONFIG.genesisAddress,
      to: address,
      amount: 1000, // 1000 TMR test funds
    });
    res.json({ success: true, message: 'Sent 1000 TMR from faucet', tx });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Root
app.get('/', (req, res) => {
  res.json({
    chain: CHAIN_CONFIG.name,
    message: 'TMR Chain RPC is live',
    endpoints: [
      'GET  /health',
      'GET  /network',
      'GET  /tokens',
      'GET  /blocks?limit=10',
      'GET  /block/:numberOrHash',
      'GET  /transactions?limit=10',
      'GET  /tx/:hash',
      'GET  /balance/:address',
      'POST /tx/send {from,to,amount}',
      'POST /faucet {address}',
      'GET  /search/:query',
    ],
  });
});

// ──────────────────────────────────────────────
// BOOT
// ──────────────────────────────────────────────
loadState();

// Auto-mine blocks on a timer (PoA — single validator)
setInterval(() => {
  try {
    mineBlock();
  } catch (e) {
    console.error('[TMR] Mining error:', e.message);
  }
}, CHAIN_CONFIG.blockTimeMs);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[TMR] RPC server running on port ${PORT}`);
  console.log(`[TMR] Chain: ${CHAIN_CONFIG.name} | Symbol: ${CHAIN_CONFIG.symbol} | Decimals: ${CHAIN_CONFIG.decimals}`);
});

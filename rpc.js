/**
 * TMR CHAIN — Full RPC Server
 * Compatible with Web3 / ethers.js style calls
 * Deploy FREE on Render.com
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── TMR CHAIN CONFIG ──
const TMR_CHAIN = {
  chainId: '0x544D52', // TMR in hex
  chainIdDecimal: 5524050,
  chainName: 'TMR Chain Mainnet',
  nativeCurrency: {
    name: 'TMR Coin',
    symbol: 'TMR',
    decimals: 6,
  },
  rpcUrls: ['https://tmr-chain.onrender.com/rpc'],
  blockExplorerUrls: ['https://tmr-chain.vercel.app'],
  standard: 'TMR-20',
  algorandAssetId: 3620615556,
  wtmrAssetId: 3620615556,
  myvAssetId: 3620967448,
};

// ── MOCK BLOCKCHAIN STATE ──
let blockHeight = 62596272;
let transactions = [];
let tokens = {
  WTMR: {
    name: 'Treasury Management Reserve',
    symbol: 'WTMR',
    assetId: 3620615556,
    decimals: 1,
    totalSupply: 10000000000,
    network: 'Algorand',
  },
  MYV: {
    name: 'MultiChain Yield Venture',
    symbol: 'MYV',
    assetId: 3620967448,
    decimals: 6,
    totalSupply: 210000000,
    network: 'Algorand',
  },
  TMR: {
    name: 'TMR Coin',
    symbol: 'TMR',
    assetId: null,
    decimals: 6,
    totalSupply: 21000000000,
    network: 'TMR Chain',
  },
};

// Auto increment block
setInterval(() => { blockHeight++; }, 4000);

// ── ROOT ──
app.get('/', (req, res) => {
  res.json({
    name: '🏦 TMR Chain RPC',
    version: '1.0.0',
    status: 'online',
    chainId: TMR_CHAIN.chainId,
    chainIdDecimal: TMR_CHAIN.chainIdDecimal,
    standard: 'TMR-20',
    rpc: 'https://tmr-chain.onrender.com/rpc',
    explorer: 'https://tmr-chain.vercel.app',
    tokens: {
      WTMR: 3620615556,
      MYV: 3620967448,
    },
  });
});

// ── RPC ENDPOINT ──
app.post('/rpc', (req, res) => {
  const { method, params, id } = req.body;

  const respond = (result) => res.json({ jsonrpc: '2.0', id, result });
  const error = (msg) => res.json({ jsonrpc: '2.0', id, error: { code: -32600, message: msg } });

  switch (method) {

    case 'tmr_chainId':
    case 'eth_chainId':
      return respond(TMR_CHAIN.chainId);

    case 'net_version':
      return respond(String(TMR_CHAIN.chainIdDecimal));

    case 'eth_blockNumber':
    case 'tmr_blockNumber':
      return respond('0x' + blockHeight.toString(16));

    case 'eth_getBalance':
    case 'tmr_getBalance':
      return respond('0x' + (1000000 * 1e6).toString(16));

    case 'eth_gasPrice':
    case 'tmr_gasPrice':
      return respond('0x' + (1000).toString(16)); // 0.001 TMR

    case 'eth_estimateGas':
    case 'tmr_estimateGas':
      return respond('0x5208');

    case 'eth_getTransactionCount':
    case 'tmr_getTransactionCount':
      return respond('0x0');

    case 'tmr_getChainInfo':
      return respond(TMR_CHAIN);

    case 'tmr_getTokens':
      return respond(tokens);

    case 'tmr_getToken':
      const symbol = params && params[0];
      if (tokens[symbol]) return respond(tokens[symbol]);
      return error('Token not found');

    case 'tmr_getBlockHeight':
      return respond(blockHeight);

    case 'tmr_sendTransaction':
      const tx = {
        hash: '0x' + crypto.randomBytes(32).toString('hex'),
        from: params && params[0] && params[0].from,
        to: params && params[0] && params[0].to,
        value: params && params[0] && params[0].value,
        timestamp: Date.now(),
        status: 'confirmed',
        blockNumber: blockHeight,
      };
      transactions.push(tx);
      return respond(tx.hash);

    case 'tmr_getTransactions':
      return respond(transactions.slice(-10));

    case 'web3_clientVersion':
      return respond('TMRChain/v1.0.0');

    default:
      return error(`Method ${method} not supported`);
  }
});

// ── NETWORK INFO ──
app.get('/network', (req, res) => {
  res.json({
    ...TMR_CHAIN,
    blockHeight,
    status: 'online',
    uptime: process.uptime(),
  });
});

// ── ADD NETWORK (MetaMask/Trust Wallet format) ──
app.get('/add-network', (req, res) => {
  res.json({
    method: 'wallet_addEthereumChain',
    params: [{
      chainId: TMR_CHAIN.chainId,
      chainName: TMR_CHAIN.chainName,
      nativeCurrency: TMR_CHAIN.nativeCurrency,
      rpcUrls: TMR_CHAIN.rpcUrls,
      blockExplorerUrls: TMR_CHAIN.blockExplorerUrls,
    }],
  });
});

// ── TOKENS ──
app.get('/tokens', (req, res) => res.json(tokens));

app.get('/tokens/:symbol', (req, res) => {
  const token = tokens[req.params.symbol.toUpperCase()];
  if (!token) return res.status(404).json({ error: 'Token not found' });
  res.json(token);
});

// ── BLOCKS ──
app.get('/blocks/latest', (req, res) => {
  res.json({
    number: blockHeight,
    hash: '0x' + crypto.createHash('sha256').update(String(blockHeight)).digest('hex'),
    timestamp: Date.now(),
    transactions: transactions.slice(-5).length,
    network: 'TMR Chain',
  });
});

// ── HEALTH ──
app.get('/health', (req, res) => {
  res.json({ status: 'ok', blockHeight, uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║      TMR CHAIN RPC SERVER v1.0       ║
  ║      Standard: TMR-20                ║
  ╠══════════════════════════════════════╣
  ║  Port:     ${PORT}                        ║
  ║  ChainID:  ${TMR_CHAIN.chainId}              ║
  ║  RPC:      /rpc                      ║
  ║  Network:  /network                  ║
  ║  Tokens:   /tokens                   ║
  ╚══════════════════════════════════════╝
  `);
});

module.exports = app;

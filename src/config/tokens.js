// src/config/tokens.js
// Konfigurasi token yang dipantau

const TOKEN_CONFIG = {
  'UNI': {
    cgId: 'uniswap',
    name: 'Uniswap',
    symbol: 'UNI',
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
  },
  'LINK': {
    cgId: 'chainlink',
    name: 'Chainlink',
    symbol: 'LINK',
    address: '0x514910771AF9Ca656af840dff83E8264EcF986CA'
  },
  'PEPE': {
    cgId: 'pepe',
    name: 'Pepe',
    symbol: 'PEPE',
    address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933'
  }
};

module.exports = { TOKEN_CONFIG };

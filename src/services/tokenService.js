// src/services/tokenService.js
// Handles ERC-20 validation, metadata fetching, and Uniswap pool discovery

const { ethers } = require('ethers');
const { TokenStore } = require('../storage/tokenStore');

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

const UNISWAP_V2_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';

const V2_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) view returns (address pair)'
];

const V3_FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)'
];

const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

class TokenService {
  constructor(wssUrl, tokenStore) {
    this.provider = new ethers.WebSocketProvider(wssUrl);
    this.tokenStore = tokenStore || new TokenStore();
    
    this.v2Factory = new ethers.Contract(UNISWAP_V2_FACTORY, V2_FACTORY_ABI, this.provider);
    this.v3Factory = new ethers.Contract(UNISWAP_V3_FACTORY, V3_FACTORY_ABI, this.provider);
  }

  async validateAndAddToken(tokenAddress) {
    try {
      if (!ethers.isAddress(tokenAddress)) {
        throw new Error('Format alamat ERC-20 tidak valid');
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      
      const [symbol, decimals] = await Promise.all([
        tokenContract.symbol().catch(() => null),
        tokenContract.decimals().catch(() => null)
      ]);

      if (!symbol || decimals === null) {
        throw new Error('Kontrak tidak valid atau bukan ERC-20 standard');
      }

      let isNew = false;
      let tokenData = this.tokenStore.getToken(symbol);

      if (!tokenData) {
        // Discover Pools
        console.log(`[TokenService] Discovering pools for ${symbol}...`);
        const pools = await this.discoverPools(tokenAddress, symbol, decimals);

        if (pools.length === 0) {
          throw new Error(`Tidak ditemukan liquidity pool aktif untuk ${symbol}/WETH di Uniswap V2/V3`);
        }

        tokenData = {
          symbol: symbol.toUpperCase(),
          address: tokenAddress,
          decimals: Number(decimals),
          pools: pools
        };

        this.tokenStore.addToken(tokenData);
        isNew = true;
        console.log(`[TokenService] Successfully added ${symbol} with ${pools.length} pools`);
      }

      return { tokenData, isNew };
    } catch (err) {
      console.error(`[TokenService] Error adding token:`, err.message);
      throw err;
    }
  }

  async discoverPools(tokenAddress, symbol, tokenDecimals) {
    const pools = [];
    
    // Sort addresses for Token0 / Token1 logic (required by Uniswap if we want to know baseTokenIndex, but actually getPair/getPool handles any order)
    const tokenA = tokenAddress.toLowerCase();
    const tokenB = WETH_ADDRESS.toLowerCase();
    
    const isToken0 = tokenA < tokenB;

    // Check V2
    try {
      const v2Pair = await this.v2Factory.getPair(tokenAddress, WETH_ADDRESS);
      if (v2Pair && v2Pair !== ethers.ZeroAddress) {
        pools.push({
          address: v2Pair,
          dex: 'Uniswap V2',
          version: 2,
          token0Symbol: isToken0 ? symbol : 'WETH',
          token1Symbol: isToken0 ? 'WETH' : symbol,
          token0Decimals: isToken0 ? Number(tokenDecimals) : 18,
          token1Decimals: isToken0 ? 18 : Number(tokenDecimals),
          baseTokenIndex: isToken0 ? 1 : 0
        });
      }
    } catch (e) {}

    // Check V3 Fees: 0.05%, 0.3%, 1%
    const v3Fees = [
      { fee: 500, label: '0.05%' },
      { fee: 3000, label: '0.3%' },
      { fee: 10000, label: '1%' }
    ];

    for (const feeT of v3Fees) {
      try {
        const v3Pool = await this.v3Factory.getPool(tokenAddress, WETH_ADDRESS, feeT.fee);
        if (v3Pool && v3Pool !== ethers.ZeroAddress) {
          pools.push({
            address: v3Pool,
            dex: `Uniswap V3 (${feeT.label})`,
            version: 3,
            token0Symbol: isToken0 ? symbol : 'WETH',
            token1Symbol: isToken0 ? 'WETH' : symbol,
            token0Decimals: isToken0 ? Number(tokenDecimals) : 18,
            token1Decimals: isToken0 ? 18 : Number(tokenDecimals),
            baseTokenIndex: isToken0 ? 1 : 0
          });
        }
      } catch (e) {}
    }

    return pools;
  }
}

module.exports = { TokenService };

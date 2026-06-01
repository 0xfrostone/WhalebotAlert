// src/utils/helpers.js
// Helper functions umum

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const truncateAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const getCurrentTimeString = () => new Date().toLocaleTimeString('id-ID');

const isArrayEmpty = (arr) => !Array.isArray(arr) || arr.length === 0;

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

module.exports = {
  sleep,
  validateEmail,
  truncateAddress,
  getCurrentTimeString,
  isArrayEmpty,
  getRandomElement
};

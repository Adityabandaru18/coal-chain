/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      viaIR: true,
      optimizer: { enabled: true, runs: 1 },
    },
  },
  paths: {
    sources: "./contracts",   // put your .sol files in Contracts/contracts/
    artifacts: "./artifacts",
    cache: "./cache",
  },
};

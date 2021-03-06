require("dotenv").config();
import { BuidlerConfig, usePlugin, task, internalTask } from "@nomiclabs/buidler/config";
import { getConfig } from "./utils";
import SetProtocol from "setprotocol.js";
import BigNumber from 'bignumber.js';

usePlugin("@nomiclabs/buidler-waffle");
usePlugin("@nomiclabs/buidler-etherscan");
usePlugin("solidity-coverage");
usePlugin("@nomiclabs/buidler-web3");
usePlugin('buidler-deploy');

const INFURA_API_KEY = process.env.INFURA_API_KEY || "";
const KOVAN_PRIVATE_KEY = process.env.KOVAN_PRIVATE_KEY || "";
const MAINNET_PRIVATE_KEY = process.env.MAINNET_PRIVATE_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const RINKEBY_PRIVATE_KEY = process.env.RINKEBY_PRIVATE_KEY || "";

interface ExtendedBuidlerConfig extends BuidlerConfig {
  [x:string]: any
}

const config: ExtendedBuidlerConfig = {
  defaultNetwork: "buidlerevm",
  solc: {
    version: "0.6.4",
  },
  networks: {
    buidlerevm: {
      gasPrice: 0,
      blockGasLimit: 100000000,
    },
    kovan: {
      url: `https://kovan.infura.io/v3/${INFURA_API_KEY}`,
      gasPrice: 40000000000,
      accounts: [KOVAN_PRIVATE_KEY]
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
      gasPrice: 40000000000,
      accounts: [MAINNET_PRIVATE_KEY]
    },
    coverage: {
      url: 'http://127.0.0.1:8555' // Coverage launches its own ganache-cli client
    },
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${INFURA_API_KEY}`,
      accounts: [RINKEBY_PRIVATE_KEY]
    },
  },
  etherscan: {
    // The url for the Etherscan API you want to use.
    url: "https://api-rinkeby.etherscan.io/api",
    // Your API key for Etherscan
    // Obtain one at https://etherscan.io/
    apiKey: ETHERSCAN_API_KEY
  },
  typechain: {
    outDir: "typechain",
    target: "ethers"
  }
};

task("create-set", "Creates the initial (non rebalancing set)")
  .addParam("allocation", "path to the allocation")
  .addParam("symbol", "token symbol")
  .addParam("name", "token name")
  .setAction(async(taskArgs, {buidlerArguments, web3, network }) => {
    const allocation = (await import(taskArgs.allocation)).default;
    const config = getConfig(buidlerArguments.network);
    const setProtocol = new SetProtocol(web3, config);

    const componentAddresses = allocation.tokens.map(token => (token.address));
    const prices = allocation.tokens.map(token => (token.value));
    const allocations = allocation.tokens.map(token => (token.weight));

    const { units, naturalUnit } = await setProtocol.calculateSetUnitsAsync(
      componentAddresses,
      prices,
      allocations,
      allocation.initialValue,
    );
    
    const txOpts = {
      from: (await web3.eth.getAccounts())[0],
      gas: 4000000,
      gasPrice: network.config.gasPrice,
    };

    const txHash = await setProtocol.createSetAsync(
      componentAddresses,
      units,
      naturalUnit,
      `Initial ${taskArgs.name}`,
      `I ${taskArgs.symbol}`,
      txOpts,
    );

    const setAddress = await setProtocol.getSetAddressFromCreateTxHashAsync(txHash);
    
    console.log(`Base set deployed at: ${setAddress}`);

    return setAddress;
});

task("deploy-rebalancing-set", "Deploy rebalancing set token from allocation")
  .addParam("allocation", "path to allocation")
  .addParam("name", "name of the token")
  .addParam("symbol", "symbol of the token")
  .addParam("proposalPeriod", "length of the proposal period in seconds", "300")
  .addParam("rebalanceInterval", "length of the rebalance interval", "600")
  .setAction(async(taskArgs, {buidlerArguments, web3, run, network}) => {
    const config = getConfig(buidlerArguments.network);
    const setProtocol = new SetProtocol(web3, config);

    const initialSetAddress = await run("create-set", taskArgs);
    const initialUnitShares = new BigNumber(10 ** 10);
    
    const proposalPeriod = taskArgs.proposalPeriod;
    const rebalanceInterval = taskArgs.rebalanceInterval - proposalPeriod;

    const txOpts = {
      from: (await web3.eth.getAccounts())[0],
      gas: 4000000,
      gasPrice: network.config.gasPrice,
    };

    const txHash = await setProtocol.createRebalancingSetTokenAsync(
      (await web3.eth.getAccounts())[0],
      initialSetAddress,
      initialUnitShares,
      new BigNumber(proposalPeriod),
      new BigNumber(rebalanceInterval),
      taskArgs.name,
      taskArgs.symbol,
      txOpts
    );

    const rebalancingSetAddress = await setProtocol.getSetAddressFromCreateTxHashAsync(txHash);

    console.log(`Rebalancing set deployed at: ${rebalancingSetAddress}`);
});

task("mint-set", "Mints a rebalancing set token")
  .addParam("set", "address of the set token")
  .addParam("amount", "amount to mint")
  .setAction(async(taskArgs, {buidlerArguments, web3, run, network}) => {
    const config = getConfig(buidlerArguments.network);
    const setProtocol = new SetProtocol(web3, config);
    const txOpts = {
      from: (await web3.eth.getAccounts())[0],
      gas: 4000000,
      gasPrice: network.config.gasPrice,
    };

    const currentSet = (await setProtocol.setToken.getComponentsAsync(taskArgs.set))[0];
    const components = await setProtocol.setToken.getComponentsAsync(currentSet);

    const mintAmount = new BigNumber(taskArgs.amount * 10 ** 18);

    // Approve tokens
    for(const component of components) {
      const txHash = await setProtocol.setUnlimitedTransferProxyAllowanceAsync(
        component,
        txOpts
      );
      await setProtocol.awaitTransactionMinedAsync(txHash);
    }

    try {
      await setProtocol.rebalancingSetIssuance.issueRebalancingSet(
        taskArgs.set,
        mintAmount,
        false, // Setting this to true keeps the dust from the collateral Set in the Vault
        txOpts,
      );
    } catch (err) {
      throw new Error(`Error when minting set token: ${err}`);
    }

    console.log("Mint complete");
});

task("propose-rebalance", "Propose a rebalance to a new set")
  .addParam("set", "address of the set token")
  .addParam("nextSet", "address of the new allocation")
  // .addParam("auctionTimeToPivot", "length of manager defined portion of the auction")
  // .addParam("auctionStartPrice", "price the auction starts at")
  // .addParam("auctionPivotPrice", "price the manager defined portion of the auction terminates at")
  .setAction(async(taskArgs, {buidlerArguments, web3, run, network}) => {
    const config = getConfig(buidlerArguments.network);
    const setProtocol = new SetProtocol(web3, config);
    const auctionLibrary = config.linearAuctionPriceCurve;
    const auctionTimeToPivot = 3600; // 3600 seconds = 60 minutes

    const startPriceRatio = 0.90;
    const priceRatioStep = 0.005;

    const auctionPriceDivisor = 1000;
    const auctionStartPrice = startPriceRatio * auctionPriceDivisor // equals 900
    const auctionPivotPrice = auctionStartPrice + ((auctionTimeToPivot/60) * priceRatioStep) * auctionPriceDivisor // equals 1200

    const txOpts = {
      from: (await web3.eth.getAccounts())[0],
      gas: 4000000,
      gasPrice: network.config.gasPrice,
    };

    const txHash = await setProtocol.rebalancing.proposeAsync(
      taskArgs.set,   // rebalancingSetTokenAddress
      taskArgs.nextSet,  // nextSetAddress
      auctionLibrary,         // address of linear auction library
      new BigNumber(auctionTimeToPivot),
      new BigNumber(auctionStartPrice),
      new BigNumber(auctionPivotPrice),
      txOpts,
    );

    console.log(`Rebalance proposed tx: ${txHash}`);
});

task("start-rebalance", "starts rebalance after proposal period ended")
  .addParam("set", "address of the rebalancing set")
  .setAction(async(taskArgs, {buidlerArguments, web3, run, network}) => {
    const config = getConfig(buidlerArguments.network);
    const setProtocol = new SetProtocol(web3, config);

    const txOpts = {
      from: (await web3.eth.getAccounts())[0],
      gas: 4000000,
      gasPrice: network.config.gasPrice,
    };

    const txHash = await setProtocol.rebalancing.startRebalanceAsync(
      taskArgs.set,
      txOpts
    );

    console.log(`Rebalance started tx: ${txHash}`);
});

task("submit-bid", "Submit a bit to the dutch auction rebalance")
  .addParam("set", "address of the rebalancing set")
  .addParam("amount", "amount to rebalance")
  .setAction(async(taskArgs, {buidlerArguments, web3, run, network}) => {
    const config = getConfig(buidlerArguments.network);
    const setProtocol = new SetProtocol(web3, config);

    const txOpts = {
      from: (await web3.eth.getAccounts())[0],
      gas: 4000000,
      gasPrice: network.config.gasPrice,
    };

    const txHash = await setProtocol.rebalancing.bidAsync(
      taskArgs.set,
      new BigNumber(taskArgs.amount * 10 ** 18),
      true,
      true,
      txOpts
    );

    console.log(`Bid submitted tx: ${txHash}`);
});

task("settle-rebalance", "Submit a rebalance")
  .addParam("set")
  .setAction(async(taskArgs, {buidlerArguments, web3, run, network}) => {
    const config = getConfig(buidlerArguments.network);
    const setProtocol = new SetProtocol(web3, config);

    const txOpts = {
      from: (await web3.eth.getAccounts())[0],
      gas: 4000000,
      gasPrice: network.config.gasPrice,
    };

    const txHash = await setProtocol.rebalancing.settleRebalanceAsync(
      taskArgs.set, // rebalancingSetTokenAddress
      txOpts
    );

    console.log(`Rebalance settled: ${txHash}`);
});

export default config;
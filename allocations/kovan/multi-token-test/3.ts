
import BigNumber from 'bignumber.js';

export default {
    initialValue: new BigNumber(12.08219837),
    tokens: [
        {
            name: "DAI",
            decimals: 18,
            address: "0xF091720Dea579d7Eec922d8B2A3A67ba522CCf6D",
            weight: new BigNumber(0.32),
            value: new BigNumber(1.0017612588),
        },
        {
            name: "USDC",
            decimals: 6,
            address: "0x15758350DECEA0E5A96cFe9024e3f352d039905a",
            weight: new BigNumber(0.32),
            value: new BigNumber(0.9982437636),
        },
        {
            name: "WBTC",
            decimals:  8,
            address: "0x595f8DaB94b9c718cbf5c693cD539Fd00b286D3d",
            weight: new BigNumber(0.11),
            value: new BigNumber(8513.7995771015),
        },
        {
            name: "WETH",
            decimals: 18,
            address: "0x8a18c7034aCEfD1748199a58683Ee5F22e2d4e45",
            weight: new BigNumber(0.25),
            value: new BigNumber(218.1263167871),
        }
    ]
}


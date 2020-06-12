
import BigNumber from 'bignumber.js';

export default {
    initialValue: new BigNumber(1.05),
    tokens: [
        {
            name: "WBTC",
            decimals:  8,
            address: "0x595f8DaB94b9c718cbf5c693cD539Fd00b286D3d",
            weight: new BigNumber(0.77),
            value: new BigNumber(1100.63),
        },
        {
            name: "USDC",
            decimals: 6,
            address: "0x15758350DECEA0E5A96cFe9024e3f352d039905a",
            weight: new BigNumber(0.23),
            value: new BigNumber(1),
        }
    ]
}



import BigNumber from 'bignumber.js';

export default {
    initialValue: new BigNumber(1),
    tokens: [
        {
            name: "TEST1",
            decimals: 8,
            address: "0x10D91508A4FAc3B36F08B0795FB1AEB951e1C6A9",
            weight: new BigNumber(0.99),
            value: new BigNumber(1),
        },
        {
            name: "TEST2",
            decimals: 8,
            address: "0x65ED29490f41CA6b85FdC772E7887E54F42F543a",
            weight: new BigNumber(0.01),
            value: new BigNumber(1),
        }
    ]
}


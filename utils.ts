export const getConfig = (network) => {
    switch(network) {
        case "mainnet":
            return require("./config/mainnet").default;
        case "kovan":
            return require("./config/kovan").default;
        default: 
            throw new Error("Config for network not found");
    }
}
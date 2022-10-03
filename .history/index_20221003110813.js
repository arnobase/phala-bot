const { ApiPromise, WsProvider } = require('@polkadot/api');

(async () => {
    // Construct
    const wsProvider = new WsProvider('wss://public-rpc.pinknode.io/khala');
    const api = await ApiPromise.create({ provider: wsProvider });

    // Do something
    let my_pool = await api.query.phalaStakePool.stakePools(3106);
    console.log(my_pool.totalShares);
})();
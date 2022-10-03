const { ApiPromise, WsProvider } = require('@polkadot/api');
const util = require('util');
const BN = require('bn.js');
const bn1e12 = new BN(10).pow(new BN(12));

// Simply returns the integer part of the PHA value
function pha(value) {
    return value.div(bn1e12).toNumber();
}

(async () => {
    // Construct
    const wsProvider = new WsProvider('wss://public-rpc.pinknode.io/khala');
    const api = await ApiPromise.create({ provider: wsProvider });

    // Do something
    let pool_pid = 3106;

    let status = {
        cap: 0,
        releasing: 0,
        free: 0,
        totalShares: 0,
        totalStake: 0,
    };
    // Try to add pool and withdraw infomation
    let poolInfo = await api.query.phalaStakePool.stakePools(pool_pid);
    if (poolInfo.isSome) {
        poolInfo = poolInfo.unwrap();
        const w = poolInfo.withdrawQueue.find(r => r.user.toString() == account);
        status = {
            ...status,
            cap: poolInfo.cap,
            releasing: pha(poolInfo.releasingStake),
            free: pha(poolInfo.freeStake),
            totalShares: pha(poolInfo.totalShares),
            totalStake: pha(poolInfo.totalStake),
        };
    }

    console.log(status);
    return;
})();
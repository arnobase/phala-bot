const { ApiPromise, WsProvider } = require('@polkadot/api');
const util = require('util');

(async () => {
    // Construct
    const wsProvider = new WsProvider('wss://public-rpc.pinknode.io/khala');
    const api = await ApiPromise.create({ provider: wsProvider });

    // Do something
    let pool_pid = '3106';

    let status = {
        releasing: 0,
        free: 0,
        lockedInPool: 0,
        withdrawing: 0,
        startTime: ''
    };
    // Try to add pool and withdraw infomation
    let poolInfo = await api.query.phalaStakePool.stakePools(pool_pid);
    if (poolInfo.isSome) {
        poolInfo = poolInfo.unwrap();
        const w = poolInfo.withdrawQueue.find(r => r.user.toString() == account);
        status = {
            ...status,
            releasing: pha(poolInfo.releasingStake),
            free: pha(poolInfo.freeStake),
            withdrawing: w ? pha(w.shares) : 0,
            startTime: w ? date(w.startTime) : '',
        };
    }

    console.log(status);
})();
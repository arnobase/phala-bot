#!/usr/bin/env node

const argv = require('yargs/yargs')(process.argv.slice(2))
    .alias('i', 'info')
    .alias('c', 'claim')
    .alias('s', 'stake')
    .alias('r', 'restart')
    .alias('d', 'debug')
    .argv;

const util = require('util');
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const utils = require('./utils.js');
const config = require('./config.js');
const keyring = new Keyring({ type: 'sr25519' });
const { phalaTypes } = require ( '@phala/typedefs');

let pool_status = {
    cap: 0,
    releasing: 0,
    free: 0,
    totalShares: 0,
    totalStake: 0,
    rewardAcc: 0,
    stakable: 0
};
let staker_status = {
    free: 0,
    frozen: 0,
    lockedInPool: 0,
    total: 0,
    shares: 0,
    availableRewards: 0,
    rewardDebt: 0
};

async function signAndSend(tx,account) {
    /* https://github.com/Phala-Network/phala-blockchain/blob/68e8994d1517c6253e9330ab903fe76fac72df2d/scripts/js/bugfix-tools/dumpLockChart.js#L30 */
    let exit_status = 0;
    const unsub = await tx.signAndSend(account, ({ events = [], status, txHash }) => {
        if (status.isInBlock) {
            console.log('Successful \n\tin block '+ status.asInBlock.toHex() + "\n\ttx hash: "+txHash);
        } else {
            console.log('Status of tx: ' + status.type);
        }
        events.forEach(({ phase, event: { data, method, section } }) => {
            console.log("\tExtrinsic: "+phase.toString() + ' : ' + section + '.' + method + ' ' + data.toString());
            exit_status = (method === "ExtrinsicFailed" ? 1 : 0);
        });
        if (status.isFinalized) {
            console.log("\nexit_status: "+exit_status)
            process.exit(exit_status);
        }
        setTimeout(() => {
            console.log('No response in 60 sec... exiting');
            process.exit(1);
        }, 60000);
    });
    return unsub;
}

async function checkStatus(api) {
    // First, get info about the pool
    let poolInfo = await api.query.phalaStakePool.stakePools(config.pool_pid);
    if (poolInfo.isSome) {
        poolInfo = poolInfo.unwrap();
        //const w = poolInfo.withdrawQueue.find(r => r.user.toString() == account);
        if (poolInfo.cap.isSome) {
            pool_status.cap = utils.pha(poolInfo.cap.unwrap());
        }
        pool_status = {
            ...pool_status,
            //cap: utils.pha(cap),
            releasing: utils.pha(poolInfo.releasingStake),
            free: utils.pha(poolInfo.freeStake),
            totalShares: utils.pha(poolInfo.totalShares),
            totalStake: utils.pha(poolInfo.totalStake),
            rewardAcc: BigInt(poolInfo.rewardAcc),
            stakable: pool_status.cap - utils.pha(poolInfo.totalStake)
        };
        console.log("POOL Status :")
        console.log(pool_status);
    }
    // secondly, get info about the staking account
    const STAKER = keyring.addFromUri(config.staker_seed);
    keyring.setSS58Format(30);
    const staker_address = STAKER.address;
    let stakerInfo = await api.query.system.account(staker_address);
    staker_status = {
        ...staker_status,
        free: utils.pha(stakerInfo.data.free) - utils.pha(stakerInfo.data.miscFrozen),
        frozen: utils.pha(stakerInfo.data.miscFrozen),
        total: utils.pha(stakerInfo.data.free),
    };
    // Finaly, get info about the staking into the pool (to get the rewards amount)
    let stakeInPoolInfo = await api.query.phalaStakePool.poolStakers([config.pool_pid ,staker_address]);
    if (stakeInPoolInfo.isSome) {
        stakeInPoolInfo = stakeInPoolInfo.unwrap()
    }
    staker_status = {
        ...staker_status,
        shares: BigInt(stakeInPoolInfo.shares),
        availableRewards: BigInt(stakeInPoolInfo.availableRewards),
        rewardDebt: BigInt(stakeInPoolInfo.rewardDebt),
        lockedInPool: utils.pha(stakeInPoolInfo.locked)
    }
    console.log(staker_status.shares,pool_status.rewardAcc,staker_status.rewardDebt,staker_status.availableRewards)
    const pendingRewards = (staker_status.shares*pool_status.rewardAcc) - staker_status.rewardDebt + staker_status.availableRewards
    staker_status.pendingRewards = pendingRewards
    console.log("STAKER Status :")
    console.log(staker_status)

    const pool_stakable = pool_status.stakable;
    const staker_free = staker_status.free
    
    if ( pendingRewards > 0 && staker_free <= pool_stakable) {
        const stake_amount = staker_free-1
        console.log("\nSTAKABLE amount : "+stake_amount * 1e9)
    }
}

/**
 * 
 * @param {*} api
 * 
 * claims all rewards from staking account 'STAKER'
 */
async function claimStakingRewards(api) {
    const STAKER = keyring.addFromUri(config.staker_seed);
    const pool_id = config.pool_pid;
    keyring.setSS58Format(30);
    const staker_address = STAKER.address;

    if (!argv.debug) {
        const tx = await api.tx.phalaStakePool.claimRewards(pool_id, staker_address)
        const unsub = signAndSend(tx,STAKER);
    }
}

async function stakeFreeAmount(api) {
    const STAKER = keyring.addFromUri(config.staker_seed);
    const pool_id = config.pool_pid;

    const pool_stakable = pool_status.stakable;
    const staker_free = staker_status.free
   
    let stake_amount = (staker_free-1)
    if ( stake_amount > 0 && staker_free <= pool_stakable) {
        
        // Si on passe un chiffre en param de stake, on vérifie qu'il est inférieur aux max free sur la pool
        if (typeof argv.stake === "number") {
            if (argv.stake > staker_free-1) {
                stake_amount = staker_free-1
            }
            else {
                stake_amount=argv.stake
            }
        }
    }
    else {
        console.log("rien à stake")
        process.exit(1)
    }
    
    console.log("stakeamount: "+stake_amount)

    if (!argv.debug && stake_amount > 0) {
        const tx = await api.tx.phalaStakePool.contribute(pool_id, stake_amount*1e12)
        const unsub = signAndSend(tx,STAKER);
    }
}

async function restartMining(api) {
    const POOLOWNER = keyring.addFromUri(config.pool_owner_seed);
    const pool_id = config.pool_pid;
    const totalStake = BigInt(pool_status.totalStake*1e12);
    const worker = config.workerKey

    console.log(totalStake)
    if (!argv.debug) {
        const tx = await api.tx.phalaStakePool.restartMining(pool_id, worker, totalStake)
        const unsub = signAndSend(tx,POOLOWNER);
    }
}

(async () => {
    const wsProvider = new WsProvider('wss://public-rpc.pinknode.io/khala');
    const api = await ApiPromise.create({ provider: wsProvider, types: phalaTypes });
    await checkStatus(api);
    let kill=true;
    if (argv.claim) {
        console.log("\n## Claim rewards")
        await claimStakingRewards(api);
        kill=false;
    }
    if (argv.stake) {
        console.log("\n## Stake rewards")
        await stakeFreeAmount(api);
        kill=false
    }
    if (argv.restart) {
        console.log("\n## Restart mining")
        await restartMining(api);
        kill=false
    }
    
    // si on n'a apellé aucune methode, il n'y a eu que status, on kill
    if (kill) {
        process.exit();
    }
})();
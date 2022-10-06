#!/usr/bin/env node
const argv = require('yargs/yargs')(process.argv.slice(2))
    .alias('i', 'info')
    .alias('c', 'claim')
    .alias('s', 'stake')
    .alias('r', 'restart')
    .alias('d', 'debug')
    .argv;

/*
https://github.com/Phala-Network/phala-blockchain/blob/68e8994d1517c6253e9330ab903fe76fac72df2d/scripts/js/bugfix-tools/dumpLockChart.js#L30
*/

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const utils = require('./utils.js');
const config = require('./config.js');
const keyring = new Keyring({ type: 'sr25519' });
const tx_end = false;

let pool_status = {
    cap: 0,
    releasing: 0,
    free: 0,
    totalShares: 0,
    totalStake: 0,
    stakable: 0
};
let staker_status = {
    free: 0,
    frozen: 0,
    total: 0,
};

async function checkStatus(api) {
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
            stakable: pool_status.cap - utils.pha(poolInfo.totalStake)
        };
        console.log("POOL Status :")
        console.log(pool_status);
    }
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
    console.log("STAKER Status :")
    console.log(staker_status)
    
    const pool_stakable = pool_status.stakable;
    const staker_free = staker_status.free
    if ( staker_free <= pool_stakable) {
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
        const unsub = await tx.signAndSend(STAKER, ({ events = [], status, txHash }) => {
            if (status.isInBlock) {
                console.log('Successful \n\tin block '+ status.asInBlock.toHex() + "\n\ttx hash: "+txHash);
            } else {
                console.log('Status of tx: ' + status.type);
            }
            events.forEach(({ phase, event: { data, method, section } }) => {
                console.log("\tExtrinsic: "+phase.toString() + ' : ' + section + '.' + method + ' ' + data.toString());
            });
            if (status.isFinalized) {
                //unsub();
                process.exit();
            }
            setTimeout(() => {
                //unsubscribe();
                console.log('No response in 60 sec... exiting');
                process.exit();
            }, 60000);
        });
    }
}

async function stakeFreeAmount(api) {
    const STAKER = keyring.addFromUri(config.staker_seed);
    const pool_id = config.pool_pid;

    const pool_stakable = pool_status.stakable;
    const staker_free = staker_status.free
    let stake_amount=0
    if ( staker_free <= pool_stakable) {
        stake_amount = (staker_free-1)
        // Si on passe un chiffre en param de stake, on vérifie qu'il est inférieur aux max free sur la pool
        if (typeof argv.stake === "number") {
            if (argv.stake > staker_free-1) {
                stake_amount=staker_free-1
            }
            else {
                stake_amount=argv.stake
            }
        }
    }
    
    console.log(typeof argv.stake === "number")
    console.log("stakeamount: "+stake_amount)

    if (!argv.debug) {
        const tx = await api.tx.phalaStakePool.contribute(pool_id, stake_amount*1e12)
        const unsub = await tx.signAndSend(STAKER, ({ events = [], status, txHash }) => {
            if (status.isInBlock) {
                console.log('Successful \n\tin block '+ status.asInBlock.toHex() + "\n\ttx hash: "+txHash);
            } else {
                console.log('Status of tx: ' + status.type);
            }
            events.forEach(({ phase, event: { data, method, section } }) => {
                console.log("\tExtrinsic: "+phase.toString() + ' : ' + section + '.' + method + ' ' + data.toString());
            });
            if (status.isFinalized) {
                //unsub();
                process.exit();
            }
            setTimeout(() => {
                //unsubscribe();
                console.log('No response in 60 sec... exiting');
                process.exit();
            }, 60000);
        });
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
        const unsub = await tx.signAndSend(POOLOWNER, ({ events = [], status, txHash }) => {
            if (status.isInBlock) {
                console.log('Successful \n\tin block '+ status.asInBlock.toHex() + "\n\ttx hash: "+txHash);
            } else {
                console.log('Status of tx: ' + status.type);
            }
            events.forEach(({ phase, event: { data, method, section } }) => {
                console.log("\tExtrinsic: "+phase.toString() + ' : ' + section + '.' + method + ' ' + data.toString());
            });
            if (status.isFinalized) {
                //unsub();
                process.exit();
            }
            setTimeout(() => {
                //unsubscribe();
                console.log('No response in 60 sec... exiting');
                process.exit();
            }, 60000);
        });
    }
}

(async () => {
    const wsProvider = new WsProvider('wss://public-rpc.pinknode.io/khala');
    const api = await ApiPromise.create({ provider: wsProvider });
    await checkStatus(api);
    let kill=true;
    if (argv.claim) {
        console.log("\nclaim rewards")
        await claimStakingRewards(api);
        kill=false;
    }
    if (argv.stake) {
        console.log("\nstake rewards")
        await stakeFreeAmount(api);

        kill=false
    }
    if (argv.restart) {
        console.log("\nrestart mining")
        await restartMining(api);
        kill=false
    }
    
    // si on n'a apellé aucune methode, il n'y a eu que status, on kill
    if (kill) {
        process.exit();
    }
})();
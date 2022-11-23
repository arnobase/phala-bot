#!/usr/bin/env node

const argv = require('yargs/yargs')(process.argv.slice(2))
.alias('i', 'info')
.alias('c', 'claim')
.alias('p', 'claimpool')
.alias('s', 'stake')
.alias('r', 'restart')
.alias('d', 'debug')
.alias('v', 'verbose')
.argv;

const BigNumber = require('bignumber.js');
const util = require('util');
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const utils = require('./utils.js');
const config = require('./config.js');
const keyring = new Keyring({ type: 'sr25519' });
const { phalaTypes } = require ( '@phala/typedefs');
const { RegistryTypes } = require ('@polkadot/types/types');
//const { exit } = require('process');
let api = undefined;
let metadata = undefined;
//const nodemailer = require('nodemailer');

let pool_status = {
    cap: 0,
    releasing: 0,
    free: 0,
    totalShares: 0,
    totalStake: 0,
    rewardAcc: 0,
    ownerReward: 0,
    stakable: 0
};
let staker_status = {
    free: 0,
    frozen: 0,
    lockedInPool: 0,
    total: 0,
    shares: 0,
    availableRewards: 0,
    rewardDebt: 0,
    pendingRewards: 0
};

async function proxyTx(api,tx,proxied_addr,type='Any') {
    return api.tx.proxy.proxy(
        proxied_addr,
        type,
        tx
    );
}

async function getMetadata(api) {
    let metadata = await api.rpc.state.getMetadata();
    metadata = JSON.parse(JSON.stringify(metadata.asLatest.toHuman(), null, 2));
    return metadata;
}

function getErrorDescription(errindex,errno) {
    //console.log("#####",metadata['lookup']['types'])
    const pallet = metadata.pallets.find(ele => ele.index == errindex)
    //console.log(pallet)
    const type = metadata['lookup']['types'].find((ele => ele.id == pallet.errors.type))
    const variant = type['type']['def']['Variant']['variants'].find(ele => ele.index == errno)
    const description = variant['docs'].join(' ');
    return description;
}

async function signAndSend(tx,account) {
    let exit_status = 0;
    await tx.signAndSend(account, ({ events = [], status, txHash }) => {
        if (status.isInBlock) {
            console.log('Transaction sent');
            console.log("https://khala.subscan.io/extrinsic/"+txHash)
        } else {
            process.stdout.write(status.type +"... \033[0G");
            //console.log('Status of tx: ' + status.type);
        }
        let tx_failed=0;
        let proxy_failed=undefined;
        let message=["\n"]
        events.forEach(({ phase, event: { data, method, section } }) => {
            if (argv.verbose) {
                message.push("\tExtrinsic: "+phase.toString() + ' : ' + section + '.' + method + ' ' + data.toString())
                //console.log("\tExtrinsic: "+phase.toString() + ' : ' + section + '.' + method + ' ' + data.toString());
            }
            if (method === "ProxyExecuted" ){
                let data_obj = JSON.parse(data.toString())
                proxy_failed = (typeof data_obj[0].err === "undefined" ? false : true);
                if (proxy_failed) {
                    let errindex = data_obj[0]['err']['module']['index']
                    let errno = parseInt(data_obj[0]['err']['module']['error'].substr(2, 2),16);
                    //console.log(utils.red("Proxy tx error: "+getErrorDescription(errindex,errno)))
                    message.push(utils.red("Proxy tx error: "+getErrorDescription(errindex,errno)))
                }
            }
            if (method === "ExtrinsicFailed") {
                let data_obj = JSON.parse(data.toString())
                let errindex = data_obj[0]['module']['index']
                let errno = parseInt(data_obj[0]['module']['error'].substr(2, 2),16);
                //console.log("err:",errindex,errno)
                //console.log(utils.red("Tx error: "+getErrorDescription(errindex,errno)))
                message.push(utils.red("Tx error: "+getErrorDescription(errindex,errno)))
                tx_failed = 1
            }
            exit_status = (!proxy_failed && !tx_failed ? 0 : 1);
            /** specific for claiming rewards */
            if (method === "RewardsWithdrawn") {
                let data_obj = JSON.parse(data.toString())
                let rewards_claim_amount = data_obj[2];
                //console.log(utils.green("Claimed "+utils.formatPha(rewards_claim_amount)));
                message.push(utils.green("Claimed "+utils.formatPha(rewards_claim_amount)));
            }
        });
        if (status.isFinalized) {
            let proxy_mess = (typeof proxy_failed!=="undefined" ? "Proxy tx: "+(proxy_failed ? utils.red("Fail") : utils.green("Success"))+"\n" : "");
            let tx_mess = typeof tx_failed!=="undefined" ? "Extrinsic: "+(tx_failed ? utils.red("Fail") : utils.green("Success")) : "";
            //console.log(proxy_mess+tx_mess)
            //console.log("\nexit_status: "+exit_status);
            message.push(proxy_mess+tx_mess)
            message.push("\nexit_status: "+exit_status);
            console.log(message.join("\n"))
            process.exit(exit_status);
        }
        setTimeout(() => {
            console.log(utils.red('No response in 180 sec... exiting'));
            process.exit(1);
        }, 180000);
    });
}

async function checkStatus(api) {
    // First, get info about the pool
    let poolInfo = await api.query.phalaStakePool.stakePools(config.pool_pid);
    if (poolInfo.isSome) {
        poolInfo = poolInfo.unwrap();
        //const w = poolInfo.withdrawQueue.find(r => r.user.toString() == account);
        if (poolInfo.cap.isSome) {
            pool_status.cap = poolInfo.cap.unwrap();
        }
        pool_status = {
            ...pool_status,
            //cap: utils.pha(cap),
            releasing: poolInfo.releasingStake,
            free: poolInfo.freeStake,
            totalShares: poolInfo.totalShares,
            totalStake: poolInfo.totalStake,
            rewardAcc: BigNumber(poolInfo.rewardAcc),
            ownerReward: poolInfo.ownerReward,
            stakable: BigNumber(pool_status.cap) - BigNumber(poolInfo.totalStake)
        };
    }
    // secondly, get info about the staking account
    let staker_address;
    if (typeof config.staker_addr === "undefined" || config.staker_addr === "") {
        const STAKER = keyring.addFromUri(config.staker_seed);
        keyring.setSS58Format(30);
        staker_address = STAKER.address;
    }
    else {
        staker_address = config.staker_addr;
    }
    
    let stakerInfo = await api.query.system.account(staker_address);
    staker_status = {
        ...staker_status,
        free: stakerInfo.data.free - stakerInfo.data.miscFrozen,
        frozen: stakerInfo.data.miscFrozen,
        total: stakerInfo.data.free,
    };
    // Finaly, get info about the staking into the pool (to get the rewards amount)
    let stakeInPoolInfo = await api.query.phalaStakePool.poolStakers([config.pool_pid ,staker_address]);
    if (stakeInPoolInfo.isSome) {
        stakeInPoolInfo = stakeInPoolInfo.unwrap();
    }
    staker_status = {
        ...staker_status,
        shares: BigNumber(stakeInPoolInfo.shares),
        availableRewards: BigNumber(stakeInPoolInfo.availableRewards),
        rewardDebt: BigNumber(stakeInPoolInfo.rewardDebt),
        lockedInPool: stakeInPoolInfo.locked,
    }
    staker_status = {
        ...staker_status,
        // pending rewards : shares * (rewardAcc / 2^64) - rewardDebt
        pendingRewards: (staker_status.shares * BigNumber(pool_status.rewardAcc / Math.pow(2,64))) - staker_status.rewardDebt
    }
    //console.log(staker_status.shares,pool_status.rewardAcc,staker_status.rewardDebt,staker_status.availableRewards)
    //const pendingRewards = (staker_status.shares*pool_status.rewardAcc) - staker_status.rewardDebt + staker_status.availableRewards
    //staker_status.pendingRewards = pendingRewards
   
    console.log("\n"+utils.bright("Pool "+config.pool_pid+" status ").padEnd(56,"-"));
    console.log("Maximum capacity: ".padStart(31)+utils.formatPha(pool_status.cap));
    console.log("Total staked: ".padStart(31)+utils.formatPha(pool_status.totalStake));
    console.log("Stake available: ".padStart(31)+utils.formatPha(pool_status.stakable));
    console.log("Pool owner rewards: ".padStart(31)+utils.formatPha(pool_status.ownerReward));
    console.log("staked no worker: ".padStart(31)+utils.formatPha(pool_status.free));
    //console.log("totalShares: ".padStart(31)+pool_status.totalShares);
    //console.log("totalStake: ".padStart(31)+pool_status.totalStake);
    //console.log("rewardAcc: ".padStart(31)+pool_status.rewardAcc); 
    console.log("\n"+utils.bright("Staking account status ").padEnd(56,"-"));
    console.log(staker_address)
    console.log("Total balance: ".padStart(31)+utils.formatPha(staker_status.total));
    console.log("Locked in pool: ".padStart(31)+utils.formatPha(staker_status.lockedInPool));
    console.log("Free balance: ".padStart(31)+utils.formatPha(staker_status.free));
    //console.log("rewardDebt: ".padStart(31)+staker_status.rewardDebt);
    //console.log("availableRewards ".padStart(31)+staker_status.availableRewards);
    //console.log("shares ".padStart(31)+staker_status.shares);   
    console.log("Pending Rewards: ".padStart(31)+utils.formatPha(staker_status.pendingRewards));
    console.log();
}

/**
 * 
 * @param {*} api
 * 
 * claims all rewards from staking account 'STAKER'
 */
async function claimStakingRewards(api) {
    if (utils.pha(staker_status.pendingRewards) > 1) {
        let staker_address;
        let use_proxy;
        if (typeof config.proxy_seed === "undefined" || config.proxy_seed === "") {
            const STAKER = keyring.addFromUri(config.staker_seed);
            keyring.setSS58Format(30);
            staker_address = STAKER.address;
            use_proxy=false;
        }
        else {
            staker_address = config.staker_addr;
            use_proxy=true;
        }
        const pool_id = config.pool_pid;
        if (!argv.debug) {
            let tx = await api.tx.phalaStakePool.claimRewards(pool_id, staker_address);
            let SIGNER;
            if (use_proxy) {
                tx = await proxyTx(api,tx,staker_address,type='Any');
                SIGNER = keyring.addFromUri(config.proxy_seed) 
                console.log("PROXY!")
            }
            else {
                SIGNER = keyring.addFromUri(config.staker_seed);
            }
            await signAndSend(tx,SIGNER);
        }
    }
    else {
        console.log("Nothing to claim")
        process.exit(1)
    }
}

async function claimPoolOwnerRewards(api) {
    if (utils.pha(pool_status.ownerReward) > 1) {
        let staker_address;
        let pool_owner_addr;
        let use_proxy;
        if (typeof config.proxy_seed === "undefined" || config.proxy_seed === "") {
            const STAKER = keyring.addFromUri(config.staker_seed);
            const POOLOWNER = keyring.addFromUri(config.pool_owner_seed);
            keyring.setSS58Format(30);
            staker_address = STAKER.address;
            pool_owner_address = POOLOWNER.address;
            use_proxy=false;
        }
        else {
            staker_address = config.staker_addr;
            pool_owner_address = config.pool_owner_addr;
            use_proxy=true;
        }
        const pool_id = config.pool_pid;
        if (!argv.debug) {
            let tx = await api.tx.phalaStakePool.claimOwnerRewards(pool_id, staker_address);
            let SIGNER;
            if (use_proxy) {
                tx = await proxyTx(api,tx,pool_owner_address,type='Any');
                SIGNER = keyring.addFromUri(config.proxy_seed) 
                console.log("PROXY!")
            }
            else {
                SIGNER = keyring.addFromUri(config.pool_owner_seed);
            }
            console.log("pool_owner_address",pool_owner_address)
            console.log("staker_address",staker_address)
            keyring.setSS58Format(30);
            console.log("proxy_address",SIGNER.address)
            await signAndSend(tx,SIGNER);
        }
    }
    else {
        console.log("Nothing to claim")
        process.exit(1)
    }
}

async function stakeFreeAmount(api) {

    const pool_id = config.pool_pid;
    const pool_stakable = pha(pool_status.stakable);
    const staker_free = pha(staker_status.free);

    let stake_amount = (staker_free-config.keep_available)
    if ( stake_amount > 0) {
        // If we give an amount in argv, we check it's lower than the max amount we want to stake
        if (typeof argv.stake === "number") {
            if (argv.stake <= stake_amount) {
                stake_amount=argv.stake
            }
            if (stake_amount > pool_stakable) {
                console.log("can stake a maximum of "+pool_stakable+ "("+"tried to stake "+argv.stake+")")
                process.exit(1)
            }
        }
        // stake amount can't be higher than pool_stakable
        stake_amount = Math.min(stake_amount,pool_stakable);
        console.log("stake_amount:",stake_amount);
    }
    else {
        console.log("Nothing to stake")
        process.exit(1)
    }
    
    console.log("You will stake: "+stake_amount);

    if (!argv.debug && stake_amount > 0) {
        let tx = await api.tx.phalaStakePool.contribute(pool_id, stake_amount*1e12);
        let SIGNER;
        if (typeof config.proxy_seed === "undefined" || config.proxy_seed === "") {
            SIGNER = keyring.addFromUri(config.staker_seed);
        }
        else {
            tx = await proxyTx(api,tx,config.staker_addr,type='Any');
            SIGNER = keyring.addFromUri(config.proxy_seed) 
            console.log("PROXY!")
        }
        signAndSend(tx,SIGNER);
    }
}

async function restartMining(api) {
    const POOLOWNER = keyring.addFromUri(config.pool_owner_seed);
    const pool_id = config.pool_pid;
    const totalStake = BigNumber(pool_status.totalStake*1e12);
    const worker = config.workerKey;

    console.log(totalStake)
    if (!argv.debug) {
        let tx = await api.tx.phalaStakePool.restartMining(pool_id, worker, totalStake);
        let SIGNER;
        if (typeof config.proxy_seed === "undefined" || config.proxy_seed === "") {
            SIGNER = keyring.addFromUri(config.pool_owner_seed);
        }
        else {
            tx = await proxyTx(api,tx,config.pool_owner_addr,"Any");
            SIGNER = keyring.addFromUri(config.proxy_seed);
            console.log("PROXY!")
        }
        signAndSend(tx,SIGNER);
    }
}

(async () => {
    if (argv.claim && argv.stake || argv.claim && argv.restart || argv.stake && argv.restart ){
        console.log("Claim, Stake and Restart can't be launched with another operation, just one by one");
        process.exit();
    }
    const wsProvider = new WsProvider('wss://khala-api.phala.network/ws'); 
    api = await ApiPromise.create({ 
        provider: wsProvider, 
        types: RegistryTypes, 
        noInitWarn: true, 
        initWasm: false
    });
    metadata = await getMetadata(api);
    await checkStatus(api);
    let kill=true;
    if (argv.claim) {
        console.log(utils.bright("\n## Claim rewards"));
        await claimStakingRewards(api);
        kill=false;
    }
    if (argv.claimpool) {
        console.log(utils.bright("\n## Claim pool owner rewards"));
        await claimPoolOwnerRewards(api);
        kill=false;
    }
    if (argv.stake) {
        console.log(utils.bright("\n## Stake rewards"));
        await stakeFreeAmount(api);
        kill=false;
    }
    if (argv.restart) {
        console.log(utils.bright("\n## Restart mining"));
        await restartMining(api);
        kill=false;
    }
    if (kill) {
        process.exit();
    }
})();
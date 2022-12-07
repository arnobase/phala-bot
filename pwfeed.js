#!/usr/bin/env node

const argv = require('yargs/yargs')(process.argv.slice(2))
.alias('f', 'fromaddr')
.alias('t', 'toid')
.argv;

const BigNumber = require('bignumber.js');
const util = require('util');
const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const utils = require('./utils.js');
const config = require('./config.js');
const keyring = new Keyring({ type: 'sr25519' });
const { phalaTypes } = require ( '@phala/typedefs');
const { RegistryTypes } = require ('@polkadot/types/types');
let api = undefined;
let metadata = undefined;

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
            message.push("\tExtrinsic: "+phase.toString() + ' : ' + section + '.' + method + ' ' + data.toString())
            if (method === "ProxyExecuted" ){
                let data_obj = JSON.parse(data.toString())
                proxy_failed = (typeof data_obj[0].err === "undefined" ? false : true);
                if (proxy_failed) {
                    let errindex = data_obj[0]['err']['module']['index']
                    let errno = parseInt(data_obj[0]['err']['module']['error'].substr(2, 2),16);
                    message.push(utils.red("Proxy tx error: "+getErrorDescription(errindex,errno)))
                }
            }
            if (method === "ExtrinsicFailed") {
                let data_obj = JSON.parse(data.toString())
                let errindex = data_obj[0]['module']['index']
                let errno = parseInt(data_obj[0]['module']['error'].substr(2, 2),16);
                message.push(utils.red("Tx error: "+getErrorDescription(errindex,errno)))
                tx_failed = 1
            }
            exit_status = (!proxy_failed && !tx_failed ? 0 : 1);
            /** specific for claiming rewards */
            /*
	    if (method === "RewardsWithdrawn") {
                let data_obj = JSON.parse(data.toString())
                let rewards_claim_amount = data_obj[2];
                //console.log(utils.green("Claimed "+utils.formatPha(rewards_claim_amount)));
                message.push(utils.green("Claimed "+utils.formatPha(rewards_claim_amount)));
            }
	    */
        });
        if (status.isFinalized) {
            let proxy_mess = (typeof proxy_failed!=="undefined" ? "Proxy tx: "+(proxy_failed ? utils.red("Fail") : utils.green("Success"))+"\n" : "");
            let tx_mess = typeof tx_failed!=="undefined" ? "Extrinsic: "+(tx_failed ? utils.red("Fail") : utils.green("Success")) : "";
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

/**
 *  
 * feed a shell
 */
async function feedShell(from_account,to_id) {
    
        let staker_address;
        let use_proxy=true;
       
        let tx = await api.tx.pwIncubation.feedOriginOfShell(1, to_id);
        tx = await proxyTx(api,tx,from_account,type='Any');
        let SIGNER = keyring.addFromUri(config.proxy_seed) 
        console.log("PROXY!")
        await signAndSend(tx,SIGNER);

}

(async () => {
   
    const wsProvider = new WsProvider('wss://khala-api.phala.network/ws'); 
    api = await ApiPromise.create({ 
        provider: wsProvider, 
        types: RegistryTypes, 
        noInitWarn: true, 
        initWasm: false
    });
    metadata = await getMetadata(api);
   
    console.log(utils.bright("\n## PW food process!"));
    //console.log(argv.fromaddr, argv.toid);

    await feedShell(config[argv.fromaddr],argv.toid); 
    // 176 nourri 176 x2
    // 176 nourri 228 x2
    // 176 nourri 175 x1
    // 228 nourri 228 x2
    // 228 nourri 175 x2
    // 228 nourri 427 x1
    // 175 nourri 175 x2
    // 175 nourri 1086 x2
    // 175 nourri 782 x1
    // 427 nourri 427 x2
    // 427 nourri 1303 x2
    // 427 nourri 1060 x1
    //
    //await feedShell(config.addr_176,176); // 1er shell Arno
    //await feedShell(config.addr_176,176); //1er shell Arno
    //await feedShell(config.addr_176,228); // 2eme shell Arno
    //await feedShell(config['addr_176'],228); // 2eme shell Arno
    //await feedShell(config.addr_176,175); // 3eme shell Arno
/*
    await feedShell(config.addr_228,228); // 2eme shell Arno
    await feedShell(config.addr_228,228); // 2eme shell Arno
    await feedShell(config.addr_228,175); // 3eme shell Arno
    await feedShell(config.addr_228,175); // 3eme shell Arno
    await feedShell(config.addr_228,1086); // BlackStone | Phala Amb#0238

    await feedShell(config.addr_175,175); //  3eme shell Arno
    await feedShell(config.addr_175,175); //  3eme shell Arno
    await feedShell(config.addr_175,1086); // BlackStone | Phala Amb#0238
    await feedShell(config.addr_175,1086); // BlackStone | Phala Amb#0238
    await feedShell(config.addr_175,782); //  koutakou#3780

    await feedShell(config.addr_427,427); //  4eme shell Arno
    await feedShell(config.addr_427,427);  // 4eme shell Arno
    await feedShell(config.addr_427,1303); // Darbakearg#0926
    await feedShell(config.addr_427,1303); // Darbakearg#0926
    await feedShell(config.addr_427,1060); // Ravens#3718*/

})();

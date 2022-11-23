//onst util = require('util');
//const BN = require('bn.js');
//const BigNumber = require('bignumber.js');
const bn1e12 = Math.pow(10,12)
const { formatBalance } = require('@polkadot/util');

// return the PHA value
function pha(value,decimals=false) {
    return decimals ? value/bn1e12 : Math.floor(value/bn1e12);
}
// return formated PHA (with native polkadot function)
function formatPha(value,pad=17) {
    formatBalance.setDefaults({unit: 'PHA',decimals: 12});
    const formated = formatBalance(
        value,
        { 
            withSiFull: true, 
            withSi: true,
            forceUnit: '-'
        }
    );
    return formated.padStart(pad);
}

function red(text) {
    const reset = "\x1b[0m";
    return "\x1b[31m"+text+reset;
}
function green(text) {
    const reset = "\x1b[0m";
    return "\x1b[32m"+text+reset;
}
function bright(text) {
    const reset = "\x1b[0m";
    return "\x1b[1m"+text+reset;
}


module.exports = {
    pha,
    formatPha,
    red,
    green,
    bright
};
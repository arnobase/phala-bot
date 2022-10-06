const util = require('util');
const BN = require('bn.js');
const bn1e12 = new BN(10).pow(new BN(12));

// Simply returns the integer part of the PHA value
function pha(value) {
    return value.div(bn1e12).toNumber();
}

module.exports = {pha};
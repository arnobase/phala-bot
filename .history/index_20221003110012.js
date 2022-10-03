import { ApiPromise, WsProvider } from '@polkadot/api';

// Construct
const wsProvider = new WsProvider('wss://public-rpc.pinknode.io/khala');
const api = await ApiPromise.create({ provider: wsProvider });

// Do something
console.log(api.genesisHash.toHex());
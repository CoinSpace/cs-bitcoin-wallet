import { Transaction } from '@coinspace/cs-common';
import assert from 'assert/strict';
import fs from 'fs/promises';

import TxTransformer from '../lib/TxTransformer.js';
import Unspent from '../lib/Unspent.js';
import Wallet from '../index.js';
import addressTypes from '../lib/addressTypes.js';
import networks from '../lib/networks.js';

const network = networks.regtest.bitcoin;
const TRANSACTIONS = JSON.parse(await fs.readFile('./test/fixtures/transactions.json'));

const bitcoinAtBitcoin = {
  _id: 'bitcoin@bitcoin',
  asset: 'btc',
  platform: 'bitcoin',
  type: 'coin',
  decimals: 8,
};

const defaultOptions = {
  crypto: bitcoinAtBitcoin,
  platform: bitcoinAtBitcoin,
  cache: { get() {}, set() {} },
  settings: { get() {}, set() {} },
  account: {
    request(...args) { console.log(args); },
    market: {
      getPrice() { return 27415.24; },
    },
  },
  apiWeb: 'web',
  apiNode: 'node',
  storage: { get() {}, set() {}, save() {} },
  development: true,
};

let wallet;
let accounts;

describe('TxTransformer.js', () => {
  beforeEach(() => {
    wallet = new Wallet({ ...defaultOptions });
    accounts = new Map();
  });

  describe('transformTx', () => {
    it('incoming tx (pending)', async () => {
      accounts.set(addressTypes.P2WPKH, {
        addresses: ['bcrt1qkqn0vw3jqv0n607azc5zfa747339ee29nqad7y'],
        changeAddresses: [],
      });
      const txTransformer = new TxTransformer({ wallet, accounts, network });
      const tx = txTransformer.transformTx(TRANSACTIONS[0]);

      assert.equal(tx.status, Transaction.STATUS_PENDING);
      assert.equal(tx.incoming, true);
      assert.equal(tx.rbf, false);
      assert.equal(tx.fee.value, 1000n);
      assert.equal(tx.amount.value, 2_0000_0000n);
      assert.equal(tx.to, undefined);
      assert.equal(tx.changeAddress, undefined);
      assert.deepEqual(tx.inputs, []);
      assert.deepEqual(tx.outputs, []);
    });

    it('incoming tx (confirmed)', async () => {
      accounts.set(addressTypes.P2PKH, {
        addresses: ['mnMqTye2zjQ1CE4RkCZQeaeAoaqCpEcBJS'],
        changeAddresses: [],
      });
      const txTransformer = new TxTransformer({ wallet, accounts, network });
      const tx = txTransformer.transformTx(TRANSACTIONS[6]);

      assert.equal(tx.status, Transaction.STATUS_SUCCESS);
      assert.equal(tx.incoming, true);
      assert.equal(tx.rbf, false);
      assert.equal(tx.fee.value, 1000n);
      assert.equal(tx.amount.value, 3_0000_0000n);
      assert.equal(tx.to, undefined);
      assert.equal(tx.changeAddress, undefined);
      assert.deepEqual(tx.inputs, []);
      assert.deepEqual(tx.outputs, []);
    });

    it('outgoing tx (pending)', async () => {
      accounts.set(addressTypes.P2WPKH, {
        addresses: ['bcrt1qkqn0vw3jqv0n607azc5zfa747339ee29nqad7y'],
        changeAddresses: ['bcrt1q235eynnkmvv2j9kk653a09ttv8q59sf3xfftgj'],
      });
      const txTransformer = new TxTransformer({ wallet, accounts, network });
      const tx = txTransformer.transformTx(TRANSACTIONS[1]);

      assert.equal(tx.status, Transaction.STATUS_PENDING);
      assert.equal(tx.incoming, false);
      assert.equal(tx.rbf, true);
      assert.equal(tx.fee.value, 2_0000_1000n);
      assert.equal(tx.amount.value, 1_0000_0000n);
      assert.equal(tx.to, TRANSACTIONS[1].vout[0].scriptPubKey.addresses[0]);
      assert.equal(tx.changeAddress, TRANSACTIONS[1].vout[2].scriptPubKey.addresses[0]);
      assert.deepEqual(tx.inputs, [new Unspent({
        address: 'bcrt1qkqn0vw3jqv0n607azc5zfa747339ee29nqad7y',
        confirmations: 3,
        txId: '4d26c2492366cca617e3dde10b378a17cabaa0c9324ca764e21a1b88140ae001',
        type: addressTypes.P2WPKH,
        value: 6_0000_1000n,
        vout: 1,
      })]);
      assert.deepEqual(tx.outputs, [
        new Unspent({
          address: 'bcrt1qcgrm42khvjl829x0y43y0ua9w28srdksnhtte6',
          confirmations: 0,
          txId: '2818460aebb077b4cb826477b8386b0096a65651e61f49127a0e7299ad01e001',
          type: addressTypes.P2WPKH,
          value: 1_0000_0000n,
          vout: 0,
        }),
        new Unspent({
          address: 'bcrt1qfrl9p7sp00xe8w2nk0krrjpxgventn24msjs7n',
          confirmations: 0,
          csfee: true,
          txId: '2818460aebb077b4cb826477b8386b0096a65651e61f49127a0e7299ad01e001',
          type: addressTypes.P2WPKH,
          value: 2_0000_0000n,
          vout: 1,
        }),
        new Unspent({
          address: 'bcrt1q235eynnkmvv2j9kk653a09ttv8q59sf3xfftgj',
          confirmations: 0,
          txId: '2818460aebb077b4cb826477b8386b0096a65651e61f49127a0e7299ad01e001',
          type: addressTypes.P2WPKH,
          value: 3_0000_0000n,
          vout: 2,
        }),
      ]);
    });

    it('outgoing tx (pending, without change)', async () => {
      accounts.set(addressTypes.P2WPKH, {
        addresses: ['bcrt1qkqn0vw3jqv0n607azc5zfa747339ee29nqad7y'],
        changeAddresses: [],
      });
      const txTransformer = new TxTransformer({ wallet, accounts, network });
      const tx = txTransformer.transformTx(TRANSACTIONS[2]);

      assert.equal(tx.status, Transaction.STATUS_PENDING);
      assert.equal(tx.incoming, false);
      assert.equal(tx.rbf, true);
      assert.equal(tx.fee.value, 2_0000_1000n);
      assert.equal(tx.amount.value, 1_0000_0000n);
      assert.equal(tx.to, TRANSACTIONS[2].vout[0].scriptPubKey.addresses[0]);
      assert.equal(tx.changeAddress, undefined);
      assert.deepEqual(tx.inputs, [new Unspent({
        address: 'bcrt1qkqn0vw3jqv0n607azc5zfa747339ee29nqad7y',
        confirmations: 3,
        txId: '4d26c2492366cca617e3dde10b378a17cabaa0c9324ca764e21a1b88140ae001',
        type: addressTypes.P2WPKH,
        value: 3_0000_1000n,
        vout: 1,
      })]);
      assert.deepEqual(tx.outputs, [
        new Unspent({
          address: 'bcrt1qcgrm42khvjl829x0y43y0ua9w28srdksnhtte6',
          confirmations: 0,
          txId: '2818460aebb077b4cb826477b8386b0096a65651e61f49127a0e7299ad01e002',
          type: addressTypes.P2WPKH,
          value: 1_0000_0000n,
          vout: 0,
        }),
        new Unspent({
          address: 'bcrt1qfrl9p7sp00xe8w2nk0krrjpxgventn24msjs7n',
          confirmations: 0,
          csfee: true,
          txId: '2818460aebb077b4cb826477b8386b0096a65651e61f49127a0e7299ad01e002',
          type: addressTypes.P2WPKH,
          value: 2_0000_0000n,
          vout: 1,
        }),
      ]);
    });

    it('outgoing tx (confirmed)', async () => {
      accounts.set(addressTypes.P2SH, {
        addresses: ['2Muzvftcgz3nCAo6w6c3xKFkJchXvAP5CWe'],
        changeAddresses: [],
      });
      const txTransformer = new TxTransformer({ wallet, accounts, network });
      const tx = txTransformer.transformTx(TRANSACTIONS[4]);

      assert.equal(tx.status, Transaction.STATUS_SUCCESS);
      assert.equal(tx.incoming, false);
      assert.equal(tx.rbf, false);
      assert.equal(tx.fee.value, 1_0000_1000n);
      assert.equal(tx.amount.value, 2_0000_0000n);
      assert.equal(tx.to, TRANSACTIONS[4].vout[0].scriptPubKey.addresses[0]);
      assert.equal(tx.changeAddress, undefined);
      assert.deepEqual(tx.inputs, []);
      assert.deepEqual(tx.outputs, []);
    });

    it('outgoing tx to yourself', async () => {
      accounts.set(addressTypes.P2SH, {
        addresses: ['2Muzvftcgz3nCAo6w6c3xKFkJchXvAP5CWe', '2NAsb4KfP2RKJwwwq9Wqyqyhye8LQri6E5t'],
        changeAddresses: [],
      });
      accounts.set(addressTypes.P2WPKH, {
        addresses: ['bcrt1qkqn0vw3jqv0n607azc5zfa747339ee29nqad7y'],
        changeAddresses: [],
      });
      const txTransformer = new TxTransformer({ wallet, accounts, network });
      const tx = txTransformer.transformTx(TRANSACTIONS[4]);

      assert.equal(tx.status, Transaction.STATUS_SUCCESS);
      assert.equal(tx.incoming, false);
      assert.equal(tx.rbf, false);
      assert.equal(tx.fee.value, 1000n);
      assert.equal(tx.amount.value, 0n);
      assert.equal(tx.to, TRANSACTIONS[4].vout[0].scriptPubKey.addresses[0]);
      assert.equal(tx.changeAddress, 'bcrt1qkqn0vw3jqv0n607azc5zfa747339ee29nqad7y');
      assert.deepEqual(tx.inputs, []);
      assert.deepEqual(tx.outputs, []);
    });
  });
});

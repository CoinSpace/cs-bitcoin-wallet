import assert from 'assert/strict';
import fs from 'fs/promises';
import { hex } from '@scure/base';
import sinon from 'sinon';
import { Amount, Transaction } from '@coinspace/cs-common';

import * as utils from './utils.js';
import Wallet from '@coinspace/cs-bitcoin-wallet';

// eslint-disable-next-line max-len
const RANDOM_SEED = hex.decode('2b48a48a752f6c49772bf97205660411cd2163fe6ce2de19537e9c94d3648c85c0d7f405660c20253115aaf1799b1c41cdd62b4cfbb6845bc9475495fc64b874');
const RANDOM_SEED_PUB_KEY = {
  p2wpkh: {
    // eslint-disable-next-line max-len
    xpub: 'tpubDDEcPY1jTWCnFcrJoBdQxst38MXPLZHZ3uttVbX8rNddzJrrUAhQAzmYfAsJxS85q5QRXnLmbMhZPDjjB1DvoCfMQWh5c6Sx2Liyw3Hsqr8',
    path: "m/84'/1'/0'",
  },
  p2pkh: {
    // eslint-disable-next-line max-len
    xpub: 'tpubDDmETRUCfp7xTnk3Sw15ZVw1BRUFPKpHQTNeUuupEG42YW6fx7CwQjvh2SEwBcdqTMY2nGjRvZCUomP5yuBbZSXDFj3BoPPr4t1cpyD2Azr',
    path: "m/44'/1'/0'",
  },
  p2sh: {
    // eslint-disable-next-line max-len
    xpub: 'tpubDCMx2SbjiwJmq4kpRWNde5ZFTiHdeKJbrBtv7PttFXYSoNBzxkRD9K6nLhb9mYdmhWtghNqVsAqYn5NaoLiCa2ognG3tYpa8Kc8qmjh2YjA',
    path: "m/49'/1'/0'",
  },
};
const RANDOM_ADDRESS = 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp';

const SECOND_ADDRESS_P2PKH = 'mtHcCKvxPXL6XLXQsvbZ9Cv7ShdAWz7eid';
const SECOND_ADDRESS_P2SH = '2NERD15JAX3tMguSDEdpbU79JJR8rLKmQT1';
const SECOND_ADDRESS_P2WPKH = 'bcrt1qcgrm42khvjl829x0y43y0ua9w28srdksnhtte6';
const SECOND_ADDRESS_P2WSH = 'bcrt1qhxtthndg70cthfasy8y4qlk9h7r3006azn9md0fad5dg9hh76nkq8d46nh';

const TRANSACTIONS = JSON.parse(await fs.readFile('./test/fixtures/transactions.json'));

const bitcoinAtBitcoin = {
  _id: 'bitcoin@bitcoin',
  asset: 'btc',
  platform: 'bitcoin',
  type: 'coin',
  decimals: 8,
};

const bitcoinCashAtBitcoinCash = {
  _id: 'bitcoin-cash@bitcoin-cash',
  asset: 'bch',
  platform: 'bitcoin-cash',
  type: 'coin',
  decimals: 8,
};

const litecoinAtLitecoin = {
  _id: 'litecoin@litecoin',
  asset: 'ltc',
  platform: 'litecoin',
  type: 'coin',
  decimals: 8,
};

let defaultOptions;

const COIN_PRICE = 27415.24;
const CS_FEE_ADDRESS = 'bcrt1qfrl9p7sp00xe8w2nk0krrjpxgventn24msjs7n';
const CS_FEE = {
  address: CS_FEE_ADDRESS,
  fee: 0.005,
  maxFee: 100,
  minFee: 0.3,
  feeAddition: 1920,
};
const COIN_PRICE_LTC = 65.11;
const CS_FEE_LTC = {
  address: 'ltc1qg69a6wprrdagn6ym45qflvrq28hwymf2dpx22s',
  fee: 0.005,
  maxFee: 100,
  minFee: 0.3,
  feeAddition: 1920,
};

describe('BitcoinWallet.js', () => {
  beforeEach(() => {
    defaultOptions = {
      crypto: bitcoinAtBitcoin,
      platform: bitcoinAtBitcoin,
      cache: { get() {}, set() {} },
      settings: {},
      txPerPage: 1,
      request(...args) { console.log(args); },
      apiNode: 'node',
      storage: { get() {}, set() {}, save() {} },
      development: true,
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('create wallet instance', () => {
      const wallet = new Wallet({
        ...defaultOptions,
      });
      assert.equal(wallet.state, Wallet.STATE_CREATED);
    });
  });

  describe('create wallet', () => {
    it('should create new wallet with seed', async () => {
      const wallet = new Wallet({
        ...defaultOptions,
      });
      await wallet.create(RANDOM_SEED);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, RANDOM_ADDRESS);
    });

    it('should create new wallet with seed (bitcoin-cash)', async () => {
      const wallet = new Wallet({
        ...defaultOptions,
        crypto: bitcoinCashAtBitcoinCash,
      });
      await wallet.create(RANDOM_SEED);
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, 'qpsmea0wn9ex38adldntrgn7yzhsug9m6urhumffzy');
    });

    it('should fails without seed', async () => {
      const wallet = new Wallet({
        ...defaultOptions,
      });
      await assert.rejects(async () => {
        await wallet.create();
      }, {
        name: 'TypeError',
        message: 'seed must be an instance of Uint8Array or Buffer, undefined provided',
      });
    });
  });

  describe('open wallet', () => {
    it('should open wallet with public key', async () => {
      const wallet = new Wallet({
        ...defaultOptions,
      });
      await wallet.open({ data: RANDOM_SEED_PUB_KEY });
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, RANDOM_ADDRESS);
    });

    it('should open wallet with public key (bitcoin-cash)', async () => {
      const wallet = new Wallet({
        ...defaultOptions,
        crypto: bitcoinCashAtBitcoinCash,
      });
      await wallet.open({ data: RANDOM_SEED_PUB_KEY });
      assert.equal(wallet.state, Wallet.STATE_INITIALIZED);
      assert.equal(wallet.address, 'qpsmea0wn9ex38adldntrgn7yzhsug9m6urhumffzy');
    });

    it('should fails without public key', async () => {
      const wallet = new Wallet({
        ...defaultOptions,
      });
      await assert.rejects(async () => {
        await wallet.open();
      }, {
        name: 'TypeError',
        message: 'publicKey must be an instance of Object with data property',
      });
    });

    it('should set STATE_NEED_INITIALIZATION for wrong public key', async () => {
      const wallet = new Wallet({
        ...defaultOptions,
      });
      const publicKey = JSON.parse(JSON.stringify(RANDOM_SEED_PUB_KEY));
      publicKey.p2wpkh.path = "m/44'/1'/1'";
      await wallet.open({ data: publicKey });
      assert.equal(wallet.state, Wallet.STATE_NEED_INITIALIZATION);
    });
  });

  describe('storage', () => {
    it('should load initial balance from storage', async () => {
      sinon.stub(defaultOptions.storage, 'get')
        .withArgs('balance').returns('1234567890');
      const wallet = new Wallet({
        ...defaultOptions,
      });
      await wallet.open({ data: RANDOM_SEED_PUB_KEY });
      assert.equal(wallet.balance.value, 12_3456_7890n);
    });
  });

  describe('load', () => {
    it('should load wallet', async () => {
      const storage = sinon.mock(defaultOptions.storage);
      storage.expects('set').once().withArgs('balance', '900000000');
      storage.expects('save').once();
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 1_0000_0000 },
        { address: 'bcrt1q4qqztfxyyqhc6scx005h4j62xa2skrqta3g3rh', satoshis: 1_0000_0000 },
        { address: '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF', satoshis: 5_0000_0000 },
        { address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs', satoshis: 2_0000_0000 },
      ]);
      assert.equal(wallet.state, Wallet.STATE_LOADED);
      assert.equal(wallet.balance.value, 9_0000_0000n);
      assert.equal(wallet.address, 'bcrt1qq76v3m62vxdllc2jry7n4n2vc5pjz2mx2f5zup');
      storage.verify();
    });

    it('should set STATE_ERROR on error', async () => {
      sinon.stub(defaultOptions, 'request')
        .withArgs(sinon.match.any).rejects();
      const wallet = new Wallet({
        ...defaultOptions,
      });
      await wallet.create(RANDOM_SEED);
      await assert.rejects(async () => {
        await wallet.load();
      });
      assert.equal(wallet.state, Wallet.STATE_ERROR);
    });
  });

  describe('getPublicKey', () => {
    it('should export public key', async () => {
      const wallet = new Wallet({
        ...defaultOptions,
      });
      await wallet.create(RANDOM_SEED);
      const publicKey = wallet.getPublicKey();
      assert.deepEqual(publicKey, { data: RANDOM_SEED_PUB_KEY });
    });

    it('public key is valid', async () => {
      const wallet = new Wallet({
        ...defaultOptions,
      });
      await wallet.create(RANDOM_SEED);
      const publicKey = wallet.getPublicKey();
      const secondWalet = new Wallet({
        ...defaultOptions,
      });
      secondWalet.open(publicKey);
      assert.equal(wallet.address, secondWalet.address);
    });
  });

  describe('getPrivateKey', () => {
    it('should export private key', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 1_0000_0000 },
        { address: '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF', satoshis: 5_0000_0000 },
        { address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs', satoshis: 2_0000_0000 },
        { address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs', satoshis: 1_0000_0000 },
      ]);
      const privateKey = wallet.getPrivateKey(RANDOM_SEED);
      assert.deepEqual(privateKey, [
        {
          address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp',
          privatekey: 'cU53ebmRGxqsPQyeqwtwfkxPZHhvPgYn9m6ayo4gHn58qCLceYc4',
        },
        {
          address: '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF',
          privatekey: 'cSYyezSkPmga5wgs55cysf46hw9CgM21BxG1KuaUXFtojKUedgb6',
        },
        {
          address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs',
          privatekey: 'cNEMofdJGocXjxG7zF3vqG1Gm4KHX8xwKwYvyeyQrZ4vBqXpjGwp',
        },
      ]);
    });

    it('should export private key (empty wallet)', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions);
      const privateKey = wallet.getPrivateKey(RANDOM_SEED);
      assert.deepEqual(privateKey, []);
    });
  });

  describe('getAddressType', () => {
    it('works for p2pkh LTC address with "LTC" in the beginning', async () => {
      const options = {
        ...defaultOptions,
        crypto: litecoinAtLitecoin,
        development: false,
      };
      const wallet = await utils.createWallet(RANDOM_SEED, options);
      assert.equal(wallet.getAddressType('LTCHodBXqzzfDvkL1kA3dHRVsx4SCL3Y13'), Wallet.ADDRESS_TYPE_P2PKH);
    });
  });

  describe('validators', () => {
    describe('validateAddress', () => {
      let wallet;
      beforeEach(async () => {
        wallet = await utils.createWallet(RANDOM_SEED, defaultOptions);
      });

      it('valid address', async () => {
        assert.ok(await wallet.validateAddress({ address: SECOND_ADDRESS_P2PKH }));
        assert.ok(await wallet.validateAddress({ address: SECOND_ADDRESS_P2SH }));
        assert.ok(await wallet.validateAddress({ address: SECOND_ADDRESS_P2WPKH }));
        assert.ok(await wallet.validateAddress({ address: SECOND_ADDRESS_P2WSH }));
      });

      it('invalid address', async () => {
        await assert.rejects(async () => {
          await wallet.validateAddress({ address: 'my invalid address' });
        }, {
          name: 'InvalidAddressError',
          message: 'Invalid address "my invalid address"',
        });
      });
    });

    describe('validateAmount', () => {
      let wallet;
      beforeEach(async () => {
        wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
          { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 1_0000_0000 },
          { address: '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF', satoshis: 5_0000_0000 },
          { address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs', satoshis: 2_0000_0000, confirmations: 0 },
        ]);
        await utils.loadFeeRates(wallet, defaultOptions);
        utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);
      });

      it('should be valid amount', async () => {
        const valid = await wallet.validateAmount({
          feeRate: Wallet.FEE_RATE_DEFAULT,
          address: SECOND_ADDRESS_P2WPKH,
          amount: new Amount(2_0000_0000n, wallet.crypto.decimals),
          price: COIN_PRICE,
        });
        assert.ok(valid);
      });

      it('throw on small amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateAmount({
            feeRate: Wallet.FEE_RATE_DEFAULT,
            address: SECOND_ADDRESS_P2WPKH,
            amount: new Amount(0n, wallet.crypto.decimals),
            price: COIN_PRICE,
          });
        }, {
          name: 'SmallAmountError',
          message: 'Small amount',
          amount: new Amount(546n, wallet.crypto.decimals),
        });
      });

      it('throw on big amount', async () => {
        await assert.rejects(async () => {
          await wallet.validateAmount({
            feeRate: Wallet.FEE_RATE_DEFAULT,
            address: SECOND_ADDRESS_P2WPKH,
            amount: new Amount(20_0000_0000n, wallet.crypto.decimals),
            price: COIN_PRICE,
          });
        }, {
          name: 'BigAmountError',
          message: 'Big amount',
          amount: new Amount(5_9963_3087n, wallet.crypto.decimals),
        });
      });

      it('throw on big amount (unconfirmed)', async () => {
        await assert.rejects(async () => {
          await wallet.validateAmount({
            feeRate: Wallet.FEE_RATE_DEFAULT,
            address: SECOND_ADDRESS_P2WPKH,
            amount: new Amount(7_0000_0000n, wallet.crypto.decimals),
            price: COIN_PRICE,
          });
        }, {
          name: 'BigAmountConfirmationPendingError',
          message: 'Big amount, confirmation pending',
          amount: new Amount(5_9963_3087n, wallet.crypto.decimals),
        });
      });
    });
  });

  describe('estimateImport', () => {
    it('works', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 1_0000_0000 },
        { address: '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF', satoshis: 5_0000_0000 },
        { address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs', satoshis: 2_0000_0000 },
      ]);
      await utils.loadFeeRates(wallet, defaultOptions, { default: 10, fastest: 50 });
      utils.stubUnspents(defaultOptions.request, [
        { address: 'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080', satoshis: 1_0000_0000 },
        { address: '2NAUYAHhujozruyzpsFRP63mbrdaU5wnEpN', satoshis: 1_0000_0000 },
        { address: 'mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r', satoshis: 1_0000_0000 },
      ]);
      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);

      let amount;

      amount = await wallet.estimateImport({
        privateKey: 'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA',
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });
      assert.equal(amount.value, 2_9962_9519n);

      amount = await wallet.estimateImport({
        privateKey: 'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA',
        feeRate: Wallet.FEE_RATE_FASTEST,
        price: COIN_PRICE,
      });
      assert.equal(amount.value, 2_9961_4319n);
    });

    it('works (uncompressed public key)', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions);
      await utils.loadFeeRates(wallet, defaultOptions);

      utils.stubUnspents(defaultOptions.request, [
        { address: 'mtoKs9V381UAhUia3d7Vb9GNak8Qvmcsme', satoshis: 1_0000_0000 },
      ]);
      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);

      const estimation = await wallet.estimateImport({
        privateKey: '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx', // uncompressed
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });
      assert.equal(estimation.value, 9963_3067n);
    });

    it('throw error on invalid private key', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions);
      await utils.loadFeeRates(wallet, defaultOptions);
      await assert.rejects(async () => {
        await wallet.estimateImport({
          privateKey: '123',
          feeRate: Wallet.FEE_RATE_DEFAULT,
          price: COIN_PRICE,
        });
      }, {
        name: 'InvalidPrivateKeyError',
        message: 'Invalid private key',
      });
    });

    it('throw error on empty private key', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, []);
      await utils.loadFeeRates(wallet, defaultOptions);
      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);
      utils.stubUnspents(defaultOptions.request, []);
      await assert.rejects(async () => {
        await wallet.estimateImport({
          privateKey: 'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA',
          feeRate: Wallet.FEE_RATE_DEFAULT,
          price: COIN_PRICE,
        });
      }, {
        name: 'SmallAmountError',
        message: 'Small amount',
        amount: new Amount(3632n, wallet.crypto.decimals),
      });
    });

    it('throw error on private key with small amount', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, []);
      await utils.loadFeeRates(wallet, defaultOptions);
      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);
      utils.stubUnspents(defaultOptions.request, [
        { address: '2NAUYAHhujozruyzpsFRP63mbrdaU5wnEpN', satoshis: 600 },
      ]);
      await assert.rejects(async () => {
        await wallet.estimateImport({
          privateKey: 'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA',
          feeRate: Wallet.FEE_RATE_DEFAULT,
          price: COIN_PRICE,
        });
      }, {
        name: 'SmallAmountError',
        message: 'Small amount',
        amount: new Amount(3724n, wallet.crypto.decimals),
      });
    });
  });

  describe('estimateMaxAmount', () => {
    it('works', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 1_0000_0000 },
        { address: '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF', satoshis: 5_0000_0000 },
        { address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs', satoshis: 2_0000_0000 },
      ]);
      await utils.loadFeeRates(wallet, defaultOptions);

      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);

      let maxAmount = await wallet.estimateMaxAmount({
        address: SECOND_ADDRESS_P2PKH,
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });
      assert.equal(maxAmount.value, 7_9963_2936n);

      maxAmount = await wallet.estimateMaxAmount({
        address: SECOND_ADDRESS_P2SH,
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });
      assert.equal(maxAmount.value, 7_9963_2938n);

      maxAmount = await wallet.estimateMaxAmount({
        address: SECOND_ADDRESS_P2WPKH,
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });
      assert.equal(maxAmount.value, 7_9963_2939n);

      maxAmount = await wallet.estimateMaxAmount({
        address: SECOND_ADDRESS_P2WSH,
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });
      assert.equal(maxAmount.value, 7_9963_2927n);
    });

    it('should return 0 for low balance', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 2000 },
      ]);
      await utils.loadFeeRates(wallet, defaultOptions);

      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);

      const maxAmount = await wallet.estimateMaxAmount({
        address: SECOND_ADDRESS_P2PKH,
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });
      assert.equal(maxAmount.value, 0n);
    });
  });

  describe('estimateTransactionFee', () => {
    it('should estimate transaction fee', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 5_0000 },
        { address: '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF', satoshis: 3_0000 },
        { address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs', satoshis: 2_0000 },
      ]);
      await utils.loadFeeRates(wallet, defaultOptions);
      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);

      let fee = await wallet.estimateTransactionFee({
        address: SECOND_ADDRESS_P2PKH,
        amount: new Amount(1_0000n, wallet.crypto.decimals),
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });
      assert.equal(fee.value, 3189n);

      fee = await wallet.estimateTransactionFee({
        address: SECOND_ADDRESS_P2PKH,
        amount: new Amount(6_0000n, wallet.crypto.decimals),
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });
      assert.equal(fee.value, 3280n);

      fee = await wallet.estimateTransactionFee({
        address: SECOND_ADDRESS_P2PKH,
        amount: new Amount(9_6603n, wallet.crypto.decimals), // max amount
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });
      assert.equal(fee.value, 3397n);
    });

    it('should estimate transaction fee (small change)', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 5_0000 },
      ]);
      await utils.loadFeeRates(wallet, defaultOptions);

      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);

      const fee = await wallet.estimateTransactionFee({
        address: SECOND_ADDRESS_P2PKH,
        amount: new Amount(46206n, wallet.crypto.decimals),
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });
      assert.equal(fee.value, 3189n);
    });

    it('should estimate transaction fee (low price)', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 20_0000_0000 },
      ]);
      await utils.loadFeeRates(wallet, defaultOptions);
      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);

      const maxAmount = await wallet.estimateMaxAmount({
        address: SECOND_ADDRESS_P2WPKH,
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: 100,
      });

      const fee = await wallet.estimateTransactionFee({
        address: SECOND_ADDRESS_P2WPKH,
        amount: new Amount(maxAmount.value, wallet.crypto.decimals),
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: 100,
      });
      assert.equal(fee.value + maxAmount.value, wallet.balance.value);
    });
  });

  describe('createTransaction', () => {
    it('works', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 1_0000_0000 },
        { address: '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF', satoshis: 1_0000_0000 },
        { address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs', satoshis: 1_0000_0000 },
      ]);

      await utils.loadFeeRates(wallet, defaultOptions);
      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);
      utils.stubSendTx(defaultOptions.request);

      const id = await wallet.createTransaction({
        feeRate: Wallet.FEE_RATE_DEFAULT,
        address: SECOND_ADDRESS_P2WPKH,
        amount: new Amount(2_5000_0000, wallet.crypto.decimals),
        price: COIN_PRICE,
      }, RANDOM_SEED);

      assert.equal(wallet.balance.value, 4963_2908n);
      assert.equal(id, '123456');
    });

    it('works for p2wsh destination', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 1_0000_0000 },
        { address: '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF', satoshis: 1_0000_0000 },
        { address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs', satoshis: 1_0000_0000 },
      ]);

      await utils.loadFeeRates(wallet, defaultOptions);
      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);
      utils.stubSendTx(defaultOptions.request);

      const id = await wallet.createTransaction({
        feeRate: Wallet.FEE_RATE_DEFAULT,
        address: SECOND_ADDRESS_P2WSH,
        amount: new Amount(2_5000_0000, wallet.crypto.decimals),
        price: COIN_PRICE,
      }, RANDOM_SEED);

      assert.equal(wallet.balance.value, 4963_2896n);
      assert.equal(id, '123456');
    });

    it('works for p2pkh LTC address with "LTC" in the beginning (input/output)', async () => {
      const options = {
        ...defaultOptions,
        crypto: litecoinAtLitecoin,
        development: false,
      };
      const address = 'LTCtgXry84LB9rT4GmaPuns6WEHxjRura1';
      // eslint-disable-next-line max-len
      const SEED = hex.decode('c2a39fffc5b29ed84f5af08d7f29968e19f810d9f80718888b46785c55e6193a13b1da3416df7a32009eb3ee849e478f4db2c3fac6c50c4be9f28da140a3cbe9');
      const wallet = await utils.createWallet(SEED, options, [
        { address, satoshis: 1_0000_0000 },
      ]);

      await utils.loadFeeRates(wallet, options);
      utils.stubCsFee(options.request, litecoinAtLitecoin._id, CS_FEE_LTC);
      utils.stubSendTx(options.request);
      wallet.addressType = Wallet.ADDRESS_TYPE_P2PKH;

      const maxAmount = await wallet.estimateMaxAmount({
        address,
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE_LTC,
      });
      assert.equal(maxAmount.value, 9949_7859n);

      const id = await wallet.createTransaction({
        feeRate: Wallet.FEE_RATE_DEFAULT,
        address,
        amount: new Amount(5000_0000, wallet.crypto.decimals),
        price: COIN_PRICE_LTC,
      }, SEED);

      assert.equal(wallet.balance.value, 9953_7064n);
      assert.equal(id, '123456');
    });

    it('works (csFee disabled)', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 1_0000_0000 },
        { address: '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF', satoshis: 1_0000_0000 },
        { address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs', satoshis: 1_0000_0000 },
      ]);

      await utils.loadFeeRates(wallet, defaultOptions);
      utils.stubSendTx(defaultOptions.request);

      const id = await wallet.createTransaction({
        feeRate: Wallet.FEE_RATE_DEFAULT,
        address: SECOND_ADDRESS_P2WPKH,
        amount: new Amount(2_5000_0000, wallet.crypto.decimals),
        price: COIN_PRICE,
      }, RANDOM_SEED);

      assert.equal(wallet.balance.value, 4999_9620n);
      assert.equal(id, '123456');
    });

    it('fee is equal estimated fee', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 1_0000_0000 },
        { address: '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF', satoshis: 5000_0000 },
        { address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs', satoshis: 5000_0000 },
      ]);

      const amount = 1_5000_0000n;

      await utils.loadFeeRates(wallet, defaultOptions);
      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);
      utils.stubSendTx(defaultOptions.request);

      const estimate = await wallet.estimateTransactionFee({
        feeRate: Wallet.FEE_RATE_DEFAULT,
        address: SECOND_ADDRESS_P2WPKH,
        amount: new Amount(amount, wallet.crypto.decimals),
        price: COIN_PRICE,
      });

      const id = await wallet.createTransaction({
        feeRate: Wallet.FEE_RATE_DEFAULT,
        address: SECOND_ADDRESS_P2WPKH,
        amount: new Amount(amount, wallet.crypto.decimals),
        price: COIN_PRICE,
      }, RANDOM_SEED);

      assert.equal(wallet.balance.value, 2_0000_0000n - amount - estimate.value);
      assert.equal(id, '123456');
    });

    it('sends maxAmount', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 1000_0000 },
        { address: '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF', satoshis: 2000_0000 },
        { address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs', satoshis: 5000_0000 },
      ]);

      await utils.loadFeeRates(wallet, defaultOptions);
      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);
      utils.stubSendTx(defaultOptions.request);

      const maxAmount = await wallet.estimateMaxAmount({
        feeRate: Wallet.FEE_RATE_DEFAULT,
        address: SECOND_ADDRESS_P2WPKH,
        price: COIN_PRICE,
      });

      const id = await wallet.createTransaction({
        feeRate: Wallet.FEE_RATE_DEFAULT,
        address: SECOND_ADDRESS_P2WPKH,
        amount: new Amount(maxAmount.value, wallet.crypto.decimals),
        price: COIN_PRICE,
      }, RANDOM_SEED);

      assert.equal(wallet.balance.value, 0n);
      assert.equal(id, '123456');
    });

    it('sends maxAmount (low price)', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, [
        { address: 'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp', satoshis: 20_0000_0000 },
      ]);

      await utils.loadFeeRates(wallet, defaultOptions);
      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);
      utils.stubSendTx(defaultOptions.request);

      const maxAmount = await wallet.estimateMaxAmount({
        feeRate: Wallet.FEE_RATE_DEFAULT,
        address: SECOND_ADDRESS_P2WPKH,
        price: 100,
      });

      const fee = await wallet.estimateTransactionFee({
        feeRate: Wallet.FEE_RATE_DEFAULT,
        address: SECOND_ADDRESS_P2WPKH,
        amount: new Amount(maxAmount.value, wallet.crypto.decimals),
        price: 100,
      });
      assert.equal(maxAmount.value + fee.value, wallet.balance.value);
      const id = await wallet.createTransaction({
        feeRate: Wallet.FEE_RATE_DEFAULT,
        address: SECOND_ADDRESS_P2WPKH,
        amount: new Amount(maxAmount.value, wallet.crypto.decimals),
        price: 100,
      }, RANDOM_SEED);

      assert.equal(wallet.balance.value, 0n);
      assert.equal(id, '123456');
    });
  });

  describe('createImport', () => {
    it('should support import', () => {
      const wallet = new Wallet({
        ...defaultOptions,
      });
      assert.ok(wallet.isImportSupported);
    });

    it('works', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, []);
      await utils.loadFeeRates(wallet, defaultOptions);
      utils.stubUnspents(defaultOptions.request, [
        { address: 'bcrt1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080', satoshis: 1_0000_0000 },
        { address: '2NAUYAHhujozruyzpsFRP63mbrdaU5wnEpN', satoshis: 1_0000_0000 },
        { address: 'mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r', satoshis: 1_0000_0000 },
      ]);
      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);
      utils.stubSendTx(defaultOptions.request);

      assert.equal(wallet.balance.value, 0n);

      const estimate = await wallet.estimateImport({
        privateKey: 'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA',
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });

      const id = await wallet.createImport({
        privateKey: 'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA',
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });

      assert.equal(wallet.balance.value, estimate.value);
      assert.equal(wallet.balance.value, 2_9963_2939n);
      assert.equal(id, '123456');
    });

    it('works (bitcoin-cash)', async () => {
      const options = {
        ...defaultOptions,
        crypto: bitcoinCashAtBitcoinCash,
      };
      const wallet = await utils.createWallet(RANDOM_SEED, options);
      await utils.loadFeeRates(wallet, options);
      utils.stubUnspents(options.request, [
        { address: 'mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r', satoshis: 1_0000_0000 },
        { address: 'mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r', satoshis: 1_0000_0000 },
        { address: 'mrCDrCybB6J1vRfbwM5hemdJz73FwDBC8r', satoshis: 1_0000_0000 },
      ]);
      utils.stubCsFee(options.request, bitcoinCashAtBitcoinCash._id, {
        ...CS_FEE,
        address: 'mv1jSdXSnrVN1dt5hfQXxtgSEpiHFiLfjx',
      });
      utils.stubSendTx(options.request);

      assert.equal(wallet.balance.value, 0n);

      const estimate = await wallet.estimateImport({
        privateKey: 'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA',
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });

      const id = await wallet.createImport({
        privateKey: 'cMahea7zqjxrtgAbB7LSGbcQUr1uX1ojuat9jZodMN87JcbXMTcA',
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });

      assert.equal(wallet.balance.value, estimate.value);
      assert.equal(wallet.balance.value, 2_9963_2797n);
      assert.equal(id, '123456');
    });

    it('works (uncompressed public key)', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions);
      await utils.loadFeeRates(wallet, defaultOptions);
      utils.stubUnspents(defaultOptions.request, [
        { address: 'mtoKs9V381UAhUia3d7Vb9GNak8Qvmcsme', satoshis: 1_0000_0000 },
      ]);
      utils.stubCsFee(defaultOptions.request, bitcoinAtBitcoin._id, CS_FEE);
      utils.stubSendTx(defaultOptions.request);

      assert.equal(wallet.balance.value, 0n);

      const estimate = await wallet.estimateImport({
        privateKey: '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });

      const id = await wallet.createImport({
        privateKey: '91avARGdfge8E4tZfYLoxeJ5sGBdNJQH4kvjJoQFacbgwmaKkrx',
        feeRate: Wallet.FEE_RATE_DEFAULT,
        price: COIN_PRICE,
      });

      assert.equal(wallet.balance.value, estimate.value);
      assert.equal(wallet.balance.value, 9963_3067n);
      assert.equal(id, '123456');
    });
  });

  describe('loadTransaction', () => {
    it('should load transaction', async () => {
      const unspentOptions = utils.txsToUnspentOptions(TRANSACTIONS, [
        'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp',
        '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF',
        'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs',
      ]);
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, unspentOptions);

      utils.stubTxs(defaultOptions.request, [TRANSACTIONS[1]]);
      const tx = await wallet.loadTransaction(TRANSACTIONS[1].txid);
      assert.equal(tx.status, Transaction.STATUS_PENDING);
      assert.equal(tx.incoming, false);
      assert.equal(tx.rbf, true);
      assert.equal(tx.fee.value, 2_0000_1000n);
      assert.equal(tx.amount.value, 4_0000_0000n);
    });

    it('should load transaction (preloaded)', async () => {
      const unspentOptions = utils.txsToUnspentOptions(TRANSACTIONS, [
        'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp',
        '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF',
        'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs',
      ]);
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, unspentOptions);

      utils.stubTxs(defaultOptions.request, TRANSACTIONS);
      await utils.loadAllTxs(wallet);

      sinon.restore();

      const tx = await wallet.loadTransaction(TRANSACTIONS[1].txid);
      assert.equal(tx.status, Transaction.STATUS_PENDING);
      assert.equal(tx.incoming, false);
      assert.equal(tx.rbf, true);
      assert.equal(tx.fee.value, 2_0000_1000n);
      assert.equal(tx.amount.value, 4_0000_0000n);
    });
  });

  describe('loadTransactions', () => {
    it('should load transactions', async () => {
      const unspentOptions = utils.txsToUnspentOptions(TRANSACTIONS, [
        'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp',
        '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF',
        'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs',
      ]);
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, unspentOptions);

      utils.stubTxs(defaultOptions.request, TRANSACTIONS);
      const txs = await utils.loadAllTxs(wallet);

      assert.deepEqual(txs.map((tx) => tx.id), [
        '2818460aebb077b4cb826477b8386b0096a65651e61f49127a0e7299ad01e001',
        '2818460aebb077b4cb826477b8386b0096a65651e61f49127a0e7299ad01e002',
        '2818460aebb077b4cb826477b8386b0096a65651e61f49127a0e7299ad01e003',
        '2818460aebb077b4cb826477b8386b0096a65651e61f49127a0e7299ad01e335',
        'b261eda4c904af0a5610c9fa4405a97b275ed245ca3abea2dcbe8b142efd4e06',
        '56c42825e8dc2eaf4d83755a3e3028087838dba3bb81932312b0d2205f52c532',
        '780cc0d76bd57339a23e9669461084358b2652dfc5a6d73350e46f79ac2f0083',
      ]);
    });
  });

  describe('estimateReplacement', () => {
    let wallet;
    let txs;
    beforeEach(async () => {
      const unspentOptions = utils.txsToUnspentOptions(TRANSACTIONS, [
        'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp',
        'bcrt1qq0a3kg4wr6tlw8vww0tnnz9sd94v9jxv7vz89m',
        '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF',
        'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs',
      ]);
      wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, unspentOptions);
      utils.stubTxs(defaultOptions.request, TRANSACTIONS);
      txs = await utils.loadAllTxs(wallet);
    });

    it('works', async () => {
      const estimate = await wallet.estimateReplacement(txs[0]);
      assert.equal(estimate.percent, 0.5);
      assert.equal(estimate.fee.value, 548n);
    });

    it('works for tx without change', async () => {
      const estimate = await wallet.estimateReplacement(txs[1]);
      assert.equal(estimate.percent, 0.5);
      assert.equal(estimate.fee.value, 2840n);
    });

    it('works for tx with small change', async () => {
      const estimate = await wallet.estimateReplacement(txs[2]);
      assert.equal(estimate.percent, 0.5);
      assert.equal(estimate.fee.value, 1880n);
    });

    it('throw error not enough funds', async () => {
      await assert.rejects(async () => {
        const tx = txs[2];
        sinon.stub(tx, 'feePerByte').get(() => 1000000);
        await wallet.estimateReplacement(tx);
      }, {
        name: 'BigAmountError',
        message: 'Big amount',
      });
    });
  });

  describe('createReplacementTransaction', () => {
    let wallet;
    let txs;
    beforeEach(async () => {
      const unspentOptions = utils.txsToUnspentOptions(TRANSACTIONS, [
        'bcrt1q5ud5zsng5k47n2ndvlavtm0zswdkf8j6r4qglp',
        'bcrt1qq0a3kg4wr6tlw8vww0tnnz9sd94v9jxv7vz89m',
        '2Mxn69GNwjnu2UedKPoMNUrkGFH5CtW3dxF',
        'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs',
      ]);
      wallet = await utils.createWallet(RANDOM_SEED, defaultOptions, unspentOptions);
      utils.stubTxs(defaultOptions.request, TRANSACTIONS);
      utils.stubSendTx(defaultOptions.request);
      txs = await utils.loadAllTxs(wallet);
    });

    it('replace tx', async () => {
      const tx = txs[0];
      const before = wallet.balance.value;
      const id = await wallet.createReplacementTransaction(tx, RANDOM_SEED);
      const after = wallet.balance.value;
      assert.equal(before - after, 548n);
      assert.equal(after, 11_0000_0452n);
      assert.equal(id, '123456');
    });

    it('replace tx without change', async () => {
      const tx = txs[1];
      const before = wallet.balance.value;
      const id = await wallet.createReplacementTransaction(tx, RANDOM_SEED);
      const after = wallet.balance.value;
      assert.equal(before - after, 2840n);
      assert.equal(after, 10_9999_8160n);
      assert.equal(id, '123456');
    });
  });

  describe('unalias', () => {
    it('domain alias', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions);
      defaultOptions.request.withArgs({
        seed: 'device',
        method: 'GET',
        url: 'api/v4/domain/address',
        params: { crypto: bitcoinAtBitcoin._id, domain: 'nick.crypto' },
      }).resolves({ address: SECOND_ADDRESS_P2WPKH });

      const response = await wallet.unalias('nick.crypto');
      assert.ok(response);
      assert.equal(response.alias, 'nick.crypto');
      assert.equal(response.address, SECOND_ADDRESS_P2WPKH);
    });

    it('CashAddr', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, {
        ...defaultOptions,
        crypto: bitcoinCashAtBitcoinCash,
      });
      const response = await wallet.unalias('qpsmea0wn9ex38adldntrgn7yzhsug9m6urhumffzy');
      assert.ok(response);
      assert.equal(response.alias, 'qpsmea0wn9ex38adldntrgn7yzhsug9m6urhumffzy');
      assert.equal(response.address, 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs');
    });

    it('domain alias with CashAddr', async () => {
      const options = {
        ...defaultOptions,
        crypto: bitcoinCashAtBitcoinCash,
      };
      const wallet = await utils.createWallet(RANDOM_SEED, options);
      options.request.withArgs({
        seed: 'device',
        method: 'GET',
        url: 'api/v4/domain/address',
        params: { crypto: bitcoinCashAtBitcoinCash._id, domain: 'nick.crypto' },
      }).resolves({ address: 'qpsmea0wn9ex38adldntrgn7yzhsug9m6urhumffzy' });
      const response = await wallet.unalias('nick.crypto');
      assert.ok(response);
      assert.equal(response.alias, 'nick.crypto (qpsmea0wn9ex38adldntrgn7yzhsug9m6urhumffzy)');
      assert.equal(response.address, 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs');
    });

    it('domain alias with legacy BCH address', async () => {
      const options = {
        ...defaultOptions,
        crypto: bitcoinCashAtBitcoinCash,
      };
      const wallet = await utils.createWallet(RANDOM_SEED, options);
      options.request.withArgs({
        seed: 'device',
        method: 'GET',
        url: 'api/v4/domain/address',
        params: { crypto: bitcoinCashAtBitcoinCash._id, domain: 'nick.crypto' },
      }).resolves({ address: 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs' });
      const response = await wallet.unalias('nick.crypto');
      assert.ok(response);
      assert.equal(response.alias, 'nick.crypto');
      assert.equal(response.address, 'mpRkCswzPqyiamEPbBkEen1zWjUFEh5Hrs');
    });

    it('not alias', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions);
      const response = await wallet.unalias(RANDOM_ADDRESS);
      assert.equal(response, undefined);
    });

    it('missing alias', async () => {
      const wallet = await utils.createWallet(RANDOM_SEED, defaultOptions);
      defaultOptions.request.withArgs({
        seed: 'device',
        method: 'GET',
        url: 'api/v4/domain/address',
        params: { crypto: bitcoinAtBitcoin._id, domain: 'nick.crypto' },
        headers: sinon.match.object,
      }).rejects();
      const response = await wallet.unalias('nick.crypto');
      assert.equal(response, undefined);
    });
  });
});

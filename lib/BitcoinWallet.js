import * as btc from '@scure/btc-signer';
import { HDKey } from '@scure/bip32';
import utils from './utils.js';

import TxBuilder from './TxBuilder.js';
import TxTransformer from './TxTransformer.js';
import Vsize from './Vsize.js';

import * as symbols from './symbols.js';
import {
  Amount,
  CsWallet,
  errors,
} from '@coinspace/cs-common';

import API from './api/API.js';
import Bip32 from './Bip32.js';
import Unspent from './Unspent.js';
import networks from './networks.js';

export default class BitcoinWallet extends CsWallet {
  #api;
  #network;
  #maxTxInputs = 650; // ~100kb
  #addressTypes = [];
  #accounts = new Map();
  #balance = 0n;
  #txIds = new Set();
  #unspents = [];
  #bchaddr;
  #feeRates = new Map();
  #transactions = new Map();
  #txTransformer;

  // memorized functions
  #estimateMaxAmount;
  #estimateTransactionFee;
  #getUnspentsForTx;
  #getSortedTxIds;

  static ADDRESS_TYPE_P2PKH = symbols.ADDRESS_TYPE_P2PKH;
  static ADDRESS_TYPE_P2SH = symbols.ADDRESS_TYPE_P2SH;
  static ADDRESS_TYPE_P2WPKH = symbols.ADDRESS_TYPE_P2WPKH;
  static ADDRESS_TYPE_P2WSH = symbols.ADDRESS_TYPE_P2WSH;

  static FEE_RATE_MINIMUM = symbols.FEE_RATE_MINIMUM;
  static FEE_RATE_FASTEST = symbols.FEE_RATE_FASTEST;

  get defaultSettings() {
    const network = networks[this.development ? 'regtest' : 'mainnet'][this.crypto.platform];
    return ['bip44', 'bip49', 'bip84'].reduce((settings, key) => {
      if (network[key]) settings[key] = network[key];
      return settings;
    }, {});
  }

  get isImportSupported() {
    return true;
  }

  get isSettingsSupported() {
    return true;
  }

  get isCsFeeSupported() {
    return true;
  }

  get isFeeRatesSupported() {
    return true;
  }

  get isUnaliasSupported() {
    return true;
  }

  get isFactorsSupported() {
    return !!this.#network.factors;
  }

  get address() {
    return this.#getAddress();
  }

  get balance() {
    return new Amount(this.#balance, this.crypto.decimals);
  }

  get addressTypes() {
    return this.#addressTypes;
  }

  get feeRates() {
    return [...this.#feeRates.keys()];
  }

  get factors() {
    return this.#network.factors;
  }

  constructor(options = {}) {
    super(options);

    this.#api = new API(this);
    this.#network = networks[this.development ? 'regtest' : 'mainnet'][this.crypto.platform];
    this.#addressTypes = this.#network.addressTypes;
    this.#txTransformer = new TxTransformer({
      wallet: this,
      accounts: this.#accounts,
      network: this.#network,
    });

    this.#estimateMaxAmount = this.memoize(this._estimateMaxAmount);
    this.#estimateTransactionFee = this.memoize(this._estimateTransactionFee);
    this.#getUnspentsForTx = this.memoize(this._getUnspentsForTx);
    this.#getSortedTxIds = this.memoize(this._getSortedTxIds);
  }

  async create(seed) {
    this.typeSeed(seed);
    this.state = CsWallet.STATE_INITIALIZING;

    const hdkey = HDKey.fromMasterSeed(seed, this.#network.bip32);

    this.#addressTypes.forEach((type) => {
      const base = hdkey.derive(this.#getAddressTypePath(type)).wipePrivateData();
      this.#accounts.set(type, {
        external: base.deriveChild(0),
        internal: base.deriveChild(1),
        base,
        addresses: [],
        changeAddresses: [],
      });
    });
    await this.#initPlatform();
    this.#init();
    this.state = CsWallet.STATE_INITIALIZED;
  }

  async open(publicKey) {
    this.typePublicKey(publicKey);
    this.state = CsWallet.STATE_INITIALIZING;

    this.#addressTypes = this.#addressTypes.filter((type) => {
      const extendedKey = publicKey.data[type.description];
      if (!extendedKey) return false;
      // TODO check publicKey.path
      const base = HDKey.fromExtendedKey(extendedKey.xpub, this.#network.bip32);
      this.#accounts.set(type, {
        external: base.deriveChild(0),
        internal: base.deriveChild(1),
        base,
        addresses: [],
        changeAddresses: [],
      });
      return true;
    });
    await this.#initPlatform();
    this.#init();
    this.state = CsWallet.STATE_INITIALIZED;
  }

  async load() {
    this.state = CsWallet.STATE_LOADING;
    try {
      const bip32 = new Bip32({
        accounts: this.#accounts,
        api: this.#api,
        cache: this.cache,
        getAddressFromPublicKeyBuffer: this.#getAddressFromPublicKeyBuffer.bind(this),
      });
      const { txIds, unspents } = await bip32.load();
      this.#unspents = unspents;
      this.#txIds = txIds;
      this.#balance = this.#calculateBalance();
      this.storage.set('balance', this.#balance.toString());
      await this.storage.save();
      this.state = CsWallet.STATE_LOADED;
    } catch (err) {
      this.state = CsWallet.STATE_ERROR;
      throw err;
    }
  }

  async loadFeeRates() {
    const fees = await this.requestWeb({
      method: 'GET',
      url: 'api/v4/fees',
      params: {
        crypto: this.crypto._id,
      },
    });

    this.#feeRates.clear();
    fees.forEach((fee) => {
      if (fee.name === 'minimum') this.#feeRates.set(BitcoinWallet.FEE_RATE_MINIMUM, BigInt(fee.value));
      if (fee.name === 'default') this.#feeRates.set(BitcoinWallet.FEE_RATE_DEFAULT, BigInt(fee.value));
      if (fee.name === 'fastest') this.#feeRates.set(BitcoinWallet.FEE_RATE_FASTEST, BigInt(fee.value));
    });
  }

  #init() {
    this.#balance = BigInt(this.storage.get('balance') || 0);
  }

  async #initPlatform() {
    if (this.crypto.platform === 'bitcoin-cash') {
      this.#bchaddr = (await import('bchaddrjs')).default;
    }
  }

  async cleanup() {
    await super.cleanup();
    this.memoizeClear(this.#estimateMaxAmount);
    this.memoizeClear(this.#estimateTransactionFee);
    this.memoizeClear(this.#getUnspentsForTx);
    this.memoizeClear(this.#getSortedTxIds);
  }

  getPublicKey() {
    const data = {};
    this.#accounts.forEach((account, type) => {
      data[type.description] = {
        xpub: account.base.publicExtendedKey,
        path: this.#getAddressTypePath(type),
      };
    });
    return { data };
  }

  getPrivateKey(seed) {
    this.typeSeed(seed);

    const privateAccounts = this.#getPrivateAccounts(seed);
    const privateKey = [];
    const exported = {};

    this.#unspents.forEach((unspent) => {
      if (exported[unspent.address]) return;
      exported[unspent.address] = true;
      const key = this.#getPrivateKeyForUnspent(unspent, privateAccounts);
      privateKey.push({
        address: this.#prettyAddress(unspent.address),
        privatekey: btc.WIF(this.#network).encode(key),
      });
    });
    return privateKey;
  }

  async calculateCsFee(value) {
    return super.calculateCsFee(value, {
      dustThreshold: this.#network.dustThreshold,
    });
  }

  async validateAddress({ address }) {
    super.validateAddress({ address });
    const type = this.getAddressType(address);
    if (type === BitcoinWallet.ADDRESS_TYPE_UNKNOWN) {
      throw new errors.InvalidAddressError(address);
    }
    return true;
  }

  async validateAmount({ feeRate, address, amount }) {
    super.validateAmount({ feeRate, address, amount });
    const { value } = amount;
    if (value < this.#network.dustThreshold) {
      throw new errors.SmallAmountError(new Amount(this.#network.dustThreshold, this.crypto.decimals));
    }
    const maxAmount = await this.#estimateMaxAmount({ feeRate, address });
    if (value > maxAmount) {
      const unconfirmedMaxAmount = await this.#estimateMaxAmount({ feeRate, address, unconfirmed: true });
      if (value < unconfirmedMaxAmount) {
        throw new errors.BigAmountConfirmationPendingError(new Amount(maxAmount, this.crypto.decimals));
      } else {
        throw new errors.BigAmountError(new Amount(maxAmount, this.crypto.decimals));
      }
    }
    return true;
  }

  async _estimateTransactionFee({ address, value, feeRate }) {
    const txBuilder = new TxBuilder({
      wallet: this,
      unspents: await this.#getUnspentsForTx(),
      network: this.#network,
      calculateMinerFee: this.#calculateMinerFee.bind(this),
      vsizeOnly: true,
    });
    const maxAmount = await this.#estimateMaxAmount({ feeRate, address });
    const hasChange = (maxAmount - value) >= this.#network.dustThreshold;
    const { fee } = await txBuilder.build({
      feeRate,
      address,
      value,
      changeAddress: hasChange && this.#getChangeAddress(),
    });
    return fee;
  }

  async estimateTransactionFee({ address, amount, feeRate }) {
    super.estimateTransactionFee({ address, amount, feeRate });
    const { value } = amount;
    const fee = await this.#estimateTransactionFee({ address, value, feeRate });
    return new Amount(fee, this.crypto.decimals);
  }

  async _estimateMaxAmount({ feeRate, address, unconfirmed = false }) {
    const utxos = await this.#getUnspentsForTx({ unconfirmed });
    if (utxos.length === 0) {
      return 0n;
    }

    const vsize = new Vsize();
    const available = utxos.reduce((total, unspent) => {
      vsize.addInputs(unspent.type);
      return total + unspent.value;
    }, 0n);

    if (available < this.#network.dustThreshold) return 0n;

    vsize.addOutputs(this.getAddressType(address));

    const csFeeConfig = await this.getCsFeeConfig();
    if (!csFeeConfig.disabled) {
      vsize.addOutputs(this.getAddressType(csFeeConfig.address));
    }

    const minerFee = this.#calculateMinerFee(vsize, feeRate);

    const csFee = await this.calculateCsFee(available - minerFee);
    const maxAmount = available - minerFee - csFee;

    if (maxAmount < this.#network.dustThreshold) return 0n;
    return maxAmount;
  }

  async estimateMaxAmount(options) {
    super.estimateMaxAmount(options);
    const maxAmount = await this.#estimateMaxAmount(options);
    return new Amount(maxAmount, this.crypto.decimals);
  }

  async createTransaction({ feeRate, address, amount }, seed) {
    super.createTransaction({ feeRate, address, amount }, seed);
    const { value } = amount;
    const txBuilder = new TxBuilder({
      wallet: this,
      unspents: await this.#getUnspentsForTx(),
      network: this.#network,
      calculateMinerFee: this.#calculateMinerFee.bind(this),
    });
    const maxAmount = await this.#estimateMaxAmount({ feeRate, address });
    const hasChange = (maxAmount - value) >= this.#network.dustThreshold;
    await txBuilder.build({
      feeRate,
      address,
      value,
      changeAddress: hasChange && this.#getChangeAddress(),
    });
    const privateAccounts = this.#getPrivateAccounts(seed);
    txBuilder.sign((unspent) => {
      return { privateKey: this.#getPrivateKeyForUnspent(unspent, privateAccounts) };
    });
    await this.#api.transactions.propagate(txBuilder.tx.hex);
    await this.#afterTx(txBuilder);
  }

  async estimateImport({ privateKey: wif, feeRate }) {
    super.estimateImport({ feeRate });
    const { sendable } = await this.#prepareImport({ wif, feeRate });
    return new Amount(sendable, this.crypto.decimals);
  }

  async createImport({ privateKey: wif, feeRate }) {
    super.createImport({ feeRate });
    const { sendable, unspents, privateKey, compressed } = await this.#prepareImport({ wif, feeRate });
    const txBuilder = new TxBuilder({
      wallet: this,
      unspents,
      network: this.#network,
      calculateMinerFee: this.#calculateMinerFee.bind(this),
      isPublicKeyCompressed: compressed,
    });
    await txBuilder.build({
      feeRate,
      address: this.#getAddress(undefined, false),
      value: sendable,
    });
    txBuilder.sign(() => ({ privateKey, compressed }));
    await this.#api.transactions.propagate(txBuilder.tx.hex);
    await this.#afterTx(txBuilder);
  }

  async estimateReplacement(tx) {
    super.estimateReplacement(tx);
    const feePerByte = Math.ceil(tx.feePerByte * this.#network.rbfFactor);
    const txBuilder = new TxBuilder({
      wallet: this,
      unspents: [...tx.inputs, ...await this.#getUnspentsForTx()],
      network: this.#network,
      vsizeOnly: true,
    });
    const changeAddress = tx.changeAddress || this.#getChangeAddress();
    const { fee } = txBuilder.rbf({ tx, feePerByte, changeAddress });
    return {
      percent: Number((this.#network.rbfFactor - 1).toFixed(2)),
      fee: new Amount(fee, this.crypto.decimals),
    };
  }

  async createReplacementTransaction(tx, seed) {
    super.createReplacementTransaction(tx, seed);
    const feePerByte = Math.ceil(tx.feePerByte * this.#network.rbfFactor);
    const txBuilder = new TxBuilder({
      wallet: this,
      unspents: [...tx.inputs, ...await this.#getUnspentsForTx()],
      network: this.#network,
    });
    const changeAddress = tx.changeAddress || this.#getChangeAddress();
    txBuilder.rbf({ tx, feePerByte, changeAddress });
    const privateAccounts = this.#getPrivateAccounts(seed);
    txBuilder.sign((unspent) => {
      return { privateKey: this.#getPrivateKeyForUnspent(unspent, privateAccounts) };
    });
    await this.#api.transactions.propagate(txBuilder.tx.hex);
    await this.#afterReplacement(tx, txBuilder);
  }

  async loadTransactions({ cursor } = {}) {
    if (!cursor) {
      this.memoizeClear(this.#getSortedTxIds);
      this.#transactions.clear();
    }
    const sortedTxIds = await this.#getSortedTxIds();
    const start = cursor ? sortedTxIds.indexOf(cursor) + 1 : 0;
    const txIds = sortedTxIds.slice(start, start + this.txPerPage);
    const txs = await this.#api.transactions.get(txIds);
    const transactions = this.#txTransformer.transformTxs(txs);
    for (const transaction of transactions) {
      this.#transactions.set(transaction.id, transaction);
    }
    const hasMore = txs.length === this.txPerPage;
    return {
      transactions,
      hasMore,
      cursor: hasMore ? transactions.at(-1).id : undefined,
    };
  }

  async loadTransaction(id) {
    if (!this.#txIds.has(id)) {
      return;
    }
    if (this.#transactions.has(id)) {
      return this.#transactions.get(id);
    } else {
      const [tx] = await this.#api.transactions.get([id]);
      return this.#txTransformer.transformTx(tx);
    }
  }

  async unalias(alias) {
    const domain = await super.unalias(alias);
    const address = domain ? domain.address : alias;
    const legacyAddress = this.#legacyAddress(address);
    if (legacyAddress === alias) return;
    if (domain && address !== legacyAddress) {
      alias = `${alias} (${address})`;
    }
    return { alias, address: legacyAddress };
  }

  getAddressType(address) {
    try {
      const { type } = btc.Address(this.#network).decode(address);
      if (type === 'pkh') return BitcoinWallet.ADDRESS_TYPE_P2PKH;
      if (type === 'sh') return BitcoinWallet.ADDRESS_TYPE_P2SH;
      if (type === 'wpkh') return BitcoinWallet.ADDRESS_TYPE_P2WPKH;
      if (type === 'wsh') return BitcoinWallet.ADDRESS_TYPE_P2WSH;
    } catch (e) {} // eslint-disable-line no-empty
    return BitcoinWallet.ADDRESS_TYPE_UNKNOWN;
  }

  #getAddress(type = this.addressType, newFormat = true) {
    const cacheKey = `deriveIndex.${type.description}`;

    const account = this.#accounts.get(type);

    const deriveIndex = this.cache.get(cacheKey) || account.addresses.length;
    const node = account.external.deriveChild(deriveIndex);
    const address = this.#getAddressFromPublicKeyBuffer(node.publicKey, type);

    if (newFormat) {
      return this.#prettyAddress(address);
    }
    return address;
  }

  #getChangeAddress(type = this.addressType) {
    const account = this.#accounts.get(type);
    const node = account.internal.deriveChild(account.changeAddresses.length);
    return this.#getAddressFromPublicKeyBuffer(node.publicKey, type);
  }

  #getAddressFromPublicKeyBuffer(publicKeyBuffer, type) {
    if (type === BitcoinWallet.ADDRESS_TYPE_P2PKH) {
      const { address } = btc.p2pkh(publicKeyBuffer, this.#network);
      return address;
    }
    if (type === BitcoinWallet.ADDRESS_TYPE_P2SH) {
      const { address } = btc.p2sh(btc.p2wpkh(publicKeyBuffer, this.#network), this.#network);
      return address;
    }
    if (type === BitcoinWallet.ADDRESS_TYPE_P2WPKH) {
      const { address } = btc.p2wpkh(publicKeyBuffer, this.#network);
      return address;
    }
  }

  #getAddressTypePath(type) {
    if (type === BitcoinWallet.ADDRESS_TYPE_P2PKH) return this.settings.bip44;
    if (type === BitcoinWallet.ADDRESS_TYPE_P2SH) return this.settings.bip49;
    if (type === BitcoinWallet.ADDRESS_TYPE_P2WPKH) return this.settings.bip84;
  }

  #getPrivateAccounts(seed) {
    const hdkey = HDKey.fromMasterSeed(seed, this.#network.bip32);
    const privateAccounts = new Map();
    this.#accounts.forEach((_, type) => {
      const base = hdkey.derive(this.#getAddressTypePath(type));
      privateAccounts.set(type, {
        external: base.deriveChild(0),
        internal: base.deriveChild(1),
      });
    });
    return privateAccounts;
  }

  #getPrivateKeyForUnspent(unspent, privateAccounts) {
    const { address, type } = unspent;
    const account = this.#accounts.get(type);
    const privateAccount = privateAccounts.get(type);
    let index;
    if ((index = account.addresses.indexOf(address)) > -1) {
      return privateAccount.external.deriveChild(index).privateKey;
    } else if ((index = account.changeAddresses.indexOf(address)) > -1) {
      return privateAccount.internal.deriveChild(index).privateKey;
    }
  }

  #prettyAddress(address) {
    if (this.crypto.platform === 'bitcoin-cash') {
      return this.#bchaddr.toCashAddress(address).split(':')[1];
    }
    return address;
  }

  #legacyAddress(address) {
    if (this.crypto.platform === 'bitcoin-cash') {
      try {
        return this.#bchaddr.toLegacyAddress(address);
        // eslint-disable-next-line no-empty
      } catch (err) {}
    }
    return address;
  }

  #calculateMinerFee(vsize, feeRate) {
    return BigInt(vsize.value()) * this.#feeRates.get(feeRate);
  }

  #calculateBalance() {
    return this.#unspents.reduce((balance, item) => balance + item.value, 0n);
  }

  async #afterReplacement(tx, txBuilder) {
    const { inputs, outputs } = tx;
    this.#balance = this.#calculateBalance();

    inputs.forEach((input) => {
      this.#unspents.push(input);
    });
    outputs.forEach((output) => {
      const unspent = this.#unspents.find((item) => item.txId === output.txId && item.vout === output.vout);
      if (unspent) {
        this.#unspents.splice(this.#unspents.indexOf(unspent), 1);
      }
    });
    this.#txIds.delete(tx.id);
    this.#balance = this.#calculateBalance();
    await this.#afterTx(txBuilder);
  }

  async #afterTx({ inputs, outputs, tx }) {
    this.#unspents = this.#unspents.filter((unspent) => !inputs.includes(unspent));
    outputs.forEach(({ address, value, type }, vout) => {
      const account = this.#accounts.get(type);
      const nextChangeAddress = this.#getChangeAddress(type);
      const nextAddress = this.#getAddress(type, false);
      if (address === nextChangeAddress) {
        account.changeAddresses.push(address);
      } else if (address === nextAddress) {
        account.addresses.push(address);
        this.cache.set(`deriveIndex.${type.description}`, account.addresses.length);
      }
      if (account.addresses.includes(address) || account.changeAddresses.includes(address)) {
        this.#unspents.push(new Unspent({
          address,
          type,
          confirmations: 0,
          txId: tx.id,
          value,
          vout,
        }));
      }
    });
    this.#txIds.add(tx.id);
    this.#balance = this.#calculateBalance();
    this.storage.set('balance', this.#balance.toString());
    await this.storage.save();
  }

  async #prepareImport({ wif, feeRate }) {
    const { privateKey, publicKey, compressed } = utils.decodeWIF(wif, this.#network);
    const addresses = [];
    this.#network.addressTypes.forEach((type) => {
      // https://github.com/bitcoin/bips/blob/master/bip-0143.mediawiki#restrictions-on-public-key-type
      if (!compressed && type !== BitcoinWallet.ADDRESS_TYPE_P2PKH) return;
      addresses.push(this.#getAddressFromPublicKeyBuffer(publicKey, type));
    });
    const vsize = new Vsize({ isPublicKeyCompressed: compressed });
    const unspents = await this.#getUnspentsForTx({
      unspents: await this.#api.addresses.unspents(addresses),
    });
    const value = unspents.reduce((total, unspent) => {
      vsize.addInputs(unspent.type);
      return total + unspent.value;
    }, 0n);

    if (value < this.#network.dustThreshold) {
      throw new errors.SmallAmountError(new Amount(this.#network.dustThreshold, this.crypto.decimals));
    }

    vsize.addOutputs(this.addressType);

    const csFeeConfig = await this.getCsFeeConfig();
    if (!csFeeConfig.disabled) {
      vsize.addOutputs(this.getAddressType(csFeeConfig.address));
    }

    const minerFee = this.#calculateMinerFee(vsize, feeRate);
    const csFee = await this.calculateCsFee(value - minerFee);
    const fee = minerFee + csFee;
    const sendable = value - fee;

    if (sendable < this.#network.dustThreshold) {
      throw new errors.SmallAmountError(new Amount(this.#network.dustThreshold, this.crypto.decimals));
    }
    return {
      value,
      fee,
      sendable,
      unspents,
      privateKey,
      compressed,
    };
  }

  _getUnspentsForTx({ unspents = this.#unspents, unconfirmed = false } = {}) {
    return unspents.filter((unspent) => {
      return unconfirmed || unspent.confirmations >= this.#network.minConf;
    }).sort((a, b) => {
      if (a.value > b.value) return -1;
      if (a.value < b.value) return 1;
      return 0;
    }).slice(0, this.#maxTxInputs);
  }

  _getSortedTxIds() {
    return this.#api.transactions.sortedTxIds(Array.from(this.#txIds));
  }
}

import crypto from 'crypto';
import sinon from 'sinon';

import Wallet from '@coinspace/cs-bitcoin-wallet';

export async function createWallet(RANDOM_SEED, options, unspentOptions = []) {
  const request = sinon.stub(options, 'request');

  const unspents = unspentOptions.map((option) => addressUnspent(option));
  const unspentAddresses = [...new Set(unspents.map((item) => item.address))];

  const regex = new RegExp('api/v1/addrs/([\\w,]+)$');
  request.withArgs(sinon.match((value) => {
    return regex.test(value?.url);
  })).callsFake(({ url }) => {
    const addresses = url.match(regex)[1].split(',');
    return Promise.resolve(addresses.map((address) => addressInfo(address, unspents)));
  });

  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: `api/v1/addrs/${unspentAddresses.join(',')}/utxo`,
    baseURL: 'node',
    headers: sinon.match.object,
  }).resolves(unspents.filter((item) => item.satoshis > 0));

  const wallet = new Wallet({
    ...options,
  });
  await wallet.create(RANDOM_SEED);
  await wallet.load();

  return wallet;
}

export function addressUnspent(options) {
  return {
    address: options.address,
    txid: options.txid ?? crypto.randomBytes(32).toString('hex'),
    vout: options.vout ?? 0,
    satoshis: options.satoshis,
    confirmations: options.confirmations ?? 300,
  };
}

export function addressInfo(address, unspents) {
  const utxosConfirmed = unspents.filter((item) => item.address === address && item.confirmations > 0);
  const utxosUnconfirmed = unspents.filter((item) => item.address === address && item.confirmations === 0);
  const txApperances = new Set(utxosConfirmed.map((item) => item.txid));
  const unconfirmedTxApperances = new Set(utxosUnconfirmed.map((item) => item.txid));
  return {
    balance: utxosConfirmed.reduce((sum, item) => sum + item.satoshis, 0) / 1e8,
    unconfirmedBalance: utxosUnconfirmed.reduce((sum, item) => sum + item.satoshis, 0) / 1e8,
    txApperances: txApperances.size,
    unconfirmedTxApperances: unconfirmedTxApperances.size,
    transactions: Array.from([...txApperances, ...unconfirmedTxApperances]),
    addrStr: address,
  };
}

export function stubUnspents(request, unspentOptions) {
  const unspents = unspentOptions.map((option) => addressUnspent(option));
  const regex = new RegExp('api/v1/addrs/([\\w,]+)/utxo$');
  request.withArgs(sinon.match((value) => {
    return regex.test(value?.url);
  })).callsFake(({ url }) => {
    const addresses = url.match(regex)[1].split(',');
    return Promise.resolve(addresses.map((address) => {
      return unspents.filter((item) => item.address === address);
    }).flat());
  });
}

export function stubCsFee(request, cryptoId, csFee) {
  request.withArgs({
    seed: 'device',
    method: 'GET',
    url: 'api/v4/csfee',
    params: { crypto: cryptoId },
  }).resolves(csFee);
}

export function stubSendTx(request, txId = '123456') {
  request.withArgs({
    seed: 'device',
    method: 'POST',
    url: 'api/v1/tx/send',
    baseURL: 'node',
    data: sinon.match.any,
    headers: sinon.match.object,
  }).resolves({ txId });
}

export function stubTxs(request, txs) {
  const regexConfirmations = new RegExp('api/v1/txs/([\\w,]+)/confirmations$');
  request.withArgs(sinon.match((value) => {
    return regexConfirmations.test(value?.url);
  })).callsFake(({ url }) => {
    const txIds = url.match(regexConfirmations)[1].split(',');
    return Promise.resolve(txIds.map((txid) => {
      const tx = txs.find((item) => item.txid === txid);
      return {
        txid: tx.txid,
        confirmations: tx.confirmations,
        ...tx.confirmations === 0 ? { time: tx.time } : {},
      };
    }));
  });
  const regex = new RegExp('api/v1/txs/([\\w,]+)$');
  request.withArgs(sinon.match((value) => {
    return regex.test(value?.url);
  })).callsFake(({ url }) => {
    const txIds = url.match(regex)[1].split(',');
    return Promise.resolve(txIds.map((txid) => {
      return txs.find((item) => item.txid === txid);
    }));
  });
}

export async function loadFeeRates(wallet, options, feeRates = { default: 1 }) {
  options.request.withArgs({
    seed: 'device',
    method: 'GET',
    url: 'api/v4/fees',
    params: { crypto: options.crypto._id },
  }).resolves(Object.keys(feeRates).map((key) => {
    return {
      name: key,
      value: feeRates[key],
    };
  }));
  await wallet.loadFeeRates();
}

export function txsToUnspentOptions(txs, addresses = []) {
  const result = [];
  txs.forEach((tx) => {
    tx.vin.forEach((input) => {
      const address = input.addr;
      if (addresses.includes(address)) {
        result.push({
          address,
          satoshis: 0,
          confirmations: tx.confirmations,
          vout: input.vout,
          txid: tx.txid,
        });
      }
    });
    tx.vout.forEach((output) => {
      const address = output.scriptPubKey.addresses[0];
      if (addresses.includes(address)) {
        result.push({
          address,
          satoshis: output.valueSat,
          confirmations: tx.confirmations,
          vout: output.vout,
          txid: tx.txid,
        });
      }
    });
  });
  return result;
}

export async function loadAllTxs(wallet) {
  let result = {};
  const txs = [];
  do {
    result = await wallet.loadTransactions({ cursor: result.cursor });
    txs.push(...result.transactions);
  } while (result.hasMore);
  return txs;
}

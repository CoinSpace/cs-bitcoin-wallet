import * as btc from '@scure/btc-signer';
import { Amount } from '@coinspace/cs-common';

import BitcoinTransaction from './BitcoinTransaction.js';
import Unspent from './Unspent.js';
import Vsize from './Vsize.js';

export default class TxTransformer {
  #network;
  #accounts;
  #wallet;

  constructor({ wallet, accounts, network } = {}) {
    this.#wallet = wallet;
    this.#accounts = accounts;
    this.#network = network;
  }

  transformTxs(txs) {
    return txs.map((tx) => {
      return this.transformTx(tx);
    });
  }

  transformTx(tx) {
    let inputValue = 0n;
    let outputValue = 0n;
    let csFee = 0n;
    let rbf = this.#network.bip125 && tx.confirmations === 0;
    let inputs = [];
    let outputs = [];
    let changeAddress;
    const vsize = new Vsize();

    tx.vin.forEach((input) => {
      const { addr: address, valueSat, sequence, vout, txid } = input;
      const value = BigInt(valueSat);
      const type = this.#wallet.getAddressType(address);
      const account = this.#accounts.get(type);
      if (account && (account.addresses.includes(address) || account.changeAddresses.includes(address))) {
        inputValue = inputValue + value;
      }
      rbf = rbf && (sequence < btc.DEFAULT_SEQUENCE - 1);
      vsize.addInputs(type);
      if (rbf) {
        inputs.push(new Unspent({
          address,
          type,
          confirmations: this.#network.minConf,
          txId: txid,
          value,
          vout,
        }));
      }
    });
    tx.vout.forEach((output, i) => {
      const address = output.scriptPubKey.addresses[0];
      const { valueSat, vout, csfee } = output;
      const value = BigInt(valueSat);
      const type = this.#wallet.getAddressType(address);
      const account = this.#accounts.get(type);
      if (account && (account.addresses.includes(address) || account.changeAddresses.includes(address))) {
        outputValue = outputValue + value;
        if (i !== 0) changeAddress = address;
      } else if (output.csfee === true) {
        csFee = csFee + value;
      }
      vsize.addOutputs(type);
      if (rbf) {
        outputs.push(new Unspent({
          address,
          type,
          confirmations: tx.confirmations,
          txId: tx.txid,
          value,
          vout,
          csfee,
        }));
      }
    });

    const minerFee = Math.round(tx.fees * 1e8);
    const totalFee = csFee + BigInt(minerFee);
    const value = outputValue - inputValue;
    let amount;
    let incoming;
    let to;
    if (value > 0) {
      incoming = true;
      amount = new Amount(value, this.#wallet.crypto.decimals);
      rbf = false;
      changeAddress = undefined;
    } else {
      incoming = false;
      amount = new Amount(-1n * value - totalFee, this.#wallet.crypto.decimals);
      to = tx.vout[0].scriptPubKey.addresses[0];
    }
    let status;
    if (tx.confirmations >= this.#network.minConf) {
      status = BitcoinTransaction.STATUS_SUCCESS;
    } else {
      status = BitcoinTransaction.STATUS_PENDING;
    }

    const feePerByte = Math.ceil(minerFee / vsize.value());
    rbf = rbf && (feePerByte * this.#network.rbfFactor < this.#network.maxFeePerByte);
    if (!rbf) {
      inputs = [];
      outputs = [];
    }

    return new BitcoinTransaction({
      status,
      id: tx.txid,
      to,
      amount,
      incoming,
      fee: new Amount(totalFee, this.#wallet.crypto.decimals),
      timestamp: new Date(tx.time * 1000),
      confirmations: tx.confirmations,
      minConfirmations: this.#network.minConf,
      development: this.#wallet.development,
      network: this.#network,
      rbf,
      feePerByte,
      inputs,
      outputs,
      changeAddress,
    });
  }
}

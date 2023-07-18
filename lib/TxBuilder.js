import * as btc from '@scure/btc-signer';
import { errors } from '@coinspace/cs-common';

import * as symbols from './symbols.js';
import Vsize from './Vsize.js';
import utils from './utils.js';

export default class TxBuilder {
  #wallet;
  #unspents = [];
  #network;
  #calculateMinerFee;
  #vsizeOnly;
  #vsize;

  inputs = [];
  outputs = [];
  tx = new btc.Transaction({ allowLegacyWitnessUtxo: true });

  constructor({ wallet, unspents, network, calculateMinerFee, vsizeOnly = false, isPublicKeyCompressed = true } = {}) {
    this.#wallet = wallet;
    this.#unspents = unspents;
    this.#network = network;
    this.#calculateMinerFee = calculateMinerFee;
    this.#vsizeOnly = vsizeOnly;
    this.#vsize = new Vsize({ isPublicKeyCompressed });
  }

  async build({ feeRate, address, value, changeAddress }) {
    const csFeeConfig = await this.#wallet.getCsFeeConfig();

    this.#addOutput(address, value);

    let csFee = 0n;
    if (!csFeeConfig.disabled) {
      csFee = await this.#wallet.calculateCsFee(value);
      this.#addOutput(csFeeConfig.address, csFee);
    }
    let changeAddressType;
    if (changeAddress) {
      changeAddressType = this.#wallet.getAddressType(changeAddress);
      this.#vsize.addOutputs(changeAddressType);
    }

    let accum = 0n;
    let fee = 0n;
    let minerFee = 0n;
    let change = 0n;

    for (const unspent of this.#unspents) {
      this.#addInput(unspent);
      accum += unspent.value;
      minerFee = this.#calculateMinerFee(this.#vsize, feeRate);
      fee = minerFee + csFee;
      const subTotal = value + fee;
      if (accum >= subTotal) {
        change = accum - subTotal;
        break;
      }
    }

    if (changeAddress) {
      if (change >= this.#network.dustThreshold) {
        this.#addOutput(changeAddress, change, false);
      } else {
        this.#vsize.addOutputs(changeAddressType, -1);
        minerFee = this.#calculateMinerFee(this.#vsize, feeRate);
        fee = minerFee + csFee;
      }
    } else {
      fee += change;
    }
    return { fee };
  }

  rbf({ tx, feePerByte, changeAddress }) {
    const { address, value } = tx.outputs[0];
    this.#addOutput(address, value);

    const csFeeOutput = tx.outputs.find((output) => output.csfee);
    let csFee = 0n;
    if (csFeeOutput) {
      csFee = csFeeOutput.value;
      this.#addOutput(csFeeOutput.address, csFee);
    }

    const changeAddressType = this.#wallet.getAddressType(changeAddress);
    this.#vsize.addOutputs(changeAddressType);

    let accum = 0n;
    let fee = 0n;
    let minerFee = 0n;
    let change = 0n;
    let subTotal = 0n;

    for (const unspent of this.#unspents) {
      this.#addInput(unspent);
      accum += unspent.value;
      minerFee = BigInt(Math.ceil(this.#vsize.value() * feePerByte));
      fee = minerFee + csFee;
      subTotal = value + fee;
      if (accum >= subTotal) {
        change = accum - subTotal;
        if (change >= this.#network.dustThreshold) {
          this.#addOutput(changeAddress, change, false);
          break;
        } else if (tx.changeAddress) {
          // if change address exist in tx, we can't remove it
          continue;
        } else {
          this.#vsize.addOutputs(changeAddressType, -1);
          minerFee = BigInt(Math.ceil(this.#vsize.value() * feePerByte));
          fee = minerFee + csFee;
        }
        break;
      }
    }
    if (accum < subTotal) {
      throw new errors.BigAmountError();
    }
    return { fee: fee - tx.fee.value };
  }

  sign(getPrivateKeyForUnspent) {
    this.inputs.forEach((unspent, i) => {
      const { privateKey, compressed = true } = getPrivateKeyForUnspent(unspent);
      if (unspent.type === symbols.ADDRESS_TYPE_P2SH) {
        this.tx.inputs[i].redeemScript = utils.redeemScript(privateKey, this.#network);
      }
      if (compressed) {
        this.tx.signIdx(privateKey, i);
      } else {
        const partialSig = utils.partialSigForUncompressed(this.tx, privateKey, i);
        this.tx.updateInput(i, { partialSig }, true);
      }
      this.tx.finalizeIdx(i);
    });
    return this.tx;
  }

  #addInput(unspent) {
    this.#vsize.addInputs(unspent.type);
    if (this.#vsizeOnly) return;

    this.inputs.push(unspent);
    this.tx.addInput({
      txid: unspent.txId,
      index: unspent.vout,
      sequence: this.#network.bip125 ? btc.DEFAULT_SEQUENCE - 2 : btc.DEFAULT_SEQUENCE,
      witnessUtxo: {
        amount: BigInt(unspent.value),
        script: utils.toOutputScript(unspent.address, this.#network),
      },
    });
  }

  #addOutput(address, value, addVsize = true) {
    const type = this.#wallet.getAddressType(address);

    if (addVsize) this.#vsize.addOutputs(type);
    if (this.#vsizeOnly) return;

    this.outputs.push({ address, value, type });
    this.tx.addOutputAddress(address, value, this.#network);
  }
}

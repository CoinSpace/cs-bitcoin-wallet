import { Transaction } from '@coinspace/cs-common';

export default class BitcoinTransaction extends Transaction {
  #network;
  #feePerByte;
  #inputs;
  #outputs;
  #changeAddress;

  constructor(options) {
    super(options);
    this.#network = options.network;
    this.#feePerByte = options.feePerByte;
    this.#inputs = options.inputs;
    this.#outputs = options.outputs;
    this.#changeAddress = options.changeAddress;
  }

  get url() {
    return this.#network.txUrl.replace('${txId}', this.id);
  }

  get feePerByte() {
    return this.#feePerByte;
  }

  get inputs() {
    return this.#inputs;
  }

  get outputs() {
    return this.#outputs;
  }

  get changeAddress() {
    return this.#changeAddress;
  }
}

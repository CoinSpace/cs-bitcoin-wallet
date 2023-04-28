import addressTypes from './addressTypes.js';

export default class Vsize {
  #inputs = new Map();
  #outputs = new Map();
  #isPublicKeyCompressed;

  constructor({ isPublicKeyCompressed = true } = {}) {
    this.#isPublicKeyCompressed = isPublicKeyCompressed;
  }

  addInputs(type, value = 1) {
    this.#inputs.set(type, (this.#inputs.get(type) || 0) + value);
  }
  addOutputs(type, value = 1) {
    this.#outputs.set(type, (this.#outputs.get(type) || 0) + value);
  }

  static getInputSize(type, compressed = true) {
    if (type === addressTypes.P2PKH && compressed) return 148; // (32 + 4) + 1 + (1 + 72 + 1 + 33) + 4 = 148
    if (type === addressTypes.P2PKH) return 180; // (32 + 4) + 1 + (1 + 72 + 1 + 65) + 4 = 180
    if (type === addressTypes.P2SH) return 91; // (((32 + 4) + 1 + 23 + 4) * 4 + (1 + 1 + 72 + 1 + 33)) / 4 = 91
    if (type === addressTypes.P2WPKH) return 68; // (((32 + 4) + 1 + 4) * 4 + (1 + 1 + 72 + 1 + 33)) / 4 = 68
  }

  static getOutputSize(type) {
    if (type === addressTypes.P2PKH) return 34;
    if (type === addressTypes.P2SH) return 32;
    if (type === addressTypes.P2WPKH) return 31;
    if (type === addressTypes.P2WSH) return 43;
  }

  value() {
    let inputSize = 0;
    let inputCount = 0;
    let witnessCount = 0;

    this.#inputs.forEach((count, type) => {
      if (!count) return;
      inputCount += count;
      inputSize += count * Vsize.getInputSize(type, this.#isPublicKeyCompressed);
      if (type === addressTypes.P2SH || type === addressTypes.P2WPKH) {
        witnessCount += count;
      }
    });

    let outputSize = 0;
    let outputCount = 0;
    this.#outputs.forEach((count, type) => {
      if (!count) return;
      outputCount += count;
      outputSize += count * Vsize.getOutputSize(type);
    });

    let witnessVBytes = 0;
    if (witnessCount > 0) {
      witnessVBytes = 0.25 + 0.25 + getSizeOfVarInt(witnessCount) / 4;
    }
    const overheadVBytes = 4 + getSizeOfVarInt(inputCount) + getSizeOfVarInt(outputCount) + 4 + witnessVBytes;
    const vBytes = overheadVBytes + inputSize + outputSize;
    function getSizeOfVarInt(length) {
      if (length < 253) {
        return 1;
      } else if (length < 65535) {
        return 3;
      }
    }
    return Math.ceil(vBytes);
  }
}

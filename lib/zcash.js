// Zcash v5 transparent-only transactions (ZIP-225), signature hashing (ZIP-244)
// and decoding of TEX (ZIP-320) and unified (ZIP-316) addresses
import * as btc from '@scure/btc-signer';
import { blake2b } from '@noble/hashes/blake2b';
import { secp256k1 } from '@noble/curves/secp256k1';
import { bech32m, hex } from '@scure/base';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils';

const TX_VERSION = 5;
const VERSION_GROUP_ID = 0x26A7270A;
const SIGHASH_ALL = 0x01;

function u32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);
  return bytes;
}

function u64(value) {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), true);
  return bytes;
}

function varBytes(bytes) {
  return concatBytes(btc.CompactSize.encode(BigInt(bytes.length)), bytes);
}

function hash(personalization, ...data) {
  const pers = typeof personalization === 'string' ? utf8ToBytes(personalization) : personalization;
  return blake2b(concatBytes(...data), { dkLen: 32, personalization: pers });
}

function getInputs(tx) {
  const inputs = [];
  for (let i = 0; i < tx.inputsLength; i++) inputs.push(tx.getInput(i));
  return inputs;
}

function getOutputs(tx) {
  const outputs = [];
  for (let i = 0; i < tx.outputsLength; i++) outputs.push(tx.getOutput(i));
  return outputs;
}

// scure keeps txid in display order, serialized form is reversed
function prevout(input) {
  return concatBytes(input.txid.slice().reverse(), u32(input.index));
}

function header(branchId) {
  return concatBytes(
    u32((TX_VERSION | (1 << 31)) >>> 0),
    u32(VERSION_GROUP_ID),
    u32(branchId),
    u32(0), // lock_time
    u32(0) // expiry_height
  );
}

function digests(tx, branchId) {
  const inputs = getInputs(tx);
  const outputs = getOutputs(tx);
  return {
    inputs,
    header: hash('ZTxIdHeadersHash', header(branchId)),
    prevouts: hash('ZTxIdPrevoutHash', ...inputs.map(prevout)),
    sequence: hash('ZTxIdSequencHash', ...inputs.map((input) => u32(input.sequence))),
    outputs: hash('ZTxIdOutputsHash',
      ...outputs.map((output) => concatBytes(u64(output.amount), varBytes(output.script)))
    ),
    sapling: hash('ZTxIdSaplingHash'),
    orchard: hash('ZTxIdOrchardHash'),
    txHashPers: concatBytes(utf8ToBytes('ZcashTxHash_'), u32(branchId)),
  };
}

function sighash(tx, i, branchId) {
  const d = digests(tx, branchId);
  const input = d.inputs[i];
  const amounts = hash('ZTxTrAmountsHash', ...d.inputs.map((item) => u64(item.witnessUtxo.amount)));
  const scripts = hash('ZTxTrScriptsHash', ...d.inputs.map((item) => varBytes(item.witnessUtxo.script)));
  const txin = hash('Zcash___TxInHash',
    prevout(input),
    u64(input.witnessUtxo.amount),
    varBytes(input.witnessUtxo.script),
    u32(input.sequence)
  );
  const transparent = hash('ZTxIdTranspaHash',
    new Uint8Array([SIGHASH_ALL]),
    d.prevouts,
    amounts,
    scripts,
    d.sequence,
    d.outputs,
    txin
  );
  return hash(d.txHashPers, d.header, transparent, d.sapling, d.orchard);
}

function sign(tx, privateKey, i, branchId) {
  const publicKey = secp256k1.getPublicKey(privateKey, true);
  const hash = sighash(tx, i, branchId);
  const sig = secp256k1.sign(hash, privateKey).toDERRawBytes();
  const partialSig = [[publicKey, concatBytes(sig, new Uint8Array([SIGHASH_ALL]))]];
  tx.updateInput(i, { partialSig }, true);
}

function serialize(tx, branchId) {
  const inputs = getInputs(tx);
  const outputs = getOutputs(tx);
  return hex.encode(concatBytes(
    header(branchId),
    btc.CompactSize.encode(BigInt(inputs.length)),
    ...inputs.map((input) => concatBytes(prevout(input), varBytes(input.finalScriptSig), u32(input.sequence))),
    btc.CompactSize.encode(BigInt(outputs.length)),
    ...outputs.map((output) => concatBytes(u64(output.amount), varBytes(output.script))),
    new Uint8Array([
      0, // nSpendsSapling
      0, // nOutputsSapling
      0, // nActionsOrchard
    ])
  ));
}

function txId(tx, branchId) {
  const d = digests(tx, branchId);
  const transparent = hash('ZTxIdTranspaHash', d.prevouts, d.sequence, d.outputs);
  return hex.encode(hash(d.txHashPers, d.header, transparent, d.sapling, d.orchard).reverse());
}

function decodeTex(address, network) {
  const { prefix, words } = bech32m.decode(address);
  if (prefix !== network.tex) throw new Error(`wrong TEX prefix=${prefix}`);
  const data = Uint8Array.from(bech32m.fromWords(words));
  if (data.length !== 20) throw new Error('Invalid TEX address');
  return { type: 'pkh', hash: data };
}

function f4unjumble(message) {
  if (message.length < 48) throw new Error('Invalid F4Jumble message length');
  const leftLength = Math.min(64, Math.floor(message.length / 2));
  const rightLength = message.length - leftLength;
  const xor = (a, b) => a.map((item, i) => item ^ b[i]);
  const H = (i, u) => blake2b(u, {
    dkLen: leftLength,
    personalization: concatBytes(utf8ToBytes('UA_F4Jumble_H'), new Uint8Array([i, 0, 0])),
  });
  const G = (i, u) => {
    const parts = [];
    for (let j = 0; j < Math.ceil(rightLength / 64); j++) {
      parts.push(blake2b(u, {
        dkLen: 64,
        personalization: concatBytes(utf8ToBytes('UA_F4Jumble_G'), new Uint8Array([i, j & 0xff, j >> 8])),
      }));
    }
    return concatBytes(...parts).subarray(0, rightLength);
  };
  const e = message.subarray(0, leftLength);
  const d = message.subarray(leftLength);
  const c = xor(e, H(1, d));
  const b = xor(d, G(1, c));
  const a = xor(c, H(0, b));
  return concatBytes(a, xor(b, G(0, a)));
}

const RECEIVER_P2PKH = 0x00;
const RECEIVER_P2SH = 0x01;

// only transparent receivers are supported
function decodeUnified(address, network) {
  const { prefix, words } = bech32m.decode(address, false);
  if (prefix !== network.unified) throw new Error(`wrong unified address prefix=${prefix}`);
  const data = f4unjumble(Uint8Array.from(bech32m.fromWords(words)));

  const padding = new Uint8Array(16);
  padding.set(utf8ToBytes(prefix));
  if (hex.encode(data.subarray(-16)) !== hex.encode(padding)) throw new Error('Invalid unified address padding');

  const items = data.subarray(0, -16);
  let offset = 0;
  const readCompactSize = () => {
    const first = items[offset++];
    if (first < 0xfd) return first;
    const length = first === 0xfd ? 2 : 4;
    if (first === 0xff) throw new Error('Invalid unified address item');
    let value = 0;
    for (let i = 0; i < length; i++) value += items[offset++] * 2 ** (8 * i);
    return value;
  };
  const receivers = new Map();
  while (offset < items.length) {
    const typecode = readCompactSize();
    const length = readCompactSize();
    if (offset + length > items.length) throw new Error('Invalid unified address item');
    receivers.set(typecode, items.slice(offset, offset + length));
    offset += length;
  }

  for (const [typecode, type] of [[RECEIVER_P2PKH, 'pkh'], [RECEIVER_P2SH, 'sh']]) {
    if (receivers.has(typecode)) {
      const hash = receivers.get(typecode);
      if (hash.length !== 20) throw new Error('Invalid transparent receiver');
      return { type, hash };
    }
  }
  throw new Error('Unified address has no transparent receiver');
}

export default {
  sign,
  serialize,
  txId,
  decodeTex,
  decodeUnified,
};

import * as btc from '@scure/btc-signer';
import { base58check as _b58 } from '@scure/base';
import { concatBytes } from '@noble/hashes/utils';
import { errors } from '@coinspace/cs-common';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import zcash from './zcash.js';

const base58check = _b58(sha256);

function decodeWIF(str, network) {
  try {
    let parsed = base58check.decode(str);
    if (parsed[0] !== network.wif) throw new Error('Wrong WIF prefix');
    parsed = parsed.subarray(1);

    let compressed = true;

    if (parsed.length === 32) {
      compressed = false;
    } else if (parsed.length === 33 && parsed[32] === 0x01) {
      parsed = parsed.subarray(0, -1);
    } else {
      throw new Error('Wrong WIF format');
    }
    const publicKey = secp256k1.getPublicKey(parsed, compressed);
    return {
      privateKey: parsed,
      publicKey,
      compressed,
    };
  } catch (err) {
    throw new errors.InvalidPrivateKeyError(undefined, { cause: err });
  }
}

// @scure/btc-signer supports only 1-byte base58 prefixes (zcash uses 2 bytes)
function Address(network) {
  if (network.pubKeyHash <= 0xff && network.scriptHash <= 0xff) {
    return btc.Address(network);
  }
  const toBytes = (prefix) => new Uint8Array([prefix >> 8, prefix & 0xff]);
  return {
    encode(from) {
      if (from.type === 'pkh') return base58check.encode(concatBytes(toBytes(network.pubKeyHash), from.hash));
      if (from.type === 'sh') return base58check.encode(concatBytes(toBytes(network.scriptHash), from.hash));
      throw new Error(`Unknown address type=${from.type}`);
    },
    decode(address) {
      const lower = address.toLowerCase();
      if (network.tex && lower.startsWith(`${network.tex}1`)) return zcash.decodeTex(address, network);
      if (network.unified && lower.startsWith(`${network.unified}1`)) return zcash.decodeUnified(address, network);
      const data = base58check.decode(address);
      if (data.length !== 22) throw new Error('Invalid base58 address');
      const prefix = (data[0] << 8) | data[1];
      if (prefix === network.pubKeyHash) return { type: 'pkh', hash: data.slice(2) };
      if (prefix === network.scriptHash) return { type: 'sh', hash: data.slice(2) };
      throw new Error(`Invalid address prefix=${prefix}`);
    },
  };
}

function toOutputScript(address, network) {
  return btc.OutScript.encode(Address(network).decode(address));
}

function redeemScript(privateKey, network) {
  return btc.p2wpkh(secp256k1.getPublicKey(privateKey, true), network).script;
}

function signUncompressed(tx, privateKey, i) {
  const publicKey = secp256k1.getPublicKey(privateKey, false);
  const { lastScript, sighash } = btc.getInputType(tx.inputs[i], true);
  const hash = tx.preimageLegacy(i, lastScript, sighash);
  const sig = secp256k1.sign(hash, privateKey).toDERRawBytes();
  const partialSig = [[publicKey, concatBytes(sig, new Uint8Array([sighash]))]];
  tx.updateInput(i, { partialSig }, true);
}

function signBitcoinCash(tx, privateKey, i, value) {
  const publicKey = secp256k1.getPublicKey(privateKey, true);
  const type = btc.getInputType(tx.inputs[i], true);
  const SIGHASH_BITCOINCASHBIP143 = 0x40;
  const sighash = type.sighash | SIGHASH_BITCOINCASHBIP143;
  const hash = tx.preimageWitnessV0(i, type.lastScript, sighash, value);
  const sig = secp256k1.sign(hash, privateKey).toDERRawBytes();
  const partialSig = [[publicKey, concatBytes(sig, new Uint8Array([sighash]))]];
  tx.updateInput(i, { partialSig }, true);
}

export default {
  Address,
  decodeWIF,
  toOutputScript,
  redeemScript,
  signUncompressed,
  signBitcoinCash,
};

import * as btc from '@scure/btc-signer';
import { base58check as _b58 } from '@scure/base';
import { concatBytes } from '@noble/hashes/utils';
import { errors } from '@coinspace/cs-common';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

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

function toOutputScript(address, network) {
  return btc.OutScript.encode(btc.Address(network).decode(address));
}

function redeemScript(privateKey, network) {
  return btc.p2wpkh(secp256k1.getPublicKey(privateKey, true), network).script;
}

function partialSigForUncompressed(tx, privateKey, i) {
  const publicKey = secp256k1.getPublicKey(privateKey, false);
  const { lastScript, sighash } = tx.inputType(tx.inputs[i]);
  const hash = tx.preimageLegacy(i, lastScript, sighash);
  const sig = secp256k1.sign(hash, privateKey).toDERRawBytes();
  return [[publicKey, concatBytes(sig, new Uint8Array([sighash]))]];
}

export default {
  decodeWIF,
  toOutputScript,
  redeemScript,
  partialSigForUncompressed,
};

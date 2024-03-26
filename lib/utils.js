import * as btc from '@scure/btc-signer';
import { base58check as _b58 } from '@scure/base';
import { concatBytes } from '@noble/hashes/utils';
import { errors } from '@coinspace/cs-common';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

const base58check = _b58(sha256);
const { SignatureHash, OutScript } = btc;

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

function signUncompressed(tx, privateKey, i) {
  const publicKey = secp256k1.getPublicKey(privateKey, false);
  const { lastScript, sighash } = getInputType(tx.inputs[i]);
  const hash = tx.preimageLegacy(i, lastScript, sighash);
  const sig = secp256k1.sign(hash, privateKey).toDERRawBytes();
  const partialSig = [[publicKey, concatBytes(sig, new Uint8Array([sighash]))]];
  tx.updateInput(i, { partialSig }, true);
}

function signBitcoinCash(tx, privateKey, i, value) {
  const publicKey = secp256k1.getPublicKey(privateKey, true);
  const type = getInputType(tx.inputs[i]);
  const SIGHASH_BITCOINCASHBIP143 = 0x40;
  const sighash = type.sighash | SIGHASH_BITCOINCASHBIP143;
  const hash = tx.preimageWitnessV0(i, type.lastScript, sighash, value);
  const sig = secp256k1.sign(hash, privateKey).toDERRawBytes();
  const partialSig = [[publicKey, concatBytes(sig, new Uint8Array([sighash]))]];
  tx.updateInput(i, { partialSig }, true);
}

// https://github.com/paulmillr/scure-btc-signer/blob/1.2.1/index.ts#L1765
function getInputType(input, allowLegacyWitnessUtxo = true) {
  let txType = 'legacy';
  let defaultSighash = SignatureHash.ALL;
  const prevOut = getPrevOut(input);
  const first = OutScript.decode(prevOut.script);
  let { type } = first;
  let cur = first;
  const stack = [first];
  if (first.type === 'tr') {
    defaultSighash = SignatureHash.DEFAULT;
    return {
      txType: 'taproot',
      type: 'tr',
      last: first,
      lastScript: prevOut.script,
      defaultSighash,
      sighash: input.sighashType || defaultSighash,
    };
  } else {
    if (first.type === 'wpkh' || first.type === 'wsh') txType = 'segwit';
    if (first.type === 'sh') {
      if (!input.redeemScript) throw new Error('inputType: sh without redeemScript');
      const child = OutScript.decode(input.redeemScript);
      if (child.type === 'wpkh' || child.type === 'wsh') txType = 'segwit';
      stack.push(child);
      cur = child;
      type += `-${child.type}`;
    }
    // wsh can be inside sh
    if (cur.type === 'wsh') {
      if (!input.witnessScript) throw new Error('inputType: wsh without witnessScript');
      const child = OutScript.decode(input.witnessScript);
      if (child.type === 'wsh') txType = 'segwit';
      stack.push(child);
      cur = child;
      type += `-${child.type}`;
    }
    const last = stack[stack.length - 1];
    if (last.type === 'sh' || last.type === 'wsh') {
      throw new Error('inputType: sh/wsh cannot be terminal type');
    }
    const lastScript = OutScript.encode(last);
    const res = {
      type,
      txType,
      last,
      lastScript,
      defaultSighash,
      sighash: input.sighashType || defaultSighash,
    };
    if (txType === 'legacy' && !allowLegacyWitnessUtxo && !input.nonWitnessUtxo) {
      throw new Error(
        // eslint-disable-next-line max-len
        'Transaction/sign: legacy input without nonWitnessUtxo, can result in attack that forces paying higher fees. Pass allowLegacyWitnessUtxo=true, if you sure'
      );
    }
    return res;
  }
}

// https://github.com/paulmillr/scure-btc-signer/blob/1.2.1/index.ts#L1723
function getPrevOut(input) {
  if (input.nonWitnessUtxo) {
    if (input.index === undefined) throw new Error('Unknown input index');
    return input.nonWitnessUtxo.outputs[input.index];
  } else if (input.witnessUtxo) return input.witnessUtxo;
  else throw new Error('Cannot find previous output info');
}

export default {
  decodeWIF,
  toOutputScript,
  redeemScript,
  signUncompressed,
  signBitcoinCash,
};

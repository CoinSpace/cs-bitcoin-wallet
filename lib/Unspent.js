export default class Unspent {
  address;
  type;
  confirmations;
  txId;
  value;
  vout;
  csfee;

  constructor({ address, type, confirmations, txId, value, vout, csfee = false }) {
    this.address = address;
    this.type = type;
    this.confirmations = confirmations;
    this.txId = txId;
    this.value = value;
    this.vout = vout;
    this.csfee = csfee;
  }
}

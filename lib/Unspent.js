export default class Unspent {
  address;
  type;
  confirmations;
  txId;
  value;
  vout;
  coinbase;
  csfee;

  constructor({ address, type, confirmations, txId, value, vout, coinbase, csfee = false }) {
    this.address = address;
    this.type = type;
    this.confirmations = confirmations;
    this.txId = txId;
    this.value = value;
    this.vout = vout;
    this.coinbase = coinbase;
    this.csfee = csfee;
  }
}

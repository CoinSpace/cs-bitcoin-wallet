import Addresses from './Addresses.js';
import Consensus from './Consensus.js';
import Fees from './Fees.js';
import Transactions from './Transactions.js';

export default class API {
  constructor(wallet) {
    this.addresses = new Addresses(wallet);
    this.consensus = new Consensus(wallet);
    this.fees = new Fees(wallet);
    this.transactions = new Transactions(wallet);
  }
}

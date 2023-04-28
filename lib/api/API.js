import Addresses from './Addresses.js';
import Transactions from './Transactions.js';

export default class API {
  constructor(wallet) {
    this.addresses = new Addresses(wallet);
    this.transactions = new Transactions(wallet);
  }
}

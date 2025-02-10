import Unspent from '../Unspent.js';

export default class Addresses {
  #wallet;
  constructor(wallet) {
    this.#wallet = wallet;
  }

  async info(addresses) {
    const data = await this.#wallet.requestNode({
      method: 'GET',
      url: `api/v1/addrs/${addresses.join(',')}`,
    });
    return data.map((res) => {
      return {
        address: res.addrStr,
        balance: BigInt(Math.round((res.balance + res.unconfirmedBalance) * 1e8)),
        txCount: res.txApperances + res.unconfirmedTxApperances,
        txIds: res.transactions,
      };
    });
  }

  async unspents(addresses) {
    if (!addresses.length) return [];
    const CHUNK_SIZE = 50;
    const utxos = [];
    for (let i = 0; i < Math.ceil(addresses.length / CHUNK_SIZE); i++) {
      const slice = addresses.slice(i * CHUNK_SIZE, i * CHUNK_SIZE + CHUNK_SIZE);
      utxos.push(await this.#wallet.requestNode({
        method: 'GET',
        url: `api/v1/addrs/${slice.join(',')}/utxo`,
      }));
    }
    return utxos.flat().map((utxo) => {
      return new Unspent({
        address: utxo.address,
        type: this.#wallet.getAddressType(utxo.address),
        confirmations: utxo.confirmations,
        txId: utxo.txid,
        value: BigInt(utxo.satoshis),
        vout: utxo.vout,
        coinbase: utxo.coinbase,
      });
    });
  }
}

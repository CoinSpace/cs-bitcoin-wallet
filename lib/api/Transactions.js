export default class Transactions {
  #wallet;
  constructor(wallet) {
    this.#wallet = wallet;
  }

  async sortedTxIds(txIds) {
    if (!txIds.length) return [];
    const CHUNK_SIZE = 50;
    const txs = [];
    for (let i = 0; i < Math.ceil(txIds.length / CHUNK_SIZE); i++) {
      const slice = txIds.slice(i * CHUNK_SIZE, i * CHUNK_SIZE + CHUNK_SIZE);
      txs.push(await this.#wallet.requestNode({
        method: 'GET',
        url: `api/v1/txs/${slice.join(',')}/confirmations`,
      }));
    }
    return txs.flat().sort((a, b) => {
      if (a.confirmations === 0 && b.confirmations === 0) {
        return b.time - a.time;
      }
      return a.confirmations - b.confirmations;
    }).map((tx) => tx.txid);
  }

  async get(txIds) {
    if (!txIds.length) return [];
    const CHUNK_SIZE = 50;
    const txs = [];
    for (let i = 0; i < Math.ceil(txIds.length / CHUNK_SIZE); i++) {
      const slice = txIds.slice(i * CHUNK_SIZE, i * CHUNK_SIZE + CHUNK_SIZE);
      txs.push(await this.#wallet.requestNode({
        method: 'GET',
        url: `api/v1/txs/${slice.join(',')}`,
      }));
    }
    return txs.flat();
  }

  async propagate(hex) {
    return this.#wallet.requestNode({
      method: 'POST',
      url: 'api/v1/tx/send',
      data: {
        rawtx: hex,
      },
    });
  }
}

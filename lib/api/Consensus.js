export default class Consensus {
  #wallet;
  constructor(wallet) {
    this.#wallet = wallet;
  }

  // zcash only
  async info() {
    const data = await this.#wallet.requestNode({
      method: 'GET',
      url: 'api/v1/consensus',
    });
    return {
      branchId: parseInt(data.branchId, 16),
    };
  }
}

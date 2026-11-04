export default class Fees {
  #wallet;
  constructor(wallet) {
    this.#wallet = wallet;
  }

  // zcash only (ZIP-317)
  async info() {
    const data = await this.#wallet.requestNode({
      method: 'GET',
      url: 'api/v1/fees',
    });
    return {
      marginalFee: BigInt(data.marginalFee),
      graceActions: data.graceActions,
    };
  }
}

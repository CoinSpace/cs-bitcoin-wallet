const BATCH_SIZE = 3;
const BATCH_SIZE_MAX = 10;

export default class Bip32 {
  #api;
  #cache;
  #accounts;
  #getAddressFromPublicKeyBuffer;

  constructor({ accounts, api, cache, getAddressFromPublicKeyBuffer }) {
    this.#accounts = accounts;
    this.#api = api;
    this.#cache = cache;
    this.#getAddressFromPublicKeyBuffer = getAddressFromPublicKeyBuffer;
  }

  async load() {
    let unspentAddresses = [];
    const txIds = new Set();

    for (const [type, account] of this.#accounts) {
      const [external, internal] = await Promise.all([
        this.#discover(account.external, type),
        this.#discover(account.internal, type),
      ]);

      external.txIds.forEach((item) => txIds.add(item));
      internal.txIds.forEach((item) => txIds.add(item));
      account.addresses = external.addresses;
      account.changeAddresses = internal.addresses;
      unspentAddresses = unspentAddresses.concat(external.unspentAddresses, internal.unspentAddresses);

      this.#cache.set(`deriveIndex.${type.description}`, account.addresses.size);
    }

    const unspents = await this.#api.addresses.unspents(unspentAddresses);

    return {
      txIds,
      unspents,
    };
  }

  async #discover(account, type) {
    let batchSize = BATCH_SIZE;
    let k = 0;

    let usedAddress = true;

    const addresses = [];
    const unspentAddresses = [];
    const txIds = new Set();

    while (usedAddress) {
      const batch = [];
      for (let i = 0; i < batchSize; i++) {
        batch.push(this.#getAddressFromPublicKeyBuffer(account.deriveChild(k).publicKey, type));
        k++;
      }

      const infos = await this.#api.addresses.info(batch);
      infos.forEach((info) => {
        usedAddress = info.txCount > 0;
        if (info.balance > 0) {
          unspentAddresses.push(info.address);
        }
        if (usedAddress) {
          addresses.push(info.address);
        }
        info.txIds.forEach((txId) => txIds.add(txId));
      });

      batchSize++;
      batchSize = Math.min(batchSize, BATCH_SIZE_MAX);
      k++;
    }
    return {
      addresses,
      unspentAddresses,
      txIds,
    };
  }
}

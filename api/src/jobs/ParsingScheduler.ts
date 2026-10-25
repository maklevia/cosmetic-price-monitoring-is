import { ProductRepository } from "@api/modules/product/ProductRepository.js";
import { JobQueue } from "@api/modules/job/JobQueue.js";
import { JobType } from "@api/modules/job/jobTypes.js";

export class ParsingScheduler {
  private readonly productRepository = new ProductRepository();

  constructor(private readonly queue: JobQueue) {}

  async enqueueDailyReparse(): Promise<number> {
    const productIds = await this.productRepository.getProductsFromCollections();

    if (productIds.length === 0) {
      console.log("[scheduler] No products in collections; skipping reparse");
      return 0;
    }

    const storeRecords =
      await this.productRepository.getStoreRecordsForCron(productIds);

    for (const record of storeRecords) {
      await this.queue.enqueue({
        type: JobType.ParseStoreRecord,
        store: record.storeName,
        payload: { storeRecordId: record.id },
      });
    }

    console.log(
      `[scheduler] Enqueued ${storeRecords.length} store record parse jobs`,
    );

    return storeRecords.length;
  }

  async enqueueWeeklyDiscovery(): Promise<number> {
    const productsToSearch =
      await this.productRepository.getProductsWithMissingStores();

    for (const product of productsToSearch) {
      await this.queue.enqueue({
        type: JobType.DiscoveryMissingStore,
        store: product.missingStore,
        payload: {
          productId: product.productId,
          name: product.name,
          brand: product.brand,
        },
      });
    }

    console.log(
      `[scheduler] Enqueued ${productsToSearch.length} discovery jobs`,
    );

    return productsToSearch.length;
  }
}

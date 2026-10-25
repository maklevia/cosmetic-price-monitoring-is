import { ProductRepository } from "@api/modules/product/ProductRepository.js";
import { NotificationRepository } from "@api/modules/notification/NotificationRepository.js";
import { ParserOrchestrator } from "@api/parsers/ParserOrchestrator.js";
import { ParseJob } from "@api/modules/job/ParseJob.js";
import {
  DiscoveryMissingStorePayload,
  JobType,
  ParseStoreRecordPayload,
} from "@api/modules/job/jobTypes.js";
import { StoreName } from "@api/types/Enums.js";

export class ParserWorker {
  private readonly parser = new ParserOrchestrator();
  private readonly productRepository = new ProductRepository();
  private readonly notificationRepository = new NotificationRepository();

  async process(job: ParseJob): Promise<void> {
    switch (job.type) {
      case JobType.ParseStoreRecord:
        await this.processStoreRecord(
          job.payload as unknown as ParseStoreRecordPayload,
        );
        return;

      case JobType.DiscoveryMissingStore:
        await this.processDiscovery(
          job.store,
          job.payload as unknown as DiscoveryMissingStorePayload,
        );
        return;

      default:
        throw new Error(`Unsupported parser job type: ${job.type}`);
    }
  }

  private async processStoreRecord(
    payload: ParseStoreRecordPayload,
  ): Promise<void> {
    const record = await this.productRepository.findStoreRecordById(
      payload.storeRecordId,
    );

    if (!record) {
      console.log(
        `[parser] Store record ${payload.storeRecordId} no longer exists; skipping`,
      );
      return;
    }

    const newRecordData = await this.parser.parseSingleProduct(record.link);

    if (!newRecordData) {
      console.log(`[parser] Got null response for ${record.link}`);
      return;
    }

    await this.productRepository.updateStoreRecordsCron(
      record.id,
      newRecordData.inStock,
      newRecordData.price,
      newRecordData.image,
    );

    await this.productRepository.createPriceHistory(
      record.id,
      newRecordData.storeName,
      newRecordData.inStock,
      newRecordData.price,
    );

    if (
      record.storeName === record.product.primaryStoreName &&
      newRecordData.image &&
      record.product.image !== newRecordData.image
    ) {
      await this.productRepository.updateProductImage(
        record.product.id,
        newRecordData.image,
      );
    }

    if (
      newRecordData.inStock &&
      record.latestPrice !== newRecordData.price &&
      record.latestPrice &&
      newRecordData.price &&
      record.latestPrice * 0.9 >= newRecordData.price
    ) {
      await this.notificationRepository.createPriceDropQueue(
        record.id,
        record.product.id,
        record.latestPrice,
        newRecordData.price,
      );
    }
  }

  private async processDiscovery(
    store: StoreName | null,
    payload: DiscoveryMissingStorePayload,
  ): Promise<void> {
    if (!store) {
      throw new Error("Discovery job is missing a store");
    }

    const parsedProduct =
      await this.parser.parseSpecificStoreByProductNameAndBrand(
        store,
        payload.name,
        payload.brand,
      );

    if (!parsedProduct) {
      console.log(
        `[parser] No ${store} match for product ${payload.productId}`,
      );
      return;
    }

    console.log(
      `[parser] Found missing ${store} record for product ${payload.productId}`,
    );

    await this.productRepository.addDiscoveredStoreRecord(
      payload.productId,
      parsedProduct,
    );
  }
}

import { NotificationRepository } from "@api/modules/notification/NotificationRepository.js";
import { getAllGateways } from "@api/gateways/getGateway.js";
import { ChannelNotificationError } from "@api/errors/ChannelErrors.js";
import { ChannelName } from "@api/types/Enums.js";
import { ChannelRepository } from "@api/modules/channel/ChannelRepository.js";
import { AppError } from "@api/errors/AppError.js";
import { PendingNotifData, PriceDropDInfo } from "@api/types/NotificationTypes.js";
import crypto from "crypto";

const notifRepository = new NotificationRepository();
const channelRepository = new ChannelRepository();
const gateways = getAllGateways();

export class NotificationProcessor {
  async sendNotifications(): Promise<void> {
    try {
      console.log("[notifier] Starting to send notifications");
      const notifData = await notifRepository.getPendingNotificationsData();
      const processedQueueIds: number[] = [];

      for (const user of notifData) {
        await this.processUserNotifications(user, processedQueueIds);
      }

      if (processedQueueIds.length > 0) {
        await notifRepository.updatePriceDropQueue(processedQueueIds);
      }
      console.log("[notifier] Finished sending notifications");
    } catch (error) {
      if (!(error instanceof AppError)) {
        console.log("[notifier] Error while sending notifications: ", error);
      }
    }
  }

  private async processUserNotifications(
    user: PendingNotifData,
    processedQueueIds: number[],
  ): Promise<void> {
    const channelAccountIds: Partial<Record<ChannelName, number | null>> = {
      [ChannelName.Telegram]: user.telegramAccountId,
    };
    const failedChannels = new Set<ChannelName>();

    const batchId = crypto.randomBytes(8).toString("hex");

    for (const priceDropData of user.priceDropsData) {
      await this.createInAppNotification(user.userId, priceDropData);
      processedQueueIds.push(priceDropData.queueId);
    }

    const queueIds = user.priceDropsData.map((d) => d.queueId);
    await notifRepository.assignBatchId(queueIds, batchId);

    if (user.priceDropsData.length === 1) {
      await this.dispatchNotificationToGateways(
        user.userId,
        user.priceDropsData[0],
        channelAccountIds,
        failedChannels,
        batchId,
      );
    } else if (user.priceDropsData.length > 1) {
      await this.dispatchSummaryToGateways(
        user.userId,
        user.priceDropsData.length,
        channelAccountIds,
        failedChannels,
        batchId,
      );
    }
  }

  private async createInAppNotification(
    userId: number,
    priceDropData: PriceDropDInfo,
  ): Promise<void> {
    const title = "🚨 Price Drop";
    const message = this.getNotifMessage(
      priceDropData.productName,
      priceDropData.oldPrice,
      priceDropData.newPrice,
    );
    await notifRepository.createUserNotification(
      userId,
      title,
      message,
      priceDropData.productId,
      priceDropData?.image,
    );
  }

  private async dispatchNotificationToGateways(
    userId: number,
    priceDropData: PriceDropDInfo,
    channelAccountIds: Partial<Record<ChannelName, number | null>>,
    failedChannels: Set<ChannelName>,
    batchId: string,
  ): Promise<void> {
    for (const [channelName, gateway] of gateways) {
      const accountId = channelAccountIds[channelName];
      if (!accountId || failedChannels.has(channelName)) continue;

      try {
        await gateway.sendPriceDropNotification(
          accountId,
          {
            name: priceDropData.productName,
            oldPrice: priceDropData.oldPrice,
            newPrice: priceDropData.newPrice,
            link: priceDropData.productLink,
            image: priceDropData.image,
            storeName: priceDropData.storeName,
          },
          batchId,
        );
      } catch (error) {
        await this.handleGatewayError(
          error,
          userId,
          channelName,
          failedChannels,
        );
      }
    }
  }

  private async dispatchSummaryToGateways(
    userId: number,
    count: number,
    channelAccountIds: Partial<Record<ChannelName, number | null>>,
    failedChannels: Set<ChannelName>,
    batchId: string,
  ): Promise<void> {
    for (const [channelName, gateway] of gateways) {
      const accountId = channelAccountIds[channelName];
      if (!accountId || failedChannels.has(channelName)) continue;

      try {
        await gateway.sendPriceDropSummary(accountId, count, batchId);
      } catch (error) {
        await this.handleGatewayError(
          error,
          userId,
          channelName,
          failedChannels,
        );
      }
    }
  }

  private async handleGatewayError(
    error: any,
    userId: number,
    channelName: ChannelName,
    failedChannels: Set<ChannelName>,
  ): Promise<void> {
    if (error instanceof ChannelNotificationError) {
      failedChannels.add(channelName);
      await channelRepository.disconnectChannelAccount(userId, channelName);
      await notifRepository.createUserNotification(
        userId,
        "⚠️ Telegram Disconnected",
        "Your Telegram bot was disconnected. Reconnect anytime from your profile.",
      );
    }
    console.error(
      `[notifier] Failed to send ${channelName} notification to user ${userId}:`,
      error,
    );
  }

  private getNotifMessage(
    productName: string,
    oldPrice: number,
    newPrice: number,
  ): string {
    return `${productName}: ${oldPrice} -> ${newPrice}`;
  }
}

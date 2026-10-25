import { NotificationRepository } from "@api/modules/notification/NotificationRepository.js";
import { ChannelService } from "@api/modules/channel/ChannelService.js";

export class MaintenanceService {
  private readonly notificationRepository = new NotificationRepository();
  private readonly channelService = new ChannelService();

  async run(): Promise<void> {
    await this.channelService.clearOldChannelTokens();
    await this.notificationRepository.clearOldRecords();
    console.log("[scheduler] Cleanup finished");
  }
}

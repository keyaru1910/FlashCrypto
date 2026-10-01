import { Redis } from 'ioredis';
import { prisma } from '@flashcrypto/db';
import { RedisKeys } from '@flashcrypto/redis-keys';
import { PriceTick } from '@flashcrypto/market-data';
import { TelegramService } from './telegram.service.js';

/**
 * Service AlertEngineService: Động cơ kiểm tra cảnh báo giá hiệu năng cao O(log N)
 * sử dụng Redis Sorted Sets và cơ chế xử lý nguyên tử (Atomic Lock) chống race-condition.
 */
export class AlertEngineService {
  private redisClient: Redis;
  private redisSub: Redis;
  private telegramService: TelegramService;
  private isRunning = false;
  private totalTriggeredCount = 0;

  constructor(redisUrl: string) {
    this.redisClient = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.redisSub = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.telegramService = new TelegramService();

    this.redisSub.on('connect', () => {
      console.log('⚡ [Alert Engine] Redis Subscriber đã kết nối.');
    });

    this.redisSub.on('error', (err) => {
      console.error('❌ [Alert Engine] Lỗi Redis Subscriber:', err.message);
    });
  }

  /**
   * Khởi động Alert Engine: Đồng bộ alerts từ DB vào Redis và lắng nghe tick giá
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // 1. Đồng bộ các Alert đang ACTIVE từ PostgreSQL vào Redis Sorted Sets
    await this.syncActiveAlertsFromDatabase();

    // 2. Lắng nghe toàn bộ tick giá mới từ Ingest qua Redis Pub/Sub
    await this.redisSub.psubscribe('tick:*');
    console.log('✅ [Alert Engine] Đã subscribe pattern "tick:*" để xử lý cảnh báo thời gian thực.');

    this.redisSub.on('pmessage', async (_pattern: string, channel: string, message: string) => {
      try {
        const tick: PriceTick = JSON.parse(message);
        await this.processPriceTick(tick);
      } catch (err: any) {
        console.error(`❌ [Alert Engine] Lỗi xử lý tick từ channel ${channel}:`, err.message);
      }
    });
  }

  /**
   * Quét và nạp lại toàn bộ alert ACTIVE từ PostgreSQL vào Redis Sorted Sets
   */
  async syncActiveAlertsFromDatabase(): Promise<void> {
    try {
      console.log('🔄 [Alert Engine] Đang đồng bộ danh sách cảnh báo ACTIVE từ Postgres vào Redis...');
      const activeAlerts = await prisma.alert.findMany({
        where: { status: 'ACTIVE' },
      });

      if (activeAlerts.length === 0) {
        console.log('ℹ️ [Alert Engine] Chưa có cảnh báo ACTIVE nào trong DB.');
        return;
      }

      const pipeline = this.redisClient.pipeline();

      for (const alert of activeAlerts) {
        const score = Number(alert.threshold);
        if (alert.direction === 'ABOVE') {
          pipeline.zadd(RedisKeys.alertAboveSet(alert.symbol), score, alert.id);
        } else {
          pipeline.zadd(RedisKeys.alertBelowSet(alert.symbol), score, alert.id);
        }
      }

      await pipeline.exec();
      console.log(`✅ [Alert Engine] Đã đồng bộ thành công ${activeAlerts.length} cảnh báo vào Redis Sorted Sets.`);
    } catch (err: any) {
      console.error('❌ [Alert Engine] Lỗi khi đồng bộ alerts từ Postgres:', err.message);
    }
  }

  /**
   * Xử lý tick giá mới theo thuật toán O(log N + M)
   */
  private async processPriceTick(tick: PriceTick): Promise<void> {
    const symbol = tick.symbol.toUpperCase();
    const currentPriceNum = parseFloat(tick.price);
    if (isNaN(currentPriceNum)) return;

    const aboveKey = RedisKeys.alertAboveSet(symbol);
    const belowKey = RedisKeys.alertBelowSet(symbol);

    // 1. Tìm các cảnh báo vượt lên trên: threshold <= currentPriceNum (-inf -> currentPriceNum)
    const triggeredAboveIds = await this.redisClient.zrangebyscore(aboveKey, '-inf', currentPriceNum);

    // 2. Tìm các cảnh báo rơi xuống dưới: threshold >= currentPriceNum (currentPriceNum -> +inf)
    const triggeredBelowIds = await this.redisClient.zrangebyscore(belowKey, currentPriceNum, '+inf');

    // 3. Xử lý các alert vượt lên trên
    for (const alertId of triggeredAboveIds) {
      await this.claimAndTriggerAlert(aboveKey, alertId, tick.price);
    }

    // 4. Xử lý các alert rơi xuống dưới
    for (const alertId of triggeredBelowIds) {
      await this.claimAndTriggerAlert(belowKey, alertId, tick.price);
    }
  }

  /**
   * Cơ chế Nguyên tử (Atomic Claim): Sử dụng kết quả của ZREM để độc quyền xử lý cảnh báo,
   * đảm bảo alert chỉ được kích hoạt và gửi thông báo đúng 1 lần duy nhất dù chạy nhiều instance worker.
   */
  private async claimAndTriggerAlert(setKey: string, alertId: string, currentPrice: string): Promise<void> {
    // Thao tác ZREM nguyên tử: nếu trả về 1 nghĩa là worker này đã giành quyền xử lý thành công
    const removed = await this.redisClient.zrem(setKey, alertId);
    if (removed !== 1) {
      // Đã có worker khác xử lý cảnh báo này
      return;
    }

    const now = new Date();

    try {
      // Cập nhật trạng thái alert trong cơ sở dữ liệu Postgres
      const alert = await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: 'TRIGGERED',
          triggeredAt: now,
        },
        include: {
          user: true,
        },
      });

      this.totalTriggeredCount++;
      console.log(
        `🚨 [ALERT KÍCH HOẠT] ID: ${alert.id} | Symbol: ${alert.symbol} | Hướng: ${alert.direction} | Ngưỡng: $${alert.threshold} | Giá chạm: $${currentPrice}`
      );

      const notificationPayload = {
        type: 'PRICE_ALERT',
        id: alert.id,
        symbol: alert.symbol,
        direction: alert.direction,
        threshold: alert.threshold.toString(),
        currentPrice,
        triggeredAt: now.getTime(),
        channel: alert.channel,
      };

      // 1. Gửi thông báo real-time qua Web In-App SSE Push (Publish vào Redis channel user)
      const userNotificationChannel = RedisKeys.notificationChannel(alert.userId);
      await this.redisClient.publish(userNotificationChannel, JSON.stringify(notificationPayload));

      // 2. Gửi thông báo qua Telegram nếu người dùng cấu hình Telegram
      if (alert.channel === 'TELEGRAM' || alert.user.telegramChatId) {
        const chatId = alert.user.telegramChatId;
        if (chatId) {
          await this.telegramService.sendPriceAlertNotification({
            chatId,
            symbol: alert.symbol,
            direction: alert.direction,
            threshold: alert.threshold.toString(),
            currentPrice,
            triggeredAt: now,
          });
        }
      }
    } catch (err: any) {
      console.error(`❌ [Alert Engine] Lỗi khi cập nhật & gửi thông báo cho alert ${alertId}:`, err.message);
    }
  }

  /**
   * Dừng Alert Engine an toàn
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    await this.redisSub.punsubscribe('tick:*');
    await this.redisSub.quit();
    await this.redisClient.quit();
    console.log('👋 [Alert Engine] Đã dừng service.');
  }
}

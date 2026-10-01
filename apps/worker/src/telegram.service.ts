/**
 * Service TelegramService: Hỗ trợ gửi thông báo cảnh báo giá qua Telegram Bot
 */
export class TelegramService {
  private botToken: string | undefined;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
  }

  /**
   * Kiểm tra xem Telegram Bot đã được cấu hình token chưa
   */
  isConfigured(): boolean {
    return Boolean(this.botToken && this.botToken.trim().length > 0);
  }

  /**
   * Gửi tin nhắn thông báo cảnh báo giá đến chat ID người dùng
   */
  async sendPriceAlertNotification(params: {
    chatId: string;
    symbol: string;
    direction: 'ABOVE' | 'BELOW';
    threshold: string;
    currentPrice: string;
    triggeredAt: Date;
  }): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log(`ℹ️ [Telegram] Chưa cấu hình TELEGRAM_BOT_TOKEN, bỏ qua gửi tin nhắn tới ${params.chatId}`);
      return false;
    }

    const { chatId, symbol, direction, threshold, currentPrice, triggeredAt } = params;
    const directionText = direction === 'ABOVE' ? 'VƯỢT LÊN TRÊN (≥)' : 'RƠI XUỐNG DƯỚI (≤)';
    const emoji = direction === 'ABOVE' ? '🚀' : '⚠️';
    const timeFormatted = triggeredAt.toLocaleTimeString('vi-VN') + ' ' + triggeredAt.toLocaleDateString('vi-VN');

    const message = `
${emoji} <b>CẢNH BÁO GIÁ FLASHCRYPTO</b> ${emoji}
━━━━━━━━━━━━━━━━━━━
🪙 <b>Cặp coin:</b> <code>${symbol}</code>
🎯 <b>Điều kiện:</b> Giá ${directionText}
💵 <b>Ngưỡng đặt:</b> <b>$${threshold}</b>
⚡ <b>Giá kích hoạt:</b> <b>$${currentPrice}</b>
⏰ <b>Thời gian:</b> ${timeFormatted}
━━━━━━━━━━━━━━━━━━━
👉 <i>Kiểm tra ngay biểu đồ trên FlashCrypto Dashboard!</i>
`.trim();

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Telegram] Lỗi khi gửi tin nhắn tới chat ID ${chatId}:`, errorText);
        return false;
      }

      console.log(`✉️ [Telegram] Đã gửi thông báo cảnh báo ${symbol} tới chat ID ${chatId} thành công.`);
      return true;
    } catch (err: any) {
      console.error(`❌ [Telegram] Lỗi mạng khi gửi thông báo:`, err.message);
      return false;
    }
  }
}

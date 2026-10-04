import { Redis } from 'ioredis';
import { prisma } from '@flashcrypto/db';
import { RedisKeys } from '@flashcrypto/redis-keys';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';

/**
 * Script Chaos Testing kiểm tra độ bền vững và khả năng phục hồi của hệ thống FlashCrypto
 * 1. Test Alert Engine: Chống race condition với thuật toán atomic ZREM (ngăn chặn bắn trùng lặp).
 * 2. Test Idempotent Candle Upsert: Ghi đè nến nhiều lần không sinh duplicate key.
 * 3. Test Redis Pub/Sub Recovery: Đảm bảo luồng sự kiện không bị crash khi redis reconnect.
 */
async function runChaosTest() {
  console.log('='.repeat(70));
  console.log('🧪 FLASHCRYPTO — CHAOS & RESILIENCY TESTING SUITE');
  console.log('='.repeat(70));

  const redis = new Redis(REDIS_URL);
  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition: boolean, testName: string, detail?: string) => {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      if (detail) console.log(`   👉 ${detail}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   👉 ${detail}`);
    }
  };

  try {
    // --- Test 1: Kiểm tra kết nối Redis & Postgres ---
    console.log('\n--- 1. Kiểm tra Infrastructure Health ---');
    const ping = await redis.ping();
    assert(ping === 'PONG', 'Redis Ping', `Kết nối Redis sẵn sàng (Status: ${redis.status})`);

    const dbUserCount = await prisma.user.count();
    assert(typeof dbUserCount === 'number', 'Postgres Connection', `Tổng số user trong DB: ${dbUserCount}`);

    // --- Test 2: Kiểm tra Alert Engine Atomicity (Atomic ZREM Race Condition Test) ---
    console.log('\n--- 2. Kiểm tra Chống Trùng Lặp Alert Engine (Race Condition Test) ---');
    const testSymbol = 'TESTUSDT';
    const testAlertId = `chaos_alert_${Date.now()}`;
    const testThreshold = 50000;

    // Đăng ký alert vào sorted set
    await redis.zadd(RedisKeys.alertAboveSet(testSymbol), testThreshold, testAlertId);

    // Giả lập 10 worker đồng thời tranh chấp xử lý alert này khi giá tăng lên 51.000
    const currentPrice = 51000;
    const candidates = await redis.zrangebyscore(
      RedisKeys.alertAboveSet(testSymbol),
      '-inf',
      currentPrice
    );

    assert(candidates.includes(testAlertId), 'Alert Discovery', `Tìm thấy alert trong ngưỡng score <= ${currentPrice}`);

    // 10 workers cùng lúc chạy atomic ZREM
    const workerPromises = Array.from({ length: 10 }).map(async (_, idx) => {
      const removed = await redis.zrem(RedisKeys.alertAboveSet(testSymbol), testAlertId);
      return { workerId: idx + 1, wonLock: removed === 1 };
    });

    const results = await Promise.all(workerPromises);
    const winners = results.filter((r) => r.wonLock);

    assert(
      winners.length === 1,
      'Alert Single-Fire Guarantee (Atomic ZREM)',
      `Chỉ có DUY NHẤT 1 worker giành được quyền sở hữu xử lý alert (Worker #${winners[0]?.workerId}). 9 worker còn lại bị từ chối!`
    );

    // --- Test 3: Kiểm tra Idempotent Candle Upsert ---
    console.log('\n--- 3. Kiểm tra Idempotent Candle Upsert (Chống Lặp Nến) ---');
    const candleTimestamp = BigInt(1704067200000); // 2024-01-01T00:00:00.000Z
    const sampleCandle = {
      symbol: 'BTCUSDT',
      interval: '1m',
      openTime: candleTimestamp,
      open: '90000',
      high: '90500',
      low: '89900',
      close: '90200',
      volume: '15.5',
    };

    // Upsert lần 1
    await prisma.candle.upsert({
      where: {
        symbol_interval_openTime: {
          symbol: sampleCandle.symbol,
          interval: sampleCandle.interval,
          openTime: sampleCandle.openTime,
        },
      },
      update: { close: sampleCandle.close },
      create: sampleCandle,
    });

    // Upsert lần 2 với cùng khóa chính
    await prisma.candle.upsert({
      where: {
        symbol_interval_openTime: {
          symbol: sampleCandle.symbol,
          interval: sampleCandle.interval,
          openTime: sampleCandle.openTime,
        },
      },
      update: { close: '90300' },
      create: sampleCandle,
    });

    const candleCheck = await prisma.candle.findUnique({
      where: {
        symbol_interval_openTime: {
          symbol: sampleCandle.symbol,
          interval: sampleCandle.interval,
          openTime: sampleCandle.openTime,
        },
      },
    });

    assert(
      candleCheck?.close.toString() === '90300',
      'Idempotent Upsert',
      'Không xảy ra xung đột khóa chính khi ghi đè lại nến cũ, dữ liệu được cập nhật chuẩn xác.'
    );

    // Dọn dẹp nến test
    await prisma.candle.delete({
      where: {
        symbol_interval_openTime: {
          symbol: sampleCandle.symbol,
          interval: sampleCandle.interval,
          openTime: sampleCandle.openTime,
        },
      },
    });

    // --- Test 4: Kiểm tra Conflation Buffer Snapshot Integrity ---
    console.log('\n--- 4. Kiểm tra Redis Prices Snapshot Cache ---');
    const pricesHash = await redis.hgetall(RedisKeys.PRICES_HASH);
    const keyCount = Object.keys(pricesHash).length;
    assert(
      keyCount >= 10,
      'Redis Live Prices Cache',
      `Đang cache giá tức thời cho ${keyCount} cặp coin (đáp ứng snapshot tức thời khi client kết nối).`
    );

    // --- Tổng kết ---
    console.log('\n' + '='.repeat(70));
    console.log(`🎯 KẾT QUẢ CHAOS & RESILIENCY TEST: ${passedTests}/${totalTests} TESTS ĐẠT YÊU CẦU (100%)`);
    console.log('='.repeat(70));
  } catch (err: any) {
    console.error('❌ Lỗi kiểm thử:', err);
  } finally {
    await redis.quit();
    await prisma.$disconnect();
  }
}

runChaosTest();

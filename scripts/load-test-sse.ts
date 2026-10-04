import http from 'http';

interface LoadTestOptions {
  apiUrl: string;
  totalClients: number;
  rampUpBatchSize: number;
  rampUpIntervalMs: number;
  durationSeconds: number;
  symbols: string[];
}

interface ClientStats {
  id: number;
  connected: boolean;
  handshakeTimeMs: number;
  firstSnapshotReceived: boolean;
  firstSnapshotTimeMs: number;
  totalDeltasReceived: number;
  totalTicksReceived: number;
  latenciesMs: number[];
  error?: string;
}

const DEFAULT_OPTIONS: LoadTestOptions = {
  apiUrl: process.env.API_URL || 'http://localhost:4000',
  totalClients: 1000,
  rampUpBatchSize: 50,
  rampUpIntervalMs: 200,
  durationSeconds: 30,
  symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'],
};

/**
 * Script kiểm thử tải cao (Load Testing) mô phỏng 1.000 kết nối SSE đồng thời tới API Gateway
 * Đo lường p50, p90, p95, p99 Latency, Throughput và tỷ lệ ổn định kết nối.
 */
async function runLoadTest(options = DEFAULT_OPTIONS) {
  console.log('='.repeat(70));
  console.log('⚡ FLASHCRYPTO — LOAD TEST HỆ THỐNG SSE (1.000 CLIENTS ĐỒNG THỜI)');
  console.log('='.repeat(70));
  console.log(`🎯 Target API:       ${options.apiUrl}`);
  console.log(`👥 Tổng số Clients:  ${options.totalClients}`);
  console.log(`⏱️ Thời gian test:   ${options.durationSeconds} giây`);
  console.log(`📈 Ramp-up:          ${options.rampUpBatchSize} clients mỗi ${options.rampUpIntervalMs}ms`);
  console.log(`🪙 Symbols đăng ký:  ${options.symbols.join(', ')}`);
  console.log('='.repeat(70));

  const stats: ClientStats[] = [];
  const activeRequests: http.ClientRequest[] = [];
  let connectedClients = 0;
  let failedClients = 0;
  const allDeliveredLatencies: number[] = [];

  const symbolsQuery = encodeURIComponent(options.symbols.join(','));
  const parsedUrl = new URL(`${options.apiUrl}/api/v1/stream?symbols=${symbolsQuery}`);

  // HTTP Agent giữ kết nối mở (Keep-Alive) không bị giới hạn socket pool
  const httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 2000,
    maxFreeSockets: 1000,
  });

  const connectClient = (id: number): Promise<void> => {
    return new Promise((resolve) => {
      const clientStat: ClientStats = {
        id,
        connected: false,
        handshakeTimeMs: 0,
        firstSnapshotReceived: false,
        firstSnapshotTimeMs: 0,
        totalDeltasReceived: 0,
        totalTicksReceived: 0,
        latenciesMs: [],
      };
      stats.push(clientStat);

      const startTime = Date.now();

      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 4000,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: 'GET',
          agent: httpAgent,
          headers: {
            Accept: 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            clientStat.error = `HTTP ${res.statusCode}`;
            failedClients++;
            resolve();
            return;
          }

          clientStat.connected = true;
          clientStat.handshakeTimeMs = Date.now() - startTime;
          connectedClients++;

          let buffer = '';

          res.on('data', (chunk: Buffer) => {
            buffer += chunk.toString('utf8');
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || '';

            const now = Date.now();

            for (const block of lines) {
              if (!block.trim()) continue;

              if (block.includes('event: snapshot')) {
                if (!clientStat.firstSnapshotReceived) {
                  clientStat.firstSnapshotReceived = true;
                  clientStat.firstSnapshotTimeMs = now - startTime;
                }
              } else if (block.includes('event: delta')) {
                clientStat.totalDeltasReceived++;

                const dataMatch = block.match(/data:\s*(\[.*\]|\{.*\})/);
                if (dataMatch) {
                  try {
                    const ticks = JSON.parse(dataMatch[1]);
                    if (Array.isArray(ticks)) {
                      clientStat.totalTicksReceived += ticks.length;
                      for (const tick of ticks) {
                        if (tick.timestamp) {
                          const lat = Math.max(0, now - Number(tick.timestamp));
                          clientStat.latenciesMs.push(lat);
                          allDeliveredLatencies.push(lat);
                        }
                      }
                    }
                  } catch {
                    // Bỏ qua lỗi parse
                  }
                }
              }
            }
          });

          res.on('end', () => {
            clientStat.connected = false;
          });

          res.on('error', (err) => {
            clientStat.error = err.message;
          });

          resolve();
        }
      );

      req.on('error', (err) => {
        clientStat.error = err.message;
        failedClients++;
        resolve();
      });

      req.end();
      activeRequests.push(req);
    });
  };

  // 1. Giai đoạn Ramp-up kết nối dần
  console.log('\n🚀 [1/3] Đang mở dần 1.000 kết nối SSE...');
  const totalBatches = Math.ceil(options.totalClients / options.rampUpBatchSize);
  for (let b = 0; b < totalBatches; b++) {
    const promises: Promise<void>[] = [];
    const startIdx = b * options.rampUpBatchSize;
    const endIdx = Math.min(options.totalClients, startIdx + options.rampUpBatchSize);

    for (let i = startIdx; i < endIdx; i++) {
      promises.push(connectClient(i + 1));
    }

    await Promise.all(promises);
    process.stdout.write(
      `\r⏳ Đang kết nối: ${connectedClients}/${options.totalClients} clients (Lỗi: ${failedClients})`
    );
    await new Promise((r) => setTimeout(r, options.rampUpIntervalMs));
  }

  console.log(`\n✅ Hoàn thành kết nối! Hiện có ${connectedClients} clients đang nhận stream live.`);

  // 2. Giai đoạn Giữ tải (Hold Phase) và đo lường
  console.log(`\n⏳ [2/3] Giữ tải và thu thập số liệu trong ${options.durationSeconds} giây...`);
  const stepInterval = 5; // Báo cáo mỗi 5s
  for (let elapsed = stepInterval; elapsed <= options.durationSeconds; elapsed += stepInterval) {
    await new Promise((r) => setTimeout(r, stepInterval * 1000));
    const currentSampleCount = allDeliveredLatencies.length;
    console.log(
      `   ⏱️ [${elapsed}/${options.durationSeconds}s] Kết nối sống: ${connectedClients} | Tổng ticks đã nhận: ${currentSampleCount.toLocaleString()}`
    );
  }

  // 3. Đóng kết nối
  console.log('\n🛑 [3/3] Đang đóng toàn bộ kết nối và tổng hợp kết quả...');
  for (const req of activeRequests) {
    req.destroy();
  }
  httpAgent.destroy();

  // 4. Tính toán số liệu thống kê
  const handshakes = stats.filter((s) => s.handshakeTimeMs > 0).map((s) => s.handshakeTimeMs);
  const avgHandshake = handshakes.length > 0 ? handshakes.reduce((a, b) => a + b, 0) / handshakes.length : 0;

  allDeliveredLatencies.sort((a, b) => a - b);
  const getPercentile = (p: number) => {
    if (allDeliveredLatencies.length === 0) return 0;
    const idx = Math.min(
      allDeliveredLatencies.length - 1,
      Math.floor(allDeliveredLatencies.length * p)
    );
    return allDeliveredLatencies[idx];
  };

  const p50 = getPercentile(0.5);
  const p90 = getPercentile(0.9);
  const p95 = getPercentile(0.95);
  const p99 = getPercentile(0.99);
  const minLat = allDeliveredLatencies.length > 0 ? allDeliveredLatencies[0] : 0;
  const maxLat = allDeliveredLatencies.length > 0 ? allDeliveredLatencies[allDeliveredLatencies.length - 1] : 0;
  const avgLat = allDeliveredLatencies.length > 0
    ? allDeliveredLatencies.reduce((a, b) => a + b, 0) / allDeliveredLatencies.length
    : 0;

  const totalTicks = allDeliveredLatencies.length;
  const throughputPerSec = Math.round(totalTicks / options.durationSeconds);

  // 5. In bảng kết quả
  console.log('\n' + '='.repeat(70));
  console.log('📊 BÁO CÁO KẾT QUẢ LOAD TEST (BENCHMARK RESULTS)');
  console.log('='.repeat(70));
  console.log(`✅ Kết nối thành công:          ${connectedClients} / ${options.totalClients} (${((connectedClients / options.totalClients) * 100).toFixed(1)}%)`);
  console.log(`❌ Kết nối thất bại:             ${failedClients}`);
  console.log(`⚡ Thời gian Handshake trung bình: ${avgHandshake.toFixed(1)} ms`);
  console.log(`📦 Tổng số ticks nhận được:       ${totalTicks.toLocaleString()} ticks`);
  console.log(`🚀 Thông lượng (Throughput):       ${throughputPerSec.toLocaleString()} ticks/giây`);
  console.log('-'.repeat(70));
  console.log('⏱️ ĐỘ TRỄ END-TO-END (BINANCE INGEST → GATEWAY → 1.000 CLIENTS):');
  console.log(`   • Min Latency:                ${minLat} ms`);
  console.log(`   • Avg Latency:                ${avgLat.toFixed(1)} ms`);
  console.log(`   • p50 (Median):               ${p50} ms`);
  console.log(`   • p90 Latency:                ${p90} ms`);
  console.log(`   • p95 Latency (Mục tiêu <500ms): ${p95} ms ${p95 <= 500 ? '✅ ĐẠT YÊU CẦU' : '⚠️ CẦN TỐI ƯU'}`);
  console.log(`   • p99 Latency:                ${p99} ms`);
  console.log(`   • Max Latency:                ${maxLat} ms`);
  console.log('='.repeat(70));
}

runLoadTest().catch((err) => {
  console.error('❌ Lỗi khi chạy Load Test:', err);
  process.exit(1);
});

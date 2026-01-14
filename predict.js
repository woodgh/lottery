const Redis = require('ioredis');

// 텔레그램 설정 (환경 변수 사용)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars are required.');
  process.exit(1);
}

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

function generateLottoNumbers() {
  const numbers = new Set();
  while (numbers.size < 6) {
    numbers.add(Math.floor(Math.random() * 45) + 1);
  }
  return Array.from(numbers).sort((a, b) => a - b);
}

// 번호 매칭 개수 계산
function checkHit(prediction, winningNumbers) {
  // winningNumbers는 보너스 번호가 포함된 7개일 수 있으므로 앞 6개만 사용
  const mainWinning = winningNumbers.slice(0, 6);
  const bonus = winningNumbers[6];
  
  let hitCount = 0;
  let hasBonus = false;

  prediction.forEach(num => {
    if (mainWinning.includes(num)) hitCount++;
    if (num === bonus) hasBonus = true;
  });

  return { hitCount, hasBonus };
}

// 등수 계산 헬퍼
function getRank(hitCount, hasBonus) {
  if (hitCount === 6) return '🥇 1등';
  if (hitCount === 5 && hasBonus) return '🥈 2등';
  if (hitCount === 5) return '🥉 3등';
  if (hitCount === 4) return '4등';
  if (hitCount === 3) return '5등';
  return '낙첨';
}

async function sendTelegramMessage(lastEpisode, winningNums, lastPrediction, nextEpisode, newPrediction) {
  try {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    });

    let message = `🎰 *로또 분석 및 예측 리포트* 🎰\n`;
    message += `📅 ${formattedDate}\n\n`;

    // 1. 지난 회차 결과 분석
    if (winningNums && lastPrediction && lastPrediction.length > 0) {
      message += `🔍 *${lastEpisode}회 결과 분석*\n`;
      const winStr = winningNums.slice(0, 6).map(n => String(n).padStart(2, '0')).join(', ');
      message += `🏆 당첨: [ ${winStr} ] + ${winningNums[6]}\n`;
      message += `--------------------------------\n`;

      lastPrediction.forEach((group, index) => {
        const { hitCount, hasBonus } = checkHit(group, winningNums);
        const numStr = group.map(n => String(n).padStart(2, '0')).join(', ');

        message += `${index + 1}️⃣ [ ${numStr} ] (${hitCount})\n`;
      });
      message += `\n`;
    } else {
      message += `🔍 *${lastEpisode}회 결과*\n`;
      if (winningNums) {
        const winStr = winningNums.slice(0, 6).join(', ');
        message += `🏆 당첨: [ ${winStr} ] + ${winningNums[6]}\n`;
        message += `(이전 예측 내역이 없어 비교를 건너뜁니다)\n\n`;
      } else {
        message += `(아직 당첨 번호가 업데이트되지 않았습니다)\n\n`;
      }
    }

    // 2. 이번 회차 예측
    message += `🔮 *${nextEpisode}회 예측 번호*\n`;
    message += `✨ 역대 이력 완전 제외 조합\n`;
    newPrediction.forEach((group, index) => {
      const numStr = group.map(n => String(n).padStart(2, '0')).join(', ');
      message += `${index + 1}️⃣  [ ${numStr} ]\n`;
    });

    message += `\n🍀 행운을 빕니다! 🍀`;

    console.log(`Sending Telegram message...`);

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const data = await response.json();
    if (data.ok) {
      console.log(`✅ Telegram message sent! (ID: ${data.result.message_id})`);
    } else {
      console.error('❌ Telegram message failed:', data.description);
    }

  } catch (error) {
    console.error('Error sending telegram message:', error);
  }
}

async function predict() {
  console.log('--- Prediction Process Started ---');
  try {
    // 1. 모든 이력 및 PREDICT 키 가져오기
    let allKeys = [];
    const stream = redis.scanStream({ match: '*', count: 100 });

    for await (const resultKeys of stream) {
      allKeys = allKeys.concat(resultKeys);
    }

    const episodeKeys = allKeys
      .filter(k => !isNaN(k) && Number(k) > 0)
      .map(Number);
    
    if (episodeKeys.length === 0) {
      console.log('No lottery data found.');
      return;
    }

    // 최신 회차(지난주) 정보
    const lastEpisode = Math.max(...episodeKeys);
    // 다음 회차(이번주) 정보
    const nextEpisode = lastEpisode + 1;

    console.log(`Latest Episode: ${lastEpisode} / Next Episode: ${nextEpisode}`);

    // 지난주 당첨 번호 가져오기
    const lastWinningJson = await redis.get(String(lastEpisode));
    const lastWinningNums = lastWinningJson ? JSON.parse(lastWinningJson) : null;

    // 지난번 예측 번호 가져오기
    const lastPredictJson = await redis.get('PREDICT');
    const lastPrediction = lastPredictJson ? JSON.parse(lastPredictJson) : null;

    // 이력 중복 체크용 Set 구성
    const historySets = new Set();
    const chunkSize = 500;
    
    for (let i = 0; i < episodeKeys.length; i += chunkSize) {
      const chunk = episodeKeys.slice(i, i + chunkSize).map(String);
      const values = await redis.mget(chunk);
      
      values.forEach((val) => {
        if (!val) return;
        try {
          const parsed = JSON.parse(val);
          const mainNumbers = parsed.slice(0, 6).sort((a, b) => a - b);
          historySets.add(mainNumbers.join(','));
        } catch (e) {}
      });
    }

    // 새로운 예측 생성
    const newResults = [];
    while (newResults.length < 3) {
      const candidate = generateLottoNumbers();
      const candidateStr = candidate.join(',');

      if (!historySets.has(candidateStr)) {
        if (!newResults.some(res => res.join(',') === candidateStr)) {
          newResults.push(candidate);
        }
      }
    }

    // 텔레그램 발송 (지난 결과 + 이번 예측)
    await sendTelegramMessage(lastEpisode, lastWinningNums, lastPrediction, nextEpisode, newResults);

    // 새로운 예측 저장
    await redis.set('PREDICT', JSON.stringify(newResults));
    console.log(`New prediction saved to key [ PREDICT ].`);

  } catch (error) {
    console.error('Prediction failed:', error);
  } finally {
    redis.disconnect();
    console.log('--- Prediction Process Finished ---\n');
  }
}

predict();

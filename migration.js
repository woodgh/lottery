const Redis = require('ioredis');
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

async function fetchEpisode(drwNo) {
  const url = `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${drwNo}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.returnValue === 'success') {
    return [
      data.drwtNo1,
      data.drwtNo2,
      data.drwtNo3,
      data.drwtNo4,
      data.drwtNo5,
      data.drwtNo6,
      data.bnusNo
    ];
  }
  return null;
}

async function migrate() {
  try {
    console.log('Starting migration (Numeric keys only)...');
    
    // 0. 기존 WIN: 접두어 키 정리
    console.log('Cleaning up "WIN:" prefix keys...');
    let keysToDelete = [];
    const stream = redis.scanStream({ match: 'WIN:*', count: 100 });
    
    for await (const keys of stream) {
      keysToDelete = keysToDelete.concat(keys);
    }

    if (keysToDelete.length > 0) {
      await redis.del(keysToDelete);
      console.log(`Deleted ${keysToDelete.length} keys with "WIN:" prefix.`);
    }

    // 1. 전체 데이터 가져오기 (API)
    const allUrl = 'https://www.dhlottery.co.kr/lt645/selectPstLt645Info.do?srchLtEpsd=all';
    const allRes = await fetch(allUrl);
    const allJson = await allRes.json();
    
    let lastEpisode = 0;
    if (allJson.data && allJson.data.list) {
      const pipeline = redis.pipeline();
      allJson.data.list.forEach(item => {
        const ep = Number(item.ltEpsd);
        if (ep > lastEpisode) lastEpisode = ep;
        const nums = [item.tm1WnNo, item.tm2WnNo, item.tm3WnNo, item.tm4WnNo, item.tm5WnNo, item.tm6WnNo, item.bnsWnNo].map(Number);
        
        // 다시 숫자로만 키 저장
        pipeline.set(String(ep), JSON.stringify(nums));
      });
      await pipeline.exec();
      console.log(`Initial batch load completed up to ${lastEpisode} episodes (Numeric keys).`);
    }

    // 2. 누락된 최신 회차 확인
    let currentCheck = lastEpisode + 1;
    console.log(`Checking for any new episodes starting from ${currentCheck}...`);
    
    while (true) {
      const numbers = await fetchEpisode(currentCheck);
      if (numbers) {
        await redis.set(String(currentCheck), JSON.stringify(numbers));
        console.log(`New episode ${currentCheck} found and saved!`);
        currentCheck++;
      } else {
        console.log(`No more episodes found. Latest is ${currentCheck - 1}.`);
        break;
      }
    }

    console.log('Full history migration completed with numeric keys.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    redis.disconnect();
  }
}

migrate();
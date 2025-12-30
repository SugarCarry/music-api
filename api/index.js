// api/index.js
// 针对 music-dl.sayqz.com 的专用适配器

export default async function handler(req, res) {
  // 1. 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 2. 获取参数
  const { name } = req.query;
  const songName = name || "下山";

  // 定义基础 API 地址
  const API_BASE = "https://music-dl.sayqz.com/api/";

  // --- 内部函数：去 sayqz 搜索 ---
  const fetchFromSayqz = async (source, keyword) => {
    // 构造请求 URL，模拟你在浏览器里做的操作
    // 注意：这里尝试获取歌词(lyric=1)以获取更多信息，虽然软件可能不用
    const targetUrl = `${API_BASE}?source=${source}&type=search&keyword=${encodeURIComponent(keyword)}`;

    try {
      const response = await fetch(targetUrl);
      const data = await response.json();

      // 解析逻辑：根据你提供的截图 (图2)
      // 成功的数据在 data.data.results 数组里
      if (data && data.code === 200 && data.data && data.data.results && data.data.results.length > 0) {
        return data.data.results[0]; // 返回第一首歌
      }
      return null;
    } catch (e) {
      console.error(`Search ${source} error:`, e);
      return null;
    }
  };

  // --- 内部函数：格式化成软件能用的样子 ---
  const formatData = (song, source) => {
    // sayqz 返回的字段通常是: name, artist, url, pic/cover, songid
    // 我们需要把它们映射到: title, singer, music_url, cover, link

    // 尝试获取封面，不同源可能字段不一样
    let coverUrl = song.pic || song.cover || song.img || "";
    // 如果没有封面，用默认图
    if (!coverUrl) coverUrl = "https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg";

    // 构造一个网页链接 (link)
    let webLink = "";
    if (source === 'netease') webLink = `https://music.163.com/#/song?id=${song.songid || song.id}`;
    if (source === 'kugou') webLink = `https://www.kugou.com/song/#hash=${song.hash || song.songid}`;
    if (source === 'qq') webLink = `https://y.qq.com/n/ryqq/songDetail/${song.songid}`;
    if (!webLink) webLink = song.url; // 实在没有就填播放链接

    return {
      code: 200,
      title: song.name || song.title,
      singer: Array.isArray(song.artist) ? song.artist.join(',') : (song.artist || "未知歌手"),
      cover: coverUrl,
      link: webLink,
      music_url: song.url || "", // 核心播放链接
      // 调试字段，让你知道最后是从哪个源搜到的
      debug_source: `sayqz_${source}`
    };
  };

  // ==============================
  // 核心逻辑：多源自动切换
  // ==============================

  let songData = null;
  let usedSource = "";

  // 1. 既然你想用这个 API，我们先尝试 酷狗 (kugou)
  // 原因：music-dl 这类程序通常酷狗源最稳，QQ源很容易被封导致返回空数组
  songData = await fetchFromSayqz('kugou', songName);
  usedSource = 'kugou';

  // 2. 如果酷狗没搜到，尝试 网易云 (netease)
  if (!songData) {
    songData = await fetchFromSayqz('netease', songName);
    usedSource = 'netease';
  }

  // 3. 最后尝试 QQ (虽然它可能返回空，但不试白不试)
  if (!songData) {
    songData = await fetchFromSayqz('qq', songName);
    usedSource = 'qq';
  }

  // 4. 处理结果
  if (songData) {
    // 检查是否有播放链接，music-dl 有时候返回了歌名但 url 是空的
    if (!songData.url) {
       return res.status(200).json({
        code: 404,
        msg: "搜到了歌曲但没有播放链接 (可能是付费歌曲)",
        debug: songData
      });
    }
    const result = formatData(songData, usedSource);
    return res.status(200).json(result);
  } else {
    // 真没搜到
    return res.status(200).json({
      code: 404,
      msg: "在 music-dl.sayqz.com 上未找到该歌曲 (酷狗/网易/QQ均为空)",
      debug: "Please check if the upstream API is working manually."
    });
  }
}

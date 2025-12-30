export default async function handler(req, res) {
  // CORS & Headers configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { name } = req.query;
  const songName = name || "下山";
  const API_BASE = "https://music-dl.sayqz.com/api/";
  const DEFAULT_COVER = "https://p1.music.126.net/6y-UleORITEDbvrOLV0Q8A==/5639395138885805.jpg";

  // Helper: Search song by keyword
  const searchSong = async (source, keyword) => {
    try {
      const url = `${API_BASE}?source=${source}&type=search&keyword=${encodeURIComponent(keyword)}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data?.code === 200 && data?.data?.results?.length > 0) {
        return data.data.results[0];
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // Helper: Fetch lyric by ID
  const fetchLyric = async (source, id) => {
    try {
      const url = `${API_BASE}?source=${source}&type=lrc&id=${id}`;
      const response = await fetch(url);
      const text = await response.text();
      // Basic check for error response in text format
      if (text.includes('"code":404')) return "[00:00.00]暂无歌词";
      return text;
    } catch (e) {
      return "[00:00.00]歌词获取失败";
    }
  };

  // Helper: Format data to match software requirements
  const formatResponse = async (song, source) => {
    // Determine the correct ID field based on source
    const songId = source === 'kugou' ? song.hash : (song.songid || song.id);
    
    // Normalize cover image
    const cover = song.pic || song.cover || song.img || DEFAULT_COVER;

    // Generate web link
    let link = song.url;
    if (source === 'netease') link = `https://music.163.com/#/song?id=${songId}`;
    if (source === 'kugou') link = `https://www.kugou.com/song/#hash=${songId}`;

    // Fetch lyric
    const lyric = await fetchLyric(source, songId);

    return {
      code: 200,
      title: song.name || song.title,
      singer: Array.isArray(song.artist) ? song.artist.join(',') : (song.artist || "Unknown"),
      cover: cover,
      link: link,
      music_url: song.url || "",
      lyric: lyric,
      source: source // Debug info
    };
  };

  // Main Logic: Source Fallback Strategy (Kugou -> Netease -> QQ)
  let songData = await searchSong('kugou', songName);
  let source = 'kugou';

  if (!songData) {
    songData = await searchSong('netease', songName);
    source = 'netease';
  }

  if (!songData) {
    songData = await searchSong('qq', songName);
    source = 'qq';
  }

  // Final Response Handling
  if (songData && songData.url) {
    const result = await formatResponse(songData, source);
    return res.status(200).json(result);
  } else {
    return res.status(200).json({
      code: 404,
      msg: "未找到歌曲或无播放链接"
    });
  }
}

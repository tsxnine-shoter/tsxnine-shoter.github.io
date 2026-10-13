// Pobiera prawdziwe klipy i zapisuje data/clips.json. Node 20+, bez zależności.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const cfg = JSON.parse(readFileSync("site.config.json", "utf8"));
const tag = (x, t) => (x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || "";
const attr = (x, t, a) => (x.match(new RegExp(`<${t}[^>]*\\s${a}="([^"]*)"`)) || [])[1] || "";
const dec = (s) => s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
const clips = [];

async function youtube(id) {
  const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
  if (!r.ok) throw new Error("YouTube RSS " + r.status);
  for (const e of (await r.text()).split("<entry>").slice(1)) {
    const vid = tag(e, "yt:videoId");
    clips.push({ platform: "youtube", id: vid, url: `https://www.youtube.com/watch?v=${vid}`,
      title: dec(tag(e, "title")), thumb: attr(e, "media:thumbnail", "url"),
      date: tag(e, "published"), views: Number(attr(e, "media:statistics", "views")) || null });
  }
}
// TikTok nie ma publicznego feedu – użyj RSS z RSSHub (np. własna instancja: /tiktok/user/@nick)
async function tiktok(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("TikTok RSS " + r.status);
  for (const e of (await r.text()).split(/<item>|<entry>/).slice(1)) {
    const link = dec(tag(e, "link")) || attr(e, "link", "href");
    const id = (link.match(/video\/(\d+)/) || [])[1];
    if (!id) continue;
    const desc = dec(tag(e, "description") || tag(e, "content"));
    clips.push({ platform: "tiktok", id, url: link, title: dec(tag(e, "title")).slice(0, 140),
      thumb: (desc.match(/<img[^>]+src="([^"]+)"/) || [])[1] || "",
      date: new Date(tag(e, "pubDate") || tag(e, "published")).toISOString(), views: null });
  }
}
// YouTube: ID kanału z @handle (jeśli nie podano youtubeChannelId)
async function ytChannelId(handle) {
  const r = await fetch("https://www.youtube.com/" + (handle.startsWith("@") ? handle : "@" + handle), { headers: { "accept-language": "en" } });
  const m = (await r.text()).match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (!m) throw new Error("Nie znaleziono kanału YouTube dla " + handle);
  return m[1];
}
// TikTok lokalnie: yt-dlp (https://github.com/yt-dlp/yt-dlp) czyta publiczny profil
function tiktokYtDlp(user) {
  const url = "https://www.tiktok.com/@" + user;
  const run = (args) => spawnSync("yt-dlp", [...args, "--dump-json", "--no-warnings", url], { encoding: "utf8", maxBuffer: 1 << 27 });
  // pełne dane (miniatura, tytuł, data, wyświetlenia) – wolniej; gdy się nie uda, szybka lista
  let r = run(["--ignore-errors", "--playlist-end", "12"]);
  if (r.error) throw new Error("Brak yt-dlp w PATH (zainstaluj go, patrz README)");
  if (!r.stdout.trim()) r = run(["--flat-playlist", "--playlist-end", "30"]);
  if (!r.stdout.trim()) throw new Error("yt-dlp nic nie zwrócił: " + (r.stderr || "").slice(0, 300));
  r.stdout.split("\n").filter(Boolean).forEach((l, i) => {
    let v; try { v = JSON.parse(l); } catch { return; }
    clips.push({ platform: "tiktok", id: String(v.id), url: v.webpage_url || v.url || `https://www.tiktok.com/@${user}/video/${v.id}`,
      title: String(v.title || v.description || "TikTok").slice(0, 140),
      thumb: v.thumbnail || (v.thumbnails && v.thumbnails.length ? v.thumbnails[v.thumbnails.length - 1].url : ""),
      date: v.timestamp ? new Date(v.timestamp * 1000).toISOString() : new Date(Date.now() - i * 6e4).toISOString(),
      views: v.view_count || null, likes: v.like_count || null });
  });
}
// --- statystyki profilu TikTok (obserwujący, polubienia) ---
function parseProfile(t) {
  const i = t.indexOf('"userInfo"'), s = i >= 0 ? t.slice(i) : t; // liczby z bloku profilu, nie z polecanych kont
  const n = (k) => { const m = s.match(new RegExp('"' + k + '":"?(\\d+)')); return m ? Number(m[1]) : null; };
  const followers = n("followerCount") || null; // 0 = pusty/zablokowany ekran, pomijamy
  return { followers, likes: followers ? (n("heartCount") ?? n("heart")) : null, videos: n("videoCount") };
}
async function profileStats(user) {
  const r = await fetch("https://www.tiktok.com/@" + user, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "accept-language": "en-US,en;q=0.9" } });
  if (!r.ok) throw new Error("profil TikTok: HTTP " + r.status);
  const o = parseProfile(await r.text());
  if (o.followers === null) throw new Error("nie znaleziono liczników w profilu albo TikTok zwrócił zera (mógł zablokować serwer)");
  return o;
}
// Instagram: oficjalne Graph API, wymaga tokena w sekrecie IG_TOKEN
async function instagram(token) {
  const r = await fetch(`https://graph.instagram.com/me/media?fields=id,caption,media_type,thumbnail_url,permalink,timestamp&limit=25&access_token=${token}`);
  if (!r.ok) throw new Error("Instagram API " + r.status);
  for (const m of (await r.json()).data || []) {
    if (m.media_type !== "VIDEO") continue;
    clips.push({ platform: "instagram", id: m.permalink.split("/").filter(Boolean).pop(), url: m.permalink,
      title: (m.caption || "Reel").split("\n")[0].slice(0, 140), thumb: m.thumbnail_url || "", date: m.timestamp, views: null });
  }
}
const s = cfg.sources, jobs = [];
if (s.youtubeChannelId) jobs.push(youtube(s.youtubeChannelId));
else if (s.youtubeHandle) jobs.push(ytChannelId(s.youtubeHandle).then(youtube));
if (s.tiktokRssUrl) jobs.push(tiktok(s.tiktokRssUrl));
else if (s.tiktokUser) jobs.push(Promise.resolve().then(() => tiktokYtDlp(s.tiktokUser)));
if (s.instagramEnabled && process.env.IG_TOKEN) jobs.push(instagram(process.env.IG_TOKEN));
const res = await Promise.allSettled(jobs);
if (s.tiktokUser) {
  let prev = {}; try { prev = JSON.parse(readFileSync("data/stats.json", "utf8")); } catch {}
  let cur = null; try { cur = await profileStats(s.tiktokUser); } catch (e) { console.error("Statystyki:", e.message); }
  const ov = cfg.statsOverride || {}, f = cur?.followers ?? ov.followers ?? null;
  const out = { updated: new Date().toISOString(), followers: f ?? prev.followers ?? null, likes: cur?.likes ?? ov.likes ?? prev.likes ?? null, videos: cur?.videos ?? prev.videos ?? null, history: prev.history || [] };
  if (f !== null) { const last = out.history[out.history.length - 1]; if (!last || Date.now() - new Date(last.t) >= 6 * 36e5) out.history.push({ t: out.updated, f }); out.history = out.history.slice(-400); }
  if (out.followers !== null || out.likes !== null) { writeFileSync("data/stats.json", JSON.stringify(out, null, 2)); console.log("Statystyki zapisane: " + out.followers + " obserwujących"); }
}

res.filter((x) => x.status === "rejected").forEach((x) => console.error("Błąd źródła:", x.reason.message));
if (jobs.length && res.every((x) => x.status === "rejected")) process.exit(1); // nie nadpisuj starych danych
if (!jobs.length) console.log("Brak skonfigurowanych źródeł – uzupełnij site.config.json");
clips.sort((a, b) => new Date(b.date) - new Date(a.date));
if (jobs.length) writeFileSync("data/clips.json", JSON.stringify(clips, null, 2));
console.log(`Zapisano ${clips.length} klipów`);

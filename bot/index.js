import { Telegraf, Markup } from 'telegraf';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv'; dotenv.config();

const bot = new Telegraf(process.env.TG_BOT_TOKEN);
const API = process.env.APP_URL;

async function downloadTelegramFile(botToken, fileId, destPath) {
  const api = `https://api.telegram.org/bot${botToken}`;
  const info = await fetch(`${api}/getFile?file_id=${fileId}`).then(r=>r.json());
  if (!info.ok) throw new Error('getFile gagal');
  const filePath = info.result.file_path;
  const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const res = await fetch(url);
  await fs.promises.mkdir(path.dirname(destPath), { recursive:true });
  const ws = fs.createWriteStream(destPath);
  await new Promise((resolve,reject)=>{ res.body.pipe(ws); res.body.on('error', reject); ws.on('finish', resolve); });
}

bot.start(ctx => ctx.reply('Halo! Kirim video (atau dokumen video) untuk diunggah.'));

bot.command('upload', ctx => ctx.reply('Silakan kirim video / dokumen MP4.'));

bot.on(['video','document'], async ctx=>{
  try {
    let fileId, fileName='video.mp4';
    if (ctx.message.video) {
      fileId = ctx.message.video.file_id;
    } else if (ctx.message.document && (ctx.message.document.mime_type||'').includes('video')) {
      fileId = ctx.message.document.file_id;
      fileName = ctx.message.document.file_name || fileName;
    } else return ctx.reply('Kirim video atau dokumen video ya.');

    await ctx.reply('⬇️ Mengunduh video...');
    const rawDir = 'storage/raw';
    const tempId = Date.now().toString();
    const tempPath = path.join(rawDir, `${tempId}.mp4`);
    await downloadTelegramFile(process.env.TG_BOT_TOKEN, fileId, tempPath);

    // Intake
    const intake = await fetch(`${API}/api/videos/intake`, {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ title:fileName, description:'Uploaded via Telegram' })
    }).then(r=>r.json());
    if (!intake.ok) throw new Error(intake.error || 'Intake gagal');

    const videoId = intake.video.id;
    const finalPath = path.join(rawDir, `${videoId}.mp4`);
    await fs.promises.rename(tempPath, finalPath);

    const kb = Markup.inlineKeyboard([
      [Markup.button.url('🎥 Watch on Web', `${API}/watch/${intake.video.slug}`)],
      [Markup.button.callback('🔑 Get Key', `getkey_${videoId}`)],
      [Markup.button.callback('👁️ Views', `views_${videoId}`)]
    ]);

    await ctx.reply(
      `✅ Video diterima\nID: ${videoId}\nJudul: ${intake.video.title}\nStatus: processing ⏳`,
      kb
    );
  } catch (e) {
    console.error(e);
    ctx.reply('❌ Gagal memproses video: '+e.message);
  }
});

bot.on('callback_query', async ctx=>{
  try {
    const data = ctx.callbackQuery.data || '';
    if (data.startsWith('getkey_')) {
      const id = data.split('_')[1];
      const res = await fetch(`${API}/api/public/videos?q=${id}`); // dummy ping
      // ambil key via endpoint terbuka? di sini kita balikkan instruksi langsung:
      await ctx.answerCbQuery();
      await ctx.reply(`Gunakan link HLS dengan query ?key=[key]\nContoh: ${API}/hls/${id}/master.m3u8?key=YOUR_KEY\n(cek key via CLI/DB atau notifikasi sukses transcode)`);
    } else if (data.startsWith('views_')) {
      const id = data.split('_')[1];
      await ctx.answerCbQuery('Cek halaman web untuk total terbaru.');
    }
  } catch (e) {
    await ctx.answerCbQuery('Error');
  }
});

bot.launch().then(()=> console.log('Telegram bot running'));

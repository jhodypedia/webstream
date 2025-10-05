import { Telegraf, Markup } from "telegraf";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
dotenv.config();

const bot = new Telegraf(process.env.TG_BOT_TOKEN);
const API = process.env.APP_URL;
const TMP_DIR = "storage/raw";
const THUMB_DIR = "storage/thumbs";
const sessions = {}; // session per user sementara

ffmpeg.setFfmpegPath(ffmpegPath);

async function downloadTelegramFile(botToken, fileId, destPath) {
  const api = `https://api.telegram.org/bot${botToken}`;
  const info = await fetch(`${api}/getFile?file_id=${fileId}`).then(r => r.json());
  if (!info.ok) throw new Error("getFile gagal");
  const filePath = info.result.file_path;
  const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
  const res = await fetch(url);
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  const ws = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    res.body.pipe(ws);
    res.body.on("error", reject);
    ws.on("finish", resolve);
  });
}

bot.start(ctx =>
  ctx.reply("👋 Halo! Kirim video (atau dokumen video) untuk diunggah ke *PansaStream*.", {
    parse_mode: "Markdown",
  })
);

bot.command("upload", ctx =>
  ctx.reply("Silakan kirim file video (MP4, MOV, dsb).")
);

bot.on(["video", "document"], async ctx => {
  try {
    let fileId, fileName = "video.mp4";
    if (ctx.message.video) {
      fileId = ctx.message.video.file_id;
    } else if (
      ctx.message.document &&
      (ctx.message.document.mime_type || "").includes("video")
    ) {
      fileId = ctx.message.document.file_id;
      fileName = ctx.message.document.file_name || fileName;
    } else return ctx.reply("Kirim video atau dokumen video ya.");

    await ctx.reply("⬇️ Mengunduh video ke server...");
    const tempId = Date.now().toString();
    const tempPath = path.join(TMP_DIR, `${tempId}.mp4`);
    await downloadTelegramFile(process.env.TG_BOT_TOKEN, fileId, tempPath);

    sessions[ctx.from.id] = {
      fileId,
      tempPath,
      fileName,
      title: fileName.replace(/\.[^/.]+$/, ""),
      description: "",
      thumbPath: "",
      confirmed: false,
    };

    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("✏️ Set Judul", "set_title")],
      [Markup.button.callback("📝 Set Deskripsi", "set_desc")],
      [Markup.button.callback("📸 Generate Thumbnail", "make_thumb")],
      [Markup.button.callback("✅ Selesai Upload", "confirm_upload")],
      [Markup.button.callback("❌ Batal", "cancel_upload")],
    ]);

    await ctx.reply(
      `📦 File disiapkan: *${fileName}*\n\nAtur dulu detailnya sebelum diunggah.`,
      { parse_mode: "Markdown", ...kb }
    );
  } catch (e) {
    console.error(e);
    ctx.reply("❌ Gagal memproses video: " + e.message);
  }
});

bot.on("callback_query", async ctx => {
  try {
    const userId = ctx.from.id;
    const data = ctx.callbackQuery.data;
    const session = sessions[userId];
    await ctx.answerCbQuery();

    if (!session) return ctx.reply("⚠️ Tidak ada sesi aktif.");

    // === Set Judul ===
    if (data === "set_title") {
      await ctx.reply("🖊️ Kirim teks judul baru:");
      session.awaiting = "title";
    }

    // === Set Deskripsi ===
    else if (data === "set_desc") {
      await ctx.reply("📄 Kirim deskripsi video:");
      session.awaiting = "desc";
    }

    // === Generate Thumbnail ===
    else if (data === "make_thumb") {
      const thumbOut = path.join(THUMB_DIR, `${Date.now()}.jpg`);
      await fs.promises.mkdir(THUMB_DIR, { recursive: true });
      await ctx.reply("📸 Membuat thumbnail...");

      await new Promise((resolve, reject) => {
        ffmpeg(session.tempPath)
          .on("end", resolve)
          .on("error", reject)
          .screenshots({
            count: 1,
            timemarks: ["50%"],
            filename: path.basename(thumbOut),
            folder: THUMB_DIR,
            size: "640x?",
          });
      });

      session.thumbPath = thumbOut;
      await ctx.replyWithPhoto({ source: thumbOut }, { caption: "✅ Thumbnail berhasil dibuat!" });
    }

    // === Konfirmasi Upload ===
    else if (data === "confirm_upload") {
      await ctx.reply("🚀 Mengunggah video ke sistem...");

      const body = {
        title: session.title,
        description: session.description || "Uploaded via Telegram",
        filename: session.fileName,
        thumbnail_url: session.thumbPath ? `${API}/${session.thumbPath}` : null,
      };

      const intake = await fetch(`${API}/api/videos/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(r => r.json());

      if (!intake.ok) throw new Error(intake.error || "Intake gagal");

      const videoId = intake.video.id;
      const finalPath = path.join(TMP_DIR, `${videoId}.mp4`);
      await fs.promises.rename(session.tempPath, finalPath);

      const kb = Markup.inlineKeyboard([
        [
          Markup.button.url("▶️ Tonton di Web", `${API}/watch/${intake.video.slug}`),
        ],
        [Markup.button.callback("👁️ Cek Views", `views_${videoId}`)],
      ]);

      await ctx.reply(
        `✅ *Video berhasil diunggah!*\n\n🎬 *${intake.video.title}*\n🆔 ${videoId}\n\nTersimpan dan sedang diproses ⏳`,
        { parse_mode: "Markdown", ...kb }
      );

      delete sessions[userId];
    }

    // === Batalkan Upload ===
    else if (data === "cancel_upload") {
      if (fs.existsSync(session.tempPath)) await fs.promises.unlink(session.tempPath);
      if (session.thumbPath && fs.existsSync(session.thumbPath)) await fs.promises.unlink(session.thumbPath);
      delete sessions[userId];
      await ctx.reply("❌ Upload dibatalkan dan file dihapus.");
    }

    // === Lihat Views ===
    else if (data.startsWith("views_")) {
      await ctx.reply("👁️ Buka halaman web untuk melihat total views terbaru.");
    }
  } catch (e) {
    console.error(e);
    await ctx.reply("⚠️ Terjadi error: " + e.message);
  }
});

// === Tangani pesan teks setelah set judul/deskripsi ===
bot.on("text", async ctx => {
  const userId = ctx.from.id;
  const session = sessions[userId];
  if (!session || !session.awaiting) return;

  if (session.awaiting === "title") {
    session.title = ctx.message.text.trim();
    session.awaiting = null;
    await ctx.reply(`✅ Judul diperbarui menjadi:\n*${session.title}*`, { parse_mode: "Markdown" });
  } else if (session.awaiting === "desc") {
    session.description = ctx.message.text.trim();
    session.awaiting = null;
    await ctx.reply("✅ Deskripsi disimpan.");
  }
});

bot.launch().then(() => console.log("🤖 Telegram bot aktif dengan flow interaktif + thumbnail!"));

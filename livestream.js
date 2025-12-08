const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
require("dotenv").config();
const readline = require("readline");

// ===== DETECT OS & SET FFMPEG PATH =====
function getFfmpegPath() {
  const platform = process.platform; // win32, linux, darwin

  if (platform === "win32") {
    const winPaths = [
      "C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe",
      "C:\\ffmpeg\\bin\\ffmpeg.exe",
      "C:\\tools\\ffmpeg\\bin\\ffmpeg.exe",
    ];
    return winPaths.find((p) => fs.existsSync(p)) || winPaths[0];
  }

  if (platform === "darwin") {
    // macOS (homebrew)
    const macPaths = [
      "/opt/homebrew/bin/ffmpeg",       // Apple Silicon
      "/usr/local/bin/ffmpeg",          // Intel mac
    ];
    return macPaths.find((p) => fs.existsSync(p)) || macPaths[0];
  }

  if (platform === "linux") {
    const linuxPaths = [
      "/usr/bin/ffmpeg",
      "/usr/local/bin/ffmpeg",
      "/snap/bin/ffmpeg",
    ];
    return linuxPaths.find((p) => fs.existsSync(p)) || linuxPaths[0];
  }

  return "ffmpeg"; // fallback
}

const ffmpegPath = getFfmpegPath();
let ffmpegProcess = null;

// =======================================

function startStream() {
  if (ffmpegProcess) {
    console.log("Stream already running.");
    return;
  }

  const streamKey = process.env.YOUTUBE_STREAM_KEY;
  if (!streamKey) {
    console.error("YOUTUBE_STREAM_KEY is not defined in .env!");
    return;
  }

  const streamUrl = `rtmp://a.rtmp.youtube.com/live2/${streamKey}`;
  const videoPath = path.resolve(__dirname, "media/video.mp4");
  const audioPath = path.resolve(__dirname, "media/audio.mp3");

  console.log("==== DEBUG START STREAM ====");
  console.log("OS:", process.platform);
  console.log("FFMPEG PATH:", ffmpegPath);
  console.log("Video exists:", fs.existsSync(videoPath), videoPath);
  console.log("Audio exists:", fs.existsSync(audioPath), audioPath);
  console.log("Stream URL:", streamUrl);

  if (!fs.existsSync(videoPath) || !fs.existsSync(audioPath)) {
    console.error("Video or audio file not found! Aborting stream.");
    return;
  }

  const args = [
  "-stream_loop", "-1",
  "-re", "-i", videoPath,
  "-stream_loop", "-1",
  "-re", "-i", audioPath,

  "-shortest",

  // VIDEO
  "-c:v", "libx264",
  "-preset", "veryfast",
  "-b:v", "6000k",        // bitrate 6 Mbps
  "-maxrate", "6000k",
  "-bufsize", "12000k",
  "-pix_fmt", "yuv420p",
  "-r", "30",             // 30 FPS
  "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease",

  // AUDIO
  "-c:a", "aac",
  "-b:a", "160k",

  // OUTPUT
  "-f", "flv",
  streamUrl,
];


  try {
    ffmpegProcess = spawn(ffmpegPath, args, { stdio: "inherit" });
  } catch (err) {
    console.error("Failed to spawn ffmpeg:", err);
    ffmpegProcess = null;
    return;
  }

  ffmpegProcess.on("error", (err) => {
    console.error("FFmpeg process error event:", err);
  });

  ffmpegProcess.on("exit", (code, signal) => {
    console.log(
      `FFmpeg exited with code ${code}, signal ${signal}. Restarting in 3 seconds...`
    );
    ffmpegProcess = null;
    setTimeout(startStream, 3000);
  });
}

function stopStream() {
  if (ffmpegProcess) {
    console.log("Stopping stream...");
    ffmpegProcess.kill("SIGINT");
    ffmpegProcess = null;
  } else {
    console.log("No active stream to stop.");
  }
}

// CLI
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("Type 'start' to begin streaming, 'stop' to stop, 'exit' to quit.");

rl.on("line", (input) => {
  const cmd = input.trim().toLowerCase();
  if (cmd === "start") startStream();
  else if (cmd === "stop") stopStream();
  else if (cmd === "exit") {
    stopStream();
    rl.close();
    process.exit(0);
  } else {
    console.log("Unknown command. Use 'start', 'stop', or 'exit'.");
  }
});

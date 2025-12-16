// ffmpeg-loader.js (新檔案)

let ffmpeg = null;
// ffmpeg-loader.js
const base = '/ffmpeg_static/'; 
// ❗注意：在 GitHub Pages 上，這會被解析為您的專案根目錄，例如：
// https://<username>.github.io/<repo>/ffmpeg_static/
let isFfmpegLoaded = false;

/**
 * 載入 FFmpeg 核心並設定進度回呼
 * @param {FFmpeg} FFmpegClass - 從 window.FFmpeg 獲取的類別
 */
async function loadFfmpeg(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    ffmpeg = new FFmpegClass(); 

    // 設定進度回呼
    ffmpeg.on('progress', ({ progress, time }) => {
        const percentage = Math.round(progress);
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        if (progressFill && progressText) {
             progressFill.style.width = `${percentage}%`;
             progressText.textContent = `${percentage}%`;
        }
    });

    // ffmpeg-loader.js (最終修正程式碼片段)

    try {
        await ffmpeg.load({
            coreURL: base + 'ffmpeg-core.js',
            wasmURL: base + 'ffmpeg-core.wasm',
            // ⭐ 修正點：必須顯式地指定 workerURL，解決 SecurityError (核心載入失敗)
            workerURL: base + 'ffmpeg-core.js', 
        });
        isFfmpegLoaded = true;
        window.showMessage('success', '✅ 影片處理核心載入完成！');
    } catch (e) {
// ...
        console.error('FFmpeg 載入失敗:', e);
        window.showMessage('error', '❌ 影片處理核心載入失敗！請檢查控制台或網路。');
        throw e; // 拋出錯誤供 upload.js 捕獲
    }

    return ffmpeg;
}

// 暴露出全域變數供 upload.js 使用
window.FFMpegLoader = { 
    loadFfmpeg, 
    getFfmpeg: () => ffmpeg, 
    getIsLoaded: () => isFfmpegLoaded
};
// ffmpeg-loader.js (最終完整程式碼)

let ffmpeg = null;
const base = '/ffmpeg_static/'; 
let isFfmpegLoaded = false;

/**
 * 載入 FFmpeg 核心並設定進度回呼
 * @param {FFmpeg} FFmpegClass - 從 window.FFmpeg 獲取的類別
 */
async function loadFfmpeg(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    ffmpeg = new FFmpegClass(); 

    // 設定進度回呼 (用於顯示進度條)
    ffmpeg.on('progress', ({ progress, time }) => {
        const percentage = Math.round(progress);
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        if (progressFill && progressText) {
             progressFill.style.width = `${percentage}%`;
             progressText.textContent = `${percentage}%`;
        }
    });

    try {
        await ffmpeg.load({
            coreURL: base + 'ffmpeg-core.js',
            wasmURL: base + 'ffmpeg-core.wasm',
            // ⭐ 關鍵修正：解決 GitHub Pages/CORS 環境下的核心載入失敗問題
            workerURL: base + 'ffmpeg-core.js', 
        });
        isFfmpegLoaded = true;
        window.showMessage('success', '✅ 影片處理核心載入完成！');
        return ffmpeg;
    } catch (e) {
        console.error('❌ FFmpeg 核心載入失敗:', e);
        window.showMessage('error', `❌ 影片核心載入失敗：${e.message}。`);
        // 讓 loadFfmpeg 拋出錯誤，通知 uploadPhoto 中止
        throw new Error('FFmpeg 核心載入失敗'); 
    }
}

// 暴露出全域變數供 upload.js 使用
window.FFMpegLoader = { 
    load: () => loadFfmpeg(window.FFmpeg), // 修正 load 函式，傳入 FFmpeg 類別
    getFfmpeg: () => ffmpeg, 
    getIsLoaded: () => isFfmpegLoaded
};
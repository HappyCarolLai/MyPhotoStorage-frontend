// ffmpeg-loader.js (最終完整修正程式碼，包含 workerURL 修正)

let ffmpeg = null;
// FFmpeg 核心檔案的路徑
const base = '/ffmpeg_static/'; 
let isFfmpegLoaded = false;

/**
 * 載入 FFmpeg 核心並設定進度回呼
 * @param {FFmpeg} FFmpegClass - 從 window.FFmpeg 獲取的類別 (可能為 undefined)
 */
async function load(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    // 檢查 FFmpeg 類別是否存在
    if (typeof FFmpegClass === 'undefined') {
        // ⭐ 關鍵修正：嘗試從 window 取得 FFmpegWASM
        FFmpegClass = window.FFmpegWASM; 
        if (typeof FFmpegClass === 'undefined') {
            const errorMsg = '❌ FFmpeg.js 函式庫尚未載入。';
            window.showMessage('error', errorMsg);
            throw new Error(errorMsg);
        }
    }
    
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

    try {
        await ffmpeg.load({
            coreURL: base + 'ffmpeg-core.js',
            wasmURL: base + 'ffmpeg-core.wasm',
            // ⭐ 關鍵修正：必須顯式指定 workerURL，解決核心載入失敗
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

// 暴露出全域變數供 upload.js 使用 (在全域腳本中會成功)
window.FFMpegLoader = {
    load: load, // <== 確保這裡暴露出的是 load 函式
    getIsLoaded: () => isFfmpegLoaded
};
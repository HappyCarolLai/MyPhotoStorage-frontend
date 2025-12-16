// ffmpeg-loader.js (最終穩固版 - 包含 Worker 載入和類別檢查)

let ffmpeg = null;
// ⭐ 關鍵修正 A：使用 URL API 嚴格計算出絕對路徑，確保與 __webpack_public_path__ 一致
const base = new URL('ffmpeg_static/', window.location.href).href; 
let isFfmpegLoaded = false;

/**
 * 載入 FFmpeg 核心並設定進度回呼
 * @param {FFmpeg} FFmpegClass - FFmpeg 類別構造函數
 */
async function load(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    // 1. 確保 FFmpegClass 是真正的構造函數
    if (typeof FFmpegClass !== 'function') {
        if (window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg === 'function') {
             FFmpegClass = window.FFmpegWASM.FFmpeg; 
        } else {
            const errorMsg = '❌ FFmpeg.js 函式庫尚未載入。';
            window.showMessage('error', errorMsg);
            throw new Error(errorMsg);
        }
    }
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // 2. ⭐ 在構造函數中設定 corePath（必須為絕對路徑）
    ffmpeg = new FFmpegClass({ 
        corePath: base, // 使用絕對路徑
    }); 

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
        // 3. ⭐ 在 load() 中明確指定所有 URL（這是最安全的做法）
        await ffmpeg.load({
            coreURL: base + 'ffmpeg-core.js',   // 絕對路徑
            wasmURL: base + 'ffmpeg-core.wasm', // 絕對路徑
            workerURL: base + 'ffmpeg-core.js', // 絕對路徑
        });
        
        isFfmpegLoaded = true;
        window.showMessage('success', '✅ 影片處理核心載入完成！');
        return ffmpeg;
    } catch (e) {
        console.error('❌ FFmpeg 核心載入失敗:', e);
        window.showMessage('error', `❌ 影片核心載入失敗：${e.message}。`);
        throw new Error('FFmpeg 核心載入失敗');
    }
}

// 暴露出全域變數
window.FFMpegLoader = {
    load: load, 
    getIsLoaded: () => isFfmpegLoaded,
    getFfmpeg: () => ffmpeg
};
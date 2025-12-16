// ffmpeg-loader.js (Final Super Fix - 強制 Worker URL)

let ffmpeg = null;
// ⭐ 修正 1：確保使用絕對路徑，例如：https://yourdomain.com/ffmpeg_static/
const base = window.location.origin + '/ffmpeg_static/'; 
let isFfmpegLoaded = false;

/**
 * 載入 FFmpeg 核心並設定進度回呼
 * @param {FFmpeg} FFmpegClass - FFmpeg 類別構造函數
 */
async function load(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    // (省略類別檢查的健壯性程式碼，假設您已使用我提供的最新版本)
    if (typeof FFmpegClass !== 'function') {
        // Fallback check
        if (window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg === 'function') {
             FFmpegClass = window.FFmpegWASM.FFmpeg; 
        } else {
            const errorMsg = '❌ FFmpeg.js 函式庫尚未載入。';
            window.showMessage('error', errorMsg);
            throw new Error(errorMsg);
        }
    }
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // ⭐ 修正 2：在構造函數中設定 corePath（必須為絕對路徑）
    ffmpeg = new FFmpegClass({ 
        corePath: base 
    }); 

    // 設定進度回呼 (保持不變)
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
        // ⭐ 修正 3：在 load() 中明確指定 workerURL，解決 814.ffmpeg.js 問題
        // 這是告訴 FFmpeg 不要自動生成 worker，而是使用這個 URL 作為 Worker 腳本。
        // workerURL 必須指向 ffmpeg-core.js (這是 ffmpeg.wasm 要求的自定義 Worker 檔案)
        await ffmpeg.load({
            workerURL: base + 'ffmpeg-core.js', 
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

// 暴露出全域變數供 upload.js 使用 
window.FFMpegLoader = {
    load: load, 
    getIsLoaded: () => isFfmpegLoaded,
    getFfmpeg: () => ffmpeg
};
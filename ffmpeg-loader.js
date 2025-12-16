// ffmpeg-loader.js (最終 GitHub Pages 修正版)

let ffmpeg = null;
// ⭐ 關鍵修正 A：使用 URL API 嚴格計算出絕對路徑。
// 即使頁面在子目錄中，也能保證計算出：https://happycarollai.github.io/MyPhotoStorage-frontend/ffmpeg_static/
const base = new URL('ffmpeg_static/', window.location.href).href; 
let isFfmpegLoaded = false;

/**
 * 載入 FFmpeg 核心並設定進度回呼
 * @param {FFmpeg} FFmpegClass - FFmpeg 類別構造函數
 */
async function load(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    // (省略類別檢查的健壯性程式碼)
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

    // ⭐ 關鍵修正 B：在構造函數中設定 corePath（必須為絕對路徑）
    ffmpeg = new FFmpegClass({ 
        corePath: base,
        // (移除 workerType: 'module'，避免引入新的不兼容性)
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
        // ⭐ 關鍵修正 C：在 load() 中同時指定 coreURL 和 workerURL，
        // 這是因為 FFmpeg.wasm 在 Worker 啟動時，需要知道 workerURL 和 coreURL 的路徑，
        // corePath 雖然設定了，但在某些環境下需要顯式指定，以覆蓋動態路徑解析。
        await ffmpeg.load({
            coreURL: base + 'ffmpeg-core.js', // 絕對路徑
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
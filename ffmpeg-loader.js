// ffmpeg-loader.js (最終絕對路徑和 Worker 類型修正)

let ffmpeg = null;
// ⭐ 關鍵修正 A：使用絕對路徑。這是 Web Worker 載入資源最可靠的方式。
// 例如：https://yourdomain.com/ffmpeg_static/
const base = window.location.origin + '/ffmpeg_static/'; 
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
    // 這確保 FFmpeg 內部邏輯使用正確的基礎路徑。
    ffmpeg = new FFmpegClass({ 
        corePath: base,
        // ⭐ 新增修正 C：強制 Worker 使用 module 類型
        // 有些環境要求 Worker 腳本作為 ES 模組載入
        // 雖然 workerURL 指向 ffmpeg-core.js，但這個選項有時能解決底層的 Worker 創建問題
        workerType: 'module' 
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
        // ⭐ 關鍵修正 D：在 load() 中明確指定 workerURL（這是強制載入的最後一步）
        // 必須使用絕對路徑
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

// 暴露出全域變數
window.FFMpegLoader = {
    load: load, 
    getIsLoaded: () => isFfmpegLoaded,
    getFfmpeg: () => ffmpeg
};
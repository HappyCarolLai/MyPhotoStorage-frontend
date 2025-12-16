// ffmpeg-loader.js (最終修正版 - 處理核心檔案載入路徑)

let ffmpeg = null;
// FFmpeg 核心檔案的路徑
const base = '/ffmpeg_static/'; 
let isFfmpegLoaded = false;

/**
 * 載入 FFmpeg 核心並設定進度回呼
 * @param {FFmpeg} FFmpegClass - 從 upload.js 傳入的 FFmpeg 類別構造函數
 */
async function load(FFmpegClass) {
    if (isFfmpegLoaded) return ffmpeg;
    
    // 1. 修正類別提取：如果沒有傳入正確的類別，從模組物件中提取 (為防止回歸)
    if (typeof FFmpegClass !== 'function' || typeof FFmpegClass === 'undefined') {
        if (window.FFmpegWASM && typeof window.FFmpegWASM.FFmpeg === 'function') {
             // 從模組物件中提取真正的類別構造函數
             FFmpegClass = window.FFmpegWASM.FFmpeg; 
        }
        if (typeof FFmpegClass !== 'function') {
            const errorMsg = '❌ FFmpeg.js 函式庫尚未載入。';
            window.showMessage('error', errorMsg);
            throw new Error(errorMsg);
        }
    }
    
    window.showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // 2. ⭐ 關鍵修正：將 corePath 傳遞給構造函數
    // 這是告訴 FFmpeg 庫去哪裡尋找 worker 和所有核心檔案 (包括 814.ffmpeg.js 等內部檔案)
    ffmpeg = new FFmpegClass({ 
        corePath: base // base = '/ffmpeg_static/'
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
        // 3. 簡化 load 呼叫：因為 corePath 已經在構造函數中設定，這裡只需要呼叫 load()
        await ffmpeg.load(); 
        
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
    // 為了健壯性，也提供 getFfmpeg
    getFfmpeg: () => ffmpeg
};
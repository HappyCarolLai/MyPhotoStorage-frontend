// upload.js (上傳頁面邏輯)

// ⭐ 1. 引入 FFmpeg 模組
// upload.js (修正後的程式碼 - 使用 CDN)
// 確保版本號與您 npm install 的版本相符，這裡使用常見的穩定版本
import { FFmpeg } from 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js'; 

const BACKEND_URL = 'https://myphotostorage-backend.zeabur.app'; 
let selectedFiles = []; 
let isFfmpegLoaded = false;
let ffmpeg = null; // FFmpeg 實例

// FFmpeg 相關 DOM 元素
const compressionProgressDiv = document.getElementById('compressionProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');

function showMessage(type, content) {
    const msg = document.getElementById('message');
    msg.className = `message-box ${type}`;
    msg.innerHTML = content;
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
}

// ----------------------------------------------------
// FFmpeg 初始化
// ----------------------------------------------------
async function loadFfmpeg() {
    if (isFfmpegLoaded) return;
    
    // 顯示載入訊息
    showMessage('info', '正在載入影片處理核心 (FFmpeg.wasm)，請稍候...');

    // 實例化 FFmpeg
    ffmpeg = new FFmpeg();

    // 設定進度回呼
    ffmpeg.on('progress', ({ progress, time }) => {
        // progress 為 0 到 100
        const percentage = Math.round(progress);
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
    });

    try {
        // ⭐ 這裡的 coreURL 必須指向您在「前置準備」中放置的檔案路徑
        await ffmpeg.load({
            coreURL: './ffmpeg_static/ffmpeg-core.js',
        });
        isFfmpegLoaded = true;
        showMessage('success', '✅ 影片處理核心載入完成！');
    } catch (e) {
        console.error('FFmpeg 載入失敗:', e);
        showMessage('error', '❌ 影片處理核心載入失敗！請檢查控制台或網路。');
    }
}

// ----------------------------------------------------
// 影片壓縮核心函式
// ----------------------------------------------------
/**
 * 壓縮影片檔案並返回壓縮後的 Blob
 */
async function compressVideo(file) {
    // 顯示進度條
    compressionProgressDiv.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = '0%';

    const inputFileName = file.name;
    const outputFileName = `compressed-${inputFileName.replace(/\.[^/.]+$/, '.mp4')}`;

    try {
        // 1. 將 File 讀取為 ArrayBuffer，並寫入虛擬檔案系統 (FS)
        const data = await new Response(file).arrayBuffer();
        await ffmpeg.writeFile(inputFileName, new Uint8Array(data));

        // 2. 執行壓縮命令 (與後端相同的極速設定)
        await ffmpeg.exec([
            '-i', inputFileName,
            '-c:v', 'libx264',
            '-preset', 'ultrafast', // 極速預設
            '-crf', '28',           // 壓縮品質
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', 'frag_keyframe+empty_moov',
            outputFileName
        ]);

        // 3. 從 FS 讀取壓縮後的檔案
        const outputData = await ffmpeg.readFile(outputFileName);

        // 4. 轉換為 Blob
        const compressedBlob = new Blob([outputData.buffer], { type: 'video/mp4' });

        // 5. 返回一個新的 File 物件
        const compressedFile = new File([compressedBlob], inputFileName, { type: 'video/mp4' });

        return compressedFile;

    } catch (e) {
        console.error('影片壓縮失敗:', e);
        showMessage('error', `影片 ${inputFileName} 壓縮失敗！請嘗試較小的檔案。`);
        throw e; // 拋出錯誤讓外層 catch 處理
    } finally {
        // 清理虛擬檔案系統
        await ffmpeg.deleteFile(inputFileName).catch(e => console.warn('清理輸入檔失敗', e));
        await ffmpeg.deleteFile(outputFileName).catch(e => console.warn('清理輸出檔失敗', e));
        
        // 隱藏進度條
        compressionProgressDiv.style.display = 'none';
    }
}


// ----------------------------------------------------
// 載入相簿選單 (不變)
// ----------------------------------------------------
async function fetchAlbumsForSelect() {
    const select = document.getElementById('targetAlbumSelect');
    try {
        const res = await fetch(`${BACKEND_URL}/api/albums`);
        const albums = await res.json();
        select.innerHTML = '';
        
        if (albums.length === 0) {
            select.innerHTML = '<option>無相簿</option>';
            return;
        }

        albums.forEach(album => {
            const opt = document.createElement('option');
            opt.value = album._id;
            opt.textContent = album.name;
            if (album.name === '未分類相簿') opt.selected = true;
            select.appendChild(opt);
        });
    } catch (e) { console.error(e); }
}

// ----------------------------------------------------
// 處理檔案選取與預覽 (不變)
// ----------------------------------------------------
function handleFiles(files) {
    const newFiles = Array.from(files);
    selectedFiles = selectedFiles.concat(newFiles);
    
    const previewGrid = document.getElementById('previewGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (emptyState) emptyState.style.display = 'none';

    newFiles.forEach(file => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.dataset.id = file.name + file.size; // 唯一識別符
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            selectedFiles = selectedFiles.filter(f => f.name + f.size !== div.dataset.id);
            div.remove();
            if (selectedFiles.length === 0) document.getElementById('emptyState').style.display = 'block';
            document.getElementById('uploadButton').disabled = selectedFiles.length === 0;
        };
        
        const img = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '8px';
        img.src = URL.createObjectURL(file);
        
        if (file.type.startsWith('video/')) {
            img.controls = true;
            img.loop = true; // 影片預覽可循環播放
        }

        const nameSpan = document.createElement('span');
        nameSpan.textContent = file.name;
        nameSpan.className = 'file-name-preview';

        div.appendChild(img);
        div.appendChild(removeBtn);
        div.appendChild(nameSpan);
        previewGrid.appendChild(div);
    });

    document.getElementById('uploadButton').disabled = selectedFiles.length === 0;
    
    // ⭐ 檔案選取後立即嘗試載入 FFmpeg
    if (selectedFiles.length > 0) {
        loadFfmpeg(); 
    }
}

// ----------------------------------------------------
// 上傳照片函式 (修正核心邏輯)
// ----------------------------------------------------
async function uploadPhoto() {
    if (selectedFiles.length === 0) return;

    const btn = document.getElementById('uploadButton');
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> <span>處理中...</span>`; // 顯示處理中狀態

    const targetAlbumId = document.getElementById('targetAlbumSelect').value;
    const formData = new FormData();
    formData.append('targetAlbumId', targetAlbumId);

    const filesToUpload = [];
    const videoCount = selectedFiles.filter(f => f.type.startsWith('video/')).length;
    let currentVideoIndex = 0;
    
    // 預先處理所有檔案
    for (const file of selectedFiles) {
        if (file.type.startsWith('video/')) {
            // ⭐ 影片壓縮邏輯
            if (isFfmpegLoaded) {
                currentVideoIndex++;
                showMessage('info', `🎥 正在壓縮第 ${currentVideoIndex} / ${videoCount} 個影片...`);
                try {
                    // 呼叫壓縮核心函式
                    const compressedFile = await compressVideo(file);
                    filesToUpload.push(compressedFile);
                } catch (e) {
                    // 如果壓縮失敗，跳過這個檔案，繼續下一個
                    console.error(`跳過失敗的影片 ${file.name}`);
                    continue; 
                }
            } else {
                showMessage('error', '❌ FFmpeg 尚未載入！請稍候重試。');
                filesToUpload.push(file); // 如果未載入，還是嘗試上傳原始檔案 (可能導致超時)
            }
        } else {
            // ⭐ 圖片（JPG, PNG, HEIC...）直接上傳，交給後端處理
            filesToUpload.push(file);
        }
    }

    // 將所有待上傳的檔案加入 FormData
    filesToUpload.forEach(file => {
        formData.append('photos', file);
    });
    
    // 如果沒有任何檔案準備上傳 (例如所有影片都失敗了)
    if (filesToUpload.length === 0) {
        showMessage('error', '所有檔案處理失敗，請重試。');
        selectedFiles = [];
        document.getElementById('previewGrid').innerHTML = '';
        document.getElementById('emptyState').style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox=\"0 0 24 24\" style=\"width:20px; height:20px; fill:white;\"><path d=\"M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z\" /></svg> <span>上傳</span>`;
        return;
    }
    
    // 進入上傳階段
    showMessage('info', `✅ 檔案處理完成，開始上傳 ${filesToUpload.length} 個檔案...`);

    try {
        const res = await fetch(`${BACKEND_URL}/upload`, {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();
        
        // 顯示結果
        let successCount = data.results.filter(r => r.status === 'success').length;
        let errorCount = data.results.length - successCount;
        
        if (successCount > 0) {
            showMessage('success', `🎉 上傳成功！共 ${successCount} 張留影 / ${errorCount} 張失敗。`);
            selectedFiles = [];
            document.getElementById('previewGrid').innerHTML = '';
            document.getElementById('emptyState').style.display = 'block';
            btn.innerHTML = `<svg viewBox=\"0 0 24 24\" style=\"width:20px; height:20px; fill:white;\"><path d=\"M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z\" /></svg> <span>上傳</span>`;
            
            // 通知主頁面資料已變更，讓它刷新
            localStorage.setItem('albums_data_changed', 'true');
        } else {
            showMessage('error', `上傳失敗！共 ${errorCount} 張失敗。請檢查控制台錯誤訊息。`);
        }
    } catch (e) {
        showMessage('error', '上傳發生網路錯誤');
    } finally {
        btn.disabled = selectedFiles.length === 0;
        if(selectedFiles.length === 0) btn.innerHTML = `<svg viewBox=\"0 0 24 24\" style=\"width:20px; height:20px; fill:white;\"><path d=\"M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z\" /></svg> <span>上傳</span>`;
    }
}

// ----------------------------------------------------
// DOMContentLoaded
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // ⭐ 在頁面載入時預先載入 FFmpeg
    loadFfmpeg(); 
    
    window.uploadPhoto = uploadPhoto;
    fetchAlbumsForSelect();

    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('photoFile');

    // 拖曳上傳與點擊選取邏輯 (保持不變)
    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('drag-over');
    });
    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('drag-over');
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        }
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFiles(e.target.files);
        }
    });
});
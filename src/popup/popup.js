import {readStorage} from "../utils.js";

const gameInfo = document.getElementById('ggh_cache_info');

const resetBtn = document.getElementById('ggh_reset_btn');
resetBtn.addEventListener('click', async () => {
    await chrome.storage.local.clear();
    void syncCacheCnt();
    window.alert("Game cache cleared");
});

void syncCacheCnt();

async function syncCacheCnt() {
    const cacheList = await readStorage('GGH_GAME_CACHE_LIST');
    if (cacheList) {
        gameInfo.innerText = cacheList.length;
    } else {
        gameInfo.innerText = 'NO';
    }
}
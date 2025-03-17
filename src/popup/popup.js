import {readStorage} from "../utils.js";

const resetBtn = document.getElementById('ggh_reset_btn');
resetBtn.addEventListener('click', async () => {
    await chrome.storage.local.clear();
    window.alert("Game cache cleared");
});

const gameInfo = document.getElementById('ggh_cache_info');
const cacheCnt = await readStorage('GGH_GAME_CACHE_available');
if (cacheCnt) {
    gameInfo.innerText = 'ACTIVE';
}
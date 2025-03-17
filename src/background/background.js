import {writeStorage} from "../utils.js";

chrome.runtime.onInstalled.addListener(({reason}) => {
    if (reason === 'install') {
        writeStorage('GGH_ACTIVITY_TOGGLE_STATE', true, "sync")
        void chrome.tabs.create({
            url: "src/onboarding/onboarding.html"
        });
    }
});
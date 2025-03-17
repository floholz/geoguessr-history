injectHeaderContent()

function waitForQuerySelector(selector, callback) {
    const iv = setInterval(() => {
        const elem = document.querySelector('header div[class^=header-desktop_desktopSectionRight]')
        if (elem) {
            clearInterval(iv)
            callback(elem)
        }
    }, 200)
}

function injectHeaderContent() {
    waitForQuerySelector('header div[class^=header-desktop_desktopSectionRight]', (header) => {
        header.prepend(historyBtnContainer)
    })

    const historyBtnContainer = document.createElement('div');
    historyBtnContainer.id = 'ggh_historyBtnContainer'

    const historyBtn = document.createElement('a');
    historyBtn.id = 'ggh_historyBtn'
    historyBtn.href = 'https://www.geoguessr.com/me/activities'

    const historyRes = chrome.runtime.getURL('assets/history.svg');
    const historyIcon = document.createElement('img');
    historyIcon.id = 'ggh_historyIcon'
    historyIcon.src = historyRes
    historyIcon.alt = 'history-icon'

    historyBtn.appendChild(historyIcon)
    historyBtnContainer.append(historyBtn)
}

async function loadHistory() {
    // document.querySelectorAll('a[href*=duels]')

    fetch('https://www.geoguessr.com/me/activities')
        .then(response => response.text())
        .then(text => {
            const parser = new DOMParser();
            const htmlDocument = parser.parseFromString(text, "text/html");

            const links = htmlDocument.querySelectorAll('a[href*=duels]')
            const urls = links.map(a => a.href)
            console.log(urls)
        })
}
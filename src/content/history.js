/// <reference types="./utils.d.ts" />
(async () => {
    /* import utils module */
    const utilsPath = chrome.runtime.getURL("src/utils.js");
    const utils = await import(utilsPath);

    /* storage constants */
    const GGH_ACTIVITY_TOGGLE_STATE = "GGH_ACTIVITY_TOGGLE_STATE";
    const GGH_GAME_CACHE_LIST = "GGH_GAME_CACHE_LIST";

    /* inject content */
    const contentContainer = await utils.querySelector('div[class*=container_content__]');
    if (!contentContainer) {
        throw Error('No content container found');
    }

    const activityContainer = await utils.querySelector('div[class*=activities_container__]');
    if (!activityContainer) {
        throw Error('No activity container found');
    }

    const toggleContainer = document.createElement('div');
    toggleContainer.id = 'ggh_activityToggleContainer';

    const toggleLabel = document.createElement('label');
    toggleLabel.id = 'ggh_activityToggleLabel';
    toggleLabel.innerText = 'Use better Game History';
    toggleLabel.htmlFor = 'ggh_activityToggleCheckbox';

    const toggleCheckbox = document.createElement('input');
    toggleCheckbox.id = 'ggh_activityToggleCheckbox';
    toggleCheckbox.type = 'checkbox';
    toggleCheckbox.title = 'Use better Game History';
    toggleCheckbox.addEventListener('change', (ev) => toggleActivityContent(ev.target.checked));

    const gameHistoryContainer = document.createElement('div');
    gameHistoryContainer.id = 'ggh_gameHistoryContainer';

    const gameHistoryHeader = document.createElement('h1');
    gameHistoryHeader.id = 'ggh_gameHistoryHeader';
    gameHistoryHeader.innerText = 'Game History';

    const gameHistoryTable = document.createElement('div');
    gameHistoryTable.id = 'ggh_gameHistoryTable';

    toggleContainer.append(toggleLabel);
    toggleContainer.append(toggleCheckbox);
    contentContainer.append(toggleContainer);
    contentContainer.append(gameHistoryContainer);
    gameHistoryContainer.append(gameHistoryHeader);
    gameHistoryContainer.append(gameHistoryTable);

    /***************************************************************************************************************/

    /* main */

    const gameUrls = await parseGameUrls();
    addTableHeader();
    for (const url of gameUrls) {
        void addGameSummaryElem(fetchGameSummary(url))
    }

    await utils.readStorage(GGH_ACTIVITY_TOGGLE_STATE, 'sync').then((state) => {
        toggleCheckbox.checked = state;
        toggleActivityContent(state);
    })




    /***************************************************************************************************************/

    /* functions */

    function toggleActivityContent(checked) {
        if (checked) {
            activityContainer.classList.add('hidden');
            gameHistoryContainer.classList.remove('hidden');
        } else {
            activityContainer.classList.remove('hidden');
            gameHistoryContainer.classList.add('hidden');
        }
        utils.writeStorage(GGH_ACTIVITY_TOGGLE_STATE, checked, 'sync');
    }

    async function parseGameUrls() {
        const urls = [];
        const links = activityContainer.querySelectorAll('a[href*=duels]')
        for (const link of links) {
            if (link.href && link.parentElement.innerText.startsWith('You')) {
                urls.push(link.href);
            }
        }
        return urls;
    }

    async function fetchGameSummary(url) {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname !== 'www.geoguessr.com') {
            throw new Error(`Invalid hostname: ${ parsedUrl.hostname }`);
        }
        if (
            !parsedUrl.pathname.endsWith('summary') ||
            !(parsedUrl.pathname.startsWith('/duels/') || parsedUrl.pathname.startsWith('/team-duels/'))
        ) {
            throw new Error(`Invalid path: ${ parsedUrl.pathname }`);
        }

        const gameType = parsedUrl.pathname.split('/')[1];
        const gameId = parsedUrl.pathname.split('/')[2];

        // check cache
        {   // eager return
            const cacheList = await utils.readStorage(GGH_GAME_CACHE_LIST) ?? [];
            const cachedSummary = cacheList.find(summary => summary.gameId === gameId)
            if (cachedSummary) {
                return cachedSummary;
            }
        }

        // load from url
        const response = await fetch(url);
        const text = await response.text();
        const parser = new DOMParser();
        const htmlDocument = parser.parseFromString(text, "text/html");

        const summary_playedRounds = htmlDocument.querySelector('div[class*=game-summary_playedRounds__]');
        const gameSummary = {
            gameUrl: url,
            gameId: gameId,
            gameType: gameType,
            rounds: [],
        };
        gameSummary.gameMode = htmlDocument.querySelector('div[class*=game-mode-brand_selected__]')
            ?.innerText
            ?.replace('&nbsp', '');
        gameSummary.gameTypeText = htmlDocument.querySelector('div[class*=game-mode-brand_subTitle__]')
            ?.innerText
            ?.trim();
        for (const row of summary_playedRounds.children) {
            const roundSummary = {}
            roundSummary.round = Number(row.children[0].querySelector('div[class*=game-summary_text__]').innerText?.split(' ')[1]);
            roundSummary.multiplier = row.children[0].querySelector('p[class*=game-summary_specialRoundDamage__]')?.innerText;
            roundSummary.myScore = row.children[1].querySelector('div[class*=game-summary_text__]')?.innerText;
            roundSummary.myGuesserLink = row.children[1].querySelector('span[class*=game-summary_bestGuessValue__] a[href]')?.href;
            roundSummary.myGuesserName = row.children[1].querySelector('div[class*=user-nick_nick__]')?.innerText?.trim();
            roundSummary.myDistance = row.children[1].querySelector('div[class*=game-summary_smallText__]').innerText;
            roundSummary.myDistanceValue = Number(roundSummary.myDistance.split(' ')[0].replace(',', ''));
            roundSummary.myDistanceUnit = roundSummary.myDistance.split(' ')[1];
            roundSummary.vsScore = row.children[2].querySelector('div[class*=game-summary_text__]')?.innerText;
            roundSummary.vsGuesserLink = row.children[2].querySelector('span[class*=game-summary_bestGuessValue__] a[href]')?.href;
            roundSummary.vsGuesserName = row.children[2].querySelector('div[class*=user-nick_nick__]')?.innerText?.trim();
            roundSummary.vsDistance = row.children[2].querySelector('div[class*=game-summary_smallText__]').innerText;
            roundSummary.vsDistanceValue = Number(roundSummary.vsDistance.split(' ')[0].replace(',', ''));
            roundSummary.vsDistanceUnit = roundSummary.vsDistance.split(' ')[1];
            roundSummary.myHealth = row.children[3].querySelector('div[class*=game-summary_text__]').innerText;
            roundSummary.myDamage = row.children[3].querySelector('[class*=game-summary_damage__],[class*=game-summary_smallText__]').innerText;
            roundSummary.myDamageValue = Number(roundSummary.myDamage);
            roundSummary.vsHealth = row.children[4].querySelector('div[class*=game-summary_text__]').innerText;
            roundSummary.vsDamage = row.children[4].querySelector('[class*=game-summary_damage__],[class*=game-summary_smallText__]').innerText;
            roundSummary.vsDamageValue = Number(roundSummary.vsDamage);
            gameSummary.rounds.push(roundSummary);
        }
        gameSummary.win = gameSummary.rounds[gameSummary.rounds.length - 1].vsHealth === '0';
        gameSummary.roundsWon = gameSummary.rounds.reduce((acc, cur) => acc + (cur.myDamageValue > cur.vsDamageValue ? 1 : 0), 0);

        // save to cache
        const asyncCacheList = await utils.readStorageAsync(GGH_GAME_CACHE_LIST)??[];
        const asyncCachedSummary = asyncCacheList.find(summary => summary.gameId === gameId)
        if (!asyncCachedSummary) {
            asyncCacheList.push(gameSummary);
            await utils.writeStorageAsync(GGH_GAME_CACHE_LIST, asyncCacheList)
        }

        return gameSummary;
    }

    function addTableHeader() {
        const tableHeader = document.createElement('div');
        tableHeader.classList.add('game_table_header', 'game_table_item');
        const headerItems = ['Result', 'Type', 'Mode', 'Rounds', 'Avg. Distance', 'Health'];
        headerItems.forEach((headerItem) => {
            const elem = document.createElement("span");
            elem.innerText = headerItem;
            tableHeader.append(elem);
        });
        gameHistoryTable.append(tableHeader);
    }

    async function addGameSummaryElem(promisedSummary) {
        const gameContainer = document.createElement('a');
        gameContainer.classList.add('game_summary_container', 'game_table_item');
        gameContainer.classList.add('pending_content');
        gameContainer.target = '_blank';

        gameHistoryTable.append(gameContainer);

        promisedSummary.then(summary => processGameSummary(summary, gameContainer));
    }

    async function processGameSummary(summary, gameContainer) {
        gameContainer.id = 'ggh_gameContainer__' + summary.gameId;
        gameContainer.href = summary.gameUrl;
        gameContainer.classList.remove('pending_content');

        const lastRound = summary.rounds[summary.rounds.length - 1];

        const winElem = document.createElement('span');
        winElem.classList.add('game_result');
        if (summary.win) {
            winElem.classList.add('game_result_win');
            winElem.innerText = 'Win'
        } else {
            winElem.classList.add('game_result_lose');
            winElem.innerText = 'Lose'
        }

        const gameType = document.createElement('span');
        gameType.classList.add('game_mode');
        gameType.innerText = summary.gameTypeText;

        const modeElem = document.createElement('span');
        modeElem.classList.add('game_mode');
        modeElem.innerText = summary.gameMode;

        const roundElem = document.createElement('span');
        roundElem.classList.add('game_round');
        roundElem.innerText = `${lastRound.round} (${summary.roundsWon})`;

        const distElem = document.createElement('span');
        distElem.classList.add('game_damage');
        const avgDist = summary.rounds.reduce((prev, cur) => prev + cur.myDistanceValue, 0) / summary.rounds.length;
        distElem.innerText = `${avgDist.toFixed(1)} ${lastRound.myDistanceUnit}`;

        const healthElem = document.createElement('span');
        healthElem.classList.add('game_health');
        healthElem.innerText = `${lastRound.myHealth > lastRound.vsHealth ? lastRound.myHealth : lastRound.vsHealth} HP`;

        gameContainer.appendChild(winElem);
        gameContainer.appendChild(gameType);
        gameContainer.appendChild(modeElem);
        gameContainer.appendChild(roundElem);
        gameContainer.appendChild(distElem);
        gameContainer.appendChild(healthElem);
    }
})();
/// <reference types="./utils.d.ts" />
(async () => {
    /* import utils module */
    const utilsPath = chrome.runtime.getURL("src/utils.js");
    const utils = await import(utilsPath);

    /* storage constants */
    const GGH_ACTIVITY_TOGGLE_STATE = "GGH_ACTIVITY_TOGGLE_STATE";
    const GGH_GAME_CACHE = "GGH_GAME_CACHE_";

    /* inject content */
    const contentContainer = document.querySelector('div[class*=container_content__]');
    const activityContainer = document.querySelector('div[class*=activities_container__]');

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

    await utils.readStorage(GGH_ACTIVITY_TOGGLE_STATE, 'sync').then((state) => {
        toggleCheckbox.checked = state;
        toggleActivityContent(state);
    })

    const gameUrls = await parseGameUrls();
    addTableHeader();
    for (const url of gameUrls) {
        void addGameSummaryElem(fetchGameSummary(url))
    }






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
            if (link.href){
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
        const cachedSummary = await utils.readStorage(GGH_GAME_CACHE + gameId);
        if (cachedSummary) {
            return cachedSummary;
        }

        // load from url
        const response = await fetch(url);
        const text = await response.text();
        const parser = new DOMParser();
        const htmlDocument = parser.parseFromString(text, "text/html");

        // Round
        // game-summary_text__viPc6 // Round 1
        // game-summary_specialRoundDamage__8uY4d // x2.5
        //
        // Your score
        // game-summary_text__viPc6 // 1295 points
        // td>> game-summary_bestGuessValue__8mw01 // a[href="/user/679c06cff207188aa14b0899"]
        // game-summary_smallText___cwyY // 2,504 KM
        //
        // Bayesian Score
        // game-summary_text__viPc6 // 1235 points
        // td>> game-summary_bestGuessValue__8mw01 // a[href="/user/679c06cff207188aa14b0899"]
        // game-summary_smallText___cwyY // 2,591 KM
        //
        // Your health
        // game-summary_text__viPc6 // 6000
        // game-summary_smallText___cwyY // 0
        //
        // Bayesian Health
        // game-summary_text__viPc6 // 5940
        // game-summary_damage__UdjNl // -60

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
        for (const row of summary_playedRounds.children) {
            const myDistanceText = row.children[1].querySelector('div[class*=game-summary_smallText__]').innerText
            const vsDistanceText = row.children[2].querySelector('div[class*=game-summary_smallText__]').innerText

            const roundSummary = {
                round: row.children[0].querySelector('div[class*=game-summary_text__]').innerText,
                multiplier: row.children[0].querySelector('p[class*=game-summary_specialRoundDamage__]')?.innerText,

                myScore: row.children[1].querySelector('div[class*=game-summary_text__]')?.innerText,
                myGuesserLink: row.children[1].querySelector('span[class*=game-summary_bestGuessValue__] a[href]')?.href,
                myGuesserName: row.children[1].querySelector('div[class*=user-nick_nick__]')?.innerText?.trim(),
                myDistance: myDistanceText,
                myDistanceValue: Number(myDistanceText.split(' ')[0].replace(',', '')),
                myDistanceUnit: myDistanceText.split(' ')[1],

                vsScore: row.children[2].querySelector('div[class*=game-summary_text__]')?.innerText,
                vsGuesserLink: row.children[2].querySelector('span[class*=game-summary_bestGuessValue__] a[href]')?.href,
                vsGuesserName: row.children[2].querySelector('div[class*=user-nick_nick__]')?.innerText?.trim(),
                vsDistance: vsDistanceText,
                vsDistanceValue: Number(vsDistanceText.split(' ')[0].replace(',', '')),
                vsDistanceUnit: vsDistanceText.split(' ')[1],

                myHealth: row.children[3].querySelector('div[class*=game-summary_text__]').innerText,
                myDamage: row.children[3].querySelector('[class*=game-summary_damage__],[class*=game-summary_smallText__]').innerText,

                vsHealth: row.children[4].querySelector('div[class*=game-summary_text__]').innerText,
                vsDamage: row.children[4].querySelector('[class*=game-summary_damage__],[class*=game-summary_smallText__]').innerText,
            }
            gameSummary.rounds.push(roundSummary);
        }
        gameSummary.win = gameSummary.rounds[gameSummary.rounds.length - 1].vsHealth === '0';

        // save to cache
        utils.writeStorage(GGH_GAME_CACHE + gameId, gameSummary)
        utils.writeStorage(GGH_GAME_CACHE + 'available', true)

        return gameSummary;
    }

    function addTableHeader() {
        const tableHeader = document.createElement('div');
        tableHeader.classList.add('game_table_header', 'game_table_item');
        const headerItems = ['Result', 'Mode', 'Rounds', 'Avg. Distance', 'Health (me / vs)'];
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

        const modeElem = document.createElement('span');
        modeElem.classList.add('game_mode');
        modeElem.innerText = summary.gameMode;

        const roundElem = document.createElement('span');
        roundElem.classList.add('game_round');
        roundElem.innerText = lastRound.round;

        const distElem = document.createElement('span');
        distElem.classList.add('game_damage');
        const avgDist = summary.rounds.reduce((prev, cur) => prev + cur.myDistanceValue, 0) / summary.rounds.length;
        distElem.innerText = `${avgDist.toFixed(1)} ${lastRound.myDistanceUnit}`;

        const healthElem = document.createElement('span');
        healthElem.classList.add('game_health');
        healthElem.innerText = `${lastRound.myHealth} / ${lastRound.vsHealth}`;

        gameContainer.appendChild(winElem);
        gameContainer.appendChild(modeElem);
        gameContainer.appendChild(roundElem);
        gameContainer.appendChild(distElem);
        gameContainer.appendChild(healthElem);
    }
})();
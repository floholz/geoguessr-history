/**
 * Read data from the defined storage area.
 *
 * @param {string} key Storage key
 * @param {string?} area The storage area, the data should be saved to. If no area is supplied, 'local' will be used.
 * @return {Promise<*|null>} Data from storage area
 */
export async function readStorage(key, area = 'local') {
    if (!(area === 'local' || area === 'sync' || area === 'session' || area === 'managed')) {
        console.error("Invalid storage area! Possible values are: 'local', 'sync', 'session' and 'managed'.")
        return null;
    }

    const data = await chrome.storage[area].get([key]);
    return data[key];
}

/**
 * Write data to the defined storage area.
 *
 * @param {string} key Storage key
 * @param {*} data Data to be stored
 * @param {string?} area The storage area, the data should be saved to. If no area is supplied, 'local' will be used.
 */
export function writeStorage(key, data, area = 'local') {
    if (!(area === 'local' || area === 'sync' || area === 'session' || area === 'managed')) {
        console.error("Invalid storage area! Possible values are: 'local', 'sync', 'session' and 'managed'.")
        return;
    }

    chrome.storage[area].set({[key]: data});
}

const defaultStorageIntervalTime = 500;
export async function readStorageAsync(key, area = 'local', timeout = 30000) {
    if (!(area === 'local' || area === 'sync' || area === 'session' || area === 'managed')) {
        console.error("Invalid storage area! Possible values are: 'local', 'sync', 'session' and 'managed'.")
        return null;
    }
    //const waitTimeout = setTimeout(() => {
    //    throw new Error(`Storage lock timeout exceeded for area '${area}'`);
    //}, timeout)

    if (timeout <= 0) {
        throw new Error(`Storage lock timeout exceeded for area '${area}'`);
    }

    if (storageLock[area]) {
        return new Promise((resolve) => setTimeout(() => {
            resolve(readStorageAsync(key, area, timeout - defaultStorageIntervalTime));
        }, defaultStorageIntervalTime));
    }
    //clearInterval(waitTimeout);

    lockStorage(area);
    const data = await chrome.storage[area].get([key]);
    unlockStorage(area);
    return data[key];
}

export async function writeStorageAsync(key, data, area = 'local', timeout = 30000) {
    if (!(area === 'local' || area === 'sync' || area === 'session' || area === 'managed')) {
        console.error("Invalid storage area! Possible values are: 'local', 'sync', 'session' and 'managed'.")
        return;
    }
    //const waitTimeout = setTimeout(() => {
    //    throw new Error(`Storage lock timeout exceeded for area '${area}'`);
    //}, timeout)
    //while (storageLock[area]);
    //clearInterval(waitTimeout);

    if (timeout <= 0) {
        throw new Error(`Storage lock timeout exceeded for area '${area}'`);
    }

    if (storageLock[area]) {
        return new Promise((resolve) => setTimeout(() => {
            resolve(writeStorageAsync(key, data, area, timeout - defaultStorageIntervalTime));
        }, defaultStorageIntervalTime));
    }

    lockStorage(area);
    await chrome.storage[area].set({[key]: data});
    unlockStorage(area);
}


let storageLock = {
    local: false,
    sync: false,
    session: false,
}
let storageLockTimeout= {
    local: null,
    sync: null,
    session: null,
}

export function lockStorage(area = 'local', timeout = 50000) {
    if (!(area === 'local' || area === 'sync' || area === 'session' || area === 'managed')) {
        console.error("Invalid storage area! Possible values are: 'local', 'sync', 'session' and 'managed'.")
        return;
    }

    storageLock[area] = true;
    console.log(`lock storage area: ${area}`);

    storageLockTimeout[area] = setTimeout(() => {
        storageLock[area] = false;
        console.warn(`Storage lock timeout exceeded for area '${area}'`);
    }, timeout)
}

export function unlockStorage(area = 'local') {
    if (!(area === 'local' || area === 'sync' || area === 'session' || area === 'managed')) {
        console.error("Invalid storage area! Possible values are: 'local', 'sync', 'session' and 'managed'.")
        return;
    }

    storageLock[area] = false;
    console.log(`unlock storage area: ${area}`);

    if (storageLockTimeout[area]) {
        clearTimeout(storageLockTimeout[area]);
    }
}

/**
 * Callback function for {@link addStorageChangeListener}.
 *
 * @callback storageChangeListenerCallback
 * @param {*} oldValue
 * @param {*} newValue
 * @param {string} key
 * @param {string?} storage
 * @return {void}
 */
/**
 * Registers a listener for storage changes affecting the provided key.
 * By providing a storage area, the listener can be limited to this area.
 *
 * @param {string} key
 * @param {storageChangeListenerCallback} callback
 * @param {string?} area The storage area, to listen for changes. If no area is supplied, the listener will check for any area.
 */
export function addStorageChangeListener(key, callback, area = null) {
    if (!(area === 'local' || area === 'sync' || area === 'session' || area === 'managed' || area === null)) {
        console.error("Invalid storage area! Possible values are: 'local', 'sync', 'session' and 'managed'.")
        return;
    }

    chrome.storage.onChanged.addListener((changes, sArea) => {
        if (area === null || area === sArea) {
            for (let [key, { oldValue, newValue }] of Object.entries(changes)) {
                if (key === key) {
                    callback(oldValue, newValue, key, area);
                }
            }
        }
    });
}

/**
 * Sends a single message to event listeners within this extension.
 *
 * @param {string} key Message key
 * @param {*} message Message data
 * @return {Promise<*>} Message response
 */
export function sendMessage(key, message) {
    const data = {}
    data[key] = message;
    return chrome.runtime.sendMessage(data);
}

/**
 * @external MessageSender
 * @see https://developer.chrome.com/docs/extensions/reference/api/runtime#type-MessageSender
 */
/**
 * Callback function for {@link addMessageListener}.
 *
 * @callback messageListenerCallback
 * @param {*} message
 * @param {MessageSender} sender
 * @return {Promise<*>}
 */
/**
 * Register a listener for messages within this extension.
 *
 * @param {string} key Message key
 * @param {messageListenerCallback} callback Callback function for message events
 */
export function addMessageListener(key, callback) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message[key]) {
            callback(message[key], sender).then(sendResponse);
        }
    });
}

export async function registerContentScript(script, injectImmediately = false) {
    if (!script || (!script.js && !script.css) ) {
        throw Error("No 'js' or 'css' was provided, at least one of these must be set.");
    }
    const scriptDetails = Object.assign({
        id: crypto.randomUUID(),
        matches: ['*'],
        persistAcrossSessions: true,
        runAt: "document_idle",
    }, script);

    return await chrome.scripting.registerContentScripts([scriptDetails])
        .then(async () => {
            console.log(`Registered content script ${script.id}`);
            if (injectImmediately) {
                await injectStyle({ files: script.css ?? [] })
                await executeScript({ files: script.js??[] })
            }
            return scriptDetails.id
        })
        .catch((err) => {
            console.warn("Could not register script!", err)
            throw err
        });
}

export async function unregisterContentScript(id) {
    chrome.scripting.unregisterContentScripts({ids: [id]})
        .then(() => console.log(`Unregistered script ${id}`))
        .catch((err) => {
            console.warn(`Could not unregister script ${id}`, err)
            throw err
        });
}

export async function injectStyle(style) {
    if (!style || !style.files) {
        throw Error("No 'files' provided.");
    }
    const tab = await getCurrentTab()
    const styleDetails = Object.assign({
        target: { tabId: tab.id },
    }, style)
    await chrome.scripting.insertCSS(styleDetails)
}

export async function executeScript(script) {
    if (!script || (!script.files && !script.func) ) {
        throw Error("No 'files' or 'func' was provided, at least one of these must be set.");
    }
    const tab = await getCurrentTab()
    const scriptDetails = Object.assign({
        target: { allFrames: true, tabId: tab.id },
        injectImmediately: true,
    }, script)
    await chrome.scripting.executeScript(scriptDetails);
}

export async function getCurrentTab() {
    let queryOptions = { active: true, lastFocusedWindow: true };
    // `tab` will either be a `tabs.Tab` instance or `undefined`.
    let [tab] = await chrome.tabs.query(queryOptions);
    return tab;
}

export async function querySelector(selector, root = document, timeout = 10000) {
    return new Promise((resolve) => {
        let element;
        const waitInterval = setInterval(() => {
            element = root.querySelector(selector);
            if (element) {
                clearInterval(waitInterval);
                resolve(element);
            }
        }, 100);
        let waitTimeout = setTimeout(() => {
            clearInterval(waitInterval);
            clearTimeout(waitTimeout);
            resolve(null);
        }, timeout);
    });
}

export async function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
}

export function injectFlag() {
    const injectedFlag = document.createElement("div")
    injectedFlag.id = "injected_flag"
    injectedFlag.style.background = 'red'
    injectedFlag.style.position = 'fixed'
    injectedFlag.style.top = '10px'
    injectedFlag.style.left = '10px'
    injectedFlag.style.width = '20px'
    injectedFlag.style.height = '20px'
    injectedFlag.style.borderRadius = '50%'
    injectedFlag.style.zIndex = '9999999999999'
    document.body.append(injectedFlag)
    return injectedFlag
}
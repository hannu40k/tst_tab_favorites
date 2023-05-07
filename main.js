/*
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
*/


'user strict';


if (typeof TSTTabFavorites == "undefined") {
    let TSTTabFavorites = async function() {

        const LOGGING = false;

        function log(vals) {
            if (LOGGING) {
                console.log(vals);
            }
        }

        const WINDOW_ID = await getCurrentWindowId();
        log('TSTTabFavorites loading in window id ' + WINDOW_ID);

        const TST_EXT_ID = 'treestyletab@piro.sakura.ne.jp';
        const TST_ADD_STATE = 'add-tab-state';
        const TST_REMOVE_STATE = 'remove-tab-state';

        const FAV_TAB_STATE = 'favorite-tab';
        const TABS_STORAGE_NAME = 'favoriteTabs';

        let REGISTERED = false;
        let tabsSettings = await browser.storage.local.get('favoriteTabCSS');  // TODO make customizable

        const tabsStorage = { [TABS_STORAGE_NAME]: [] };
        await loadFavoriteTabsFromStorage();

        // clear storage.
        // tabsStorage.favoriteTabs = [];
        // await saveFavoriteTabsToStorage();

        if (!tabsSettings.favoriteTabCSS) {
            tabsSettings.favoriteTabCSS = 'background-color: orange !important; text-shadow: 2px 2px 4px purple !important;';
        }


        async function loadFavoriteTabsFromStorage() {
            const storage = await browser.storage.local.get([TABS_STORAGE_NAME]);

            tabsStorage.favoriteTabs = storage.favoriteTabs;

            if (!tabsStorage.favoriteTabs) {
                tabsStorage.favoriteTabs = [];
            }
        }


        async function saveFavoriteTabsToStorage() {
            // log('saving favoriteTabs to storage: ' + tabsStorage.favoriteTabs);
            await browser.storage.local.set({ [TABS_STORAGE_NAME]: tabsStorage.favoriteTabs });
            // log('favoriteTabs saved');
            if (LOGGING) {
                const storage = await browser.storage.local.get([TABS_STORAGE_NAME]);
                log('storage now: ' + storage.favoriteTabs);
            }
        }


        async function getCurrentWindowId() {
            const windowInfo = await browser.windows.getCurrent();
            return windowInfo.id;
        }


        function tabIsFavorite(tabId, windowId) {
            return tabsStorage.favoriteTabs.some(tab => (tab.id === tabId && tab.windowId === windowId));
        }


        function removeFromStorage(tabId, windowId) {
            tabsStorage.favoriteTabs = tabsStorage.favoriteTabs.filter(
                tab => !(tab.id === tabId && tab.windowId === windowId)
            );
        }


        async function setTSTTabState(add_or_remove_state, tabId) {
            return await browser.runtime.sendMessage(TST_EXT_ID, {
                type: add_or_remove_state,
                tabs: [tabId],
                state: FAV_TAB_STATE,
            });
        }


        async function flashTabColor(tabId) {
            await setTSTTabState(TST_REMOVE_STATE, tabId);
            await new Promise(resolve => setTimeout(resolve, 200));
            await setTSTTabState(TST_ADD_STATE, tabId);
        }


        async function toggleTabFavorite(currentTab) {
            let message_action = ''

            await loadFavoriteTabsFromStorage();

            if (tabIsFavorite(currentTab.id, currentTab.windowId)) {
                message_action = TST_REMOVE_STATE;
                removeFromStorage(currentTab.id, currentTab.windowId);
            }
            else {
                message_action = TST_ADD_STATE;
                tabsStorage.favoriteTabs.push({
                    id: currentTab.id, index: currentTab.index, windowId: currentTab.windowId
                });
            }

            await saveFavoriteTabsToStorage();

            await setTSTTabState(message_action, currentTab.id);

            if (LOGGING) {
                log('toggled tab id ' + currentTab.id + ' in window id ' + currentTab.windowId);
                if (tabIsFavorite(currentTab.id, currentTab.windowId)) {
                    log('tab is now favorite');
                }
                else {
                    log('tab is now not a favorite');
                }
            }
        }


        async function activateNearestFavoriteTab(currentTab, direction) {
            log('finding nearest favorite tab ' + direction)

            const tabs = await browser.tabs.query({ currentWindow: true });
            let nearestTab = await getAdjacentTab(tabs, currentTab, direction);

            const failsafe = 1000;
            let loops = 0;

            while (nearestTab) {
                if (tabIsFavorite(nearestTab.id, nearestTab.windowId)) {
                    log('found favorite tab: ' + nearestTab.id);
                    break;
                }

                nearestTab = await getAdjacentTab(tabs, nearestTab, direction);

                loops += 1;
                if (loops > failsafe) {
                    nearestTab = null;
                    break
                }
            }

            if (nearestTab) {
                await browser.tabs.update(nearestTab.id, { active: true });
            }
        }


        async function getAdjacentTab(tabs, currentTab, direction) {
            const currentIndex = tabs.findIndex(tab => tab.id === currentTab.id);
            const lastIndex = tabs.length - 1;

            let newIndex;
            if (direction === 'down') {
                newIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
            } else {
                newIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
            }
            return tabs[newIndex];
        }


        async function onTabActivated(tab) {
            if (tabIsFavorite(tab.tabId, tab.windowId)) {
                flashTabColor(tab.tabId);
            }
        }


        async function onTabRemoved(tabId, removeInfo) {
            if (removeInfo.isWindowClosing) {
                return;
            }

            log('removing tab from favorites due to tab closed: ' + tabId + ' window ' + removeInfo.windowId);

            if (tabIsFavorite(tabId, removeInfo.windowId)) {
                await loadFavoriteTabsFromStorage();
                removeFromStorage(tabId, removeInfo.windowId);
                await saveFavoriteTabsToStorage();
            }
        }


        async function clearStorageAndFavorites(info) {
            log('clearing storage and favorite state from tabs');

            const tabs = await browser.tabs.query({ currentWindow: true });

            tabsStorage.favoriteTabs.forEach(storageTab => {
                tabs.get(storageTab.id).then((tab) => {
                    toggleTabFavorite(tab);
                });
            });
        }


        async function updateTabIdMapping() {
            // In case tab ids change on browser restart, update favorte tab ids from
            // real tabs based on index.
            log('updating tab id mapping');

            let needsUpdate = false;

            const browserTabs = await browser.tabs.query({ currentWindow: true });

            tabsStorage.favoriteTabs.forEach(storageTab => {

                let browserTab = browserTabs[storageTab.index];

                if (browserTab && storageTab.windowId === browserTab.windowId) {

                    if (storageTab.id != browserTab.id) {
                        log('updating tab id ' + storageTab.id + ' to ' + browserTab.id);
                        needsUpdate = true;
                    }

                    storageTab.id = browserTab.id;
                }
            });

            if (needsUpdate) {
                log('saving updated tab ids');
                await saveFavoriteTabsToStorage();
                log('tab ids updated');
            }
            else {
                log('no tab ids update needed');
            }
        }


        async function updateTabIndexMapping() {
            // In case tab is moved, many favorite tab indexes can change. Update favorite tab indexes from
            // real tabs based on id.
            log('updating tab index mapping');

            const browserTabs = await browser.tabs.query({ currentWindow: true });

            tabsStorage.favoriteTabs.forEach(storageTab => {

                let browserTab = browserTabs.get(storageTab.id);

                if (browserTab && storageTab.windowId === browserTab.windowId) {
                    storageTab.index = browserTab.index;
                }
            });

            await saveFavoriteTabsToStorage();
        }


        async function commandListener(commandName) {
            log('---');
            log(commandName);

            const currentTab = await browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => tabs[0]);

            if (commandName === "toggle-favorite") {
                toggleTabFavorite(currentTab);
            }
            else if (commandName === "next-favorite-up") {
                activateNearestFavoriteTab(currentTab, "up");
            }
            else if (commandName === "next-favorite-down") {
                activateNearestFavoriteTab(currentTab, "down");
            }
        }


        async function registerTSTExtension(from) {
            if (REGISTERED) {
                log(from + ': extension to TST already registered');
                return;
            }
            log(from + ': registering extension to TST...');
            
            try {
                const self = await browser.management.getSelf();
                
                const favoriteTabCSS = `.tab.favorite-tab tab-item-substance { ` + tabsSettings.favoriteTabCSS + ` }`;
                // TODO try .tab.highlighter::before to set highlighted apart
                
                try {
                    await browser.runtime.sendMessage(TST_EXT_ID, {
                        type: 'register-self',
                        name: self.id,
                        style: favoriteTabCSS,
                    });
                } catch (error) {
                    // TST extension probably not installed or not ready yet.
                    log(error);
                    return;
                }
                REGISTERED = true;

                log('extension registered');

                await updateTabIdMapping();

                log('setting listeners');

                browser.commands.onCommand.addListener(commandListener);
                browser.tabs.onActivated.addListener(onTabActivated);
                browser.tabs.onMoved.addListener(updateTabIndexMapping);
                browser.tabs.onRemoved.addListener(onTabRemoved);

                if (tabsStorage.favoriteTabs) {
                    log('loading favorite tabs from storage');
                    log(tabsStorage.favoriteTabs);

                    let windowId = await getCurrentWindowId();

                    tabsStorage.favoriteTabs.forEach((tab) => {
                        if (tab.windowId === windowId) {
                            setTSTTabState(TST_ADD_STATE, tab.id);
                        }
                    });
                }
                else {
                    log('no favorites to load on startup. tabStorage.favoriteTabs is ' + tabStorage.favoriteTabs);
                }

                log('TSTTabFavorites loaded');
            } catch (e) {
                log(e);
            }
        }


        await registerTSTExtension('main app');

        browser.runtime.onMessageExternal.addListener((message, sender) => {
            switch (sender.id) {
                case TST_EXT_ID:
                    switch (message.type) {
                        case 'ready':
                            registerTSTExtension('onMessageExternal');
                            break;
                    }
                    break;
            }
        });
    }

    TSTTabFavorites();
}

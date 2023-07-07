TST Tab Favorites
------------------

An extension to the excellent [Treestyletab](https://github.com/piroor/treestyletab) Firefox extension.

Adds hotkeys to set tabs as favorites and quickly navigating between them.

Known issues:

Appears to occasionally have issues when multiple browser windows are used:
- Sometimes upon Firefox restart, the favorite tabs style is not immediately visible. Fix: The style should be restored when using the hotkeys to jump through the favorite tabs.
- If a tree of tabs is moved to another window, the visualization of favorites is carried over, but tab favorite status is not. Fix: Re-toggle affected tabs as favorite.

TODOs:

- Fix issue when using multiple windows and restarting Firefox
- Options UI to let user customize:
    - Keyboard shortcut keybindings
    - Favorite tab style
- Add keyboard shortcuts also for jumping over multiple tabs instead of just one
- Add right-click context-menu to tabs for toggling favorite status without needing to activate the tab

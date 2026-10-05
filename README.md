# Stillnote

A mobile-first wine tasting notebook with staged, WSET Level 3-style prompts for Appearance, Nose, Palate and Conclusions.

## Use the app

- Start a single-wine note or a named tasting session with multiple wines.
- Record the wine identity before tasting or add it after a blind tasting.
- Move through one tasting stage at a time. Select structured descriptors, explore optional aroma prompts, and add your own words.
- Add a bottle or label photo, reopen saved notes, or edit them later.

## Private, on-device storage

Tasting records and resized label photos are stored in this browser on this device using IndexedDB. An unfinished tasting is kept as a local draft so it can be resumed after a reload. There are no accounts or server API, and notes do not sync to other devices. Clearing this browser's site data removes the notes. Export and cloud backup are not implemented yet.

## Run locally

Keep `index.html` and `app.js` in the same folder, then open `index.html` in a modern browser. GitHub Pages deploys these static files without a build step.

## Future direction

Accounts, cloud backup, syncing, and sharing notes with friends can be added later with a backend. They are intentionally outside the current private, individual-use version.

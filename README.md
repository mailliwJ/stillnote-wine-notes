# Stillnote

A mobile-first wine-tasting note prototype. It guides an individual taster through Appearance, Nose, Palate and Conclusions, with an option to add wine details before or after a blind tasting.

## Prototype flow

- Choose a single wine note or create a multi-wine tasting session.
- Name the session and add wines one by one.
- Enter the wine identity first or taste blind and add details after the tasting.
- Follow the staged tasting prompts and optional vocabulary hints.

## Current scope

This is a static front-end prototype. It does not yet save tasting notes between visits, sync across devices, or provide user accounts. The session count shown during a visit is only a prototype interaction. Do not use it as a store for valuable notes yet.

## Run locally

Open `index.html` in a browser, or serve this folder with any static file server.

## Deploy

The repository includes a GitHub Actions workflow that publishes the site to GitHub Pages after Pages is configured to use GitHub Actions as its source. The site is static and needs no build step.

# Milk's Watch Tracker

Everything you want to watch, read and play, in one place: TV, anime, movies, books, manga, comics and games.

- **Up Next**: what you're in the middle of, in your own order, with a big **+1** for the next episode or chapter.
  TV rolls over to the next season on its own (season lengths come from TVmaze). Shows that have a new episode out get a badge.
- **Library**: filter by type, status (Want to, In progress, On hold, Done, Dropped) and where you watch it; search; sort.
  Pick a status to drag things into your own order.
- **Lists**: your own hand-ordered lists ("With my wife", "Spooky season"). One thing can be on many lists.
- **Where to watch/read/play**: your own list of services and platforms (Settings). TVmaze's network is suggested when you add a show.
- **Progress**: season + episode for TV and anime. Chapter, volume, page or percent for books, manga and comics, and hours or
  percent for games. These are optional and tucked away until used. There's also a free-text "where I am" note.
- **Ratings**: your own 5-star rating (with halves) and a short review, plus the TVmaze / AniList / Open Library score.
- **Pick for me** 🎲: a random pick from your want list, filtered by type, service, tag or list.
- **History**: a dated log of every step, and a yearly recap (finished, episodes logged, average rating, favorites).
- **Recommend**: copy a message with an `MWT:` code for one title or a whole list. The other person pastes it with
  "Paste a recommendation". Copy/paste only, because on iPhone a link would open Safari instead of the installed app.

Lookups need no account or API key: [TVmaze](https://www.tvmaze.com/api) (TV), [AniList](https://anilist.co) (anime, manga),
[Open Library](https://openlibrary.org/developers/api) (books, comics). Only the title you search for is sent. Movies and games
are added by hand. Covers are cached by the service worker so they show offline.

Everything else stays on the device (IndexedDB). It works offline once opened and installs to the Home Screen.
Settings → Export backup moves everything to another device.

## Develop

```
npm.cmd install
npm.cmd run dev      # http://localhost:5173
npm.cmd test         # progress, ordering, share code and backup tests
npm.cmd run build    # svelte-check + production build into dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`
(one-time setup: repo Settings → Pages → Source: "GitHub Actions").

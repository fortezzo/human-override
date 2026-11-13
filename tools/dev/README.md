# Development helpers

Small scripts used while choosing and converting assets and while tuning the look. None of them are part of the game or its checks; they are kept because they are how the asset decisions were made, and they are useful again whenever a new model, texture or sound is added.

| Script | What it does |
| --- | --- |
| `contact-sheet.mjs`, `contact-sheet-acg.mjs` | Tile preview thumbnails of Poly Haven / ambientCG assets into one picture for comparison |
| `oga-search.mjs` | Search OpenGameArt and print each hit's author and license |
| `audio-probe.mjs` | Measure a recording: length, loudness, how many distinct hits it contains |
| `list-model-nodes.mjs`, `prop-bounds.mjs` | Print the parts and bounding boxes of downloaded and converted models |
| `inspect-glb.mjs`, `inspect-anim.mjs` | Summarise what is inside a GLB file and its animation clips |
| `view.mjs` + `viewer/` | Photograph a converted model from several angles (needs `npm run dev` running) |
| `shot.mjs` | Screenshot the running game from any camera position (needs `npm run dev` running) |

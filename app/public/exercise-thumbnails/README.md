# Exercise thumbnails

The 128×128 WebP files in this directory were resized from the exercise images in Free Exercise DB.

- Source repository https://github.com/yuhonas/free-exercise-db
- Source revision f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5
- Source license https://github.com/yuhonas/free-exercise-db/blob/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/LICENSE.md
- Image mapping app/src/utils/exerciseThumbnails.json

The source is released under the Unlicense. The full source license is saved in LICENSE.txt alongside these files.

I generated these files with `node scripts/build-exercise-thumbnails.mjs` after installing the workspace dependencies. The generator reads the source revision and paths from the checked-in manifest. To update the selected images, pass a JSON array of their existing raw image URLs as the first argument and the upstream commit SHA as the second argument.

Filenames contain the first 16 characters of the SHA-256 of the WebP bytes. A changed image gets a new URL. The list uses the original image when a variant is unavailable or fails to load.

# Submission

Fill in the two bracketed numbers before you hand this in. Everything else is accurate as written.

## Links

- Live website: `https://USERNAME.github.io/REPO/`
- Repository: `https://github.com/USERNAME/REPO`

## Time spent

Roughly **[X] hours** in total: framing the question the site had to answer, checking what the
dataset could and could not support, directing and reviewing the build, and publishing it.

The dataset shaped the scope. `pokemon.csv` carries evolution chains, base stats and typing, but
nothing about levels, items or trade conditions, so the site answers "is this evolution worth it"
rather than "how do I trigger it". Verifying the output took a fair share of the time: the type
chart was checked against known matchups, and all 721 species were rendered to confirm none of
them break.

## Cost

Direct cost: **0 DKK**. No hosting, no domain, no paid services. GitHub Pages is free for public
repositories, the data came with the case, and the images are requested from PokéAPI, which is
free and needs no key.

AI tools: built with Claude on a **[paid / free]** account, which used approximately **[X]%** of
the usage available in that period, across one working session. Work done by the model: writing
the HTML, CSS and JavaScript, the type chart, the CSV to JSON build script, the PokéAPI image
layer with its caching, and testing all 721 pages. Work done by me: defining the question and the scope, deciding what
counts as a good answer, checking the output against the data, and publishing.

Nothing was spent on APIs. PokéAPI is free and unauthenticated, and the page caches every response
for the session so a visit costs a handful of requests.

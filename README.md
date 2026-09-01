# Should I evolve this Pokémon?

A single-page site that answers one question. You pick a Pokémon, it tells you what evolving
costs you and what it buys you, and gives a straight verdict.

Live site: `https://USERNAME.github.io/REPO/`

## What it does

Search any of the 811 entries in `pokemon.csv`, being 721 species and 90 alternate forms, and
the page shows:

- **A verdict**, written from the data rather than picked from a list. "Nothing to think about
  here" for a clean upgrade, "Worth it, as long as you can spare the speed" when a stat falls,
  "Same total, different shape" for Scyther into Scizor, and so on.
- **The trade**, sprite to sprite, with the types that are new to the evolved form marked.
- **Every stat, before and after**, as bars that run left of a centre line for a loss and right
  for a gain. This is the part that answers the question fastest.
- **What gets harder and what gets easier**, worked out from the full 18-type chart. Evolving
  Charmeleon doubles the damage rock does to it. Evolving Onix trades a fire resistance for a
  fire weakness. Stats alone hide this.
- **A choice of branch** when there is one. Eevee has eight, Nincada has two, and nine other
  species have a fork. Pick what you care about (surviving, hitting hard, moving first, a bit
  of everything) and the options reorder, with one marked as the best fit.
- **Mega evolution and other forms.** The 90 alternate forms in the CSV have no evolution chain
  of their own, so each is paired with the species it belongs to and read against it. Charizard
  is the end of its evolution line, but its page still points at the two mega forms and what
  each is worth. Charizard Mega X gets its own page: +100 base stat points, nothing given up,
  and a note that it lasts for the battle rather than permanently.
- **The whole evolution line**, clickable at every stage.

Pokémon that cannot evolve get a straight answer too, plus where they stand against the rest.
Forms are labelled for what they are: a mega evolution, a primal reversion, or an alternate form.
Aegislash Blade is described as the same total with 100 points moved from defence to attack, and
the cosplay Pikachu as cosmetic, because that is what the numbers say.

## How the verdict is decided

All from `pokemon.csv`, computed in the browser:

1. Base stat total change, and the change in each of the six stats.
2. Any stat that falls. 38 evolutions cost you something, and speed is the usual price.
3. Defensive typing before and after, run against all 18 attacking types, counting matchups
   that get worse and better.
4. Where the result sits against all 721 species by base stat total. Forms are excluded from
   that population so the yardstick stays fixed.

For branches, each option is scored on the priority you choose. "Surviving" weights HP and both
defences, "moving first" weights speed, "a bit of everything" favours the most even spread so
that eight equal-total Eeveelutions still rank sensibly.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `styles.css` | All styling |
| `app.js` | Search, evolution analysis, type chart, rendering |
| `data.js` | Generated from the CSV, the only data the page loads. Every row is kept and tagged as a species, mega, primal or form |
| `build_data.py` | Regenerates `data.js` from `pokemon.csv` |
| `pokemon.csv` | Source data, unchanged |

No build step and no dependencies. At runtime the page talks to PokéAPI for images and to Google
Fonts for two webfaces. Nothing else.

## Images

Artwork is requested from the free [PokéAPI](https://pokeapi.co) as you browse:
`https://pokeapi.co/api/v2/pokemon/{id}`.

- One request per species covers both sizes used on the page. The large frames use the official
  artwork, the small thumbnails use the pixel sprite, and both arrive in the same response.
- Every result is cached in memory and in `sessionStorage`, so moving up and down an evolution
  line, or coming back to a Pokémon, costs nothing further.
- Requests for search thumbnails wait for a pause in typing, so typing "charmeleon" asks for a
  handful of Pokémon rather than one per keystroke.
- Images arrive after the text. Each frame holds its space and fills in when the response lands,
  so nothing jumps.
- If the API is unreachable, the frames say so and the rest of the page still works. The verdict,
  stats and matchups are all computed from `data.js` and need no network at all.

## Data notes

- The CSV holds 811 rows: 721 species and 90 alternate forms. Nothing is dropped. The forms have
  no generation, no evolution chain and no image in the file, but each carries a `species_id`,
  which is enough to pair it with its species and work out what the change is worth.
- Forms are sorted by name into megas (48), primal reversions (2) and other forms (40), since a
  mega evolution is a real decision about a Pokémon and a Rotom appliance is not.
- 93 of the 811 rows have no `url_image`: the 90 forms plus Diancie, Hoopa and Volcanion. That is
  a gap in the CSV rather than in reality. The API has artwork for every one of them, so all 811
  entries get a picture. The `image` field is kept in `data.js` for fidelity to the source even
  though the page no longer reads it.
- Images are served by [PokéAPI](https://pokeapi.co), which is free and needs no key. Pokémon is
  © Nintendo, Game Freak and The Pokémon Company. This is a non-commercial exercise.

## Run it locally

Serve it rather than opening the file directly, so the API requests are made from a real origin:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

An internet connection is needed for the pictures. Everything else works without one.

To rebuild `data.js` after editing the CSV:

```bash
python3 build_data.py
```

## Publish it on GitHub Pages

```bash
cd pokemon-evolve
git init
git add .
git commit -m "Pokémon evolution decision tool"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

Then in the repository: **Settings → Pages → Source: Deploy from a branch → Branch: `main`,
folder: `/ (root)` → Save**. The site appears at `https://USERNAME.github.io/REPO/` within a
couple of minutes.

Without a terminal: create a public repository on github.com, use **Add file → Upload files**,
drag in the seven files, commit, then follow the same Pages steps. The whole repository is under
400 KB, since no images are stored in it.

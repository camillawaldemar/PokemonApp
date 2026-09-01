/* Should I evolve this Pokémon?
   Reads POKEMON from data.js and works out what an evolution actually changes. */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ data */

  const STAT_NAMES = ["HP", "Attack", "Defence", "Sp. attack", "Sp. defence", "Speed"];
  const ALL_TYPES = ["normal", "fire", "water", "electric", "grass", "ice", "fighting",
    "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark",
    "steel", "fairy"];

  // Attacking type -> defending type -> multiplier. Anything unlisted is 1x.
  const CHART = {
    normal: { rock: .5, ghost: 0, steel: .5 },
    fire: { fire: .5, water: .5, grass: 2, ice: 2, bug: 2, rock: .5, dragon: .5, steel: 2 },
    water: { fire: 2, water: .5, grass: .5, ground: 2, rock: 2, dragon: .5 },
    electric: { water: 2, electric: .5, grass: .5, ground: 0, flying: 2, dragon: .5 },
    grass: { fire: .5, water: 2, grass: .5, poison: .5, ground: 2, flying: .5, bug: .5, rock: 2, dragon: .5, steel: .5 },
    ice: { fire: .5, water: .5, grass: 2, ice: .5, ground: 2, flying: 2, dragon: 2, steel: .5 },
    fighting: { normal: 2, ice: 2, poison: .5, flying: .5, psychic: .5, bug: .5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: .5 },
    poison: { grass: 2, poison: .5, ground: .5, rock: .5, ghost: .5, steel: 0, fairy: 2 },
    ground: { fire: 2, electric: 2, grass: .5, poison: 2, flying: 0, bug: .5, rock: 2, steel: 2 },
    flying: { electric: .5, grass: 2, fighting: 2, bug: 2, rock: .5, steel: .5 },
    psychic: { fighting: 2, poison: 2, psychic: .5, dark: 0, steel: .5 },
    bug: { fire: .5, grass: 2, fighting: .5, poison: .5, flying: .5, psychic: 2, ghost: .5, dark: 2, steel: .5, fairy: .5 },
    rock: { fire: 2, ice: 2, fighting: .5, ground: .5, flying: 2, bug: 2, steel: .5 },
    ghost: { normal: 0, psychic: 2, ghost: 2, dark: .5 },
    dragon: { dragon: 2, steel: .5, fairy: 0 },
    dark: { fighting: .5, psychic: 2, ghost: 2, dark: .5, fairy: .5 },
    steel: { fire: .5, water: .5, electric: .5, ice: 2, rock: 2, steel: .5, fairy: 2 },
    fairy: { fire: .5, fighting: 2, poison: .5, dragon: 2, dark: 2, steel: .5 }
  };

  const byId = new Map(POKEMON.map(p => [p.id, p]));
  const byName = new Map(POKEMON.map(p => [p.name, p]));

  // 721 species plus 90 alternate forms. Forms have no chain of their own but
  // every one belongs to a species through the species field.
  const SPECIES = POKEMON.filter(p => p.kind === "species");
  const bySpecies = new Map(SPECIES.map(p => [p.species, p]));

  const children = new Map();
  SPECIES.forEach(p => {
    if (p.evolvesFrom == null) return;
    if (!children.has(p.evolvesFrom)) children.set(p.evolvesFrom, []);
    children.get(p.evolvesFrom).push(p);
  });

  const forms = new Map();
  POKEMON.forEach(p => {
    if (p.kind === "species") return;
    if (!forms.has(p.species)) forms.set(p.species, []);
    forms.get(p.species).push(p);
  });

  const baseOf = p => (p.kind === "species" ? p : bySpecies.get(p.species));
  const formsOf = p => forms.get(p.species) || [];

  const TYPE_COLOR = {};
  POKEMON.forEach(p => p.types.forEach((t, i) => {
    if (!TYPE_COLOR[t] && p.typeColors[i]) TYPE_COLOR[t] = p.typeColors[i];
  }));
  ALL_TYPES.forEach(t => { if (!TYPE_COLOR[t]) TYPE_COLOR[t] = "#6b7488"; });

  // Type colours run from dark purple to pale yellow, so the label colour has to follow.
  function onColour(hex) {
    const v = parseInt(hex.slice(1), 16);
    const lum = (.299 * ((v >> 16) & 255) + .587 * ((v >> 8) & 255) + .114 * (v & 255)) / 255;
    return lum > .62 ? "#1d2333" : "#ffffff";
  }

  function chipStyle(type) {
    const fg = onColour(TYPE_COLOR[type]);
    return "background:" + TYPE_COLOR[type] + ";color:" + fg +
      (fg === "#1d2333" ? ";text-shadow:none" : "");
  }

  const bst = p => p.stats.reduce((a, b) => a + b, 0);
  const SORTED_BST = SPECIES.map(bst).sort((a, b) => a - b);

  function percentile(total) {
    let below = 0;
    while (below < SORTED_BST.length && SORTED_BST[below] < total) below++;
    return Math.round(below / SORTED_BST.length * 100);
  }

  const evolutionsOf = p => (p.kind === "species" ? children.get(p.species) || [] : []);
  const title = s => s.charAt(0).toUpperCase() + s.slice(1);

  // Species keep their hyphens (Ho-Oh, Porygon-Z). Forms read as a species
  // followed by the thing that makes them different: Charizard Mega X.
  function pretty(p) {
    const cap = w => title(w);
    if (p.kind === "species") return p.name.split("-").map(cap).join("-");
    const base = bySpecies.get(p.species);
    if (!base || p.name.indexOf(base.name + "-") !== 0) {
      return p.name.split("-").map(cap).join(" ");
    }
    return pretty(base) + " " + p.name.slice(base.name.length + 1).split("-").map(cap).join(" ");
  }

  const KIND_WORD = { mega: "mega evolution", primal: "primal reversion", form: "alternate form" };
  const sign = n => (n > 0 ? "+" : "") + n;

  /* ------------------------------------------------------------- images
     Artwork comes from PokeAPI at runtime rather than from this repository.
     One request per species covers both the large artwork and the small
     sprite, and results are cached for the rest of the browser session. */

  const API = "https://pokeapi.co/api/v2/pokemon/";
  const memory = new Map();
  const inflight = new Map();

  function stored(id) {
    try {
      const raw = sessionStorage.getItem("poke-art-" + id);
      return raw ? JSON.parse(raw) : undefined;
    } catch (e) { return undefined; }
  }

  function keep(id, record) {
    try { sessionStorage.setItem("poke-art-" + id, JSON.stringify(record)); } catch (e) {}
  }

  function artwork(id) {
    if (typeof fetch !== "function") return Promise.resolve(null);
    if (memory.has(id)) return Promise.resolve(memory.get(id));
    const cached = stored(id);
    if (cached !== undefined) { memory.set(id, cached); return Promise.resolve(cached); }
    if (inflight.has(id)) return inflight.get(id);

    const job = fetch(API + id)
      .then(r => { if (!r.ok) throw new Error("status " + r.status); return r.json(); })
      .then(data => {
        const s = data.sprites || {};
        const other = s.other || {};
        const official = other["official-artwork"] || {};
        const record = {
          art: official.front_default || s.front_default || null,
          sprite: s.front_default || official.front_default || null
        };
        memory.set(id, record);
        keep(id, record);
        inflight.delete(id);
        return record;
      })
      .catch(() => { inflight.delete(id); memory.set(id, null); return null; });

    inflight.set(id, job);
    return job;
  }

  // Every image starts as an empty slot and is filled once the API answers.
  function slot(p, kind) {
    return '<span class="art art-' + kind + ' art-loading" data-mon="' + p.id +
      '" data-kind="' + kind + '" data-alt="' + pretty(p) + '"></span>';
  }

  function fillImages(root) {
    root.querySelectorAll("[data-mon]").forEach(node => {
      if (node.dataset.filled) return;
      node.dataset.filled = "1";
      const kind = node.dataset.kind;
      artwork(Number(node.dataset.mon)).then(record => {
        const url = record && (kind === "hero" ? record.art : record.sprite);
        node.classList.remove("art-loading");
        if (!url) {
          node.classList.add("art-failed");
          if (kind === "hero") node.textContent = "No image came back for " + node.dataset.alt + ".";
          return;
        }
        const img = new Image();
        img.decoding = "async";
        img.alt = kind === "hero" ? node.dataset.alt : "";
        img.onload = () => { node.textContent = ""; node.appendChild(img); };
        img.onerror = () => node.classList.add("art-failed");
        img.src = url;
      });
    });
  }

  /* -------------------------------------------------------------- matchups */

  function defence(types) {
    const out = {};
    ALL_TYPES.forEach(atk => {
      let mult = 1;
      types.forEach(def => { mult *= CHART[atk][def] !== undefined ? CHART[atk][def] : 1; });
      out[atk] = mult;
    });
    return out;
  }

  function label(mult) {
    if (mult === 0) return "immune";
    if (mult === 4) return "4x";
    if (mult === 2) return "2x";
    if (mult === .5) return "½x";
    if (mult === .25) return "¼x";
    return mult + "x";
  }

  /* --------------------------------------------------------------- scoring */

  const PRIORITIES = {
    balanced: {
      label: "A bit of everything",
      // Total, minus a nudge against lopsided spreads, so an even Pokémon wins a tie.
      score: function (s) {
        const total = s.reduce((a, b) => a + b, 0);
        const mean = total / 6;
        const spread = Math.sqrt(s.reduce((a, v) => a + (v - mean) * (v - mean), 0) / 6);
        return total - .35 * spread;
      }
    },
    offence: {
      label: "Hitting hard",
      score: s => 2 * Math.max(s[1], s[3]) + .6 * Math.min(s[1], s[3]) + 1.2 * s[5] + .4 * (s[0] + s[2] + s[4])
    },
    bulk: {
      label: "Surviving",
      score: s => 1.6 * s[0] + 1.4 * s[2] + 1.4 * s[4] + .5 * (s[1] + s[3]) + .3 * s[5]
    },
    speed: {
      label: "Moving first",
      score: s => 2.4 * s[5] + 1.2 * Math.max(s[1], s[3]) + .4 * (s[0] + s[2] + s[4])
    }
  };

  /* -------------------------------------------------------------- analysis */

  function compare(from, to) {
    const deltas = to.stats.map((v, i) => v - from.stats[i]);
    const before = defence(from.types);
    const after = defence(to.types);

    const worse = [], better = [];
    ALL_TYPES.forEach(t => {
      if (after[t] > before[t]) worse.push({ type: t, from: before[t], to: after[t] });
      if (after[t] < before[t]) better.push({ type: t, from: before[t], to: after[t] });
    });

    const drops = deltas
      .map((d, i) => ({ stat: STAT_NAMES[i], d, i }))
      .filter(x => x.d < 0)
      .sort((a, b) => a.d - b.d);

    const gains = deltas
      .map((d, i) => ({ stat: STAT_NAMES[i], d, i }))
      .filter(x => x.d > 0)
      .sort((a, b) => b.d - a.d);

    return {
      from, to, deltas, drops, gains,
      total: bst(to) - bst(from),
      before, after, worse, better,
      newTypes: to.types.filter(t => !from.types.includes(t)),
      lostTypes: from.types.filter(t => !to.types.includes(t))
    };
  }

  function heavyWeaknesses(profile) {
    return ALL_TYPES.filter(t => profile[t] > 1).map(t => ({ type: t, mult: profile[t] }));
  }

  /* ---------------------------------------------------------------- verdict */

  // A form is not a stage you evolve into, so it gets its own reading.
  function verdictForForm(form) {
    const base = bySpecies.get(form.species);
    const c = compare(base, form);
    const word = KIND_WORD[form.kind];

    if (form.kind === "mega" || form.kind === "primal") {
      const sisters = formsOf(form).filter(f => f.kind === form.kind);
      return {
        tag: title(word),
        head: c.total > 0
          ? "Yes, this is as strong as " + pretty(base) + " gets."
          : "A different shape rather than a stronger one.",
        body: pretty(form) + " is worth " + sign(c.total) + " base stat points against ordinary " +
          pretty(base) + (c.drops.length
            ? ", though " + c.drops[0].stat.toLowerCase() + " falls by " + Math.abs(c.drops[0].d) + "."
            : ", with nothing given up.") +
          " It lasts for the battle rather than permanently, so it is a separate question from evolving." +
          (sisters.length > 1
            ? " " + pretty(base) + " has " + sisters.length + " of these to choose between, and they pull in different directions."
            : "")
      };
    }

    const moved = (c.gains.length ? c.gains[0].stat.toLowerCase() + " up " + c.gains[0].d : "") +
      (c.gains.length && c.drops.length ? ", " : "") +
      (c.drops.length ? c.drops[0].stat.toLowerCase() + " down " + Math.abs(c.drops[0].d) : "");

    let account;
    if (c.total !== 0) {
      account = "It is worth " + sign(c.total) + " base stat points against ordinary " +
        pretty(base) + (moved ? ", with " + moved : "") + ".";
    } else if (moved) {
      account = "The total is identical to ordinary " + pretty(base) +
        " and the points simply move: " + moved + ".";
    } else if (c.newTypes.length) {
      account = "The stats are identical to ordinary " + pretty(base) + ". Only the typing differs.";
    } else {
      account = "The stats and typing are identical to ordinary " + pretty(base) +
        ", so the difference is cosmetic.";
    }

    return {
      tag: title(word),
      head: pretty(base) + " in another shape.",
      body: pretty(form) + " is not something you evolve into. " + account +
        " Worth knowing before you settle on what to do with the species."
    };
  }

  function verdictFor(mon, options, chosen, priority) {
    if (options.length === 0) {
      const parent = mon.evolvesFrom != null ? bySpecies.get(mon.evolvesFrom) : null;
      const pct = percentile(bst(mon));
      const extra = formsOf(mon);
      const megas = extra.filter(f => f.kind === "mega" || f.kind === "primal");
      const aside = megas.length
        ? " It can still " + (megas[0].kind === "primal" ? "revert to its primal form"
            : "mega evolve" + (megas.length > 1 ? ", in " + megas.length + " different directions" : "")) + "."
        : extra.length
          ? " It does have " + (extra.length === 1 ? "another form" : extra.length + " other forms") + ", below."
          : "";

      if (parent) {
        return {
          tag: "No decision to make",
          head: pretty(mon) + " is the end of the line.",
          body: "There is nothing further to evolve into. It already sits above " + pct +
            "% of the 721 species on base stats, so the work is done." + aside
        };
      }
      return {
        tag: "No decision to make",
        head: pretty(mon) + " does not evolve.",
        body: "This species has no evolution in the data, so nothing is being held back by staying as it is. " +
          "It sits above " + pct + "% of the 721 species on base stats." + aside
      };
    }

    const c = compare(mon, chosen);
    const worseCount = c.worse.length;
    const betterCount = c.better.length;
    const gain = c.total;

    if (options.length > 1) {
      const best = rank(mon, options, priority)[0];
      const totals = options.map(bst);
      const spread = Math.max.apply(null, totals) - Math.min.apply(null, totals);
      const shape = spread === 0
        ? "All " + options.length + " land on the same " + totals[0] +
          " point total, so this is a question of shape rather than size."
        : "They are not equivalent: " + spread +
          " base stat points separate the strongest from the weakest.";
      return {
        tag: options.length + " ways to go",
        head: "Yes, but the choice matters more than the timing.",
        body: pretty(mon) + " can become " + listNames(options) + ". " + shape +
          " For " + PRIORITIES[priority].label.toLowerCase() + ", " + pretty(best) +
          " is the pick. Once you evolve, the others are off the table."
      };
    }

    if (gain < 0) {
      return {
        tag: "Only with a plan",
        head: "This one costs you stats.",
        body: pretty(chosen) + " ends up " + Math.abs(gain) +
          " base stat points below " + pretty(mon) +
          ". It is a specialist rather than an upgrade, so evolve only if that specific shape is what you are after."
      };
    }

    if (gain === 0) {
      const shift = (c.gains.length && c.drops.length)
        ? ", redistributed: " + c.gains[0].stat.toLowerCase() + " goes up " + c.gains[0].d +
          ", " + c.drops[0].stat.toLowerCase() + " drops " + Math.abs(c.drops[0].d)
        : "";
      return {
        tag: "Even trade",
        head: "Same total, different shape.",
        body: pretty(chosen) + " has exactly the same base stat total" + shift +
          ". Evolve for the new shape and typing, not because it is bigger."
      };
    }

    if (c.drops.length) {
      const worst = c.drops[0];
      return {
        tag: "Yes, with a catch",
        head: "Worth it, as long as you can spare the " + worst.stat.toLowerCase() + ".",
        body: "The total climbs " + gain + " points, but " + worst.stat.toLowerCase() +
          " falls by " + Math.abs(worst.d) + ". " +
          (worst.i === 5
            ? "Losing speed changes who moves first, which matters more than the number suggests."
            : "Everything else moves up, so this is a trade rather than a loss.") +
          (worseCount ? " Typing also opens up " + worseCount + " new problem " +
            (worseCount === 1 ? "matchup" : "matchups") + "." : "")
      };
    }

    if (worseCount > betterCount && worseCount >= 2) {
      return {
        tag: "Yes, carefully",
        head: "Stronger, but easier to hit.",
        body: "Every stat rises, " + gain + " points in total. The new typing costs you though: " +
          worseCount + " types hit harder than before" +
          (betterCount ? ", against " + betterCount + " that hit softer" : "") +
          ". Good in most places, worse against anything listed below in red."
      };
    }

    return {
      tag: "Yes",
      head: "Nothing to think about here.",
      body: "Every stat holds or improves, for " + gain + " points in total" +
        (betterCount > worseCount ? ", and the typing gets harder to break as well" : "") +
        ". " + pretty(chosen) + " sits above " + percentile(bst(chosen)) +
        "% of the 721 species, up from " + percentile(bst(mon)) + "%."
    };
  }

  function listNames(list) {
    const names = list.map(p => pretty(p));
    if (names.length === 1) return names[0];
    return names.slice(0, -1).join(", ") + " or " + names[names.length - 1];
  }

  function rank(from, options, priority) {
    const score = PRIORITIES[priority].score;
    return options.slice().sort((a, b) => score(b.stats) - score(a.stats));
  }

  function branchWhy(option, siblings) {
    if (siblings.length < 2) return "";
    const best = [];
    for (let i = 0; i < 6; i++) {
      const top = Math.max.apply(null, siblings.map(s => s.stats[i]));
      if (option.stats[i] === top && siblings.filter(s => s.stats[i] === top).length === 1) {
        best.push(STAT_NAMES[i].toLowerCase());
      }
    }
    if (best.length) return "Best " + best.slice(0, 2).join(" and ") + " of the group";
    return bst(option) + " total, " + option.types.join(" / ");
  }

  /* --------------------------------------------------------------- markup */

  function typeChips(types, highlight) {
    return '<div class="types">' + types.map(t =>
      '<span class="type' + (highlight && highlight.includes(t) ? " is-new" : "") +
      '" style="' + chipStyle(t) + '">' + t + "</span>").join("") + "</div>";
  }

  function monBlock(p, opts) {
    opts = opts || {};
    return '<div class="mon' + (opts.flash ? " flash" : "") + '">' +
      '<div class="mon-frame" style="--accent:' + p.accent + '">' + slot(p, "hero") + "</div>" +
      '<p class="mon-name">' + pretty(p) + "</p>" +
      typeChips(p.types, opts.highlight) +
      '<p class="mon-bst">' + bst(p) + " base stat total</p>" +
      "</div>";
  }

  function ledger(c) {
    const max = Math.max(10, Math.max.apply(null, c.deltas.map(Math.abs)));
    const rows = c.deltas.map((d, i) => {
      const pct = Math.abs(d) / max * 50;
      const dir = d > 0 ? "up" : d < 0 ? "down" : "flat";
      const bar = d === 0 ? "" :
        '<span class="ledger-bar ' + dir + '" style="width:' + pct.toFixed(1) + '%"></span>';
      return '<div class="ledger-row">' +
        '<span class="ledger-stat">' + STAT_NAMES[i] + "</span>" +
        '<span class="ledger-track">' + bar + "</span>" +
        '<span class="ledger-value ' + dir + '">' + (d === 0 ? "0" : sign(d)) + "</span>" +
        "</div>";
    }).join("");

    return '<div class="ledger">' + rows + "</div>" +
      '<div class="ledger-total">' +
      "<span>Total</span>" +
      '<span class="ledger-note">' + bst(c.from) + " becomes " + bst(c.to) + "</span>" +
      '<span class="ledger-value ' + (c.total > 0 ? "up" : c.total < 0 ? "down" : "flat") + '">' +
      sign(c.total) + "</span></div>";
  }

  function soloLedger(p) {
    const rows = p.stats.map((v, i) =>
      '<div class="ledger-row">' +
      '<span class="ledger-stat">' + STAT_NAMES[i] + "</span>" +
      '<span class="ledger-track solo" style="--accent:' + p.accent + '">' +
      '<span class="ledger-bar solo" style="width:' + (v / 255 * 100).toFixed(1) + '%"></span></span>' +
      '<span class="ledger-value">' + v + "</span></div>").join("");
    return '<div class="ledger">' + rows + "</div>" +
      '<div class="ledger-total"><span>Total</span>' +
      '<span class="ledger-note">above ' + percentile(bst(p)) + "% of the 721 species</span>" +
      '<span class="ledger-value">' + bst(p) + "</span></div>";
  }

  function chipList(items, kind) {
    if (!items.length) return '<p class="match-none">Nothing changes here.</p>';
    return '<div class="chips">' + items.map(x =>
      '<span class="chip" style="' + chipStyle(x.type) + '">' + x.type +
      " <small>" + label(x.from) + " to " + label(x.to) + "</small></span>").join("") + "</div>";
  }

  function currentWeaknesses(p) {
    const list = heavyWeaknesses(defence(p.types));
    if (!list.length) return '<p class="match-none">Nothing hits it for extra damage.</p>';
    return '<div class="chips">' + list.map(x =>
      '<span class="chip" style="' + chipStyle(x.type) + '">' + x.type +
      " <small>" + label(x.mult) + "</small></span>").join("") + "</div>";
  }

  function chainStrip(subject) {
    const mon = baseOf(subject);
    let root = mon;
    const guard = new Set();
    while (root.evolvesFrom != null && bySpecies.has(root.evolvesFrom) && !guard.has(root.id)) {
      guard.add(root.id);
      root = bySpecies.get(root.evolvesFrom);
    }
    const parts = [];
    (function walk(p, depth) {
      parts.push('<button type="button" class="line-step' + (p.id === mon.id ? " here" : "") +
        '" data-pick="' + p.name + '">' +
        slot(p, "thumb") + pretty(p) + "</button>");
      const kids = evolutionsOf(p);
      if (kids.length) {
        parts.push('<span class="line-sep">' + (kids.length > 1 ? "branches into" : "→") + "</span>");
        kids.forEach(k => walk(k, depth + 1));
      }
    })(root, 0);
    return '<div class="line">' + parts.join("") + "</div>";
  }

  function factsBlock(p, other, verb) {
    const m = (h, w) => (h / 10).toFixed(1) + " m, " + (w / 10).toFixed(1) + " kg";
    const abil = p.abilities.concat(p.hiddenAbility ? [p.hiddenAbility + " (hidden)"] : []);
    const gained = other
      ? abil.filter(a => !other.abilities.includes(a.replace(" (hidden)", "")) &&
        a.replace(" (hidden)", "") !== other.hiddenAbility)
      : [];
    return '<dl class="facts">' +
      '<div class="fact"><dt>Size after ' + (verb || "evolving") + '</dt><dd>' + m(p.height, p.weight) +
      (other ? ' <span class="thin">(from ' + m(other.height, other.weight) + ")</span>" : "") + "</dd></div>" +
      '<div class="fact"><dt>Abilities</dt><dd>' + (abil.join(", ") || "none listed") +
      (gained.length ? ' <span class="thin">' + gained.length + " new</span>" : "") + "</dd></div>" +
      '<div class="fact"><dt>Base experience</dt><dd>' + (p.baseExp == null ? "not listed" : p.baseExp) +
      (other && other.baseExp != null && p.baseExp != null
        ? ' <span class="thin">(' + sign(p.baseExp - other.baseExp) + ")</span>" : "") + "</dd></div>" +
      '<div class="fact"><dt>Egg groups</dt><dd>' + (p.eggGroups.join(", ") || "unknown") + "</dd></div>" +
      "</dl>";
  }

  function formCards(list, currentId) {
    return '<div class="branches">' + list.map(f => {
      const c = compare(bySpecies.get(f.species), f);
      return '<button type="button" class="branch" data-pick="' + f.name + '"' +
        (f.id === currentId ? ' aria-pressed="true"' : "") + ">" +
        slot(f, "branch") +
        '<span class="branch-name">' + pretty(f) + "</span>" +
        '<span class="branch-why">' + sign(c.total) + " total, " + f.types.join(" / ") + "</span>" +
        "</button>";
    }).join("") + "</div>";
  }

  function tradeCards(c, verb) {
    return card("Every stat, before and after", "left of the line is a loss", ledger(c)) +
      card("What gets harder, what gets easier", "damage taken by type",
        '<div class="matchcols">' +
        "<div><h4>Hits harder after " + verb + "</h4>" + chipList(c.worse) + "</div>" +
        "<div><h4>Hits softer after " + verb + "</h4>" + chipList(c.better) + "</div>" +
        "</div>") +
      card("The rest of it", "", factsBlock(c.to, c.from, verb));
  }

  function card(heading, note, body) {
    return '<section class="card"><div class="card-head"><h3>' + heading + "</h3>" +
      (note ? '<span class="note">' + note + "</span>" : "") + "</div>" +
      '<div class="card-body">' + body + "</div></section>";
  }

  /* ---------------------------------------------------------------- render */

  const state = { mon: null, chosen: null, priority: "balanced" };
  const stage = document.getElementById("stage");

  // Alternate forms are not a stage of an evolution line, so they get their
  // own page: the species they belong to, side by side with the form.
  function renderForm(form, flash) {
    const base = bySpecies.get(form.species);
    const c = compare(base, form);
    const v = verdictForForm(form);
    const sisters = formsOf(form);
    const verb = form.kind === "form" ? "changing form" : "the change";

    let html = '<section class="card verdict" style="--accent:' + form.accent + '">' +
      '<span class="verdict-tag">' + v.tag + "</span>" +
      "<h2>" + v.head + "</h2><p>" + v.body + "</p></section>";

    html += card("What changes", "against ordinary " + pretty(base),
      '<div class="pair">' + monBlock(base) +
      '<div class="arrow" aria-hidden="true">→</div>' +
      monBlock(form, { flash: flash, highlight: c.newTypes }) + "</div>");

    if (sisters.length > 1) {
      html += card("The other forms of " + pretty(base),
        sisters.length + " in total", formCards(sisters, form.id));
    }

    html += tradeCards(c, verb);
    html += card("The line it belongs to", "click any stage to read it", chainStrip(form));

    stage.innerHTML = html;
    fillImages(stage);
  }

  function render(flash) {
    const mon = state.mon;
    if (!mon) return;
    if (mon.kind !== "species") return renderForm(mon, flash);
    const options = evolutionsOf(mon);
    if (!state.chosen || !options.some(o => o.id === state.chosen.id)) {
      state.chosen = rank(mon, options, state.priority)[0] || null;
    }
    const v = verdictFor(mon, options, state.chosen, state.priority);
    let html = "";

    html += '<section class="card verdict" style="--accent:' + mon.accent + '">' +
      '<span class="verdict-tag">' + v.tag + "</span>" +
      "<h2>" + v.head + "</h2><p>" + v.body + "</p></section>";

    if (state.chosen) {
      const c = compare(mon, state.chosen);

      html += card("What you are trading", "base stats and typing",
        '<div class="pair">' + monBlock(mon) +
        '<div class="arrow" aria-hidden="true">→</div>' +
        monBlock(state.chosen, { flash: flash, highlight: c.newTypes }) + "</div>");

      if (options.length > 1) {
        const ranked = rank(mon, options, state.priority);
        html += card("Which one", "ranked for: " + PRIORITIES[state.priority].label.toLowerCase(),
          '<div class="priority" role="group" aria-label="What matters to you">' +
          Object.keys(PRIORITIES).map(k =>
            '<button type="button" data-priority="' + k + '" aria-pressed="' +
            (k === state.priority) + '">' + PRIORITIES[k].label + "</button>").join("") +
          "</div><div style=\"height:1rem\"></div>" +
          '<div class="branches">' + options.map(o => {
            const isBest = ranked[0].id === o.id;
            return '<button type="button" class="branch" data-evo="' + o.id + '" aria-pressed="' +
              (state.chosen.id === o.id) + '">' +
              slot(o, "branch") +
              '<span class="branch-name">' + pretty(o) + "</span>" +
              '<span class="branch-why">' + branchWhy(o, options) + "</span>" +
              (isBest ? '<span class="branch-best">Best fit</span>' : "") + "</button>";
          }).join("") + "</div>");
      }

      html += tradeCards(c, "evolving");
    } else {
      html += card("Where it stands", "base stats",
        '<div class="pair" style="grid-template-columns:1fr">' + monBlock(mon) + "</div>" +
        '<div style="height:1.25rem"></div>' + soloLedger(mon));
      html += card("What it struggles against", "damage taken by type", currentWeaknesses(mon));
      html += card("The rest of it", "", factsBlock(mon, null));
    }

    const extra = formsOf(mon);
    if (extra.length) {
      const megas = extra.filter(f => f.kind === "mega" || f.kind === "primal");
      html += card(
        megas.length === extra.length
          ? (megas[0].kind === "primal" ? "Primal reversion" : "Mega evolution")
          : "Other forms",
        megas.length === extra.length
          ? "a separate question from evolving"
          : extra.length + " beyond the ordinary one",
        formCards(extra, null));
    }

    html += card("The whole line", "click any stage to read it", chainStrip(mon));

    stage.innerHTML = html;
    fillImages(stage);
  }

  function select(name, push) {
    const mon = byName.get(name);
    if (!mon) return;
    state.mon = mon;
    state.chosen = null;
    render(true);
    if (push !== false) history.replaceState(null, "", "#" + name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------------------------------------------------------- search */

  const input = document.getElementById("search");
  const results = document.getElementById("results");
  let matches = [], cursor = -1, thumbTimer = null;

  function closeResults() {
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
    cursor = -1;
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (!q) { closeResults(); return; }
    const starts = [], contains = [];
    POKEMON.forEach(p => {
      if (p.name.startsWith(q)) starts.push(p);
      else if (p.name.includes(q)) contains.push(p);
    });
    matches = starts.concat(contains).slice(0, 8);
    if (!matches.length) {
      results.innerHTML = '<li class="r-empty" aria-disabled="true">No Pokémon by that name. Try part of it.</li>';
      results.hidden = false;
      input.setAttribute("aria-expanded", "true");
      return;
    }
    cursor = 0;
    results.innerHTML = matches.map((p, i) =>
      '<li role="option" data-pick="' + p.name + '" aria-selected="' + (i === 0) + '">' +
      slot(p, "thumb") + '<span class="r-name">' + pretty(p) + "</span>" +
      '<span class="r-meta">' + p.types.join(" / ") + " · " + bst(p) + "</span></li>").join("");
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
    // Wait for a pause in typing before asking the API for thumbnails.
    clearTimeout(thumbTimer);
    thumbTimer = setTimeout(() => fillImages(results), 250);
  }

  function move(step) {
    if (results.hidden || !matches.length) return;
    cursor = (cursor + step + matches.length) % matches.length;
    Array.prototype.forEach.call(results.children, (li, i) =>
      li.setAttribute("aria-selected", i === cursor));
    results.children[cursor].scrollIntoView({ block: "nearest" });
  }

  input.addEventListener("input", () => search(input.value));
  input.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" && matches[cursor]) {
      e.preventDefault();
      select(matches[cursor].name);
      input.value = "";
      closeResults();
    } else if (e.key === "Escape") closeResults();
  });

  document.addEventListener("click", e => {
    const hit = e.target.closest("[data-pick]");
    if (hit) {
      const name = hit.dataset.pick === "random"
        ? POKEMON[Math.floor(Math.random() * POKEMON.length)].name
        : hit.dataset.pick;
      select(name);
      input.value = "";
      closeResults();
      return;
    }
    const evo = e.target.closest("[data-evo]");
    if (evo) {
      state.chosen = byId.get(Number(evo.dataset.evo));
      render(true);
      return;
    }
    const pr = e.target.closest("[data-priority]");
    if (pr) {
      state.priority = pr.dataset.priority;
      state.chosen = null;
      render(false);
      return;
    }
    if (!e.target.closest(".finder")) closeResults();
  });

  window.addEventListener("hashchange", () => {
    const name = decodeURIComponent(location.hash.slice(1));
    if (name && byName.has(name)) select(name, false);
  });

  const initial = decodeURIComponent(location.hash.slice(1));
  if (initial && byName.has(initial)) select(initial, false);
})();

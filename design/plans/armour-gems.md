# Plan: armour gems resist elements

#### Armour gems: resistance **[PLAN 2026-10-24, not built]**
Nothing in the game deals elemental damage to the party yet, so there's nothing to resist. But every foe already has an element of its own: its `resist` field, the element it shrugs off.
- **Fire (7):** imps, salamanders, slugs, brutes, beetles, the drake, Vulk.
- **Frost (11):** crabs, frost wolves, rimehorns, ice wraiths, the troll, Isolde and others.
- **Venom (9):** spiders, leeches, rootlings, hollows, Mab and others.
- **Shadow (7):** shades, banshees, witchlings, voidlings, Malgrim and others.
- **None (17):** goblins, hexlings, archers and the like.

**The plan:**
- **A foe's blows carry its element.** Its `resist` element (or a new `element` field, where those should differ) tags its hits, shots and danger zones. Foes with none stay physical.
- **An element gem in armour resists that element:**
  - Chipped 6%, Clear 10%, Flawless 15%, Royal 20% less damage from it.
  - It stacks across the head, body and off-hand, capped at 50%.
  - It also shortens that element's status by the same share: Burn (fire), Chill (frost), Poison (venom), Weaken (shadow).
- **The gems tab shows it:** "+6% FIRE RESIST" in place of today's "NO EFFECT IN ARMOUR". Gear stats show the total per element.
- **Places that give it purpose:**
  - Cinderreach (fire) and Frosthelm (frost) already have heat and cold to prepare for, so resistance fits the "come prepared" idea.
  - Mistfen and Gloamwood are venom and shadow.
  - Gem drops could lean toward the region's counter-element.

**Two gems have no foes to resist:**
- **Storm** (no foe is storm): either make some foes storm (sentinels, gargoyles, warlocks' bolts and brutes already look electric), or have storm in armour give something else, such as a short slow on whoever hits you.
- **Sun** (light; no foe is light, and shades are weak to it): in armour it could resist shadow (light against dark), which would make shadow the one element with two counters, or it could boost healing received.
- My recommendation: make sentinels, gargoyles and warlocks storm, and let sun armour resist shadow.

**Checks when built:**
- Damage taken from tagged foes drops by the gem's share, and never past 50%.
- Status durations shorten.
- The fight bench with no gems socketed is unchanged.
- One bench pass with the party wearing fire resistance against the fire foes.

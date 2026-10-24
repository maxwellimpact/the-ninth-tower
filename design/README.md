# The Ninth Tower: design

The design is split by topic, so each file can be read whole. **This index is the
contract:** every design file is listed here, and a file that isn't listed
doesn't count.

## Read every session

1. **[rules.md](rules.md):** the never-again rules. Each is a bug that shipped
   once. Check new work against all of them.
2. **The newest file in [decisions/](decisions/):** what was decided recently
   and why. Don't undo a decision without asking.
3. **The topic file for what you're touching** (below).

## Topics

| File | What's in it |
|---|---|
| [vision.md](vision.md) | Vision, design pillars, the story, the business model, title and names |
| [core-numbers.md](core-numbers.md) | Levels, XP, damage formulas, the numbers everything else is tuned from (C1) |
| [combat.md](combat.md) | Elements and status effects (C2), leader controls and combat feel, companion AI, magic |
| [heroes-skills.md](heroes-skills.md) | The heroes, their skills, passives and ultimates (C3), the party |
| [gear.md](gear.md) | Equipment and rarity (C4), upgrades, refinement, gems and sockets (C5), wardrobe |
| [crafting.md](crafting.md) | Materials, crafting and consumables (C6) |
| [enemies.md](enemies.md) | Every foe, elite and boss (C7) |
| [dungeons-relics.md](dungeons-relics.md) | Dungeons, lieutenants and relics, and what each relic opens (C8) |
| [regions.md](regions.md) | The region template and recurring features (C12 §1-7), the world's layout |
| [progression.md](progression.md) | The whole game in order (C10), Brightwater's rebuild and services (C9) |
| [art-audio.md](art-audio.md) | Art, animation and the code-generated audio |
| [production.md](production.md) | Milestones, and the art and data counts the full build needs (C11) |
| [tech.md](tech.md) | Tech plan, the web prototype, test maps, the Vast, profiling, the iOS port |
| [open-questions.md](open-questions.md) | Questions still open, and known prototype shortcuts |

## Plans (written, not built)

| File | What it is |
|---|---|
| [plans/saves.md](plans/saves.md) | Saves for separate maps: none, own (clearable) or shared with the main game |
| [plans/armour-gems.md](plans/armour-gems.md) | Element gems in armour resist that element |

When a plan is built, fold it into its topic file and delete it from `plans/`.

## Decisions

The decision log, a dated row per change (what changed, why, how it was
tested), newest file last:

- [decisions/2026-10-13.md](decisions/2026-10-13.md): 2026-10-13 to 2026-10-16
- [decisions/2026-10-17.md](decisions/2026-10-17.md): 2026-10-17
- [decisions/2026-10-18.md](decisions/2026-10-18.md): 2026-10-18 to 2026-10-19
- [decisions/2026-10-21.md](decisions/2026-10-21.md): 2026-10-21 to 2026-10-23
- [decisions/2026-10-24.md](decisions/2026-10-24.md): 2026-10-24 onward (current)

Add new rows to the end of the current file. When it passes about 25 KB, start
a new one named for the first date in it, and list it here.

## Keeping it readable

- **One topic, one file.** Where topics touch, say so with a "See also" line.
- **Keep files under about 25 KB,** so they're read whole, not in pieces.
- **Section ids stay.** Code comments cite sections by id (C4, C12 §8, §13), so
  headings keep their ids when moved.

## Where this came from

Until 2026-10-24 this was one file, `DESIGN.md`. When it was split, the first
draft's sections that Part II had replaced were retired: §6 (Class & Skill
System, replaced by C3), §7 (Equipment System, by C4/C5), §9 (Magic System, by
C2/C3) and §10 (Relics & Gates, by C8). What they said that wasn't said
anywhere else moved into the topic files, and one untaken idea (rune modifiers)
went to [open-questions.md](open-questions.md). The full text of the old file
is in git history (it's whole in commit `96a5b4c`'s parent, and split word for
word in `96a5b4c`). Its opening notes:

# The Ninth Tower — Design Doc

> Living document. Sections marked **[OPEN]** still need a decision. Sections marked **[DRAFT]** have a direction we're refining. **[LOCKED]** sections are agreed.
> Last updated: 2026-10-14. **Part II (full game content) starts after §15.**



# Part II — Full Game Content **[DRAFT for review, 2026-10-14]**

This part turns the systems above into the actual content list for the full build: every hero's skills, every piece of gear, upgrades, enemies, bosses, and the order the game unfolds in. Numbers are starting values. They all live in the JSON data files and `tuning.json`, so balance changes never need code changes.

Where this part changes an earlier **[DRAFT]** section, it says so, and the earlier section points here. Items marked **(demo)** already exist in the prototype.



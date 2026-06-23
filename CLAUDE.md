Always read DESIGN.md before any UI/frontend work — it documents the actual live design system currently in use. Do not introduce new color tokens, fonts, or shadow styles without updating this file first.

Always read SCRATCHPAD.md at the start of every session — it contains active issues, key decisions, and current focus. Update it whenever a decision is made or a task is completed.

---

## Never Build From Scratch — Research First (STRICT)

Before writing any new component, utility, icon, animation, or helper, you MUST exhaust existing alternatives in this exact order:

1. **Does the project already have it?** Search the codebase first. Re-use before creating.
2. **Does an installed package already solve it?** Check `node_modules` / `package.json`. Use it.
3. **Does a well-maintained npm package exist?** Search npm. Install it. Do not hand-roll what the ecosystem already provides.
4. **Only then write custom code** — and only the minimum needed for the gap.

The 84-custom-animated-icon incident is the canonical example of what NOT to do. `lucide-animated` existed on npm. One install, zero custom files.

**This rule is non-negotiable.** A task that says "add an animated icon" means install the package, not write 100 lines of motion/react by hand.

---

## YAGNI — You Aren't Gonna Need It (STRICT)

Do not add code for hypothetical future requirements. Only build what is explicitly asked for right now.

- No "in case we need it later" abstractions
- No helper functions that aren't called by the current task
- No extra config options, feature flags, or extensibility hooks unless the task requires them
- No defensive handling for scenarios that cannot currently happen
- Three similar lines of code is better than one premature abstraction

If a feature is not in scope, do not build it.

---

## Ponytail Decision Ladder (run before every implementation)

Before writing any code, climb this ladder and stop at the first rung that solves the problem:

1. **Do we need this at all?** — YAGNI check. If no, stop.
2. **Does the language / runtime stdlib have it?** — Use it. No import needed.
3. **Does an already-installed dependency have it?** — Use it. No new package.
4. **Does a small, well-maintained npm package have it?** — Install it. Do not rewrite it.
5. **Can the whole thing be done in one line?** — Write the one line.
6. **Only now: write the minimal custom implementation** — smallest possible surface area.

The goal is to reach rung 6 as rarely as possible. Most tasks resolve at rungs 2–4.

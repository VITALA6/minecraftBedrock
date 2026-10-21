# 02 — Script API: the ruby economy

`packs/scripting` adds a coin economy on top of the stage 1 content:

- a wallet balance per player,
- coins for killing slime cubes,
- a sidebar scoreboard,
- a shop opened from a wallet item,
- a "bank" block you deposit rubies into,
- passive income near ruby blocks,
- block ownership,
- admin commands.

It uses the stable modules `@minecraft/server` 2.10.0 and `@minecraft/server-ui` 2.2.0 only.
Every API used here was checked against those versions' `.d.ts` files.

## Why it copies `basics` instead of depending on it

The bank behavior is a **custom component**, and a custom component has to be **listed in the
block's JSON** (`"myteam:ruby_bank": {...}`). So the pack that adds the behavior must own the block
definition. The alternatives are worse:

- **Edit `basics`' block.** `basics` would then reference a component only the scripting pack
  registers. Used alone, it would log `Component 'myteam:ruby_bank' was not registered in script
but used on a block`, which is the game's own error text. A lower stage would depend on a
  higher one.
- **Redefine the same block in a second pack.** Two packs defining one identifier is a conflict,
  not a supported override.

So `scripting` is a self-contained copy: stage 1 content plus the economy, with new UUIDs. This also
matches how a Marketplace add-on ships, as one BP + RP pair.

**Don't activate `basics` and `scripting` on the same world.** They define the same identifiers.

## How the code is organized

```
packs/scripting/scripts/
  main.ts                 wiring only: subscribes each feature; startup and worldLoad hooks
  config.ts               identifiers, property keys, tuning numbers
  wallet.ts               balance in a dynamic property: get / set / add / trySpend
  scoreboard.ts           sidebar objective that mirrors the wallet (display only)
  inventory.ts            typed helpers: get container, free capacity, give in stacks
  shop.ts                 catalog + purchase rules (validation lives here, not in the UI)
  ui/wallet-menu.ts       ActionForm (balance + shop) -> ModalForm (quantity slider)
  components/ruby-bank.ts custom component V2 on myteam:ruby_block
  events/
    player-join.ts        sync score, starter wallet on first join
    earning.ts            entityDie -> coins + action bar
    wallet-item.ts        itemUse on myteam:wallet -> open menu
    passive-income.ts     system.runInterval: +1 coin near a ruby block every 60 s
    block-protection.ts   beforeEvents.playerBreakBlock: owner-only breaking
    admin.ts              /scriptevent myteam:setcoins, /myteam:setcoins
```

The dependencies point one way:

```
ui/ -> shop -> wallet -> scoreboard
events/, components/ -> wallet, inventory
```

`wallet.ts` is the only code that writes the balance. Everything else calls it, so the clamping
(0 to 1,000,000) and the scoreboard mirror can't be bypassed.

## The event model

Scripts react to **events**: `world.afterEvents.*`, `world.beforeEvents.*`, `system.afterEvents.*`,
`system.beforeEvents.*`. You subscribe a callback and the game calls it.

|                   | after-events                                              | before-events                                         |
| ----------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| When              | after the thing happened, at the end of the tick          | **before** it happens, while the engine is mid-action |
| Can cancel?       | no                                                        | yes: `event.cancel = true`                            |
| Can change world? | yes                                                       | **no**: restricted ("read-only") execution            |
| Examples here     | `entityDie`, `itemUse`, `playerPlaceBlock`, `playerSpawn` | `playerBreakBlock`, `startup`                         |

**Why world edits are blocked in before-events.** A before-event runs while the engine is halfway
through an operation, such as breaking a block. If your callback could place blocks, move entities
or open inventories at that moment, the engine's state would change under its own feet. So
before-events may read anything (`world.getDynamicProperty` works) and set `cancel`, but calls
marked `@privilege no-restricted-execution` in the `.d.ts` throw. Examples of such calls:
`setScore`, `addItem`, `setItem`, `setActionBar`.

The fix is to **defer** the change: `system.run(() => ...)` runs the callback at the start of the
next tick, in normal mode. That's what `block-protection.ts` does to send its "belongs to Steve"
message. Custom command callbacks behave the same way, so `/myteam:setcoins` defers its write too.

**Early execution.** With 2.x, top-level module code runs **before the world exists**.

- At top level you may only subscribe to events.
- `system.beforeEvents.startup` is where custom components and commands are registered. They
  can't be registered later.
- `world.afterEvents.worldLoad` is the first point where the world can be touched. We set up the
  scoreboard and start the timer there.

**Filters.** Many `subscribe` calls take options, for example `{ entityTypes: [...] }`,
`{ blockTypes: [...] }` or `{ namespaces: [...] }`. The filtering happens inside the engine, which
is cheaper than checking in your callback.

## system.run, runTimeout, runInterval

There's no `setTimeout`, because the game runs on **ticks** (20 per second). Use `system` instead:

| Call                        | Runs                                        | Used here                                         |
| --------------------------- | ------------------------------------------- | ------------------------------------------------- |
| `system.run(fn)`            | once, next tick                             | leaving restricted mode (before-events, commands) |
| `system.runTimeout(fn, t)`  | once, after `t` ticks                       | (not needed yet)                                  |
| `system.runInterval(fn, t)` | every `t` ticks until `system.clearRun(id)` | passive income, every 1200 ticks = 60 s           |

Each returns a run ID for `system.clearRun`. Intervals keep running for the whole session. After
`/reload`, the script restarts from scratch and old intervals are gone.

## Dynamic properties vs scoreboard

|                      | Dynamic properties                                                                   | Scoreboard                                     |
| -------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------- |
| What                 | key → `number \| string \| boolean \| Vector3` on an entity, item stack or the world | integer scores per objective per participant   |
| Persistence          | saved with the world                                                                 | saved with the world                           |
| Visible to players   | no                                                                                   | yes: sidebar, list, below name                 |
| Usable from commands | no                                                                                   | yes: `/scoreboard`, selectors `@a[scores=...]` |
| Can be edited by     | scripts only                                                                         | any operator with `/scoreboard`                |
| Good for             | **source of truth**: balances, flags, JSON blobs, ownership                          | **display** and command or redstone interop    |

Here the wallet balance lives in the player dynamic property `myteam:coins`, and `wallet.ts`
mirrors every change into the `myteam_coins` objective. If someone edits or deletes the objective,
the next balance change fixes the display, and the real balance is unaffected.

- Block ownership is stored as **world** dynamic properties keyed by position, with a small JSON
  value.
- Objective IDs are typed into commands, so they use `[a-z0-9_]`: `myteam_coins` rather than
  `myteam:coins`.

## Server-UI forms

There are three form types: `ActionFormData` (buttons), `ModalFormData` (sliders, toggles, text
fields, dropdowns) and `MessageFormData` (two buttons). Each one is built fluently and shown with
`await form.show(player)`.

The rules that matter:

- **`show()` is async.** The player may take a minute, and anything can change meanwhile.
- **After every `await`, check `player.isValid`.** If the player left, the old object is dead.
  `show()` can also reject with `FormRejectError` whose `reason` is `PlayerQuit`.
  `wallet-item.ts` ignores that case and logs anything else.
- **`response.canceled`** is true when the form was closed. `cancelationReason` is `UserClosed`,
  or `UserBusy` when another UI (for example chat) was open.
- **Never trust form values.** They come from the client.
  - The ModalForm's `formValues` is one entry per control, in order. Our slider is index 0.
  - `purchase()` re-checks the quantity range, the balance and the inventory space at the moment
    of purchase, all synchronously, so nothing can change between the check and the change.
- **Event callbacks can't be async.** Call the async function and attach `.catch`. eslint's
  `no-floating-promises` enforces this.

## Custom components V2

A custom component is a **named behavior that block or item JSON opts into**, with parameters:

```jsonc
// behavior/blocks/ruby_block.json
"components": {
  "myteam:ruby_bank": { "coins_per_ruby": 1 },
  ...
}
```

```ts
// scripts/components/ruby-bank.ts, registered in system.beforeEvents.startup
blockComponentRegistry.registerCustomComponent("myteam:ruby_bank", {
  onPlayerInteract(event, { params }) { ... },  // params = { coins_per_ruby: 1 }
});
```

- **V2 means parameters.** The JSON object is passed to every callback as `params`. It's typed
  `unknown`, so validate it (`coinsPerRuby()`). Different blocks can reuse one component with
  different parameters.
- **Available hooks** (from `BlockCustomComponent` in the `.d.ts`):
  `onPlayerInteract`, `onPlace`, `onPlayerBreak`, `onBreak`, `onStepOn`, `onStepOff`,
  `onEntityFallOn`, `onTick`, `onRandomTick`, `onRedstoneUpdate`, `onBlockStateChange`,
  `onEntity`, and `beforeOnPlayerPlace`.
  - Some hooks need another JSON component as well. For example, `onTick` needs `minecraft:tick`.
    The Content Log tells you when one is missing.
- **Errors and reloading:**
  - A component listed in JSON but never registered logs an error.
  - A component added while the world is open needs you to leave and rejoin, because `/reload`
    can't register new ones.

The custom component **and** the event approach could both have handled "interact with block". The
custom component is the better fit when the behavior belongs to the block itself, because it only
fires for blocks that list it.

## Custom slash commands and script events

**Custom slash commands are stable in 2.10.0.** `CustomCommandRegistry` is in the stable `.d.ts`.

- `/myteam:setcoins <amount> [player]` has typed and autocompleted parameters.
- `permissionLevel: GameDirectors` limits it to operators.
- `cheatsRequired` defaults to true.
- You can usually type it without the namespace (`/setcoins`), as long as no other command has that
  name.

**`/scriptevent myteam:setcoins <amount>`** is the older, untyped hook. Any script can listen for
`system.afterEvents.scriptEventReceive`, and the message is a raw string you parse yourself. Both
are kept so you can compare them.

## Debugging script errors with the Content Log file

1. Check that **Settings → Creator → Enable Content Log File** is on.
2. Reproduce the problem, then open the newest file:
   ```bash
   ls -t ~/.var/app/io.mrarm.mcpelauncher/data/mcpelauncher/games/com.mojang/logs/ContentLog*.txt | head -1
   ```
3. Filter it:
   ```bash
   LOG=$(ls -t ~/.var/app/io.mrarm.mcpelauncher/data/mcpelauncher/games/com.mojang/logs/ContentLog*.txt | head -1)
   grep -v '\[verbose\]' "$LOG" | grep -v '^$'       # all warnings and errors
   grep '\[Scripting\]' "$LOG"                        # script lines only (verbose included)
   ```
   - `[Scripting][verbose]-Plugin Discovered [Scripting BP]` means the script module was found.
   - Uncaught exceptions and `console.warn` / `console.error` output also appear under
     `[Scripting]`.
4. **Map stack traces to source.** The game runs the bundled `dist/scripting_BP/scripts/main.js`,
   so line numbers point there. esbuild leaves a `// packs/scripting/scripts/<file>.ts` comment
   above each module's code, so open the bundle at that line and look up to the nearest comment.
5. **Common errors:**
   - **An error naming a native function that "can't be called" right now**: you changed the world
     in a before-event or command callback (restricted mode). Wrap the change in `system.run`.
   - **`InvalidEntityError`**: you used a player or entity after it left or died. Check `isValid`
     after `await`.
   - **`LocationInUnloadedChunkError` or `LocationOutOfWorldBoundariesError`**: you touched blocks
     where there's no loaded world. `passive-income.ts` clamps Y and catches this.
   - **Errors at load time**: you touched the world at top level (early execution). Move that code
     into `worldLoad`.
6. After fixing, run `npm run build && npm run deploy`, then `/reload` for script-only changes.
   Leave and rejoin the world for JSON changes or new custom components.

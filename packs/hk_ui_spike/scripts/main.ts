// S9 spike (D13): opens test forms for the JSON UI override in this pack's RP. Wiring only.
//
//   /scriptevent hk:uispike <case> [arg]
//
// Throwaway: never shipped; delete when S9 closes.

import { Player, system } from "@minecraft/server";
import { openBook } from "./cases/book";
import { openData } from "./cases/data";
import { openNav, openShift } from "./cases/nav";
import { openPot } from "./cases/pot";
import { openMessage, openModal, openVanillaAction } from "./cases/vanilla";
import { SCRIPT_EVENT } from "./config";
import { report, runFlow } from "./show";

const CASES: Record<string, (player: Player, arg: string) => Promise<void>> = {
  book: (player) => openBook(player),
  pot: (player, arg) => openPot(player, arg === "cold"),
  data: (player) => openData(player),
  nav: (player) => openNav(player),
  shift: (player) => openShift(player),
  vanilla: (player) => openVanillaAction(player),
  modal: (player) => openModal(player),
  message: (player) => openMessage(player, false),
  msgprefix: (player) => openMessage(player, true),
};

// scriptEventReceive is an after-event, so showing forms from it is allowed (no restricted mode).
system.afterEvents.scriptEventReceive.subscribe(
  ({ id, message, sourceEntity }) => {
    if (id !== SCRIPT_EVENT) return;
    if (!(sourceEntity instanceof Player)) {
      console.warn(`[hk_ui_spike] ${SCRIPT_EVENT} must be run by a player`);
      return;
    }
    const [name = "", arg = ""] = message.trim().toLowerCase().split(/\s+/);
    const open = CASES[name];
    if (!open) {
      report(sourceEntity, "help", `cases: ${Object.keys(CASES).join(", ")} (pot cold)`);
      return;
    }
    runFlow(sourceEntity, name, open(sourceEntity, arg));
  },
  { namespaces: ["hk"] },
);

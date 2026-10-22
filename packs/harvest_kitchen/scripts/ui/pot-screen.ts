import { system, type Player } from "@minecraft/server";
import { CustomForm, ObservableString, ObservableUIRawMessage } from "@minecraft/server-ui";
import { POT_SCREEN_REFRESH_TICKS, RP_UUID } from "../config";
import { itemName, t } from "../lib/text";
import { stationHot, startCooking, takeOut } from "../stations/station-engine";
import { readStation, type StationRef } from "../stations/station-store";
import { bookPage } from "./book-pages";
import { showBook } from "./book";
import { closeForm, later, runForm, showForm, ui } from "./forms";
import { potImagePath, potScreenView, type PotScreenView } from "./pot-status";

// The pot screen (plan §2.4, D14), only when there's a choice: a CustomForm with the pot's status
// image (ui/pot-status.ts picks it, tools/gen-book-pages.mjs draws it) and buttons under it:
//
//   [status image]        the target recipe in the pot (present / +N missing), heat, result
//   [♨ Needs fire below]  only when there's no heat
//   Cook <dish>           one per dish possible right now           -> starts cooking, closes
//   Almost! <dish>        only when nothing is possible: closest    -> the book on that dish
//   Take out <item> ×N    one per ingredient type                   -> takes it out
//   Recipe Book                                                     -> the book on this station
//   Close (X)
//
// While open, it re-reads the pot every POT_SCREEN_REFRESH_TICKS: the image and the Take-out
// counts update in place; when the set of buttons changes (or the heat), the screen reopens; when
// no screen applies any more (cooking, done, empty), it closes. Every tap re-validates against
// the pot's current state in station-engine.ts.

type Next = "reopen" | (() => Promise<void>) | undefined;

class PotScreen {
  readonly form: CustomForm;
  next: Next;
  private readonly src: ObservableString;
  private readonly takeLabels = new Map<string, ObservableUIRawMessage>();

  constructor(
    private readonly player: Player,
    private readonly ref: StationRef,
    private readonly view: PotScreenView,
  ) {
    this.src = new ObservableString(potImagePath(view.image));
    const form = new CustomForm(player, t(ref.station.nameKey)).image(this.src, RP_UUID, {
      width: 1,
    });
    if (view.heat === "cold") form.label(t("hk.station.no_heat"));
    for (const recipe of view.cook) {
      form.button(t("hk.pot.cook", itemName(recipe.result)), () =>
        later(player, () => {
          startCooking(player, ref, recipe.id); // re-validates; says why if it can't
          closeForm(this.form);
        }),
      );
    }
    const almost = view.almost;
    if (almost) {
      form.button(t("hk.pot.almost", itemName(almost.result)), () =>
        this.leave(() => showBook(player, bookPage.dish(almost.result))),
      );
    }
    for (const [id, count] of view.contents) {
      const label = new ObservableUIRawMessage(ui(t("hk.pot.take_out", count, itemName(id))));
      this.takeLabels.set(id, label);
      form.button(label, () =>
        later(player, () => {
          takeOut(player, ref, id);
          this.refresh();
        }),
      );
    }
    form.button(t("hk.book.title"), () =>
      this.leave(() => showBook(player, bookPage.chapter(ref.station.id))),
    );
    this.form = form.closeButton();
  }

  /** Closes this screen and then runs `flow` (the book), so the two forms never overlap. */
  private leave(flow: () => Promise<void>): void {
    later(this.player, () => {
      this.next = flow;
      closeForm(this.form);
    });
  }

  /** Re-reads the pot: update in place, reopen on a new layout, close when no screen applies. */
  refresh(): void {
    if (!this.player.isValid || !this.form.isShowing()) return;
    const view = potScreenView(this.ref.station, readStation(this.ref), stationHot(this.ref));
    if (!view) return closeForm(this.form);
    if (view.layout !== this.view.layout) {
      this.next = "reopen";
      return closeForm(this.form);
    }
    this.src.setData(potImagePath(view.image));
    for (const [id, count] of view.contents) {
      this.takeLabels.get(id)?.setData(ui(t("hk.pot.take_out", count, itemName(id))));
    }
  }

  async show(): Promise<boolean> {
    const poll = system.runInterval(() => this.refresh(), POT_SCREEN_REFRESH_TICKS);
    try {
      return await showForm(this.player, this.form);
    } finally {
      system.clearRun(poll);
    }
  }
}

async function show(player: Player, ref: StationRef): Promise<void> {
  for (let i = 0; i < 64; i++) {
    const view = potScreenView(ref.station, readStation(ref), stationHot(ref));
    if (!view) return; // someone else moved on (cooking, done), or it's empty now
    const screen = new PotScreen(player, ref, view);
    if (!(await screen.show())) return;
    if (screen.next === "reopen") continue;
    if (screen.next) await screen.next();
    return;
  }
}

/** Opens the pot screen next tick (forms can't be built in restricted execution). */
export function openPotScreen(player: Player, ref: StationRef): void {
  later(player, () => runForm(show(player, ref), "pot screen"));
}

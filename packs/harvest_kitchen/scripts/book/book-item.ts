import { system, type ItemComponentRegistry, type ItemCustomComponent } from "@minecraft/server";
import { COMPONENT_RECIPE_BOOK } from "../config";
import { openBook } from "../ui/recipe-book";

// hk:recipe_book: using the item opens the book on its Home page (plan §3).

const recipeBook: ItemCustomComponent = {
  onUse({ source }) {
    // Forms can't open in restricted execution; deferring a tick is safe either way.
    system.run(() => {
      if (source.isValid) openBook(source);
    });
  },
};

export function registerRecipeBook(registry: ItemComponentRegistry): void {
  registry.registerCustomComponent(COMPONENT_RECIPE_BOOK, recipeBook);
}

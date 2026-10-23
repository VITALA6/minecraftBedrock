// The Kitchen Guide's "How to Play" topics, as data. Pure, so tests check them in Node; the guide
// screen (ui/guide-screen.ts) shows one topic per page, with a Next button to the following one.
//
// - Title and text are lang keys in resource/texts/en_US.lang, listed literally: the lang test
//   finds used keys by searching the scripts for "wm_kitchen.…" strings.
// - Lang files have no line breaks, so a topic's text is translated with one argument, a newline,
//   and writes %1$s wherever a line ends (vanilla lang reuses %1$s the same way).
// - Icons are our own textures (tests check each PNG exists).

export interface GuideTopic {
  readonly titleKey: string;
  readonly textKey: string;
  readonly icon: string;
}

/** What %1$s becomes in every topic's text. */
export const GUIDE_LINE_BREAK = "\n";

export const GUIDE_TOPICS: readonly GuideTopic[] = [
  {
    titleKey: "wm_kitchen.guide.topic.welcome",
    textKey: "wm_kitchen.guide.text.welcome",
    icon: "textures/wm_kitchen/items/guide_book",
  },
  {
    titleKey: "wm_kitchen.guide.topic.loop",
    textKey: "wm_kitchen.guide.text.loop",
    icon: "textures/wm_kitchen/items/tomato_soup",
  },
  {
    titleKey: "wm_kitchen.guide.topic.seeds",
    textKey: "wm_kitchen.guide.text.seeds",
    icon: "textures/wm_kitchen/items/tomato_seeds",
  },
  {
    titleKey: "wm_kitchen.guide.topic.farmland",
    textKey: "wm_kitchen.guide.text.farmland",
    icon: "textures/wm_kitchen/items/tomato",
  },
  {
    titleKey: "wm_kitchen.guide.topic.bushes",
    textKey: "wm_kitchen.guide.text.bushes",
    icon: "textures/wm_kitchen/items/strawberry",
  },
  {
    titleKey: "wm_kitchen.guide.topic.board",
    textKey: "wm_kitchen.guide.text.board",
    icon: "textures/wm_kitchen/items/cutting_board",
  },
  {
    titleKey: "wm_kitchen.guide.topic.mixes",
    textKey: "wm_kitchen.guide.text.mixes",
    icon: "textures/wm_kitchen/items/tomato_soup_mix",
  },
  {
    titleKey: "wm_kitchen.guide.topic.pot",
    textKey: "wm_kitchen.guide.text.pot",
    icon: "textures/wm_kitchen/items/cooking_pot",
  },
  {
    titleKey: "wm_kitchen.guide.topic.cooking",
    textKey: "wm_kitchen.guide.text.cooking",
    icon: "textures/wm_kitchen/ui/needs_heat",
  },
  {
    titleKey: "wm_kitchen.guide.topic.cold",
    textKey: "wm_kitchen.guide.text.cold",
    icon: "textures/wm_kitchen/items/garden_salad",
  },
  {
    titleKey: "wm_kitchen.guide.topic.effects",
    textKey: "wm_kitchen.guide.text.effects",
    icon: "textures/wm_kitchen/ui/family_heal",
  },
  {
    titleKey: "wm_kitchen.guide.topic.poster",
    textKey: "wm_kitchen.guide.text.poster",
    icon: "textures/wm_kitchen/items/recipe_poster",
  },
  {
    titleKey: "wm_kitchen.guide.topic.unlocking",
    textKey: "wm_kitchen.guide.text.unlocking",
    icon: "textures/wm_kitchen/ui/locked",
  },
  {
    titleKey: "wm_kitchen.guide.topic.lost",
    textKey: "wm_kitchen.guide.text.lost",
    icon: "textures/wm_kitchen/items/guide_book",
  },
];

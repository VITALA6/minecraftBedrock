// The Kitchen Guide's "How to Play" topics, as data. Pure, so tests check them in Node; the guide
// screen (ui/guide-screen.ts) shows one topic per page, with a Next button to the following one.
//
// - Title and text are lang keys in resource/texts/en_US.lang, listed literally: the lang test
//   finds used keys by searching the scripts for "hk.…" strings.
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
    titleKey: "hk.guide.topic.welcome",
    textKey: "hk.guide.text.welcome",
    icon: "textures/hk/items/guide_book",
  },
  {
    titleKey: "hk.guide.topic.loop",
    textKey: "hk.guide.text.loop",
    icon: "textures/hk/items/tomato_soup",
  },
  {
    titleKey: "hk.guide.topic.seeds",
    textKey: "hk.guide.text.seeds",
    icon: "textures/hk/items/tomato_seeds",
  },
  {
    titleKey: "hk.guide.topic.farmland",
    textKey: "hk.guide.text.farmland",
    icon: "textures/hk/items/tomato",
  },
  {
    titleKey: "hk.guide.topic.bushes",
    textKey: "hk.guide.text.bushes",
    icon: "textures/hk/items/strawberry",
  },
  {
    titleKey: "hk.guide.topic.board",
    textKey: "hk.guide.text.board",
    icon: "textures/hk/items/cutting_board",
  },
  {
    titleKey: "hk.guide.topic.mixes",
    textKey: "hk.guide.text.mixes",
    icon: "textures/hk/items/tomato_soup_mix",
  },
  {
    titleKey: "hk.guide.topic.pot",
    textKey: "hk.guide.text.pot",
    icon: "textures/hk/items/cooking_pot",
  },
  {
    titleKey: "hk.guide.topic.cooking",
    textKey: "hk.guide.text.cooking",
    icon: "textures/hk/ui/needs_heat",
  },
  {
    titleKey: "hk.guide.topic.cold",
    textKey: "hk.guide.text.cold",
    icon: "textures/hk/items/garden_salad",
  },
  {
    titleKey: "hk.guide.topic.effects",
    textKey: "hk.guide.text.effects",
    icon: "textures/hk/ui/family_heal",
  },
  {
    titleKey: "hk.guide.topic.poster",
    textKey: "hk.guide.text.poster",
    icon: "textures/hk/items/recipe_poster",
  },
  {
    titleKey: "hk.guide.topic.unlocking",
    textKey: "hk.guide.text.unlocking",
    icon: "textures/hk/ui/locked",
  },
  {
    titleKey: "hk.guide.topic.lost",
    textKey: "hk.guide.text.lost",
    icon: "textures/hk/items/guide_book",
  },
];

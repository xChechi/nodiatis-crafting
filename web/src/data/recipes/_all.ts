// Barrel that merges all per-itemType recipe shards into a single array.
// IMPORTANT: order MUST match the alphabetical sort that build-recipe-index.mjs
// uses, so that recipeIdxByItemName indices line up with this array's order.

import Arrow from "./Arrow.json";
import Bow from "./Bow.json";
import Breastplate from "./Breastplate.json";
import Gem_common from "./Gem_common.json";
import Gem_epic from "./Gem_epic.json";
import Gem_legendary from "./Gem_legendary.json";
import Gem_rare from "./Gem_rare.json";
import Gem_uncommon from "./Gem_uncommon.json";
import Helmet from "./Helmet.json";
import Legging from "./Legging.json";
import Pet from "./Pet.json";
import Potion from "./Potion.json";
import Quiver from "./Quiver.json";
import Shield from "./Shield.json";
import Sleeve from "./Sleeve.json";
import WeapCrush from "./WeapCrush.json";
import WeapCrush2H from "./WeapCrush2H.json";
import WeapPierce from "./WeapPierce.json";
import WeapPierce2H from "./WeapPierce2H.json";
import WeapSlash from "./WeapSlash.json";
import WeapSlash2H from "./WeapSlash2H.json";
import WeapStaff from "./WeapStaff.json";
import WeapWhip from "./WeapWhip.json";

import type { RawRecipe } from "@/lib/types";

// Order MUST match `(await fs.readdir(RECIPES_DIR)).sort()` in
// build-recipe-index.mjs — alphabetical by filename.
export const allRawRecipes: RawRecipe[] = [
  ...Arrow,
  ...Bow,
  ...Breastplate,
  ...Gem_common,
  ...Gem_epic,
  ...Gem_legendary,
  ...Gem_rare,
  ...Gem_uncommon,
  ...Helmet,
  ...Legging,
  ...Pet,
  ...Potion,
  ...Quiver,
  ...Shield,
  ...Sleeve,
  ...WeapCrush,
  ...WeapCrush2H,
  ...WeapPierce,
  ...WeapPierce2H,
  ...WeapSlash,
  ...WeapSlash2H,
  ...WeapStaff,
  ...WeapWhip,
] as RawRecipe[];

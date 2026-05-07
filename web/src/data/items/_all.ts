// Barrel that merges all per-category item shards into a single array.
// Generated to be checked-in but trivially regenerable: list one import per
// `data/items/*.json` shard and concatenate. data.ts consumes the merged array.

import armor from "./armor.json";
import gems from "./gems.json";
import materials from "./materials.json";
import other from "./other.json";
import pets from "./pets.json";
import potions from "./potions.json";
import tools from "./tools.json";
import weapons from "./weapons.json";

import type { RawItem } from "@/lib/types";

export const allRawItems: RawItem[] = [
  ...armor,
  ...gems,
  ...materials,
  ...other,
  ...pets,
  ...potions,
  ...tools,
  ...weapons,
] as RawItem[];

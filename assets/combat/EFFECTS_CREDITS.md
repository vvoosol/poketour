# Move effects

Selected aliases and timing patterns adapted from Pokémon Showdown Move Animations,
Guangcong Luo, file SPDX/author header: CC0-1.0.

Source: https://github.com/smogon/pokemon-showdown-client/blob/0de26d2ef7258e5619057f63b3774240b45cecbd/play.pokemonshowdown.com/src/battle-animations-moves.ts

CC0: https://creativecommons.org/publicdomain/zero/1.0/

Adapted: ember/flamethrower (0/100/200/300 ms, 400 ms travel),
watergun/watersport (0/75/150/225 ms), vinewhip/powerwhip (420 ms impact),
thundershock/electroball (500 ms travel), tackle/slam and scratch/slash aliases.

Changes: converted selected timing/alias descriptions to a small standalone table;
replaced BattleScene, jQuery, sprite and image dependencies with original Canvas2D
primitives and shared interpolation. This is a simplified representation, not the
complete Showdown animation renderer. Other moves use explicitly generic effects.
No Showdown image, audio or AGPL client UI was imported.

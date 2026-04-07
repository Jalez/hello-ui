/**
 * Bump a spot's version when its tour copy or UI meaningfully changes so users see the tour again.
 * Keys are stable identifiers; values are monotonic integers.
 */
export const TOUR_SPOT_VERSIONS = {
  "navbar.game_route_score": 1,
  "navbar.game_route_mobile_game_menu": 1,
  "navbar.game_route_levels": 1,
  "navbar.game_route_lobby": 1,
  "navbar.game_route_finish": 1,
  "navbar.creator_game_menu": 1,
  "navbar.creator_workbench_tools": 1,
  "navbar.creator_levels": 1,
  "creator.workbench_sidebar": 1,
  "creator.level_tools": 1,
  "creator.events": 1,
  "creator.variants": 1,
  "creator.game_tools": 1,
  "footer.help": 1,
  "footer.level_menu": 1,
  "footer.time_menu": 1,
  "footer.info": 1,
  "footer.collaboration": 1,
  "gameboard.events_strip": 2,
  "gameboard.scenario_run_controls": 2,
  "gameboard.artboard_actions": 2,
} as const;

export type TourSpotKey = keyof typeof TOUR_SPOT_VERSIONS;

export function isTourSpotKey(key: string): key is TourSpotKey {
  return key in TOUR_SPOT_VERSIONS;
}

export function getTourSpotVersion(key: TourSpotKey): number {
  return TOUR_SPOT_VERSIONS[key];
}

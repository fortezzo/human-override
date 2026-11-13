// The single list of every third-party asset the game uses.
//
// tools/assets/fetch.mjs downloads these into assets-source/_downloads
// (never committed), the build-*.mjs scripts convert them into the small
// compressed files in public/assets (committed), and build-credits.mjs turns
// this same list into CREDITS.md and the in-game credits screen.
//
// Rule for this file: only CC0 or CC-BY sources (plus the Mixamo skeleton
// and animations, which the project owner downloaded under Adobe's Mixamo
// terms).

/**
 * Surface materials from Poly Haven (CC0).
 *   res - download size, out - pixel size shipped in the game
 */
export const POLYHAVEN_TEXTURES = [
  { id: 'concrete_floor_worn_001', res: '2k', out: 2048, use: 'floors' },
  { id: 'painted_plaster_wall', res: '1k', out: 1024, use: 'upper walls' },
  { id: 'painted_concrete', res: '1k', out: 1024, use: 'painted lower wall band' },
  { id: 'dirty_concrete', res: '1k', out: 1024, use: 'columns and ceiling slab' },
  { id: 'corrugated_iron_02', res: '1k', out: 1024, use: 'ceiling deck' },
  { id: 'metal_plate_02', res: '1k', out: 1024, use: 'steel plate cladding and doors' },
  { id: 'green_metal_rust', res: '1k', out: 1024, use: 'painted metal trim' },
  { id: 'rusty_metal_04', res: '1k', out: 1024, use: 'beams, pipes and brackets' },
  { id: 'metal_plate', res: '1k', out: 1024, use: 'tread plate thresholds' },
];

/** Surface materials and decals from ambientCG (CC0). `decal` keeps the opacity map as alpha. */
export const AMBIENTCG = [
  { id: 'Metal046B', res: '1K', out: 1024, use: 'robot body, dark steel trim and cables' },
  { id: 'PaintedMetal016', res: '1K', out: 1024, use: 'hazard stripes' },
  { id: 'Leaking003', res: '1K', out: 1024, decal: true, use: 'wall leak stains (decal)' },
  { id: 'Leaking004', res: '1K', out: 1024, decal: true, use: 'wall leak stains (decal)' },
  { id: 'RoadLines022A', res: '1K', out: 1024, decal: true, use: 'painted floor hazard zone (decal)' },
];

/** Night sky from Poly Haven (CC0), seen through the breach and windows. */
export const POLYHAVEN_HDRIS = [{ id: 'moonless_golf', res: '1k', use: 'night sky outside the facility' }];

/**
 * Props from Poly Haven (CC0).
 *   tex    - texture size in pixels after conversion
 *   tris   - triangle budget for the whole file after simplification
 *   keep   - only keep nodes whose name matches (drops unwanted variants)
 *   kit    - a modular kit: every piece is kept as its own node at the origin
 *   groups - bundle several nodes into one named prop, re-centred on `origin`
 */
export const POLYHAVEN_MODELS = [
  // Structure
  { id: 'rollershutter_door', tex: 1024, keep: /^rollershutter_door$/ },
  { id: 'rollershutter_window_01', tex: 1024, keep: /^rollershutter_window_01$/ },
  { id: 'modular_airduct_rectangular_01', tex: 1024, tris: 9000, kit: true, keep: /(single_01|double_01|corner_01|bend_01|vent_01|vent_02|connector_01|half_01)$/ },
  { id: 'modular_industrial_pipes_01', tex: 1024, tris: 7000, kit: true },
  { id: 'utility_box_01', tex: 512, tris: 1500 },
  { id: 'utility_box_02', tex: 512, tris: 2000 },
  { id: 'power_box_01', tex: 512, tris: 4000 },
  { id: 'fire_alarm', tex: 256, tris: 600 },
  { id: 'korean_fire_extinguisher_01', tex: 512, tris: 2500 },
  { id: 'security_camera_01', tex: 512, tris: 3000 },
  // Lighting fixtures
  { id: 'hanging_industrial_lamp', tex: 512, tris: 2600 },
  { id: 'caged_hanging_light', tex: 512, tris: 5000 },
  { id: 'industrial_wall_lamp', tex: 512, tris: 1800 },
  { id: 'mounted_fluorescent_lights', tex: 512, tris: 2400, kit: true, keep: /_(d|b)$/ },
  {
    id: 'flood_lights',
    tex: 512,
    tris: 7000,
    groups: [
      { name: 'standing', match: /^flood_lights_standing_double_a_/, origin: 'flood_lights_standing_double_a_stand' },
      { name: 'floor', match: /^flood_lights_floor_double_a_/, origin: 'flood_lights_floor_double_a_bar' },
    ],
  },
  { id: 'portable_searchlight', tex: 512, tris: 3000 },
  { id: 'desk_lamp_arm_01', tex: 256, tris: 3000 },
  // Containers and clutter
  { id: 'Barrel_01', tex: 512 },
  { id: 'barrel_03', tex: 512 },
  { id: 'wooden_military_crate', tex: 512, tris: 3000 },
  { id: 'ammo_box', tex: 512, tris: 1500 },
  { id: 'cardboard_box_01', tex: 512, tris: 1500 },
  { id: 'metal_trash_can', tex: 512, tris: 2500, keep: /^metal_trash_can_rust/, groups: [{ name: 'can', match: /^metal_trash_can_rust/, origin: 'metal_trash_can_rust' }] },
  { id: 'concrete_road_barrier', tex: 512, tris: 1800 },
  { id: 'WetFloorSign_01', tex: 256 },
  { id: 'medical_box', tex: 256, tris: 1200 },
  { id: 'clipboard', tex: 256, tris: 800 },
  // Furniture and equipment
  { id: 'metal_office_desk', tex: 512, tris: 3000 },
  { id: 'metal_tool_chest', tex: 512, tris: 3500 },
  { id: 'industrial_storage_cart', tex: 512, tris: 4000 },
  { id: 'hand_truck', tex: 512, tris: 3500 },
  { id: 'worn_metal_rack', tex: 512, tris: 2500 },
  { id: 'steel_frame_shelves_03', tex: 512, tris: 3000 },
  { id: 'television_02', tex: 512 },
  { id: 'classic_laptop', tex: 512, tris: 3000 },
  { id: 'metal_stool_02', tex: 256, tris: 1800 },
  { id: 'SchoolChair_01', tex: 256, tris: 1800 },
];

/** Sound packs from Kenney (CC0). `slug` is the page name on kenney.nl. */
export const KENNEY = [
  { slug: 'impact-sounds', title: 'Impact Sounds' },
  { slug: 'sci-fi-sounds', title: 'Sci-Fi Sounds' },
  { slug: 'interface-sounds', title: 'Interface Sounds' },
];

/**
 * Sounds and music from OpenGameArt. Each entry was checked by hand on its
 * page: only CC0 or CC-BY licenses are listed here.
 */
export const OPENGAMEART = [
  {
    key: 'firearm-library',
    title: 'The Free Firearm Sound Library',
    author: 'Still North Media (posted by bart)',
    license: 'CC0',
    page: 'https://opengameart.org/content/the-free-firearm-sound-library',
    files: ['Prepared SFX Library.7z'],
  },
  {
    key: 'gun-reload-sounds',
    title: 'Gun reload sounds',
    author: 'SpringySpringo',
    license: 'CC0',
    page: 'https://opengameart.org/content/gun-reload-sounds',
    files: ['gunreload1.wav', 'assaultriflereload1_0.wav', 'shotguncock_0.wav'],
  },
  {
    key: 'equipment-clicks-ii',
    title: 'Equipment Clicks II',
    author: 'LFA',
    license: 'CC0',
    page: 'https://opengameart.org/content/equipment-clicks-ii',
    files: ['equipmentclicks.wav'],
  },
  {
    key: 'metal-impact-sounds',
    title: 'Metal Impact Sounds',
    author: 'BMacZero',
    license: 'CC0',
    page: 'https://opengameart.org/content/metal-impact-sounds',
    files: 'all',
  },
  {
    key: 'breaking-falling-hit',
    title: '75 CC0 breaking / falling / hit sfx',
    author: 'rubberduck',
    license: 'CC0',
    page: 'https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx',
    files: 'all',
  },
  {
    key: 'wood-and-metal-vol2',
    title: 'Wood and Metal Sound Effects: Volume 2',
    author: 'Ogrebane',
    license: 'CC0',
    page: 'https://opengameart.org/content/wood-and-metal-sound-effects-volume-2',
    files: 'all',
  },
  {
    key: 'robotic-steps',
    title: 'Robotic mechanic step sounds',
    author: 'Michel Baradari (posted by qubodup)',
    license: 'CC-BY 3.0',
    page: 'https://opengameart.org/content/robotic-mechanic-step-sounds',
    files: 'all',
  },
  {
    key: 'scifi-sfx-library',
    title: 'Sci-Fi Sound Effects Library',
    author: 'Little Robot Sound Factory',
    license: 'CC-BY 3.0',
    page: 'https://opengameart.org/content/sci-fi-sound-effects-library',
    files: 'all',
  },
  {
    key: 'factory-ambiance',
    title: 'Factory ambiance',
    author: 'yd',
    license: 'CC0',
    page: 'https://opengameart.org/content/factory-ambiance',
    files: 'all',
  },
  {
    key: 'dark-ambiences',
    title: 'Dark Ambiences',
    author: 'Ogrebane',
    license: 'CC0',
    page: 'https://opengameart.org/content/dark-ambiences',
    files: 'all',
  },
  {
    key: 'horror-atmosphere',
    title: 'Horror Atmosphere (Post Apocalyptic Wastelands)',
    author: 'Juhani Junkala (SubspaceAudio)',
    license: 'CC0',
    page: 'https://opengameart.org/content/horror-atmosphere',
    files: 'all',
  },
  {
    key: 'when-the-shadows-gather',
    title: 'When the Shadows Gather',
    author: 'Tsorthan Grove',
    license: 'CC0',
    page: 'https://opengameart.org/content/when-the-shadows-gather',
    files: ['when_the_shadows_gather_0.ogg'],
  },
];

/**
 * Gun models from Sketchfab (CC-BY 4.0), downloaded by the project owner.
 * The page links are the owner's own, from assets-source/guns/links.txt;
 * tools/check-credits.mjs fails if the two ever disagree.
 * `shipped` marks the ones that are converted and included in the game so far.
 */
export const SKETCHFAB = [
  {
    key: 'rifle',
    shipped: true,
    changes: 'Changes: re-centred and scaled; its folding sight removed and replaced with a reflex sight made for the game; textures re-packed and compressed; paint lightened in the game.',
    title: 'Sci-Fi Rifle',
    author: 'Slayver',
    license: 'CC-BY 4.0',
    page: 'https://sketchfab.com/3d-models/sci-fi-rifle-a78881c37ceb4303814279c0807f2f0f',
    zip: 'sci-fi-rifle.zip',
  },
  {
    key: 'pistol',
    title: 'Sci-fi Pistol [PBR]',
    author: 'StarGames studio',
    license: 'CC-BY 4.0',
    page: 'https://sketchfab.com/3d-models/sci-fi-pistol-pbr-4e05d6bd3b2f4854b7c999e8fc9ebe51',
    zip: 'sci-fi-pistol-pbr.zip',
  },
  {
    key: 'shotgun',
    title: 'Sci-fi Super Shotgun',
    author: 'tnnv',
    license: 'CC-BY 4.0',
    page: 'https://sketchfab.com/3d-models/sci-fi-super-shotgun-5929e6949d1e421e927116e117248f07',
    zip: 'sci-fi-super-shotgun.zip',
  },
  {
    key: 'prototype',
    title: 'arma sci-fi/sci-fi weapon',
    author: 'LoonaUwU (semoi0055)',
    license: 'CC-BY 4.0',
    page: 'https://sketchfab.com/3d-models/arma-sci-fisci-fi-weapon-7a983d742dc94505ae399826136f1e62',
    zip: 'arma-sci-fisci-fi-weapon.zip',
  },
];

/** Interface fonts (SIL Open Font License 1.1), self-hosted. */
export const FONTS = [
  {
    family: 'Barlow Condensed',
    author: 'Jeremy Tribby',
    license: 'OFL 1.1',
    page: 'https://fonts.google.com/specimen/Barlow+Condensed',
    weights: [500, 600, 700],
  },
  {
    family: 'Share Tech Mono',
    author: 'Carrois Apostrophe',
    license: 'OFL 1.1',
    page: 'https://fonts.google.com/specimen/Share+Tech+Mono',
    weights: [400],
  },
];

export const DOWNLOAD_DIR = 'assets-source/_downloads';
export const USER_AGENT = 'asset-fetch-script/1.0';

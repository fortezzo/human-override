// What the game downloads before it starts. Paths are relative to
// public/assets. Every file here has an entry in CREDITS.md.

/** Tiling PBR surfaces: <id>_color / _normal / _orm .webp */
export const SURFACES = [
  'concrete_floor_worn_001',
  'preconcrete_wall_001',
  'painted_concrete',
  'dirty_concrete',
  'corrugated_iron_02',
  'metal_plate_02',
  'green_metal_rust',
  'rusty_metal_04',
  'metal_plate',
  'Metal046B',
  'PaintedMetal016',
] as const;

/** Decals: a single color+alpha image each. */
export const DECALS = ['Leaking003', 'Leaking004', 'RoadLines022A'] as const;

/** Props: models/props/<id>.glb */
export const PROPS = [
  'rollershutter_door',
  'rollershutter_window_01',
  'modular_airduct_rectangular_01',
  'modular_industrial_pipes_01',
  'utility_box_01',
  'utility_box_02',
  'power_box_01',
  'fire_alarm',
  'korean_fire_extinguisher_01',
  'security_camera_01',
  'hanging_industrial_lamp',
  'caged_hanging_light',
  'industrial_wall_lamp',
  'mounted_fluorescent_lights',
  'flood_lights',
  'portable_searchlight',
  'desk_lamp_arm_01',
  'Barrel_01',
  'barrel_03',
  'wooden_military_crate',
  'ammo_box',
  'cardboard_box_01',
  'metal_trash_can',
  'concrete_road_barrier',
  'WetFloorSign_01',
  'medical_box',
  'clipboard',
  'metal_office_desk',
  'metal_tool_chest',
  'industrial_storage_cart',
  'hand_truck',
  'worn_metal_rack',
  'steel_frame_shelves_03',
  'television_02',
  'classic_laptop',
  'metal_stool_02',
  'SchoolChair_01',
] as const;

export const MODELS = {
  robot: 'models/robot.glb',
  rifle: 'models/rifle.glb',
} as const;

export const SKY = 'env/night_sky.webp';

export type SurfaceId = (typeof SURFACES)[number];
export type DecalId = (typeof DECALS)[number];
export type PropId = (typeof PROPS)[number];
export type ModelId = keyof typeof MODELS;

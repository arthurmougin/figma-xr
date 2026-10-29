export interface Point {
  x: number;
  y: number;
}
export interface Rect extends Point {
  width: number;
  height: number;
}
export interface CatalogItem {
  id: string;
  name: string;
  pageId: string;
  version: number;
  image: string;
  width: number;
  height: number;
  updatedAt: number;
}
export interface ViewportItem {
  id: string;
  bounds: Rect;
  z: number;
  version: number;
}
export interface ViewportSnapshot {
  revision: number;
  pageId: string;
  bounds: Rect;
  zoom: number;
  pixelWidth: number;
  pixelHeight: number;
  image: string;
  layoutKey: string;
  items: ViewportItem[];
}
export interface MatchPoint {
  id: number;
  reference: Point;
  image: Point;
}
export interface MatchResult {
  revision: number;
  homography: number[];
  points: MatchPoint[];
  inliers: number;
  error: number;
  coverage: number;
}
export type Vec3 = [number, number, number];
export interface Ray {
  origin: Vec3;
  direction: Vec3;
}
export interface CameraFrame {
  width: number;
  height: number;
  projection: number[];
  cameraWorld: number[];
}
export interface ScreenPlane {
  origin: Vec3;
  axisU: Vec3;
  axisV: Vec3;
  normal: Vec3;
  residual: number;
}

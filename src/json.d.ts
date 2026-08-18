declare module "*.json" {
  const value: { pairs: import("./types.ts").PairSource[] };
  export default value;
}

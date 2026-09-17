let cache = null;
let updatedAt = 0;
export const dashboardCache = {
  get() { return cache && Date.now() - updatedAt < 300000 ? cache : null; },
  set(value) { cache = value; updatedAt = Date.now(); return value; },
  invalidate() { cache = null; updatedAt = 0; },
};

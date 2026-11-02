/** Very rough continent outlines as [lon, lat]. Only ever drawn as a coarse dot grid. */
const CONTINENTS: [number, number][][] = [
  // North America
  [[-165,65],[-155,71],[-125,70],[-95,73],[-80,70],[-62,58],[-55,50],[-65,44],[-75,38],[-81,30],[-82,25],[-90,29],[-97,26],[-96,19],[-88,16],[-83,9],[-78,8],[-90,14],[-105,20],[-115,31],[-124,40],[-125,49],[-135,58],[-150,60],[-165,55]],
  // Greenland
  [[-55,60],[-40,60],[-22,70],[-20,81],[-60,82],[-70,76]],
  // South America
  [[-78,8],[-62,10],[-50,1],[-35,-6],[-38,-18],[-48,-27],[-58,-38],[-66,-52],[-74,-52],[-72,-30],[-80,-6]],
  // Europe and Asia
  [[-10,37],[-9,44],[0,50],[8,54],[5,60],[15,69],[30,71],[60,72],[100,77],[140,73],[180,68],[170,60],[155,58],[142,50],[135,43],[127,38],[122,30],[118,24],[108,20],[106,10],[100,4],[100,14],[92,21],[80,14],[77,8],[72,20],[60,25],[52,18],[44,13],[36,30],[28,36],[22,37],[14,42],[4,42]],
  // Africa
  [[-16,14],[-16,28],[-6,35],[10,37],[32,31],[37,20],[44,11],[51,11],[40,-4],[40,-16],[33,-26],[20,-35],[14,-22],[12,-5],[8,4],[-8,5]],
  // Madagascar
  [[44,-16],[49,-13],[50,-18],[46,-25],[44,-22]],
  // Indonesia and the Philippines
  [[96,5],[105,-5],[114,-8],[120,-9],[118,-3],[110,1],[104,3]],
  [[109,1],[117,7],[119,1],[116,-3]],
  [[120,18],[122,18],[126,8],[125,6],[121,8],[120,12]],
  [[130,-1],[141,-3],[150,-9],[141,-9],[132,-4]],
  // Japan
  [[131,32],[136,34],[141,37],[142,44],[140,41],[136,36]],
  // Australia
  [[114,-22],[122,-18],[131,-12],[137,-15],[142,-11],[146,-19],[153,-27],[150,-37],[140,-38],[130,-32],[116,-34]],
  // New Zealand
  [[172,-35],[178,-38],[174,-42],[167,-46]],
  // UK and Iceland
  [[-6,50],[1,51],[-2,58],[-6,58]],
  [[-24,64],[-14,64],[-14,66],[-22,66]],
];

function inside(lon: number, lat: number, polygon: [number, number][]) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      hit = !hit;
    }
  }
  return hit;
}

/** Land dots on an even lon/lat grid. */
export function landDots(step: number) {
  const dots: [number, number][] = [];
  for (let lat = -56; lat <= 80; lat += step) {
    for (let lon = -170; lon <= 180; lon += step) {
      if (CONTINENTS.some((polygon) => inside(lon, lat, polygon))) dots.push([lon, lat]);
    }
  }
  return dots;
}

/** Project to a 0..1 box using plain equirectangular coordinates. */
export function mapPoint(lon: number, lat: number): [number, number] {
  return [(lon + 170) / 350, (80 - lat) / 136];
}

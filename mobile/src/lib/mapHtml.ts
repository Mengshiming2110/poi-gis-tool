export const MAP_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  *{margin:0;padding:0} html,body,#map{width:100%;height:100%}
</style>
</head>
<body>
<div id="map"></div>
<script>
window._AMapSecurityConfig = { securityJsCode: '8d13a7d3f6ecff69f02dc1dea5855b0a' };
</script>
<script src="https://webapi.amap.com/maps?v=2.0&key=35f0e1144644fbfba405c109db466cdc&plugin=AMap.MouseTool,AMap.Geolocation,AMap.Scale,AMap.ToolBar"></script>
<script>
var map, mouseTool, drawnShape = null, gridOverlays = [];

function sendMsg(type, data) {
  window.ReactNativeWebView.postMessage(JSON.stringify({type, data}));
}

function init() {
  map = new AMap.Map('map', {
    zoom: 13, center: [113.7634, 23.0438],
    viewMode: '2D', resizeEnable: true,
    touchZoom: true, dragEnable: true,
  });
  map.addControl(new AMap.Scale({position:'LB'}));
  map.addControl(new AMap.ToolBar({position:'RT'}));

  mouseTool = new AMap.MouseTool(map);
  mouseTool.on('draw', function(e) {
    var obj = e.obj;
    if (drawnShape && drawnShape.overlay) map.remove(drawnShape.overlay);
    clearGrid();
    if (obj instanceof AMap.Polygon) {
      drawnShape = {type:'polygon', overlay:obj, path: obj.getPath().map(function(p){return [p.lng,p.lat]})};
    } else if (obj instanceof AMap.Rectangle) {
      var b = obj.getBounds();
      drawnShape = {type:'rectangle', overlay:obj, bounds:[[b.getSW().lng,b.getSW().lat],[b.getNE().lng,b.getNE().lat]]};
    } else if (obj instanceof AMap.Circle) {
      var c = obj.getCenter();
      drawnShape = {type:'circle', overlay:obj, center:[c.lng,c.lat], radius:obj.getRadius()};
    }
    mouseTool.close(true);
    sendMsg('drawComplete', drawnShape);
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function(p) {
      map.setZoomAndCenter(15, [p.coords.longitude, p.coords.latitude]);
    }, function(){}, {timeout:5000});
  }

  sendMsg('mapReady', {});
}

function setDrawMode(mode) {
  mouseTool.close(true);
  var s = {strokeWeight:3,strokeOpacity:0.8,fillOpacity:0.15,strokeStyle:'dashed'};
  if (mode==='polygon') mouseTool.polygon({...s,strokeColor:'#4A90D9',fillColor:'#4A90D9'});
  else if (mode==='rectangle') mouseTool.rectangle({...s,strokeColor:'#27AE60',fillColor:'#27AE60'});
  else if (mode==='circle') mouseTool.circle({...s,strokeColor:'#F39C12',fillColor:'#F39C12'});
}

function clearDraw() {
  if (drawnShape && drawnShape.overlay) map.remove(drawnShape.overlay);
  drawnShape = null; clearGrid();
  sendMsg('cleared', {});
}

function clearGrid() {
  gridOverlays.forEach(function(o){ map.remove(o); });
  gridOverlays = [];
}

function splitGrid(meters) {
  if (!drawnShape) return;
  clearGrid();
  var bounds;
  if (drawnShape.type === 'polygon') {
    var lngs = drawnShape.path.map(function(p){return p[0]});
    var lats = drawnShape.path.map(function(p){return p[1]});
    bounds = [[Math.min.apply(null,lngs),Math.min.apply(null,lats)],[Math.max.apply(null,lngs),Math.max.apply(null,lats)]];
  } else if (drawnShape.type === 'rectangle') {
    bounds = drawnShape.bounds;
  } else {
    var clng = drawnShape.center[0], clat = drawnShape.center[1], r = drawnShape.radius;
    var d = r/111320;
    bounds = [[clng-d,clat-d],[clng+d,clat+d]];
  }
  var latStep = meters/111320;
  var midLat = (bounds[0][1]+bounds[1][1])/2;
  var lngStep = meters/(111320*Math.cos(midLat*Math.PI/180));
  var count = 0;
  var cells = [];
  for (var lat=bounds[0][1]; lat<bounds[1][1]; lat+=latStep) {
    for (var lng=bounds[0][0]; lng<bounds[1][0]; lng+=lngStep) {
      var sw = [lng, lat], ne = [Math.min(lng+lngStep,bounds[1][0]), Math.min(lat+latStep,bounds[1][1])];
      var rect = new AMap.Rectangle({
        bounds: new AMap.Bounds(new AMap.LngLat(sw[0],sw[1]), new AMap.LngLat(ne[0],ne[1])),
        strokeColor:'#888',strokeWeight:1,strokeOpacity:0.5,fillColor:'#4A90D9',fillOpacity:0.06
      });
      rect.setMap(map);
      gridOverlays.push(rect);
      cells.push({sw:sw, ne:ne, center:[(sw[0]+ne[0])/2,(sw[1]+ne[1])/2]});
      count++;
    }
  }
  sendMsg('gridSplit', {count:count, cells:cells});
}

init();
</script>
</body>
</html>
`;

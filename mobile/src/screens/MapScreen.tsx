import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { getTasks, getPois, subscribeToTask } from '../lib/supabase';
import { MAP_HTML } from '../lib/mapHtml';

const CATEGORIES = [
  { code: '050000', name: '餐饮', color: '#EF4444' },
  { code: '060000', name: '购物', color: '#F97316' },
  { code: '070000', name: '生活服务', color: '#EAB308' },
  { code: '080000', name: '医疗', color: '#EF4444' },
  { code: '100000', name: '酒店', color: '#8B5CF6' },
  { code: '110000', name: '景点', color: '#22C55E' },
  { code: '140000', name: '交通', color: '#3B82F6' },
  { code: '150000', name: '教育', color: '#EC4899' },
];

export default function MapScreen() {
  const webRef = useRef<WebView>(null);
  const [drawMode, setDrawMode] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [gridSize, setGridSize] = useState('500');
  const [cells, setCells] = useState<any[]>([]);
  const [pois, setPois] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [showData, setShowData] = useState(false);

  const post = (msg: object) => webRef.current?.postMessage(JSON.stringify(msg));

  const handleMapMsg = useCallback((e: any) => {
    const m = JSON.parse(e.nativeEvent.data);
    if (m.type === 'mapReady') onMapReady();
    else if (m.type === 'gridSplit') setCells(m.data.cells || []);
    else if (m.type === 'drawComplete') setDrawMode(null);
  }, []);

  const onMapReady = () => {
    // Load tasks from Supabase
    getTasks().then(setTasks);
  };

  const toggleCat = (code: string) => {
    setSelected(s => s.includes(code) ? s.filter(c => c !== code) : [...s, code]);
  };

  const selectDrawMode = (mode: string) => {
    if (drawMode === mode) { setDrawMode(null); post({ action: 'setDrawMode', mode: null }); }
    else { setDrawMode(mode); post({ action: 'setDrawMode', mode }); }
  };

  const clearDraw = () => {
    post({ action: 'clearDraw' });
    setDrawMode(null);
    setCells([]);
  };

  const splitGrid = () => {
    post({ action: 'splitGrid', meters: parseInt(gridSize) || 500 });
  };

  const loadPois = async (taskId: string) => {
    const data = await getPois(taskId);
    setPois(data);
    setShowData(true);
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webRef}
        source={{ html: MAP_HTML }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={handleMapMsg}
        style={styles.map}
      />

      {/* Draw toolbar */}
      <View style={styles.toolbar}>
        {['polygon','rectangle','circle'].map(m => (
          <TouchableOpacity key={m} style={[styles.toolBtn, drawMode===m&&styles.toolBtnActive]} onPress={()=>selectDrawMode(m)}>
            <Text style={[styles.toolBtnText, drawMode===m&&styles.toolBtnTextActive]}>{m==='polygon'?'⬠':m==='rectangle'?'▭':'◯'}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.toolBtn,{borderColor:'#ef4444'}]} onPress={clearDraw}>
          <Text style={{color:'#ef4444',fontSize:16}}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Control panel */}
      <ScrollView style={styles.panel}>
        <Text style={styles.title}>POI 类别</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map(c => (
            <TouchableOpacity key={c.code} onPress={()=>toggleCat(c.code)}
              style={[styles.chip, selected.includes(c.code)&&{backgroundColor:c.color}]}>
              <Text style={[styles.chipText, selected.includes(c.code)&&{color:'#fff'}]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.title}>网格切分</Text>
        <View style={styles.row}>
          <TextInput style={styles.input} value={gridSize} onChangeText={setGridSize} keyboardType="numeric" />
          <Text style={styles.label}>米</Text>
          <TouchableOpacity style={styles.btn} onPress={splitGrid}><Text style={styles.btnText}>切分</Text></TouchableOpacity>
        </View>
        {cells.length > 0 && <Text style={styles.hint}>{cells.length} 个网格单元</Text>}

        {/* Tasks from Supabase */}
        <Text style={styles.title}>采集任务</Text>
        {tasks.slice(0,5).map((t: any) => (
          <TouchableOpacity key={t.id} style={styles.taskRow} onPress={()=>loadPois(t.id)}>
            <Text style={styles.taskText}>{t.status} | {t.total_cells}格/{t.total_pois}POI</Text>
            <Text style={styles.taskDate}>{new Date(t.created_at).toLocaleString()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* POI data sheet */}
      {showData && (
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>POI 数据 ({pois.length})</Text>
            <TouchableOpacity onPress={()=>setShowData(false)}><Text style={{fontSize:18}}>✕</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {pois.slice(0,50).map((p:any,i:number)=>(
              <View key={i} style={styles.poiRow}>
                <Text style={styles.poiName}>{p.name}</Text>
                <Text style={styles.poiCat}>{p.category}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  toolbar: { position:'absolute', top:10, right:10, flexDirection:'row', gap:6, backgroundColor:'rgba(255,255,255,0.9)', borderRadius:8, padding:4 },
  toolBtn: { width:36, height:36, justifyContent:'center', alignItems:'center', borderRadius:6, borderWidth:1.5, borderColor:'#e2e8f0' },
  toolBtnActive: { backgroundColor:'#3b82f6', borderColor:'#3b82f6' },
  toolBtnText: { fontSize:16, color:'#475569' },
  toolBtnTextActive: { color:'#fff' },
  panel: { position:'absolute', bottom:0, left:0, right:0, maxHeight:'40%', backgroundColor:'rgba(255,255,255,0.95)', borderTopLeftRadius:12, borderTopRightRadius:12, padding:12 },
  title: { fontSize:13, fontWeight:'700', marginTop:8, marginBottom:4 },
  chipRow: { flexDirection:'row', flexWrap:'wrap', gap:6 },
  chip: { paddingHorizontal:12, paddingVertical:6, borderRadius:16, borderWidth:1, borderColor:'#e2e8f0', backgroundColor:'#fff' },
  chipText: { fontSize:12, color:'#475569' },
  row: { flexDirection:'row', alignItems:'center', gap:8 },
  input: { width:80, borderWidth:1, borderColor:'#e2e8f0', borderRadius:6, padding:6, textAlign:'center', fontSize:14 },
  label: { fontSize:12, color:'#94a3b8' },
  btn: { backgroundColor:'#3b82f6', paddingHorizontal:16, paddingVertical:8, borderRadius:6 },
  btnText: { color:'#fff', fontSize:13, fontWeight:'600' },
  hint: { fontSize:11, color:'#94a3b8', marginTop:4 },
  taskRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:6, borderBottomWidth:1, borderBottomColor:'#f1f5f9' },
  taskText: { fontSize:12, color:'#475569' },
  taskDate: { fontSize:10, color:'#94a3b8' },
  sheet: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor:'#fff', zIndex:100 },
  sheetHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, borderBottomWidth:1, borderBottomColor:'#e2e8f0' },
  sheetTitle: { fontSize:16, fontWeight:'700' },
  poiRow: { padding:12, borderBottomWidth:1, borderBottomColor:'#f1f5f9' },
  poiName: { fontSize:14, fontWeight:'500' },
  poiCat: { fontSize:11, color:'#94a3b8', marginTop:2 },
});

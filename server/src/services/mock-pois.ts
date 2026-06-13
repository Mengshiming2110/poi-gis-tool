// Mock POI generator for debug/testing — no API calls needed

const CATEGORIES: { code: string; names: string[] }[] = [
  { code: '050000', names: ['川西坝子火锅', '蜀九香', '小龙坎老火锅', '大龙燚', '海底捞', '老码头火锅', '巴蜀大将', '谭鸭血', '吼堂老火锅', '锦城印象'] },
  { code: '060000', names: ['红旗连锁', '舞东风', '全家便利店', '屈臣氏', '伊藤洋华堂', '王府井百货', '万象城', '来福士', '银泰城', '凯德广场'] },
  { code: '070000', names: ['U＋美容美发', '郑远元修脚', '快剪', '洁丰干洗', '顺丰快递站', '菜鸟驿站', '链家地产', '伊诚地产', '58到家', '天鹅到家'] },
  { code: '100000', names: ['锦江宾馆', '希尔顿酒店', '洲际酒店', '全季酒店', '如家快捷', '汉庭酒店', '亚朵酒店', '丽思卡尔顿', '万豪酒店', '凯宾斯基'] },
  { code: '110000', names: ['宽窄巷子', '锦里古街', '武侯祠', '杜甫草堂', '青城山', '都江堰', '大熊猫基地', '金沙遗址', '文殊院', '青羊宫'] },
  { code: '080000', names: ['华西医院', '省人民医院', '市一医院', '成飞医院', '爱尔眼科', '极光口腔', '美年大健康', '瑞慈体检', '同仁堂', '德仁堂'] },
];

const ADDRESSES = [
  '天府大道北段{}号', '红星路{}段{}号', '人民南路{}段{}号', '蜀都大道{}号',
  '一环路{}段{}号', '二环路{}段{}号', '科华北路{}号', '建设路{}号', '春熙路{}号',
  '锦华路{}段{}号', '光华大道{}号', '益州大道{}段{}号',
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number): number { return Math.random() * (max - min) + min; }
function randInt(min: number, max: number): number { return Math.floor(rand(min, max + 1)); }
function phone(): string {
  const prefix = pick(['138', '139', '158', '182', '186', '189']);
  return `${prefix}${String(randInt(0, 99999999)).padStart(8, '0')}`;
}

export function generateMockPois(
  centerLng: number,
  centerLat: number,
  categoryCode: string,
  count: number = 15,
): Array<{
  name: string; type: string; typecode: string; address: string;
  location: string; pname: string; cityname: string; adname: string;
  tel?: string; biz_ext?: { rating?: string };
}> {
  // Spread POIs around the center with some random offset
  const cat = CATEGORIES.find(c => c.code === categoryCode) || CATEGORIES[0];
  const actual = Math.min(count, 25); // simulate API page size limit
  const pois: any[] = [];

  const districts = ['锦江区', '武侯区', '青羊区', '金牛区', '成华区', '高新区'];

  for (let i = 0; i < actual; i++) {
    const name = pick(cat.names);
    const lng = centerLng + rand(-0.008, 0.008);
    const lat = centerLat + rand(-0.006, 0.006);
    const addr = pick(ADDRESSES).replace('{}', String(randInt(1, 200))).replace('{}', String(randInt(1, 200)));

    pois.push({
      name: `${name}${i > 0 ? `(${pick(['旗舰店','分店','总店',''])}${pick(['','二店','三店'])}` : ''}`.replace(/\(\)/g, '').trim(),
      type: `餐饮服务;${name};`,
      typecode: categoryCode,
      address: `四川省成都市${pick(districts)}${addr}`,
      location: `${lng.toFixed(6)},${lat.toFixed(6)}`,
      pname: '四川省',
      cityname: '成都市',
      adname: pick(districts),
      tel: Math.random() > 0.3 ? phone() : undefined,
      biz_ext: Math.random() > 0.5 ? { rating: (3.5 + rand(0, 1.5)).toFixed(1) } : undefined,
    });
  }

  return pois;
}

export function mockAmapResponse(centerLng: number, centerLat: number, categoryCode: string, totalCount?: number) {
  const pois = generateMockPois(centerLng, centerLat, categoryCode, totalCount || randInt(8, 25));
  return {
    status: '1',
    count: String(pois.length),
    info: 'OK',
    infocode: '10000',
    pois,
  };
}

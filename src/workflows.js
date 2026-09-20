import {
  Boxes,
  FileImage,
  Globe2,
  Image,
  LayoutTemplate,
  Palette,
  ScanFace,
  Sparkles,
  Video,
} from 'lucide-react'

export const SIZE_OPTIONS = [
  { value: '1024x1024', ratio: '1:1', label: '正方形' },
  { value: '720x1280', ratio: '9:16', label: '竖版' },
  { value: '1280x720', ratio: '16:9', label: '横版' },
  { value: '832x1248', ratio: '2:3', label: '竖幅' },
  { value: '1248x832', ratio: '3:2', label: '横幅' },
]

export const WORKFLOWS = [
  { id: 'base', label: '商品底图', icon: Image, enabled: true },
  { id: 'detail', label: '商品详情页', icon: LayoutTemplate, enabled: true },
  { id: 'overseas', label: '海外电商', icon: Globe2, enabled: true },
  { id: 'poster', label: '设计海报', icon: Palette, enabled: true, badge: 'NEW' },
  { id: 'fun', label: '趣味玩法', icon: Sparkles, enabled: true, badge: 'NEW' },
  { id: 'viral', label: '爆款 IP 分析', icon: ScanFace, enabled: false, badge: '待接口' },
  { id: 'video', label: '爆款视频', icon: Video, enabled: false, badge: '待接口' },
  { id: 'ppt', label: 'AI PPT', icon: FileImage, enabled: false, badge: '待接口' },
  { id: 'digital', label: '数字人', icon: Boxes, enabled: false, badge: '待接口' },
]

export const SCENES = [
  { id: 'home', label: '居家生活', note: '北欧温馨', prompt: '北欧风温馨家居生活场景，自然窗光，高级但真实' },
  { id: 'outdoor', label: '户外街拍', note: '自然环境', prompt: '现代城市户外街拍场景，自然日光，真实生活感' },
  { id: 'desk', label: '办公桌面', note: '工作场景', prompt: '简洁高级的现代办公桌面，柔和侧光，秩序感' },
  { id: 'minimal', label: '极简纯色', note: '高级棚拍', prompt: '极简纯色摄影棚背景，商业级柔光，精致阴影' },
  { id: 'festival', label: '节日营销', note: '促销氛围', prompt: '精致节日营销氛围，层次丰富的装饰，保留文案留白' },
  { id: 'cyber', label: '科技赛博', note: '深色霓虹', prompt: '高级深色赛博科技场景，蓝紫霓虹边缘光，干净光效' },
  { id: 'nature', label: '自然质感', note: '木纹/绿植', prompt: '自然木纹与绿植元素，清新日光，有呼吸感的构图' },
  { id: 'studio', label: '专业棚拍', note: '电商主图', prompt: '专业电商棚拍，浅色无缝背景，大型柔光箱，细节清晰' },
  { id: 'cafe', label: '咖啡馆桌', note: '下午茶氛围', prompt: '温暖咖啡馆桌面，下午茶氛围，浅景深与窗边光' },
  { id: 'kitchen', label: '厨房料理', note: '美食场景', prompt: '现代明亮厨房料理场景，干净台面，自然食物摄影光' },
  { id: 'bathroom', label: '浴室个护', note: '清新水珠', prompt: '高级浴室个护场景，透明水珠，白色石材与柔光' },
  { id: 'retro', label: '复古杂志', note: '胶片质感', prompt: '复古编辑杂志摄影，胶片颗粒，克制而有态度的配色' },
]

export const DETAIL_MODULES = [
  { id: 'hero', label: '首屏主视觉', note: '卖点 + 产品', prompt: '电商详情页首屏主视觉，产品为唯一主体，留出标题和卖点的干净排版空间' },
  { id: 'feature', label: '核心卖点', note: '功能可视化', prompt: '电商详情页核心卖点模块，用可视化光效表现产品功能，专业高级' },
  { id: 'closeup', label: '材质细节', note: '质感特写', prompt: '微距产品材质细节特写，突出工艺、质感与真实触感' },
  { id: 'lifestyle', label: '使用场景', note: '真实代入', prompt: '真实的用户使用场景，产品尺寸与逻辑正确，自然高级' },
  { id: 'closing', label: '收尾信任页', note: '品牌收口', prompt: '电商详情页收尾品牌画面，克制留白，稳重、值得信赖' },
]

export const OVERSEAS_MODULES = [
  { id: 'main', label: '纯白主图', note: 'Amazon MAIN', prompt: '符合 Amazon MAIN 图规范，纯白 #FFFFFF 背景，产品占画面 85%，无文字无贴纸无水印' },
  { id: 'infographic', label: '卖点信息图', note: '清晰信息层级', prompt: '跨境电商卖点信息图，产品突出，图标化结构，留出英文文案区域' },
  { id: 'lifestyle', label: '海外生活场景', note: '本地化审美', prompt: '符合北美用户审美的真实生活方式场景，人物和环境自然' },
  { id: 'scale', label: '尺寸对比图', note: '比例一目了然', prompt: '跨境电商尺寸演示图，产品比例准确，整洁网格和测量标记留白' },
  { id: 'package', label: '包装清单', note: '所见即所得', prompt: '产品与包装清单平铺图，整洁对齐，每个配件清晰可见' },
]

export const POSTER_TEMPLATES = [
  { id: 'launch', label: '新品发布', note: '高级科技感', prompt: '为产品设计一张高级新品发布海报，大量留白，强主视觉，光线精准，克制的商业排版' },
  { id: 'sale', label: '限时促销', note: '高转化电商', prompt: '设计一张高转化电商促销海报，强对比色，产品醒目，清晰信息层级，保留价格与口号区域' },
  { id: 'xiaohongshu', label: '小红书种草', note: '清新生活方式', prompt: '小红书生活方式种草封面，真实但精致，清新配色，留出大标题与标签区域' },
  { id: 'festival', label: '节日主题', note: '氛围营销', prompt: '节日氛围营销海报，环境元素有层次，产品和主题高度统一，专业广告摄影' },
]

export const FUN_STYLES = [
  { id: 'figure', label: '3D 手办', note: '潮玩盒装', prompt: '将参考图主体转换为精致 3D 收藏手办，摆在透明橱窗与高级玩具包装前，保留主体特征' },
  { id: 'anime', label: '日系动漫', note: '细腻光影', prompt: '将参考图转换为细腻的现代日系动漫插画，保留人物身份特征、服装与构图' },
  { id: 'clay', label: '粘土治愈', note: '柔软可爱', prompt: '将参考图主体转换为手工粘土定格动画风格，柔软材质，可爱比例，温暖打光' },
  { id: 'oil', label: '油画肖像', note: '艺术馆级', prompt: '将参考图转换为艺术馆级经典油画，保留主体神态与辨识度，细腻笔触与明暗塑造' },
  { id: 'pixel', label: '像素世界', note: '复古游戏', prompt: '将参考图重绘为精致 16-bit 像素艺术，保留主体姿势与特征，有完整的复古游戏场景' },
  { id: 'magazine', label: '杂志封面', note: '时尚大片', prompt: '将参考图打造成高级时尚杂志封面大片，保留人物辨识度，专业摄影棚光线，留出杂志排版空间' },
]

export function getWorkflow(id) {
  return WORKFLOWS.find((item) => item.id === id) || WORKFLOWS[0]
}

export function modulesFor(id) {
  if (id === 'detail') return DETAIL_MODULES
  if (id === 'overseas') return OVERSEAS_MODULES
  if (id === 'poster') return POSTER_TEMPLATES
  if (id === 'fun') return FUN_STYLES
  return SCENES
}

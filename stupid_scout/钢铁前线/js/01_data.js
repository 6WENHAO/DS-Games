'use strict';
// ===================== 战役 / 阵营 / 环境主题 =====================
// 每个战役: 独立地形结构(terr) + 独立布局(layout) + 专属玩法(mode) + 旗点/基地/道路/战壕
const CAMPAIGNS=[
{ id:'normandy', title:'诺曼底 1944', sub:'乡野田园 · 树篱丛生', f:['us','ger'], theme:'green',
terr:'rolling', layout:'rural', mode:'assault', atk:0, modeName:'攻防·盟军进攻',
flags:[{id:'A',x:-70,z:22,r:13},{id:'B',x:-26,z:-66,r:13},{id:'C',x:3,z:8,r:14},{id:'D',x:30,z:68,r:13},{id:'E',x:74,z:-29,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:true,
roads:[[-70,22,-52,8],[74,-29,52,-8]],
trench:[[-52,4,-30,-8],[36,2,58,14]] },
{ id:'stalingrad', title:'斯大林格勒 1942', sub:'严冬巷战 · 寸土必争', f:['sov','ger'], theme:'winter',
terr:'urban', layout:'city', mode:'conquest', atk:0, modeName:'征服·五点争夺',
flags:[{id:'A',x:-62,z:20,r:13},{id:'B',x:-20,z:-26,r:13},{id:'C',x:4,z:12,r:14},{id:'D',x:42,z:-18,r:13},{id:'E',x:72,z:26,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[-142,0,-62,20],[-62,20,-20,-26],[-20,-26,4,12],[4,12,42,-18],[42,-18,72,26],[72,26,142,0]],
trench:[[-42,-34,-20,-44],[24,32,46,24]] },
{ id:'berlin', title:'柏林 1945', sub:'帝国末日 · 逐街攻坚', f:['sov','ger'], theme:'ruin',
terr:'urban', layout:'city', mode:'assault', atk:0, modeName:'攻防·苏军进攻',
flags:[{id:'A',x:-74,z:10,r:13},{id:'B',x:-26,z:-16,r:13},{id:'C',x:22,z:18,r:14},{id:'D',x:74,z:-8,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[-142,0,-74,10],[-74,10,-26,-16],[-26,-16,22,18],[22,18,74,-8],[74,-8,142,0]],
trench:[[-48,26,-28,36],[46,-26,66,-32]] },
{ id:'songhu', title:'淞沪会战 1937', sub:'水乡血战 · 节节抵抗', f:['kmt','jp'], theme:'china',
terr:'delta', layout:'delta', mode:'assault', atk:1, modeName:'攻防·日军进攻',
flags:[{id:'A',x:72,z:-18,r:13},{id:'B',x:30,z:24,r:13},{id:'C',x:-12,z:-20,r:14},{id:'D',x:-60,z:12,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[142,0,72,-18],[72,-18,30,24],[30,24,-12,-20],[-12,-20,-60,12],[-60,12,-142,0]],
trench:[[52,-4,34,10],[10,4,-6,-10],[-34,2,-48,10],[-24,-32,-4,-38]] },
{ id:'baituan', title:'百团大战 1940', sub:'黄土沟壑 · 破袭铁路', f:['cpc','jp'], theme:'loess',
terr:'loess', layout:'loess', mode:'demolition', atk:0, modeName:'破袭·摧毁补给',
flags:[{id:'A',x:-50,z:-20,r:13},{id:'B',x:10,z:30,r:13},{id:'C',x:58,z:-24,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[-142,0,-50,-20],[-50,-20,10,30],[10,30,58,-24],[58,-24,142,0]],
trench:[[-64,-8,-44,-2],[-6,18,14,12],[40,-12,56,-4],[24,-40,44,-46]] },
{ id:'burma', title:'滇缅公路 1944', sub:'密林穿插 · 雨林争夺', f:['kmt','jp'], theme:'jungle',
terr:'jungle', layout:'jungle', mode:'conquest', atk:0, modeName:'征服·丛林四点',
flags:[{id:'A',x:-64,z:-28,r:14},{id:'B',x:-10,z:38,r:14},{id:'C',x:20,z:-42,r:14},{id:'D',x:66,z:24,r:14}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[-142,0,-64,-28],[-64,-28,20,-42],[20,-42,66,24],[66,24,142,0],[-64,-28,-10,38],[-10,38,66,24]],
trench:[[-32,-36,-12,-44]] },
{ id:'moscow', title:'莫斯科郊外 1941', sub:'雪岭松林 · 寒冬防线', f:['sov','ger'], theme:'alpine',
terr:'alpine', layout:'alpine', mode:'assault', atk:1, modeName:'攻防·德军进攻',
flags:[{id:'A',x:66,z:-18,r:13},{id:'B',x:22,z:26,r:13},{id:'C',x:-24,z:-26,r:14},{id:'D',x:-70,z:14,r:13}],
bases:[{x:-142,z:0},{x:142,z:0}], sineRoad:false,
roads:[[142,0,66,-18],[66,-18,22,26],[22,26,-24,-26],[-24,-26,-70,14],[-70,14,-142,0]],
trench:[[48,-8,32,6],[6,14,-10,2],[-42,-8,-56,4]] },
];
let CAMPAIGN_IDX=clamp(parseInt(localStorage.getItem('sf_campaign')||'0')||0,0,CAMPAIGNS.length-1);
const CAMPAIGN=CAMPAIGNS[CAMPAIGN_IDX];
// 玩法归属战役: 征服 / 攻防(atk=进攻方) / 破袭(摧毁补给库)
let GAMEMODE=CAMPAIGN.mode;
const ATK=CAMPAIGN.atk||0, DEF=1-ATK;
let assaultIdx=0;
const DEPOTS=[];
// 战役天气: 雨/雪/阴天/雷暴
const WEATHER={normandy:'overcast',stalingrad:'snow',berlin:'overcast',songhu:'rain',baituan:'clear',burma:'storm',moscow:'snow'}[CAMPAIGN.id]||'clear';
// 河流 (进入地形生成)
const RIVER={
moscow:{pts:[[-165,-70],[-60,-34],[20,-48],[90,-92],[165,-120]],w:9,ice:true},
burma:{pts:[[-165,62],[-70,32],[-8,62],[60,12],[120,42],[165,22]],w:8,ice:false},
songhu:{pts:[[-165,-52],[-80,-42],[0,-58],[80,-32],[165,-42]],w:7,ice:false},
}[CAMPAIGN.id]||null;
const SIZE_OPTS=[{n:'标准',bots:11,tk:330},{n:'加强',bots:16,tk:430},{n:'史诗',bots:22,tk:540}];
let SIZE_IDX=clamp(parseInt(localStorage.getItem('sf_size')||'0')||0,0,2);
// 移动端检测 (可在菜单强制覆盖)
const MOBILE=(()=>{
const ov=localStorage.getItem('sf_mobile');
if(ov==='1') return true;
if(ov==='0') return false;
try{ return navigator.maxTouchPoints>0&&matchMedia('(pointer:coarse)').matches; }catch(e){ return 'ontouchstart' in window; }
})();
const THEMES={
green:{ sky:['#5e7ca0','#93aec0','#c3cdc2','#d8d3b8','#c9c3a4'], fog:0xb8c4bc, hemi:[0xcfd8e8,0x5a5844,0.75], sun:0xffeed0, sunI:2.0,
ground:0xffffff, grassC:0xffffff, leaf:0xffffff, roof:0xffffff, dead:0.08, ruinAdd:0, rubbleN:0, snow:false, birds:true, treeN:95, grassMul:1 },
winter:{ sky:['#6b7684','#939aa4','#b8bcc2','#c8cacc','#bfc2c4'], fog:0xbcc2c8, hemi:[0xcdd4de,0x777d84,0.8], sun:0xe8ecf2, sunI:1.5,
ground:0xdfe4ea, grassC:0xc8ccd2, leaf:0x5a5148, roof:0xb8bcc2, dead:0.7, ruinAdd:0.35, rubbleN:14, snow:true, birds:false, treeN:55, grassMul:0.3 },
ruin:{ sky:['#5f5a55','#8a7f74','#a89a88','#b3a48e','#a3947e'], fog:0xa89c8c, hemi:[0xc2b8a8,0x5f584c,0.7], sun:0xffd9a8, sunI:1.7,
ground:0xb8b0a2, grassC:0x9a9482, leaf:0x6a6a52, roof:0x8f8578, dead:0.5, ruinAdd:0.5, rubbleN:20, snow:false, birds:false, treeN:45, grassMul:0.45 },
china:{ sky:['#7d93a8','#a8b8bc','#cfc8b2','#ddd2ac','#cfc29e'], fog:0xc6bfa6, hemi:[0xd8d8c8,0x5f5c48,0.75], sun:0xffe8c0, sunI:1.85,
ground:0xf2ecd8, grassC:0xd8e0b8, leaf:0xd0ffb0, roof:0x6a7076, dead:0.15, ruinAdd:0.2, rubbleN:8, snow:false, birds:true, treeN:80, grassMul:0.9 },
loess:{ sky:['#8a97a4','#b5b3a4','#d8cba4','#e0d0a0','#d4c294'], fog:0xd2c49e, hemi:[0xe0d8c0,0x6f6448,0.75], sun:0xffe2b0, sunI:1.9,
ground:0xf0dfb2, grassC:0xe8d8a0, leaf:0xc8d890, roof:0x9a9078, dead:0.3, ruinAdd:0.1, rubbleN:5, snow:false, birds:true, treeN:60, grassMul:0.55 },
jungle:{ sky:['#5f7d8c','#8fae9c','#b8c8a0','#c8cf9a','#b8c288'], fog:0xaebf96, hemi:[0xc8d8c0,0x40523c,0.8], sun:0xfff2c8, sunI:1.7,
ground:0xa8c078, grassC:0x8fb860, leaf:0x69a83c, roof:0x8a8468, dead:0.05, ruinAdd:0, rubbleN:0, snow:false, birds:true, treeN:185, grassMul:1.7 },
alpine:{ sky:['#5a6a80','#8b98a8','#c2c8ce','#d8dade','#ccd0d4'], fog:0xc6ccd4, hemi:[0xd0d8e4,0x6a7078,0.82], sun:0xeef2f8, sunI:1.55,
ground:0xe6eaf0, grassC:0xc8d0d8, leaf:0x3d5a44, roof:0xd8dce2, dead:0.25, ruinAdd:0.1, rubbleN:4, snow:true, birds:false, treeN:150, grassMul:0.35 },
};
const THEME=THEMES[CAMPAIGN.theme];
const FACTIONS={
us:{ name:'美国陆军', short:'盟军', sym:'★', flagBg:'#3a5f9e',
coat:0x57604a, pants:0x8a7f5e, helm:0x4a5240, skin:0xc09878, sleeve:0x4d5240, helmet:'pot', nade:'egg',
names:['米勒','雷本','杰克逊','霍瓦特','梅利什','厄本','韦德','卡帕佐','德尔安科','麦克','唐尼','史密斯','布鲁尔','泰勒'],
cls:[['garand','m1911'],['thompson','m1911'],['bar','m1911'],['springfield','m1911'],['m1903','m1911'],['bazooka','m1911'],['m1carb','m1911'],['m1carb','m1911']],
tanks:[{name:'M5A1 斯图亚特',cls:'light',hp:600,spd:7.8,rev:4.0,turn:1.1,reload:3.6,tRate:0.72,dmg:190,pen:70,armor:{f:44,s:29,r:25,t:44,top:13},crew:['driver','gunner','commander'],col:0x5d7244,colT:0x46562f,heavy:false,barrelL:2.6,hullL:4.8},
{name:'M4A3 谢尔曼',cls:'medium',hp:850,spd:6.4,rev:3.4,turn:0.9,reload:5.2,tRate:0.55,dmg:330,pen:118,armor:{f:76,s:38,r:38,t:89,top:19},crew:['driver','gunner','commander','loader'],col:0x586e40,colT:0x404e30,heavy:false,barrelL:3.3,hullL:5.8},
{name:'M36 杰克逊',cls:'td',hp:700,spd:6.2,rev:3.2,turn:0.8,reload:6.2,tRate:0.42,dmg:470,pen:200,armor:{f:60,s:25,r:19,t:76,top:0},openTop:true,crew:['driver','gunner','commander','loader'],col:0x50663c,colT:0x3c5030,heavy:true,barrelL:4.2,hullL:6.0}],
trucks:[{name:'M3 半履带车',hp:420,spd:8.6,rev:4.2,turn:1.1,seats:6,open:true,mg:true,half:true,col:0x57624a}],
planes:[{name:'P-51 野马',hp:100,spd:[32,64],rof:0.075,mgDmg:17,bombs:1,col:0x74806a,size:1},
{name:'P-47 雷电',hp:160,spd:[28,54],rof:0.09,mgDmg:21,bombs:3,col:0x687a62,size:1.18}] },
ger:{ name:'德意志国防军', short:'德军', sym:'✠', flagBg:'#8a2020',
coat:0x555a60, pants:0x46484e, helm:0x3e4246, skin:0xc8a080, sleeve:0x4a4d52, helmet:'stahl', nade:'stick',
names:['施泰纳','穆勒','克格勒','汉森','冯·克劳克','贝克','施密特','里希特','沃尔夫','凯撒','布劳恩','菲舍尔','霍夫曼','克鲁格'],
cls:[['kar98','p38'],['mp40','p38'],['stg44','p38'],['kar98zf','p38'],['kar98','p38'],['schreck','p38'],['g33','p38'],['g33','p38']],
tanks:[{name:'四号坦克G型',cls:'medium',hp:800,spd:6.2,rev:3.4,turn:0.9,reload:5.0,tRate:0.5,dmg:330,pen:121,armor:{f:80,s:30,r:20,t:50,top:16},crew:['driver','gunner','commander','loader'],col:0x545a50,colT:0x3e4238,heavy:false,barrelL:3.5,hullL:5.8},
{name:'黑豹',cls:'heavy',hp:1250,spd:5.6,rev:2.8,turn:0.75,reload:6.2,tRate:0.4,dmg:430,pen:192,armor:{f:138,s:42,r:40,t:110,top:17},crew:['driver','gunner','commander','loader'],col:0x5c5a48,colT:0x464438,heavy:true,barrelL:4.3,hullL:6.6},
{name:'黄鼠狼III',cls:'td',hp:520,spd:5.8,rev:3.0,turn:0.85,reload:5.6,tRate:0.32,dmg:400,pen:154,armor:{f:50,s:16,r:10,t:15,top:0},openTop:true,casemate:true,crew:['driver','gunner','loader'],col:0x6a6852,colT:0x545240,heavy:false,barrelL:3.8,hullL:5.2},],
trucks:[{name:'Sd.Kfz 251 半履带',hp:420,spd:8.4,rev:4.0,turn:1.05,seats:6,open:true,mg:true,half:true,col:0x565a52}],
planes:[{name:'BF-109',hp:100,spd:[32,64],rof:0.075,mgDmg:17,bombs:1,col:0x70747a,size:1},
{name:'FW-190',hp:160,spd:[28,54],rof:0.09,mgDmg:21,bombs:3,col:0x62666a,size:1.18}] },
sov:{ name:'苏联红军', short:'苏军', sym:'☭', flagBg:'#b03030',
coat:0x6b6a4f, pants:0x5c5a42, helm:0x515c3e, skin:0xc8a080, sleeve:0x62614a, helmet:'ssh', nade:'stickS',
names:['伊万诺夫','彼得罗夫','瓦西里','安德烈','谢尔盖','德米特里','尼古拉','阿列克谢','米哈伊尔','尤里','奥列格','弗拉基米尔','康斯坦丁','格里高利'],
cls:[['mosin','tt33'],['ppsh','tt33'],['dp28','tt33'],['mosinpu','tt33'],['mosin','tt33'],['ptrd','tt33'],['m38carb','tt33'],['m38carb','tt33']],
tanks:[{name:'T-34/76',cls:'medium',hp:850,spd:7.0,rev:3.6,turn:0.95,reload:5.0,tRate:0.5,dmg:335,pen:102,armor:{f:90,s:52,r:45,t:74,top:16},crew:['driver','gunner','commander'],col:0x4f5c40,colT:0x3c4832,heavy:false,barrelL:3.4,hullL:5.9},
{name:'KV-1 重型',cls:'heavy',hp:1400,spd:4.6,rev:2.5,turn:0.65,reload:6.8,tRate:0.36,dmg:420,pen:108,armor:{f:100,s:76,r:70,t:95,top:31},crew:['driver','gunner','commander','loader'],col:0x53604a,colT:0x404c3a,heavy:true,barrelL:3.9,hullL:6.5},
{name:'SU-76 自行火炮',cls:'td',hp:560,spd:6.6,rev:3.4,turn:0.9,reload:4.6,tRate:0.32,dmg:330,pen:105,armor:{f:35,s:16,r:10,t:12,top:0},openTop:true,casemate:true,crew:['driver','gunner','loader'],col:0x556248,colT:0x424e38,heavy:false,barrelL:3.5,hullL:5.0},],
trucks:[{name:'嘎斯-AA 卡车',hp:300,spd:9.2,rev:4.4,turn:1.15,seats:6,open:true,mg:false,col:0x525c46}],
planes:[{name:'La-5',hp:100,spd:[32,64],rof:0.075,mgDmg:17,bombs:1,col:0x5f7062,size:1},
{name:'IL-2 强击机',hp:180,spd:[26,50],rof:0.095,mgDmg:22,bombs:3,col:0x556052,size:1.2}] },
jp:{ name:'日本帝国陆军', short:'日军', sym:'☀', flagBg:'#8a2020',
coat:0x7a6f4a, pants:0x6e6444, helm:0x60593a, skin:0xc8a078, sleeve:0x6f6543, helmet:'jp', nade:'egg',
names:['田中','佐藤','铃木','高桥','渡边','伊藤','山本','中村','小林','加藤','吉田','山田','佐佐木','松本'],
cls:[['arisaka','nambu'],['type100','nambu'],['type96','nambu'],['type97s','nambu'],['arisaka','nambu'],['type97at','nambu'],['type38c','nambu'],['type38c','nambu']],
tanks:[{name:'九五式轻战车',cls:'light',hp:430,spd:7.6,rev:3.8,turn:1.1,reload:4.2,tRate:0.7,dmg:160,pen:42,armor:{f:12,s:12,r:10,t:12,top:9},crew:['driver','gunner'],col:0x756e48,colT:0x5e583c,heavy:false,barrelL:2.4,hullL:4.4},
{name:'九七式改中战车',cls:'medium',hp:650,spd:6.6,rev:3.4,turn:0.95,reload:4.8,tRate:0.55,dmg:260,pen:86,armor:{f:47,s:25,r:20,t:47,top:12},crew:['driver','gunner','commander'],col:0x6f6a4c,colT:0x585340,heavy:false,barrelL:2.9,hullL:5.4},
{name:'一式炮战车',cls:'td',hp:500,spd:6.0,rev:3.0,turn:0.85,reload:5.2,tRate:0.32,dmg:330,pen:104,armor:{f:50,s:25,r:12,t:16,top:0},openTop:true,casemate:true,crew:['driver','gunner','loader'],col:0x6a6548,colT:0x53503c,heavy:true,barrelL:3.4,hullL:5.5},],
trucks:[{name:'九四式六轮卡车',hp:280,spd:9.0,rev:4.4,turn:1.15,seats:6,open:true,mg:false,col:0x6b6547}],
planes:[{name:'零式舰战',hp:90,spd:[33,66],rof:0.07,mgDmg:16,bombs:1,col:0x8a9284,size:0.96},
{name:'一式战 隼',hp:150,spd:[29,56],rof:0.085,mgDmg:20,bombs:3,col:0x77806e,size:1.12}] },
kmt:{ name:'国民革命军', short:'国军', sym:'✷', flagBg:'#2050b0',
coat:0x5a6a72, pants:0x52606a, helm:0x46525a, skin:0xc8a078, sleeve:0x53626b, helmet:'stahl', nade:'stick',
names:['王大山','李长贵','张铁柱','刘志','陈国栋','杨得胜','赵铁牛','黄浦生','周卫国','吴天亮','徐虎','孙立','马汉山','胡铁军'],
cls:[['zhongzheng','c96'],['mp18','c96'],['zb26','c96'],['zhongzhengs','c96'],['hanyang','c96'],['boys','c96'],['laotao','c96'],['laotao','c96']],
tanks:[{name:'维克斯6吨',cls:'light',hp:520,spd:6.0,rev:3.2,turn:0.95,reload:4.6,tRate:0.65,dmg:210,pen:52,armor:{f:17,s:13,r:10,t:17,top:9},crew:['driver','gunner'],col:0x5c6858,colT:0x475244,heavy:false,barrelL:2.7,hullL:5.2},
{name:'T-26(援华)',cls:'light',hp:640,spd:6.4,rev:3.4,turn:0.9,reload:5.0,tRate:0.6,dmg:250,pen:70,armor:{f:15,s:15,r:10,t:15,top:10},crew:['driver','gunner','commander'],col:0x556050,colT:0x424c3e,heavy:true,barrelL:3.0,hullL:5.4},
{name:'M3 斯图亚特(美援)',cls:'light',hp:620,spd:7.8,rev:4.0,turn:1.1,reload:3.8,tRate:0.7,dmg:200,pen:70,armor:{f:44,s:29,r:25,t:44,top:13},crew:['driver','gunner','commander'],col:0x5d7050,colT:0x475840,heavy:false,barrelL:2.6,hullL:4.8},],
trucks:[{name:'CCKW 十轮卡(援华)',hp:320,spd:9.2,rev:4.4,turn:1.1,seats:6,open:true,mg:false,col:0x5a6456}],
planes:[{name:'霍克III',hp:95,spd:[30,58],rof:0.08,mgDmg:16,bombs:1,col:0x6f7a68,size:0.98},
{name:'伊-16(援华)',hp:140,spd:[28,54],rof:0.085,mgDmg:19,bombs:2,col:0x5f6a58,size:1.05}] },
cpc:{ name:'八路军', short:'八路', sym:'✭', flagBg:'#b03030',
coat:0x777d72, pants:0x6d736a, helm:0x777d72, skin:0xc8a078, sleeve:0x6f756a, helmet:'cap', nade:'stick', atn5:4,
names:['李云龙','赵刚','王铁蛋','孙德胜','张大彪','魏和尚','段鹏','沈泉','邢志国','陈铁柱','石头','柱子','二娃','铁蛋'],
cls:[['hanyang','c96'],['c96auto','c96'],['type11','c96'],['zhongzhengs','c96'],['hanyang','c96'],['hanyang','c96'],['laotao','c96'],['laotao','c96']],
tanks:[{name:'九七式(缴获)',cls:'medium',hp:600,spd:6.6,rev:3.4,turn:0.95,reload:4.8,tRate:0.55,dmg:250,pen:86,armor:{f:47,s:25,r:20,t:47,top:12},crew:['driver','gunner','commander'],col:0x6d7268,colT:0x565b52,heavy:false,barrelL:2.9,hullL:5.4},
{name:'九五式(缴获)',cls:'light',hp:430,spd:7.6,rev:3.8,turn:1.1,reload:4.2,tRate:0.7,dmg:160,pen:42,armor:{f:12,s:12,r:10,t:12,top:9},crew:['driver','gunner'],col:0x687062,colT:0x51584c,heavy:true,barrelL:2.4,hullL:4.4},],
trucks:[{name:'改装民用卡车',hp:260,spd:8.6,rev:4.2,turn:1.1,seats:6,open:true,mg:false,civ:true,col:0x5e5a4a}],
planes:[{name:'隼(缴获)',hp:150,spd:[29,56],rof:0.085,mgDmg:20,bombs:2,col:0x6f7a6a,size:1.12},
{name:'九九式(缴获)',hp:140,spd:[27,52],rof:0.09,mgDmg:19,bombs:3,col:0x667062,size:1.15}] },
};
const TEAM_FACTION=[FACTIONS[CAMPAIGN.f[0]],FACTIONS[CAMPAIGN.f[1]]];
const TEAM_NAME=[TEAM_FACTION[0].short,TEAM_FACTION[1].short];
const TEAM_COL=[0x8fc1ff,0xff9c8a];
const MAP_SIZE=CAMPAIGN.mapSize||(CAMPAIGN.layout==='city'?420:360);
const MAP_HALF=MAP_SIZE/2, MAP_EDGE=MAP_HALF-8;
let BOTS_PER_TEAM=11;
const START_TICKETS=330;
const US_NAMES=['米勒','雷本','杰克逊','霍瓦特','梅利什','厄本','韦德','卡帕佐','德尔安科','麦克','唐尼','史密斯','布鲁尔','泰勒'];
const GER_NAMES=['施泰纳','穆勒','克格勒','汉森','冯·克劳克','贝克','施密特','里希特','沃尔夫','凯撒','布劳恩','菲舍尔','霍夫曼','克鲁格'];

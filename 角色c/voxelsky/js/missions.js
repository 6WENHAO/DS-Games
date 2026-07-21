import{fmt}from"./util.js";

export function buildMissions(g){
  return[
    {
      id:"repair_scanner",
      title:"苏醒 AWAKENINGS",
      desc:"外骨骼扫描仪已损坏。使用采矿光束(按住左键)从岩石中采集 铁尘，修复扫描仪。",
      prog:()=>`铁尘 ${Math.min(g.inv.count("ferrite"),25)} / 25`,
      check:()=>g.inv.count("ferrite")>=25,
      onComplete:()=>{
        g.inv.remove("ferrite",25);
        g.flags.scannerFixed=true;
        g.ui.notify("扫描仪已修复","按 C 环境扫描 · 按 F 分析目镜","");
        g.audio.speak("扫描仪功能已恢复");
      }
    },
    {
      id:"recharge_shield",
      title:"生命体征衰减",
      desc:"危险防护正在流失电力。采集 钠 (黄色植株，按 C 扫描定位)，并按 Q 为危险防护充能。",
      prog:()=>`钠 ${Math.min(g.inv.count("sodium"),20)} / 20 · 按 Q 充能`,
      check:()=>g.flags.shieldRecharged,
      onComplete:()=>{
        g.audio.speak("危险防护已恢复");
      }
    },
    {
      id:"find_ship",
      title:"坠毁信号",
      desc:"探测到附近有一艘坠毁的星际飞船。跟随罗盘上的标记，找到它。",
      prog:()=>{
        const d=g.shipDistance();
        return d!=null?`距离 ${fmt(d)} m`:"";
      },
      check:()=>g.shipDistance()!=null&&g.shipDistance()<14,
      marker:()=>({pos:g.ship?g.ship.pos:null,icon:"▲",label:"坠毁的飞船",kind:"mission"}),
      onComplete:()=>{
        g.ui.notify("已找到飞船","靠近并检查受损情况","");
        g.audio.speak("检测到飞船残骸，建议立即检修");
      }
    },
    {
      id:"check_ship",
      title:"损毁评估",
      desc:"这艘 拉扎鲁斯号 坠毁时受损严重。靠近飞船，按住 E 检查核心系统。",
      prog:()=>"",
      check:()=>g.flags.shipChecked,
      marker:()=>({pos:g.ship?g.ship.pos:null,icon:"▲",label:"拉扎鲁斯号",kind:"mission"}),
      onComplete:()=>{
        g.ui.notify("诊断完成","起飞推进器 与 脉冲引擎 需要修理","warn");
      }
    },
    {
      id:"repair_thruster",
      title:"修复起飞推进器",
      desc:"打开物品栏(TAB)合成所需组件：金属镀层(铁尘×50)、二氢凝胶(二氢×40，蓝色晶体)。然后到飞船处按住 E 安装。",
      prog:()=>{
        const a=g.inv.count("plating")>=1?"✓":"✗";
        const b=g.inv.count("jelly")>=1?"✓":"✗";
        return`金属镀层 ${a} · 二氢凝胶 ${b}`;
      },
      check:()=>g.flags.thrusterFixed,
      marker:()=>({pos:g.ship?g.ship.pos:null,icon:"▲",label:"拉扎鲁斯号",kind:"mission"}),
      onComplete:()=>{
        g.ui.notify("起飞推进器","修复完成","");
        g.audio.speak("起飞推进器已修复");
      }
    },
    {
      id:"repair_pulse",
      title:"修复脉冲引擎",
      desc:"脉冲引擎需要 金属镀层×1 与 密封垫×1。附近的遇险信标可能存有密封垫，跟随标记前往回收。",
      prog:()=>{
        const a=g.inv.count("plating")>=1?"✓":"✗";
        const b=g.inv.count("seal")>=1?"✓":"✗";
        return`金属镀层 ${a} · 密封垫 ${b}`;
      },
      check:()=>g.flags.pulseFixed,
      marker:()=>{
        if(g.inv.count("seal")>=1)return{pos:g.ship?g.ship.pos:null,icon:"▲",label:"拉扎鲁斯号",kind:"mission"};
        return{pos:g.beaconWorldPos(),icon:"◆",label:"遇险信标",kind:"mission"};
      },
      onComplete:()=>{
        g.ui.notify("脉冲引擎","修复完成","");
        g.audio.speak("脉冲引擎已修复");
      }
    },
    {
      id:"fuel_ship",
      title:"补给起飞燃料",
      desc:"合成 起飞燃料(二氢凝胶×1 + 金属镀层×1)，然后在飞船处按住 E 注入燃料。",
      prog:()=>`起飞燃料 ${g.inv.count("launchfuel")>=1?"✓ 已合成":"✗ 未合成"}`,
      check:()=>g.shipState.launchFuel>=99,
      marker:()=>({pos:g.ship?g.ship.pos:null,icon:"▲",label:"拉扎鲁斯号",kind:"mission"}),
      onComplete:()=>{
        g.ui.notify("燃料已注入","飞船已准备就绪","");
        g.audio.speak("燃料注入完成，可以起飞");
      }
    },
    {
      id:"takeoff",
      title:"起飞",
      desc:"进入飞船(按住 E)，然后按 空格 点火起飞。使用 W/S 控制推进，鼠标控制方向。",
      prog:()=>"",
      check:()=>g.flags.tookOff,
      marker:()=>({pos:g.ship?g.ship.pos:null,icon:"▲",label:"拉扎鲁斯号",kind:"mission"}),
      onComplete:()=>{
        g.ui.notify("起飞成功","向上飞行，冲出大气层","");
      }
    },
    {
      id:"reach_space",
      title:"冲出大气层",
      desc:"拉起机头持续爬升。当高度超过 200m，你将挣脱这颗行星的束缚。",
      prog:()=>"",
      check:()=>g.flags.reachedSpace,
      onComplete:()=>{
        g.audio.speak("已进入外太空");
      }
    },
    {
      id:"mine_asteroids",
      title:"星海採掘",
      desc:"脉冲引擎需要 氚 作为燃料。用舰载武器(左键)击碎小行星，收集 氚×40。",
      prog:()=>`氚 ${Math.min(g.inv.count("tritium"),40)} / 40`,
      check:()=>g.inv.count("tritium")>=40,
      onComplete:()=>{
        g.shipState.pulseFuel=100;
        g.ui.notify("脉冲引擎","燃料已自动装填 100%","");
        g.audio.speak("脉冲燃料已装填");
      }
    },
    {
      id:"visit_planet",
      title:"新的世界",
      desc:"选定一颗行星，按住 F 进行脉冲飞行。抵达后直接飞向行星表面进入大气层，并按 E 着陆。",
      prog:()=>"",
      check:()=>g.flags.landedOther,
      onComplete:()=>{
        g.addUnits(2500);
        g.ui.notify("里程碑达成","星际旅行者 · +2,500 单位","");
        g.audio.discovery();
      }
    },
    {
      id:"endless",
      title:"无尽的旅程",
      desc:"银河属于你：扫描未知生物(F)、采集稀有资源、建造基地(合成建造方块)、拜访空间站进行交易。",
      prog:()=>"自由探索",
      check:()=>false
    }
  ];
}

export class MissionManager{
  constructor(g){
    this.g=g;
    this.list=buildMissions(g);
    this.idx=0;
    this.doneFlash=0;
  }
  get current(){return this.list[this.idx];}
  setIndex(i){
    this.idx=Math.min(i,this.list.length-1);
    this.g.ui.setMission(this.current);
  }
  event(type,data){
    const g=this.g;
    if(type==="rechargeShield")g.flags.shieldRecharged=true;
    if(type==="checkShip")g.flags.shipChecked=true;
    if(type==="repairThruster")g.flags.thrusterFixed=true;
    if(type==="repairPulse")g.flags.pulseFixed=true;
    if(type==="takeoff")g.flags.tookOff=true;
    if(type==="reachSpace")g.flags.reachedSpace=true;
    if(type==="landOther")g.flags.landedOther=true;
  }
  update(dt){
    const m=this.current;
    if(!m)return;
    if(m.check&&m.check()){
      if(m.onComplete)m.onComplete();
      this.g.audio.missionDone();
      this.g.ui.missionComplete(m.title);
      this.idx=Math.min(this.idx+1,this.list.length-1);
      const next=this.current;
      this.g.ui.setMission(next);
      this.g.save();
    }else{
      this.g.ui.updateMissionProg(m.prog?m.prog():"");
    }
    const mk=m.marker?m.marker():null;
    this.g.ui.setMissionMarker(mk&&mk.pos?mk:null);
  }
}

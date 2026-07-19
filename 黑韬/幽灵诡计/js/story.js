'use strict';
/* ============================================================
   story.js — 《灰港安魂曲》 全剧本 (原创)
   演出重制版: 表情气泡 / 节奏运镜 / 招牌动作 / 奇观双段式
   ============================================================ */
var Story = (function(){

  /* ---------- 快捷 ---------- */
  function S(kid, t){ return Dialog.line(kid, t); }
  function music(id){ return call(function(){ AudioSys.playMusic(id); }); }
  function scard(a,b){ return Game.showCardStep(a,b); }
  function cam(x,y,z){ return call(function(){ World.lookAt(x,y,z); }); }
  function cut(x,y,z){ return call(function(){ World.snapCam(x,y,z); }); }
  function anim(fn){ return function(next){ fn(next); }; }
  function sfx(name){ return call(function(){ AudioSys.sfx[name](); }); }
  function emo(who, type){ return call(function(){ World.emote(World.chars[who], type); }); }
  function pose(who, p){ return call(function(){ World.setPose(World.chars[who], p); }); }
  function walk(who, tx, sp, kf, doneFn){
    return function(next){
      World.walkTo(World.chars[who], tx, sp, doneFn || next, kf);
    };
  }
  /* 行走 + 镜头全程跟随 */
  function walkCam(who, tx, sp, camY, camZoom){
    return function(next){
      var chr = World.chars[who];
      var arrived = false;
      World.walkTo(chr, tx, sp, function(){ arrived=true; next(); }, false);
      World.animate(function(){
        World.lookAt(chr.root.position.x, camY||18, camZoom||0.95);
        return arrived;
      });
    };
  }

  /* ============================================================
     序章 · 死者的夜班
     ============================================================ */
  function prologue(){
    return [
      call(function(){
        World.showScene('dock'); World.resetDock(); World.snapCam(0,26,1);
        World.chars.wei.root.visible=false;
        GFX.setFade(1);
      }),
      music('grey'),
      wait(0.6),
      call(function(){ GFX.fadeTo(0, 0.8); }),
      wait(1.6),
      S('narr','雨。铁锈。海雾。'),
      S('narr','以及一声还没散尽的枪响。'),
      cam(0,20,1.15),
      S('hero','………'),
      S('hero','那是……我？'),
      S('narr','码头中央躺着一个穿风衣的男人。领带被雨水泡得发深。'),
      S('hero','喂。喂！那是我的身体！谁来——'),
      S('hero','……没有人听得见。'),
      wait(0.4),
      sfx('radioStatic'),
      cut(70,34,0.8),
      S('beacon','听得见。'),
      S('beacon','往右看，新人。灯塔上这团黄光就是我。'),
      S('beacon','大伙儿都叫我"老灯"。死在这座塔里，三十年工龄。'),
      S('hero','死、死在……那我现在是——'),
      S('beacon','一缕魂。别急着哭，死人的夜晚可忙了。'),
      cam(0,22,1),
      S('beacon','规矩一：魂没有脚。但可以附身在"核心"上跳着走。'),
      S('beacon','灯、钟、电话——凡是被人手摸旧了的东西，都算数。'),
      S('beacon','按下右下角那团蓝火试试。那是幽灵界的门。'),
      call(function(){ Game.setGhostAllowed(true); Game.setSoul('corpse'); }),
      call(function(){ Game.goGhost(true); }),
      S('beacon','好。看见那些光点了吗？点亮的就是跳得到的。'),
      S('beacon','练个手——跳到左边渔船的桅灯上来。跳不到就找中转站。'),
      call(function(){ Game.showToast('目标: 桅灯 (经木箱→系缆桩中转)'); }),
      Game.waitTravel('mastLamp'),
      call(function(){ Game.goGhost(false); }),
      sfx('checkPass'),
      S('beacon','嚯，三跳过河。你生前不会是干杂技的吧。'),
      S('hero','是侦探。……好像是。记不太清了。'),
      S('beacon','规矩二：附身之后，可以对核心施展"诡计"。'),
      S('beacon','东西不同，本事不同。灯会灭，钟会响，电话会闹脾气。'),
      /* — 教学诡计: 电话振铃 — */
      Game.ghostWindow({
        time: 0, startCore:'mastLamp',
        setup: function(){},
        tricks: [
          { core:'phoneA', label:'电话振铃',
            hint:'练习: 跳回码头东侧的「电话亭」, 按下诡计按钮让它响铃。',
            anim: function(done){ World.trickPhoneRing(1.8, done); } }
        ],
        success: prologueAfterPhone
      }),
    ];
  }
  function prologueAfterPhone(){
    return [
      S('beacon','就是这个感觉。死物的语言，你已经会说两句了。'),
      S('hero','……老灯，我想问。我是谁杀的？'),
      S('beacon','不知道。但我知道一件更要紧的事。'),
      S('beacon','规矩三，也是最后一条——'),
      S('beacon','死者的魂，可以回到"死亡发生前的四分钟"。'),
      S('hero','四分钟……能改变什么？'),
      S('beacon','问得好。今晚你就会知道答案。'),
      wait(0.3),
      sfx('thunder'),
      cam(-40,20,0.9),
      S('narr','码头西侧传来脚步声。轻的，快的，年轻的。'),
      call(function(){
        World.chars.wei.root.visible=true;
        World.chars.wei.root.position.set(-70,0,-8);
        World.setPose(World.chars.wei,'idle',true);
        World.walkTo(World.chars.wei, -30, 9);
      }),
      S('beacon','巡警。是来查那声枪响的。'),
      wait(0.2),
      call(function(){
        // 检修台上, 杀手的剪影首次现身
        World.chars.killer.root.visible = true;
        World.chars.killer.root.position.set(96,26,-20);
        World.setPose(World.chars.killer,'idle',true);
      }),
      cut(94,28,0.9),
      sfx('sting'),
      emo('killer','dots'),
      S('beacon','……糟了。孩子，听我说。'),
      S('beacon','杀你的人还没走。他在灯塔的检修台上，正在换弹。'),
      S('hero','什么？！那她——'),
      S('beacon','对。四分钟后，她会死在你旁边。'),
      S('beacon','除非，你把那四分钟抢回来。'),
      wait(0.5),
    ];
  }

  /* ============================================================
     第一章 · 逆转四分钟
     ============================================================ */
  function setupW1(){
    World.showScene('dock'); World.resetDock();
    World.chars.wei.root.visible = true;
    World.chars.wei.root.position.set(2,0,-8);
    World.setPose(World.chars.wei,'kneel',true);
    World.chars.killer.root.visible = true;
    World.chars.killer.root.position.set(96,26,-20);
    World.setPose(World.chars.killer,'aim',true);
    AudioSys.playMusic('tense');
  }
  function setupW2(){
    setupW1();
    World.objs.craneLamp.bulb.material.color.set('#332e20');
    World.objs.lampCone.material.opacity = 0;
    World.chars.wei.root.position.set(-6,0,-8);
    World.setPose(World.chars.wei,'idle',true);
    // 跃下高台之后 — 杀手在地面, 缓慢逼近木箱
    World.chars.killer.root.position.set(78,0,-8);
    World.chars.killer.root.rotation.y = -Math.PI/2;
    World.setPose(World.chars.killer,'idle',true);
    World.walkTo(World.chars.killer, 30, 1.1);
  }
  function setupW3(){
    setupW2();
    World.chars.cat.root.visible = false;
    World.chars.wei.root.position.set(-20,0,-8);
    World.chars.killer.root.position.set(66,0,-8);
    World.chars.killer.root.rotation.y = -Math.PI/2;
    World.setPose(World.chars.killer,'idle',true);
    World.walkTo(World.chars.killer, -20, 1.4);
  }
  function setupW4(){
    setupW2();
    World.chars.cat.root.visible = false;
    World.objs.drum.grp.position.set(36,3.5,-14);
    World.objs.drum.grp.rotation.set(0,0,1.2);
    World.chars.wei.root.position.set(-30,0,-8);
    World.chars.killer.root.position.set(30,0,-8);
    World.chars.killer.root.rotation.y = -Math.PI/2;
    World.setPose(World.chars.killer,'idle',true);
    World.walkTo(World.chars.killer, -24, 1.6);
  }
  function failShot(next){
    World.stopWalk(World.chars.killer);
    World.killerShoot(World.chars.wei, next);
  }

  function chapter1(){
    return [
      scard('第一章','逆转四分钟'),
      music('tense'),
      call(function(){ setupW1(); World.snapCam(0,24,1); GFX.setFade(1); GFX.fadeTo(0,1.2); }),
      wait(1.4),
      call(function(){ AudioSys.sfx.fate(); GFX.flash('#8fd8ff',0.4); }),
      S('narr','—— 死亡前四分钟。'),
      S('wei','7号码头，确认枪响来源……'),
      anim(function(next){ World.startle(World.chars.wei, next); }),
      emo('wei','!'),
      S('wei','有人倒地！这里有人倒地！'),
      pose('wei','kneel'),
      S('narr','她单膝跪下探你的脉搏。手在抖，动作却没有错一步。'),
      S('wei','没有呼吸……对讲机、对讲机——'),
      cut(94,28,0.85),
      sfx('sting'),
      S('narr','灯塔检修台上，一点金属的反光缓缓抬起。'),
      S('hero','他在瞄准了！就在检修台上——'),
      S('beacon','吊灯！那盏吊灯把她照得雪亮！'),
      /* ---- 窗1 ---- */
      Game.ghostWindow({
        time: 20, startCore:'corpse',
        setup: setupW1,
        tricks: [
          { core:'craneLamp', label:'熄灭吊灯',
            hint:'跳到起重机的「吊灯」上, 施展诡计熄灭它！(提示: 幽灵界内时间静止)',
            anim: function(done){ World.trickLampFlicker(done); } }
        ],
        fail: failShot,
        success: win1After
      }),
    ];
  }
  function win1After(){
    return [
      cut(90,26,0.8),
      emo('killer','?'),
      S('killer','……灯灭了。'),
      S('killer','偏偏在这时候。哼。'),
      cam(-6,18,1),
      S('wei','停电？正好——尸体先记位置，人先躲光。'),
      walk('wei', -6, 10),
      wait(0.9),
      S('hero','她躲到木箱后面了。干得好，姑娘。'),
      S('beacon','别松气。看，他动了——'),
      /* — 招牌演出: 跃下高台 — */
      cut(88,20,0.8),
      sfx('sting'),
      emo('killer','!'),
      anim(function(next){ World.killerLeap(78, next); }),
      S('narr','大衣下摆张开如鸦翼。落地无声。'),
      S('narr','他直起身, 慢条斯理地扶正了帽檐——然后朝箱子走来。'),
      cam(20,18,0.95),
      S('hero','等等，箱子上面——那只猫还睡在那儿！'),
      S('beacon','它挡着他的射线。可猫要是自己挪窝，小警察就露出来了。'),
      S('hero','所以要让猫"现在"就跳——朝着他的方向炸毛！'),
      /* ---- 窗2 ---- */
      Game.ghostWindow({
        time: 18, startCore:'craneLamp',
        setup: setupW2,
        tricks: [
          { core:'bell', label:'敲响铜钟',
            hint:'敲响灯塔下的「铜钟」！猫会被惊得炸毛蹿出去, 正好撞上他的枪口视线！',
            anim: function(done){
              World.trickBell(function(){});
              Sched.to(function(){ World.catStartled(done); }, 1200);
            } }
        ],
        fail: failShot,
        success: win2After
      }),
    ];
  }
  function win2After(){
    return [
      cut(74,16,0.85),
      emo('killer','!'),
      S('killer','?! 什么东西——'),
      S('narr','一团黑影贴着他的脸皮蹿过, 尾巴扫翻了瞄准镜。'),
      emo('killer','anger'),
      S('killer','猫。是猫。……我最烦猫。'),
      S('cat','(远处传来一声得意的喵)'),
      cam(-20,18,1),
      emo('wei','?'),
      S('wei','钟声？这大半夜……到底是谁在敲钟？'),
      S('beacon','是"谁"敲的钟, 她早晚会知道的。'),
      cut(66,16,0.9),
      sfx('sting'),
      S('beacon','注意！他收起枪了——他要走过来, 用"安静的做法"。'),
      S('narr','皮鞋跟碾过湿木板。一步。一步。不急, 也不停。'),
      S('hero','距离她只剩三十步……油桶！集装箱顶上有油桶！'),
      S('beacon','先让电话亭响铃拖住他, 再把桶砸下去。一步都不能乱。'),
      /* ---- 窗3 (两步连锁, 杀手全程逼近) ---- */
      Game.ghostWindow({
        time: 26, startCore:'bell',
        setup: setupW3,
        tricks: [
          { core:'phoneA', label:'电话振铃',
            hint:'他正一步步逼近小卫！第一步: 让「电话亭」响铃。深夜的来电, 没有杀手会不起疑心。',
            anim: function(done){
              World.trickPhoneRing(1.8, function(){
                World.emote(World.chars.killer,'?');
                World.walkTo(World.chars.killer, 36, 12);
                done();
              });
            } },
          { core:'drum', label:'砸落油桶',
            hint:'他循着铃声走到集装箱下面了！第二步: 跳上「油桶」, 趁现在砸下去！',
            anim: function(done){
              World.stopWalk(World.chars.killer);
              World.trickDrumDrop(done);
            } }
        ],
        fail: failShot,
        success: win3After
      }),
    ];
  }
  function win3After(){
    return [
      cut(38,10,0.85),
      pose('killer','stagger'),
      S('killer','——呃!!'),
      S('narr','油桶擦着他的肩膀轰然砸落。那支细长的枪脱手飞出——'),
      sfx('splash'),
      S('narr','扑通。海收下了它。'),
      pose('killer','idle'),
      emo('killer','dots'),
      S('killer','………………'),
      S('narr','(他慢慢直起身, 从大衣内侧抽出一把短刀)'),
      sfx('shock'),
      S('killer','那就换个更安静的做法。'),
      cam(-30,16,1),
      call(function(){
        World.chars.wei.root.rotation.y = Math.PI/2;  // 面向右(杀手)
        World.setPose(World.chars.wei,'aim');
      }),
      S('wei','站住！我是警察！'),
      S('narr','她的枪口指向黑暗。手在抖, 方向没有错。'),
      S('hero','不行, 她那个距离撂不倒他……'),
      S('beacon','听见起锚机的动静了吗? 他一定也听得见——'),
      S('hero','渔船、缆绳、退潮。懂了。请他吃一记"船锤"。'),
      /* ---- 窗4 ---- */
      Game.ghostWindow({
        time: 20, startCore:'drum',
        setup: setupW4,
        tricks: [
          { core:'winch', label:'转动起锚机',
            hint:'跳到渔船的「起锚机」上转动它！机械异响会引他过来查看——正好站进船艏横扫的弧线里！',
            anim: function(done){
              World.emote(World.chars.killer,'?');
              World.walkTo(World.chars.killer, -58, 22);
              World.trickWinch(done);
            } }
        ],
        fail: failShot,
        success: win4After
      }),
    ];
  }
  function win4After(){
    return [
      call(function(){
        World.lookAt(-60,14,0.8);
        var k = World.chars.killer;
        World.stopWalk(k,'stagger');
        AudioSys.sfx.whoosh();
        World.animate(function(dt){
          k.root.position.x -= dt*30; k.root.position.y -= dt*14;
          k.root.rotation.z += dt*4;
          if(k.root.position.y<-12){
            k.root.visible=false; k.root.rotation.z=0; return true;
          }
          return false;
        });
        AudioSys.sfx.splash();
      }),
      wait(1.2),
      S('narr','缆绳绷断的巨响里, 船艏像一柄横扫的巨剑。'),
      S('narr','灰大衣在空中划出一道漂亮的抛物线——然后被浪吞了。'),
      S('killer','(咕嘟咕嘟)'),
      music('grey'),
      wait(0.6),
      cam(-20,18,1),
      S('wei','……结束了？'),
      walk('wei', -4, 9),
      wait(1.2),
      S('wei','灯自己灭, 钟自己响, 船自己发疯。'),
      S('wei','这码头今晚是活的吧。绝对是活的吧。'),
      call(function(){ World.setPose(World.chars.wei,'kneel'); World.lookAt(0,18,1.1); }),
      S('narr','她回到你的尸体旁, 从风衣内袋里抽出一本浸了血的笔记本。'),
      pose('wei','read'),
      S('wei','死者姓渡, 私家侦探……最后一页写着:'),
      S('wei','「今夜十一点, 锚与钟酒吧。证人最后一次开口的机会。」'),
      S('hero','对……我想起来了。我今晚有个约。'),
      S('hero','一个等了三十年才敢开口的证人。'),
      S('beacon','那你最好跟紧点, 孩子。'),
      S('beacon','杀手为了灭口可以开枪两次——就不会有第三次吗？'),
      wait(0.5),
    ];
  }

  /* ============================================================
     第二章 · 锚与钟 (酒吧保卫战)
     ============================================================ */
  function setupB1(){
    World.showScene('bar'); World.resetBar();
    World.chars.killer.root.visible = true;
    World.chars.killer.root.position.set(44,0,5);
    World.chars.killer.root.rotation.y = -Math.PI/2;
    World.setPose(World.chars.killer,'lean',true);
    AudioSys.playMusic('tense');
  }
  function setupB2(){
    World.showScene('bar'); World.resetBar();
    World.objs.glass.grp.visible = false;
    World.catToBar(-6, 2);
    World.chars.killer.root.visible = true;
    World.chars.killer.root.position.set(46,0,5);
    World.setPose(World.chars.killer,'idle',true);
    World.walkTo(World.chars.killer, 34, 0.9, null, true);
    AudioSys.playMusic('tense');
  }
  function failPoison(next){
    var s = World.chars.sailor;
    World.setPose(s,'lean');
    Sched.to(function(){
      AudioSys.sfx.glass();
      World.setPose(s,'stagger');
      GFX.flash('#4a1030',0.7);
      Sched.to(function(){
        World.setPose(s,'knockout');
        AudioSys.sfx.drop();
        next();
      }, 700);
    }, 800);
  }
  function failStab(next){
    var k = World.chars.killer, s = World.chars.sailor;
    World.walkTo(k, 24, 20, function(){
      AudioSys.sfx.swing();
      World.setPose(k,'aim');
      GFX.flash('#701020',0.8);
      GFX.shake(3,0.3);
      Sched.to(function(){
        World.setPose(s,'knockout');
        AudioSys.sfx.drop();
        next();
      }, 500);
    });
  }

  function chapter2(){
    return [
      scard('第二章','锚与钟'),
      call(function(){
        World.showScene('bar'); World.resetBar(); World.snapCam(0,24,1);
        GFX.setFade(1); GFX.fadeTo(0,1);
      }),
      music('disco'),
      wait(1.2),
      S('narr','「锚与钟」。霓虹招牌上的锚断了一半, 只剩钟还亮着。'),
      S('narr','烟味, 廉价杜松子酒, 和一台三十年没换唱片的点唱机。'),
      cam(20,18,1),
      S('sailor','再来一杯。算在那位渡先生账上。'),
      S('bartender','老盐, 渡先生今晚还没来。'),
      S('sailor','会来的。他说十一点。那孩子从不失约。'),
      S('hero','……老盐？是我约的证人？'),
      S('beacon','(从你魂里传来, 遥远的) 看来你的约, 得由你的魂来赴了。'),
      wait(0.4),
      sfx('door'),
      cut(-50,18,0.95),
      sfx('sting'),
      S('narr','门开了。进来的人浑身滴着水, 大衣灰得像淤泥。'),
      call(function(){
        World.chars.killer.root.visible=true;
        World.chars.killer.root.position.set(-66,0,5);   // 吧台/高凳之前的走道
        World.walkTo(World.chars.killer, -40, 8);
      }),
      wait(1.6),
      /* — 招牌演出: 门口拧大衣 — */
      call(function(){
        World.stopWalk(World.chars.killer,'lean');
        World.emote(World.chars.killer,'sweat');
        AudioSys.sfx.drip();
      }),
      S('narr','他在门口停了停, 拧了拧大衣下摆。地板上积起一小滩海水。'),
      emo('killer','anger'),
      S('hero','?!! 是他！他从海里爬回来了！'),
      walkCam('killer', 44, 14, 17, 0.95),    // 镜头全程跟着他走到吧台尽头
      call(function(){
        World.chars.killer.root.rotation.y = -Math.PI/2;
        World.setPose(World.chars.killer,'lean');
      }),
      S('killer','…………热水。'),
      S('bartender','……本店不供应"热水"。'),
      S('killer','那就什么都不用了。'),
      S('narr','他在吧台尽头坐下。位置很讲究——能看见门, 能看见老盐, 能看见每一个人。'),
      wait(0.3),
      cut(24,16,1.05),
      sfx('sting'),
      S('narr','酒保转身理酒架的三秒钟。'),
      S('narr','灰大衣的手指在老盐的酒杯上方轻轻一捻。'),
      emo('sailor','note'),
      S('sailor','来了来了, 我的老朋友~'),
      S('hero','他往杯子里下了东西！'),
      S('beacon','老盐的手已经伸向杯子了——别让那口酒进他的嘴!'),
      /* ---- 窗B1 ---- */
      Game.ghostWindow({
        time: 18, startCore:'barLamp',
        setup: setupB1,
        tricks: [
          { core:'glass', label:'掀翻酒杯',
            hint:'附身「酒杯」, 让它滑出吧台摔个粉碎！比起毒药, 老盐更承受得起一杯酒的损失。',
            anim: function(done){ World.trickGlassSlide(done); } }
        ],
        fail: failPoison,
        success: winB1After
      }),
    ];
  }
  function winB1After(){
    return [
      cut(24,14,1.05),
      anim(function(next){ World.startle(World.chars.sailor, next); }),
      emo('sailor','anger'),
      S('sailor','我的酒！！'),
      anim(function(next){ World.sailorSlam(next); }),
      S('sailor','杯子自己跑了！你看见没有, 杯子自己跑的！'),
      S('bartender','老盐, 你今晚喝得够多了。'),
      S('sailor','我碰都没碰它！！'),
      emo('killer','dots'),
      S('killer','………(指尖在台面上敲了一下)'),
      S('hero','毒不成了。但他不会收手的。'),
      wait(0.3),
      cam(-40,14,1),
      call(function(){ World.catToBar(-62, 2); }),
      emo('cat','note'),
      S('narr','吧台下钻出一团黑影——蹭了蹭凳脚, 熟门熟路地跳上高凳。'),
      anim(function(next){ World.catRunTo(-6, next); }),
      S('cat','喵。(它盯着你的火苗看了两秒, 意思是: 又是你)'),
      S('hero','阿煤？你跟着我们跑了三条街？'),
      S('cat','喵—。(意思是: 鱼干味是从这家店飘出去的)'),
      S('beacon','行了, 观众到齐了。看那边——'),
      cut(34,16,1),
      sfx('sting'),
      S('narr','灰大衣站起来了。手插在怀里, 朝老盐一步一步挪。'),
      S('killer','老头。三十年前, 七号码头。'),
      S('killer','你什么都没看见。对吧。'),
      pose('sailor','lean'),
      S('sailor','……我这辈子, 就他妈看见了那一夜。'),
      emo('killer','dots'),
      S('killer','那真遗憾。'),
      sfx('shock'),
      S('hero','刀！他掏刀了——'),
      S('beacon','点唱机！吊扇！把这间店所有会动的东西都用上!'),
      /* ---- 窗B2 (两步连锁) ---- */
      Game.ghostWindow({
        time: 24, startCore:'barLamp',
        setup: setupB2,
        tricks: [
          { core:'jukebox', label:'轰响点唱机',
            hint:'第一步: 让「点唱机」炸出一首船歌！他会警觉地循声走过去——正好停在吊扇底下。',
            anim: function(done){
              World.trickJukebox(function(){});
              Sched.to(function(){
                World.emote(World.chars.killer,'?');
                // 走向点唱机, 到吊扇下方时保持侧身注视点唱机的姿态
                World.walkTo(World.chars.killer, -14, 10, function(){
                  World.setPose(World.chars.killer,'lean');
                  done();
                }, true);
              }, 900);
            } },
          { core:'fan', label:'狂转吊扇',
            hint:'他就站在「吊扇」正下方！第二步: 让扇叶疯转脱轴, 给他一个从天而降的教训！',
            anim: function(done){
              World.trickFanSpin(function(){
                AudioSys.sfx.crash();
                GFX.shake(3,0.4);
                var k = World.chars.killer;
                World.setPose(k,'stagger');
                Sched.to(function(){
                  World.setPose(k,'knockout');
                  AudioSys.sfx.drop();
                  World.trickFanStop();
                  done();
                }, 600);
              });
            } }
        ],
        fail: failStab,
        success: winB2After
      }),
    ];
  }
  function winB2After(){
    return [
      cut(-14,12,1),
      emo('killer','!'),
      S('killer','……这家店。这家店也是活的?!'),
      S('narr','扇叶擦着他的天灵盖呼啸而过。他向后仰倒, 撞翻两张高脚凳。'),
      pose('sailor','idle'),
      S('sailor','(抄起高凳) 就是现在！按住他!!'),
      call(function(){
        // 两人冲向杀手(左侧): 面向左, keepFace保持朝向
        World.walkTo(World.chars.sailor, -8, 14, null, true);
        World.walkTo(World.chars.bartender, -10, 12, null, true);
      }),
      wait(1.4),
      S('narr','酒保用围裙带子捆人的手法, 熟练得令人不敢多问。'),
      /* — 猫的高光时刻 — */
      anim(function(next){ World.catPounce(-16, 6, next); }),
      emo('cat','note'),
      S('cat','喵！(它踩在灰大衣背上, 宣布占领)'),
      wait(0.4),
      sfx('door'),
      cut(-50,16,0.95),
      S('wei','警察！都不许动——'),
      call(function(){
        World.chars.wei.root.visible = true;
        World.chars.wei.root.position.set(-70,0,-4);
        World.setPose(World.chars.wei,'idle',true);
      }),
      walk('wei', -30, 11),
      wait(0.4),
      S('wei','……看起来, 大家都挺配合。'),
      S('sailor','小警察, 你来得正好。这人就是码头开枪的。'),
      S('wei','而你, 就是渡先生笔记里的证人。'),
      cam(14,16,1),
      S('narr','老盐望着窗外的海, 沉默了很久。'),
      S('sailor','……三十年前, 我在七号码头当水手。'),
      S('sailor','那晚有条船要炸掉旧灯塔——保险金, 加一本见不得光的走私账。'),
      anim(function(next){ World.sailorSlam(next); }),
      S('sailor','是守塔人发现的！他冲上钟台, 把钟敲得震天响！'),
      S('sailor','然后……海站起来了。'),
      emo('wei','?'),
      S('wei','海……站起来了？'),
      S('sailor','一面五十英尺高的浪, 立在港外, 一整夜, 一动不动。'),
      S('sailor','天亮时它塌回去。船没了, 账本没了, 守塔人也没了。'),
      S('sailor','官府管那叫风暴。我们管那叫——静波。'),
      S('hero','静波……为什么这两个字, 让我的火苗发烫?'),
      wait(0.3),
      sfx('wave'),
      call(function(){ GFX.shake(2,0.7); }),
      S('narr','整间酒吧的酒液同时向左倾了一寸。'),
      S('narr','海的方向, 传来一声大提琴般的低鸣。'),
      anim(function(next){ World.startle(World.chars.sailor, next); }),
      emo('sailor','!'),
      S('sailor','(脸色煞白) 这声音……三十年了, 我一辈子忘不掉——'),
      S('sailor','静波。静波又要起来了!!'),
      wait(0.4),
    ];
  }

  /* ============================================================
     第三章 · 静波 (奇观·双段式)
     ============================================================ */
  function setupC1(){
    World.showScene('dock'); World.resetDock();
    World.chars.wei.root.visible = true;
    World.chars.wei.root.position.set(-24,0,-8);
    World.setPose(World.chars.wei,'shock',true);
    World.chars.sailor.root.visible = true;
    World.chars.sailor.root.position.set(-36,0,-6);
    World.setPose(World.chars.sailor,'idle',true);
    World.chars.killer.root.visible = true;
    World.chars.killer.root.position.set(26,0,-8);
    World.chars.killer.root.rotation.y = -Math.PI/2;
    World.setPose(World.chars.killer,'aim',true);
    AudioSys.playMusic('tense');
  }
  function setupC2(){
    setupC1();
    GFX.setMode('wonder');
    AudioSys.playMusic('wonder');
  }
  function failFlare(next){
    World.killerShoot(World.chars.wei, next);
  }

  function chapter3(){
    return [
      scard('第三章','静波'),
      call(function(){
        setupC1(); World.snapCam(0,24,0.85);
        GFX.setFade(1); GFX.fadeTo(0,1.2);
      }),
      music('tense'),
      wait(1.4),
      S('narr','回到码头的路上, 押送队形散了。'),
      S('narr','因为没有人能在"那个"面前维持队形。'),
      cam(0,32,0.6),
      sfx('riser'),
      S('narr','海平线整个隆了起来。像有什么东西在水下深吸了一口气。'),
      S('wei','那是什么……那是什么?!'),
      wait(0.3),
      sfx('crash'),
      cut(26,16,0.95),
      sfx('sting'),
      S('narr','混乱里, 灰大衣挣断了围裙带子。'),
      S('narr','他从渔船残骸里捞起一把信号枪——对准了小卫。'),
      S('killer','都别动。'),
      S('killer','账本沉了, 证人老了, 警察——警察还很年轻。'),
      S('hero','那是信号枪！近距离足以致命——'),
      S('beacon','孩子, 听我说。别管枪。'),
      S('beacon','去敲钟。'),
      emo('wei','?'),
      S('hero','什么?!'),
      S('beacon','三十年前, 有人用那口钟对海说过一句话。'),
      S('beacon','海等回音, 等了三十年。'),
      /* ---- 窗C1: 敲钟唤浪 ---- */
      Game.ghostWindow({
        time: 20, startCore:'corpse',
        setup: setupC1,
        tricks: [
          { core:'bell', label:'敲响铜钟',
            hint:'照老灯说的做——跳到「铜钟」, 敲响它。对海说出那句迟到三十年的回音。',
            anim: function(done){
              World.trickBell(function(){});
              Sched.to(function(){
                World.lookAt(10, 36, 0.5);
                AudioSys.playMusic('wonder');
                GFX.setMode('wonder');
                AudioSys.sfx.riser();
                World.wonderRise(function(){
                  Sched.to(done, 500);
                });
              }, 2000);
            } }
        ],
        fail: failFlare,
        success: winWaveUp
      }),
    ];
  }
  /* — 奇观驻立 · 中场演出 — */
  function winWaveUp(){
    return [
      cam(10,36,0.5),
      S('narr','海立起来了。'),
      S('narr','五十英尺高的浪, 悬在港口上空——不落下, 不后退, 不出声。'),
      S('narr','雨滴悬停在半空, 像满天没有落笔的省略号。'),
      cut(26,16,0.9),
      emo('killer','!'),
      pose('killer','shock'),
      S('killer','?!!'),
      S('narr','信号枪的准星, 第一次抖了。'),
      cut(-24,14,0.95),
      emo('wei','!'),
      S('wei','水……停住了……'),
      emo('sailor','dots'),
      S('sailor','静波。和三十年前, 一模一样。'),
      cam(10,34,0.55),
      S('narr','浪体深处有微光流转: 三十年前的雨、沉船的残骸、一枚不肯停摆的怀表。'),
      S('hero','它在……看我。'),
      S('beacon','不是看。是等。'),
      S('beacon','最后一步, 孩子。跳进灯室来——借我的身体, 把光打向浪墙!'),
      /* ---- 窗C2: 灯室点火 ---- */
      Game.ghostWindow({
        time: 25, startCore:'bell',
        setup: setupC2,
        tricks: [
          { core:'beacon', label:'点亮灯室',
            hint:'雨停在了半空, 浪墙在等一道光。沿着「检修台」跳进「灯室」, 点亮它！',
            anim: function(done){
              GFX.flash('#ffdf91', 1);
              AudioSys.sfx.win();
              World.objs.beamFast = true;
              World.objs.beamBoost = 0.36;
              World.lookAt(48, 42, 0.5);
              var t=0;
              World.animate(function(dt){
                t+=dt;
                World.objs.beamPivot.rotation.y += dt*3.2;
                if(t>2.2){
                  World.objs.beamFast = false;
                  World.objs.beamBoost = 0;
                  return true;
                }
                return false;
              });
              Sched.to(function(){
                var k = World.chars.killer;
                World.lookAt(20, 20, 0.7);
                World.setPose(k,'shock');
                World.emote(k,'!');
                AudioSys.sfx.wave();
                Sched.to(function(){
                  AudioSys.sfx.whoosh();
                  World.animate(function(dt){
                    k.root.position.z -= dt*26;
                    k.root.position.y += dt*10;
                    k.root.rotation.z += dt*3;
                    if(k.root.position.z < -60){ k.root.visible=false; return true; }
                    return false;
                  });
                  AudioSys.sfx.splash();
                  Sched.to(done, 1400);
                }, 900);
              }, 2300);
            } }
        ],
        fail: failFlare,
        success: winC2After
      }),
    ];
  }
  function winC2After(){
    return [
      cam(0,26,0.6),
      S('narr','一条水臂从浪墙里探出, 稳、准、轻——'),
      S('narr','像老水手拎起一尾扑腾的鱼, 把灰面人从码头上拎了起来。'),
      S('killer','放开我！放开——我最烦水!! 我最烦——'),
      S('narr','浪把他高高举着, 想了想, 塞进了一个正好路过的空油桶里。'),
      sfx('crash'),
      emo('cat','note'),
      S('cat','喵哈。(不知何时蹲在木箱顶上, 看得津津有味)'),
      wait(0.6),
      cam(10,30,0.55),
      S('narr','然后, 浪墙静了下来。悬滞的雨珠绕着它缓缓打转。'),
      S('narr','五十英尺的高墙微微俯身——朝着钟台, 朝着你。'),
      S('hero','它在……认我。'),
      S('beacon','孩子, 你到现在还没想起来自己是谁, 对吗?'),
      S('hero','我是渡。私家侦探。今晚死在——'),
      S('beacon','渡先生今年三十四岁。'),
      S('beacon','而三十年前那个雨夜, 在钟台上敲钟的年轻守塔人——'),
      S('beacon','也叫这个名字。'),
      wait(0.5),
      call(function(){ GFX.flash('#dff5ee', 0.9); AudioSys.sfx.fate(); }),
      cut(88,14,0.9),
      S('hero','………………'),
      S('hero','钟声。炸药。船。我敲着钟, 看着海站起来。'),
      S('hero','我的心跳, 停在了那面浪立起来的一瞬。'),
      sfx('sting'),
      S('hero','——我不是今晚死的。'),
      S('hero','我已经死了三十年了。'),
      S('narr','火苗剧烈地摇晃了一下, 又稳住了。像一个人挺直了背。'),
      S('beacon','三十年来你一直没走。你忘了名字, 忘了脸, 只记得"有案子没查完"。'),
      S('beacon','于是你附在这座码头上, 看着一个孩子长大——'),
      S('beacon','那个在静波之夜, 被你从海里捞起来的婴儿。'),
      S('hero','……他姓了我的姓。'),
      S('beacon','他做了侦探, 花了半辈子查你的案子。今晚, 差一步。'),
      S('hero','所以我醒在他身边。他一倒下, 我就醒了。'),
      S('hero','是他叫醒的我。'),
      wait(0.6),
      /* — 静波归还 — */
      S('beacon','案子该结了。老伙计, 你看——海把证据还回来了。'),
      anim(function(next){ World.revealChest(next); }),
      cam(10,14,1),
      S('narr','一只包着铜角的木箱, 被浪轻轻放在码头上。'),
      S('narr','三十年前沉海的走私账本。封皮上的火漆, 完好如初。'),
      emo('wei','!'),
      S('wei','这是……全部的证据。人证物证, 齐了。'),
      call(function(){ World.walkTo(World.chars.wei, 4, 9); }),
      wait(1),
      S('narr','小卫合上箱子, 忽然转过身, 对着空无一人的钟台——'),
      cut(-2,16,1.05),
      sfx('sting'),
      call(function(){
        World.chars.wei.root.rotation.y = 0;
        World.setPose(World.chars.wei,'salute');
      }),
      S('narr','立正。敬礼。'),
      S('wei','渡先生。两位渡先生。'),
      S('wei','结案了。'),
      wait(1),
      pose('wei','idle'),
      /* — 浪落 — */
      music('requiem'),
      cam(0,30,0.55),
      S('beacon','好了。它也该回家了。送送它吧。'),
      sfx('wave'),
      anim(function(next){ World.wonderFall(next); }),
      call(function(){ GFX.setMode('normal'); }),
      S('narr','浪落下的那一瞬, 全世界安静得像深海。'),
      S('narr','然后——雨声回来了。潮声回来了。'),
      S('narr','三十年不散的阴云, 裂开了一道缝。'),
      wait(0.5),
      /* ---- 终局抉择 ---- */
      scard('终局','雨停之前'),
      cam(30,20,0.85),
      S('narr','天快亮了。'),
      S('narr','你感到潮水在牵你的衣角——那件早已不存在的制服的衣角。'),
      S('beacon','天亮之前, 魂要选个去处。'),
      S('beacon','跟着潮水走, 是安眠。留下来陪我守塔, 是长夜。'),
      S('beacon','……无论选哪个, 老头子我都替你高兴。'),
      Dialog.choose([
        { label:'随潮水离去, 安然长眠',
          then:[ call(function(){ Game.cmdEnding('tide'); }) ] },
        { label:'留下来, 点亮第二盏灯',
          then:[ call(function(){ Game.cmdEnding('stay'); }) ] }
      ]),
    ];
  }

  /* ============================================================
     结局
     ============================================================ */
  function endingTide(){
    return [
      music('requiem'),
      cam(-60,20,0.8),
      S('narr','你随退潮向外海漂去。灰港在身后一点点变小。'),
      S('hero','老灯。塔就交给你了。'),
      S('beacon','三十年都守了, 不差这三十年。……走好, 孩子。'),
      cam(0,16,1),
      S('narr','码头上, 小卫抱着证物箱, 忽然抬头望向海面。'),
      emo('wei','?'),
      S('wei','(不知道为什么, 她朝着晨光挥了挥手)'),
      emo('cat','note'),
      S('cat','喵——(尾巴摇了很久)'),
      S('narr','三十年的雨, 在日出前停了。'),
      S('narr','而你的名字, 是雨停之后, 落在木板上的最后一滴水声。'),
      wait(1),
      call(function(){ G.ending='tide'; Game.showEnd(); })
    ];
  }
  function endingStay(){
    return [
      music('requiem'),
      cam(70,40,0.6),
      S('hero','老灯, 那把椅子还空着吗?'),
      S('beacon','空了三十年了。灰都替你留着。'),
      S('hero','那我回来了。往后海雾再浓, 这座港也有两盏灯。'),
      call(function(){
        World.objs.lightGlass.material.color.set('#fff2c8');
        GFX.flash('#ffe9a8', 0.6);
        AudioSys.sfx.riser();
      }),
      S('narr','清晨第一班渡轮进港时, 水手们发现灯塔的光比往常亮了一倍。'),
      S('narr','老水手们管那叫"渡火"——'),
      S('narr','跟着它走的船, 从不迷路。'),
      emo('cat','note'),
      S('cat','喵。(它已经在灯室窗台上占好了位置)'),
      wait(1),
      call(function(){ G.ending='stay'; Game.showEnd(); })
    ];
  }

  /* ============================================================ */
  var CHAPTERS = {
    0:{ name:'序章', fn:prologue },
    1:{ name:'第一章·逆转四分钟', fn:chapter1 },
    2:{ name:'第二章·锚与钟', fn:chapter2 },
    3:{ name:'第三章·静波', fn:chapter3 },
    tide:{ name:'结局·归潮', fn:endingTide },
    stay:{ name:'结局·渡火', fn:endingStay }
  };

  return { CHAPTERS: CHAPTERS };
})();

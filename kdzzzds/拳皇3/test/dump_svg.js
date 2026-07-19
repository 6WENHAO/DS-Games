// dump sample SVG assets to disk for visual inspection
'use strict';
var fs = require('fs');
var path = require('path');
function makeCtx(){
  var stub = {};
  return new Proxy(stub, { get:function(t,p){ if(p in t) return t[p]; if(p==='canvas') return {width:480,height:270}; return function(){ return {addColorStop:function(){},width:10}; }; }, set:function(t,p,v){ t[p]=v; return true; } });
}
function Canvas(){ this.width=300; this.height=150; this.style={}; }
Canvas.prototype.getContext = function(){ return makeCtx(); };
global.Image = function(){ var s=this; Object.defineProperty(this,'src',{set:function(v){ s._s=v; },get:function(){return s._s;}}); };
global.window = global;
global.document = { readyState:'complete', createElement:function(){ return new Canvas(); }, getElementById:function(){ return new Canvas(); }, addEventListener:function(){} };
Object.defineProperty(global,'navigator',{value:{getGamepads:function(){return [];}},configurable:true});
global.localStorage = { getItem:function(){return null;}, setItem:function(){} };
global.requestAnimationFrame = function(){};
window.addEventListener = function(){};
global.AudioContext = undefined;

['svg.js','pixelfont.js','poses.js','puppet.js','effects.js','stages.js'].forEach(function(f){
  (0,eval)(fs.readFileSync(path.join(__dirname,'..','js',f),'utf8'));
});
// characters.js needs nothing else
(0,eval)(fs.readFileSync(path.join(__dirname,'..','js','characters.js'),'utf8'));

var KOF = global.KOF;
var out = path.join(__dirname,'svgdump');
if(!fs.existsSync(out)) fs.mkdirSync(out);

// character poses sheet: draw several chars x poses into one big SVG
var chars = ['yanlong','yueying','leihao','jifeng','tiewu','xuanbing','shenwei'];
var poses = ['idleA','walk1','run1','jumpTop','crouch','jabA','straightA','hkickA','dpRise','fbThrow','guardHi','hitHi','lieDown','sweepA','winA','grabLift'];
var FW=170, FH=132;
var sheet = '<svg xmlns="http://www.w3.org/2000/svg" width="'+(FW*poses.length/2)+'" height="'+(FH*chars.length*2)+'" shape-rendering="crispEdges">';
sheet += '<rect width="100%" height="100%" fill="#204060"/>';
for(var c=0;c<chars.length;c++){
  var ch = KOF.Characters.get(chars[c]);
  for(var p=0;p<poses.length;p++){
    var svg = KOF.Puppet.render(ch, KOF.Puppet.getPose(ch,poses[p]), ch.palettes[0], false);
    var inner = svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
    var col = p % (poses.length/2), row = c*2 + Math.floor(p/(poses.length/2));
    sheet += '<g transform="translate('+(col*FW)+','+(row*FH)+')">'+inner+'</g>';
  }
}
sheet += '</svg>';
fs.writeFileSync(path.join(out,'chars.svg'), sheet);

// stage
var st = KOF.Stages.DEFS.street.build();
fs.writeFileSync(path.join(out,'stage_sky.svg'), st.sky.svg);
fs.writeFileSync(path.join(out,'stage_mid.svg'), st.mid[0].svg);

console.log('dumped to', out);

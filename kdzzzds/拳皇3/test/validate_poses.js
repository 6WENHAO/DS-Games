// numeric validation of generated character SVG frames
'use strict';
var fs = require('fs');
var path = require('path');
function makeCtx(){
  return new Proxy({}, { get:function(t,p){ if(p in t) return t[p]; if(p==='canvas') return {width:480,height:270}; return function(){ return {addColorStop:function(){},width:10}; }; }, set:function(t,p,v){ t[p]=v; return true; } });
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

['svg.js','pixelfont.js','poses.js','puppet.js','effects.js','stages.js','characters.js'].forEach(function(f){
  (0,eval)(fs.readFileSync(path.join(__dirname,'..','js',f),'utf8'));
});
var KOF = global.KOF;
var GY = 126;
var problems = 0;

function numsFrom(svg){
  var nums = [];
  var re = /(?:x1|y1|x2|y2|cx|cy|x|y)="(-?[\d.]+)"/g, m;
  while((m=re.exec(svg))) nums.push(parseFloat(m[1]));
  var rp = /points="([^"]+)"/g;
  while((m=rp.exec(svg))){
    m[1].trim().split(/[\s,]+/).forEach(function(v){ var n=parseFloat(v); if(!isNaN(n)) nums.push(n); });
  }
  return nums;
}
function coordPairs(svg){
  var pairs = [];
  var re = /x2="(-?[\d.]+)" y2="(-?[\d.]+)"/g, m;
  while((m=re.exec(svg))) pairs.push([parseFloat(m[1]), parseFloat(m[2])]);
  return pairs;
}

var chars = KOF.Characters.ROSTER.concat(['shenwei']);
var groundedPoses = ['idleA','idleB','walk1','walk2','walk3','walk4','crouch','guardHi','guardLo','jabA','straightA','lkickA','hkickWind','cJabA','sweepA','fbThrow','chargePose','winA','intro1'];
chars.forEach(function(id){
  var ch = KOF.Characters.get(id);
  var allPoses = Object.keys(KOF.Poses);
  allPoses.forEach(function(pn){
    var svg = KOF.Puppet.render(ch, KOF.Puppet.getPose(ch, pn), ch.palettes[0], false);
    if(svg.indexOf('NaN')>=0){ console.log('NaN in '+id+':'+pn); problems++; return; }
    var nums = numsFrom(svg);
    var bad = nums.filter(function(n){ return isNaN(n) || n<-40 || n>240; });
    if(bad.length){ console.log('out-of-range coords in '+id+':'+pn+' -> '+bad.slice(0,4).join(',')); problems++; }
  });
  // grounded: check lowest line endpoint reaches near ground
  groundedPoses.forEach(function(pn){
    var svg = KOF.Puppet.render(ch, KOF.Puppet.getPose(ch, pn), ch.palettes[0], false);
    var ys = coordPairs(svg).map(function(p){ return p[1]; });
    var maxY = Math.max.apply(null, ys);
    if(maxY < GY-14){ console.log('feet floating in '+id+':'+pn+' lowest='+maxY.toFixed(1)); problems++; }
    if(maxY > GY+10){ console.log('feet under floor in '+id+':'+pn+' lowest='+maxY.toFixed(1)); problems++; }
  });
});
console.log(problems===0 ? 'POSE GEOMETRY OK ('+chars.length+' chars x '+Object.keys(KOF.Poses).length+' poses)' : problems+' pose problems');
process.exit(problems?1:0);

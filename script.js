// ══════════════════ STATE ══════════════════
let stream=null,currentFilter='',totalShots=3,photos=[],shooting=false;
let placedStickers=[];   // {id,slotIndex,emoji,x%,y%,rot,size,isAuto,autoCat,isBlush,blushData}
let blushDataPerSlot={}; // {slotIndex: [{x%,y%,rx%,ry%,side}]}
let activeStickerEmoji=null;
let selectedStickerEl=null;
let faceApiReady=false;
let chosenBg='#e8ddd0';
// Custom image background state (used when chosenBg === 'CUSTOM_IMAGE')
let customBgImage = {
  dataUrl: null,   // full uploaded image as data URL
  zoom: 100,       // percent, 100-300
  opacity: 85,     // percent, 10-100
  offsetX: 0,      // px offset for panning, relative to centered position
  offsetY: 0,
};

const nowD=new Date();
const shortDate=nowD.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}).toUpperCase();
const longDate=nowD.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
document.querySelectorAll('#ss-date,#st-date').forEach(el=>el.textContent=shortDate);
document.getElementById('fs-sub').textContent=longDate;
document.getElementById('fs-date').textContent=shortDate;

// ══════════════════ MODEL PATH ══════════════════
// Models should be in a "models" folder next to this HTML file
const MODEL_PATH='./models';

// ══════════════════ LOAD MODELS ══════════════════
async function loadModels(){
  // Show loading overlay only if models take more than 400ms
  const showTimer = setTimeout(()=>{
    document.getElementById('load-overlay').classList.remove('hidden');
    document.getElementById('load-text').textContent='Loading face detection…';
  }, 400);
  // Always hide overlay after 8s max
  const killTimer = setTimeout(()=>{
    document.getElementById('load-overlay').classList.add('hidden');
  }, 8000);
  try{
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_PATH);
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_PATH);
    faceApiReady=true;
    document.getElementById('face-status').textContent='Face detection ready ✦';
  }catch(e){
    console.warn('face-api load failed:',e);
    document.getElementById('face-status').textContent='Face detection unavailable — check ./models/ folder';
  }finally{
    clearTimeout(showTimer);
    clearTimeout(killTimer);
    document.getElementById('load-overlay').classList.add('hidden');
  }
}
window.addEventListener('load',()=>setTimeout(loadModels,100));

// ══════════════════ BACKGROUNDS ══════════════════
const BG_OPTS=[
  {bg:'#e8ddd0',label:'Parchment',light:true},{bg:'#f5f0e8',label:'Cream',light:true},
  {bg:'#dde4da',label:'Sage',light:true},{bg:'#d8dfe6',label:'Slate',light:true},
  {bg:'#ede0d4',label:'Blush',light:true},{bg:'#e6e0d6',label:'Stone',light:true},
  {bg:'#d5cec4',label:'Linen',light:true},{bg:'#cdd5c2',label:'Moss',light:true},
  {bg:'#2c2218',label:'Espresso',light:false},{bg:'#3d3028',label:'Dark Oak',light:false},
  {bg:'#1e2a1e',label:'Forest',light:false},{bg:'#1e1e2e',label:'Midnight',light:false},
  {bg:'linear-gradient(170deg,#e8ddd0,#dde4da)',label:'Warm Sage',light:true},
  {bg:'linear-gradient(170deg,#ede0d4,#d8dfe6)',label:'Blush Slate',light:true},
  {bg:'linear-gradient(170deg,#d5cec4,#cdd5c2)',label:'Linen Moss',light:true},
  {bg:'linear-gradient(170deg,#dde4da,#d8dfe6)',label:'Sage Slate',light:true},
  {bg:'linear-gradient(170deg,#2c2218,#1e2a1e)',label:'Espresso Forest',light:false},
  {bg:'linear-gradient(170deg,#3d3028,#1e1e2e)',label:'Oak Midnight',light:false},
  {bg:'linear-gradient(170deg,#e8ddd0,#ede0d4)',label:'Warm Fade',light:true},
  {bg:'linear-gradient(170deg,#1e1e2e,#1e2a1e)',label:'Deep Night',light:false},
];
(()=>{
  const grid=document.getElementById('bg-grid');
  BG_OPTS.forEach((o,i)=>{
    const el=document.createElement('div');
    el.className='bg-opt'+(o.light?' light':'')+(i===0?' active':'');
    el.style.background=o.bg;
    el.innerHTML=`<span class="bg-label">${o.label}</span>`;
    el.addEventListener('click',()=>{
      document.querySelectorAll('.bg-opt').forEach(x=>x.classList.remove('active'));
      el.classList.add('active'); chosenBg=o.bg;
      updateBgCurrentLabel(o.label);
    });
    grid.appendChild(el);
  });
})();

function updateBgCurrentLabel(text){
  document.getElementById('bg-current-label').textContent = text ? `Selected: ${text}` : '';
}

// ══════════════════ BG MODE TABS ══════════════════
document.querySelectorAll('.bg-mode-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.bg-mode-tab').forEach(t=>t.classList.remove('active'));
    document.querySelectorAll('.bg-mode-panel').forEach(p=>p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('bg-panel-'+tab.dataset.mode).classList.add('active');
  });
});

// ══════════════════ CUSTOM GRADIENT BUILDER ══════════════════
const GRAD_PRESETS=[
  ['#e8ddd0','#dde4da'], ['#ede0d4','#d8dfe6'], ['#f4a7b9','#e8d5f5'],
  ['#2c2218','#1e2a1e'], ['#fde8d8','#fff0a0'], ['#a8d8ea','#d4f5e9'],
  ['#b05a3a','#e8b86d'], ['#7a8c74','#cdd5c2'],
];
function renderGradientPreview(){
  const a=document.getElementById('grad-color-a').value;
  const b=document.getElementById('grad-color-b').value;
  const ang=document.getElementById('grad-angle').value;
  document.getElementById('grad-preview').style.background=`linear-gradient(${ang}deg, ${a}, ${b})`;
  document.getElementById('grad-angle-val').textContent=ang+'°';
}
function syncColorInputs(colorEl,textEl){
  colorEl.addEventListener('input',()=>{textEl.value=colorEl.value; renderGradientPreview();});
  textEl.addEventListener('input',()=>{
    if(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(textEl.value)){
      colorEl.value=textEl.value; renderGradientPreview();
    }
  });
}
syncColorInputs(document.getElementById('grad-color-a'),document.getElementById('grad-color-a-text'));
syncColorInputs(document.getElementById('grad-color-b'),document.getElementById('grad-color-b-text'));
document.getElementById('grad-angle').addEventListener('input',renderGradientPreview);

(function buildGradPresets(){
  const wrap=document.getElementById('grad-presets');
  GRAD_PRESETS.forEach(([a,b])=>{
    const sw=document.createElement('div');
    sw.className='grad-preset-swatch';
    sw.style.background=`linear-gradient(135deg, ${a}, ${b})`;
    sw.addEventListener('click',()=>{
      document.getElementById('grad-color-a').value=a;
      document.getElementById('grad-color-a-text').value=a;
      document.getElementById('grad-color-b').value=b;
      document.getElementById('grad-color-b-text').value=b;
      renderGradientPreview();
    });
    wrap.appendChild(sw);
  });
})();
renderGradientPreview();

document.getElementById('grad-apply-btn').addEventListener('click',()=>{
  const a=document.getElementById('grad-color-a').value;
  const b=document.getElementById('grad-color-b').value;
  const ang=document.getElementById('grad-angle').value;
  chosenBg=`linear-gradient(${ang}deg,${a},${b})`;
  document.querySelectorAll('.bg-opt').forEach(x=>x.classList.remove('active'));
  updateBgCurrentLabel('Custom Gradient');
});

// ══════════════════ CUSTOM IMAGE UPLOAD + EDITOR ══════════════════
const MAX_UPLOAD_BYTES = 5*1024*1024; // 5MB
document.getElementById('img-upload-input').addEventListener('change',e=>{
  const file=e.target.files[0];
  const warnEl=document.getElementById('img-size-warn');
  if(!file)return;
  if(!file.type.startsWith('image/')){
    warnEl.textContent='Please choose an image file.'; warnEl.className='img-size-warn err'; return;
  }
  if(file.size > MAX_UPLOAD_BYTES){
    warnEl.textContent=`Image is too large (${(file.size/1024/1024).toFixed(1)}MB). Please choose one under 5MB.`;
    warnEl.className='img-size-warn err';
    return;
  }
  warnEl.textContent=''; warnEl.className='img-size-warn';
  const reader=new FileReader();
  reader.onload=ev=>{
    customBgImage.dataUrl = ev.target.result;
    customBgImage.zoom = 100;
    customBgImage.opacity = 85;
    customBgImage.offsetX = 0;
    customBgImage.offsetY = 0;
    showImageEditor();
  };
  reader.readAsDataURL(file);
});

function showImageEditor(){
  document.getElementById('img-drop-zone').classList.add('has-image');
  document.getElementById('img-drop-empty').style.display='none';
  document.getElementById('img-editor').classList.add('show');
  const img=document.getElementById('img-editor-img');
  img.src=customBgImage.dataUrl;
  document.getElementById('img-zoom').value=customBgImage.zoom;
  document.getElementById('img-zoom-val').textContent=customBgImage.zoom+'%';
  document.getElementById('img-opacity').value=customBgImage.opacity;
  document.getElementById('img-opacity-val').textContent=customBgImage.opacity+'%';
  applyImageTransform();
}

function applyImageTransform(){
  const img=document.getElementById('img-editor-img');
  const scale=customBgImage.zoom/100;
  img.style.transform=`translate(-50%,-50%) translate(${customBgImage.offsetX}px,${customBgImage.offsetY}px) scale(${scale})`;
  img.style.opacity=customBgImage.opacity/100;
}

// Fit image to stage on load (cover behaviour as the zoom=100% baseline)
document.getElementById('img-editor-img').addEventListener('load',()=>{
  const stage=document.getElementById('img-editor-stage');
  const img=document.getElementById('img-editor-img');
  const stageW=stage.offsetWidth, stageH=stage.offsetHeight;
  const natW=img.naturalWidth, natH=img.naturalHeight;
  // Compute base size so image covers the stage at zoom=100%
  const coverScale=Math.max(stageW/natW, stageH/natH);
  img.dataset.baseW=natW*coverScale;
  img.dataset.baseH=natH*coverScale;
  img.style.width=img.dataset.baseW+'px';
  img.style.height=img.dataset.baseH+'px';
  applyImageTransform();
});

document.getElementById('img-zoom').addEventListener('input',e=>{
  customBgImage.zoom=parseInt(e.target.value);
  document.getElementById('img-zoom-val').textContent=customBgImage.zoom+'%';
  applyImageTransform();
});
document.getElementById('img-opacity').addEventListener('input',e=>{
  customBgImage.opacity=parseInt(e.target.value);
  document.getElementById('img-opacity-val').textContent=customBgImage.opacity+'%';
  applyImageTransform();
});

// Drag to pan
(function setupImagePan(){
  const stage=document.getElementById('img-editor-stage');
  let dragging=false, startX=0, startY=0, startOffX=0, startOffY=0;
  const onDown=(x,y)=>{
    dragging=true; startX=x; startY=y;
    startOffX=customBgImage.offsetX; startOffY=customBgImage.offsetY;
    stage.classList.add('dragging');
  };
  const onMove=(x,y)=>{
    if(!dragging)return;
    customBgImage.offsetX = startOffX + (x-startX);
    customBgImage.offsetY = startOffY + (y-startY);
    applyImageTransform();
  };
  const onUp=()=>{ dragging=false; stage.classList.remove('dragging'); };
  stage.addEventListener('mousedown',e=>{e.preventDefault();onDown(e.clientX,e.clientY);});
  document.addEventListener('mousemove',e=>onMove(e.clientX,e.clientY));
  document.addEventListener('mouseup',onUp);
  stage.addEventListener('touchstart',e=>{e.preventDefault();const t=e.touches[0];onDown(t.clientX,t.clientY);},{passive:false});
  document.addEventListener('touchmove',e=>{if(dragging){const t=e.touches[0];onMove(t.clientX,t.clientY);}},{passive:true});
  document.addEventListener('touchend',onUp);
})();

document.getElementById('img-remove-btn').addEventListener('click',()=>{
  customBgImage = {dataUrl:null, zoom:100, opacity:85, offsetX:0, offsetY:0};
  document.getElementById('img-drop-zone').classList.remove('has-image');
  document.getElementById('img-drop-empty').style.display='block';
  document.getElementById('img-editor').classList.remove('show');
  document.getElementById('img-upload-input').value='';
  if(chosenBg==='CUSTOM_IMAGE'){
    chosenBg='#e8ddd0';
    updateBgCurrentLabel('');
  }
});

document.getElementById('img-apply-btn').addEventListener('click',()=>{
  if(!customBgImage.dataUrl)return;
  chosenBg='CUSTOM_IMAGE';
  document.querySelectorAll('.bg-opt').forEach(x=>x.classList.remove('active'));
  updateBgCurrentLabel('Custom Image');
});

// ══════════════════ SCREEN NAV ══════════════════
function goTo(id){
  document.querySelectorAll('.screen').forEach(s=>{
    if(s.classList.contains('active')){s.classList.add('exit');s.classList.remove('active');setTimeout(()=>s.classList.remove('exit'),500);}
  });
  setTimeout(()=>document.getElementById(id).classList.add('active'),160);
}

// ══════════════════ CAMERA ══════════════════
async function startCamera(){
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:{width:1280,height:960,facingMode:'user'},audio:false});
    document.getElementById('fp-video').srcObject=stream;
    document.getElementById('s-video').srcObject=stream;
  }catch(e){alert('Camera access denied.');}
}

// ══════════════════ FILTERS ══════════════════
document.querySelectorAll('.fchip').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.fchip').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); currentFilter=b.dataset.f;
    [document.getElementById('fp-video'),document.getElementById('s-video')].forEach(v=>{
      v.className=''; if(currentFilter)v.classList.add('f-'+currentFilter);
    });
  });
});
document.querySelectorAll('.schip').forEach(b=>{
  b.addEventListener('click',()=>{
    document.querySelectorAll('.schip').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); totalShots=parseInt(b.dataset.s);
  });
});

// ══════════════════ NAV BUTTONS ══════════════════
document.getElementById('btn-start').addEventListener('click',async()=>{
  await startCamera(); buildShootStrip(); goTo('s-filter');
});
document.getElementById('btn-to-shoot').addEventListener('click',()=>{buildShootStrip();goTo('s-shoot');});
document.getElementById('btn-to-bg').addEventListener('click',()=>goTo('s-bg'));
document.getElementById('btn-skip-sticker').addEventListener('click',()=>goTo('s-bg'));
document.getElementById('btn-to-final').addEventListener('click',()=>{
  buildFinalStrip();
  goTo('s-final');
  if(pendingSave && !currentUser){
    document.getElementById('save-prompt-banner').classList.add('show');
  }
});

// ══════════════════ SHOOT STRIP ══════════════════
function buildShootStrip(){
  const strip=document.getElementById('shoot-strip');
  strip.querySelectorAll('.sp-slot').forEach(s=>s.remove());
  const dateEl=strip.querySelector('.sp-date');
  for(let i=0;i<totalShots;i++){
    const sl=document.createElement('div');sl.className='sp-slot';sl.id=`ss-slot-${i}`;
    sl.innerHTML=`<div class="sp-slot-num">${i+1}</div>`;
    strip.insertBefore(sl,dateEl);
  }
}

// ══════════════════ SHOOT ══════════════════
const shootBtn=document.getElementById('shoot-btn');
const shootStatus=document.getElementById('shoot-status');
const countdownEl=document.getElementById('countdown-el');
const flashOverlay=document.getElementById('flash-overlay');

shootBtn.addEventListener('click',async()=>{
  if(shooting||!stream)return;
  shooting=true; shootBtn.disabled=true; photos=[]; placedStickers=[]; blushDataPerSlot={};
  buildShootStrip();
  for(let i=0;i<totalShots;i++){
    for(let c=3;c>=1;c--){
      countdownEl.textContent=c;countdownEl.classList.add('on');
      shootStatus.textContent=`Photo ${i+1} of ${totalShots} — smile!`;
      await sleep(850);countdownEl.classList.remove('on');await sleep(120);
    }
    shootStatus.textContent='Click!';
    flashOverlay.classList.add('pop');await sleep(80);flashOverlay.classList.remove('pop');
    const d=captureFrame();photos.push(d);
    const sl=document.getElementById(`ss-slot-${i}`);
    if(sl){sl.innerHTML='';const img=document.createElement('img');img.src=d;sl.appendChild(img);}
    if(i<totalShots-1){shootStatus.textContent=`${i+1} done — get ready!`;await sleep(1100);}
  }
  shootStatus.textContent='All done! ✦';
  await sleep(500);
  await buildStickerStrip();
  goTo('s-sticker');
  shooting=false;shootBtn.disabled=false;
});

function captureFrame(){
  const sv=document.getElementById('s-video');
  const w=sv.videoWidth||640,h=sv.videoHeight||480;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');
  ctx.save();ctx.translate(w,0);ctx.scale(-1,1);ctx.drawImage(sv,0,0,w,h);ctx.restore();
  applyCanvasFilter(ctx,w,h,currentFilter);
  return c.toDataURL('image/jpeg',.93);
}
function applyCanvasFilter(ctx,w,h,f){
  if(!f)return;
  const id=ctx.getImageData(0,0,w,h),d=id.data;
  for(let i=0;i<d.length;i+=4){
    let r=d[i],g=d[i+1],b=d[i+2];
    if(f==='noir'){const a=r*.3+g*.59+b*.11;r=g=b=Math.min(255,a*1.2);}
    else if(f==='warm'){r=Math.min(255,r*1.1+15);b=Math.max(0,b*.85);}
    else if(f==='fade'){r=Math.min(255,r*.68+80);g=Math.min(255,g*.68+80);b=Math.min(255,b*.68+80);}
    else if(f==='chrome'){r=Math.min(255,r*1.15);g=Math.min(255,g*1.05);b=Math.min(255,b*.92);}
    else if(f==='vintage'){const a=r*.3+g*.59+b*.11;r=Math.min(255,a*.4+r*.6+25);g=Math.min(255,a*.4+g*.6);b=Math.max(0,a*.4+b*.6-22);}
    else if(f==='matte'){r=Math.min(230,Math.max(25,r*.72+42));g=Math.min(230,Math.max(25,g*.72+42));b=Math.min(230,Math.max(25,b*.72+42));}
    d[i]=r;d[i+1]=g;d[i+2]=b;
  }
  ctx.putImageData(id,0,0);
}

// ══════════════════ FACE DETECTION ══════════════════
// Returns rich face data with all landmark positions as % of image
async function detectFace(imgEl){
  if(!faceApiReady)return null;
  try{
    // Wait for img to be loaded
    if(!imgEl.complete) await new Promise(r=>{imgEl.onload=r;});
    const result=await faceapi
      .detectSingleFace(imgEl,new faceapi.TinyFaceDetectorOptions({inputSize:320,scoreThreshold:.35}))
      .withFaceLandmarks(true);
    if(!result)return null;
    const W=imgEl.naturalWidth||imgEl.width||imgEl.offsetWidth||200;
    const H=imgEl.naturalHeight||imgEl.height||imgEl.offsetHeight||150;
    const lm=result.landmarks;
    const box=result.detection.box;

    const p=(pt)=>({x:pt.x/W*100, y:pt.y/H*100});
    const avg=(pts)=>{const pp=pts.map(p);return{x:pp.reduce((s,v)=>s+v.x,0)/pp.length,y:pp.reduce((s,v)=>s+v.y,0)/pp.length};}

    const jaw=lm.getJawOutline().map(p);
    const leftEye=lm.getLeftEye().map(p);
    const rightEye=lm.getRightEye().map(p);
    const nose=lm.getNose().map(p);
    const leftBrow=lm.getLeftEyeBrow().map(p);
    const rightBrow=lm.getRightEyeBrow().map(p);

    const avgLeftEye=avg(lm.getLeftEye());
    const avgRightEye=avg(lm.getRightEye());
    const avgNose=avg(lm.getNose());
    const avgLeftBrow=avg(lm.getLeftEyeBrow());
    const avgRightBrow=avg(lm.getRightEyeBrow());

    // Face tilt angle (degrees) from eye line
    const dxEye=(avgRightEye.x/100*W)-(avgLeftEye.x/100*W);
    const dyEye=(avgRightEye.y/100*H)-(avgLeftEye.y/100*H);
    const tiltDeg=Math.atan2(dyEye,dxEye)*(180/Math.PI); // degrees the face is tilted

    const faceW=box.width/W*100;
    const faceH=box.height/H*100;

    // Forehead center (above brow midpoint)
    const browMid={x:(avgLeftBrow.x+avgRightBrow.x)/2, y:(avgLeftBrow.y+avgRightBrow.y)/2};
    // Forehead is above the brow midpoint by ~15% of face height
    const forehead={x:browMid.x, y:browMid.y - faceH*0.18};
    // Crown (very top - for crown/bow)
    const crown={x:browMid.x, y:box.y/H*100 - faceH*0.1};
    // Cheeks
    const leftCheek={x:avgLeftEye.x - faceW*0.18, y:avgLeftEye.y + faceH*0.22};
    const rightCheek={x:avgRightEye.x + faceW*0.18, y:avgRightEye.y + faceH*0.22};
    // Hair line positions for flowers (left and right of head)
    const hairLeft={x:box.x/W*100 - faceW*0.05, y:box.y/H*100 + faceH*0.05};
    const hairRight={x:(box.x+box.width)/W*100 + faceW*0.05, y:box.y/H*100 + faceH*0.05};
    const hairTop={x:browMid.x, y:box.y/H*100 - faceH*0.05};
    // Nose bridge (glasses)
    const noseBridge={x:avgNose.x, y:(avgLeftEye.y+avgRightEye.y)/2 - faceH*0.04};

    return {
      box:{x:box.x/W*100,y:box.y/H*100,w:faceW,h:faceH},
      tiltDeg, faceW, faceH,
      forehead, crown, browMid,
      leftEye:avgLeftEye, rightEye:avgRightEye,
      leftCheek, rightCheek,
      hairLeft, hairRight, hairTop,
      noseBridge, avgNose,
      // Blush ellipse params — placed on cheekbones
      blushLeft:{cx:leftCheek.x, cy:leftCheek.y, rx:faceW*0.15, ry:faceH*0.09},
      blushRight:{cx:rightCheek.x, cy:rightCheek.y, rx:faceW*0.15, ry:faceH*0.09},
    };
  }catch(e){console.warn('detect error',e);return null;}
}

// ══════════════════ AUTO STICKER RECIPES ══════════════════
// Each returns [{emoji,x%,y%,rot,szFactor}] where szFactor * faceW = size%
// rot = base rotation + tilt compensation
const AUTO_RECIPES={
  bow:(f)=>[
    // Bow sits at the top-right of forehead, tilted with face tilt
    {emoji:'🎀', x:f.crown.x+f.faceW*0.25, y:f.crown.y-f.faceH*0.02, rot:f.tiltDeg-12, szF:0.35},
  ],
  hearts:(f)=>[
    {emoji:'🩷', x:f.leftCheek.x,  y:f.leftCheek.y, rot:f.tiltDeg-8, szF:0.20},
    {emoji:'🩷', x:f.rightCheek.x, y:f.rightCheek.y, rot:f.tiltDeg+8, szF:0.20},
  ],
  blush:(f)=>'BLUSH', // special handled
  flowers:(f)=>[
    {emoji:'🌸', x:f.hairLeft.x+f.faceW*0.05,  y:f.hairLeft.y,  rot:f.tiltDeg-18, szF:0.28},
    {emoji:'🌷', x:f.hairRight.x-f.faceW*0.05, y:f.hairRight.y, rot:f.tiltDeg+14, szF:0.24},
    {emoji:'✿',  x:f.hairTop.x-f.faceW*0.12,   y:f.hairTop.y,   rot:f.tiltDeg+5,  szF:0.18},
  ],
  crown:(f)=>[
    {emoji:'👑', x:f.crown.x, y:f.crown.y-f.faceH*0.06, rot:f.tiltDeg, szF:0.55},
  ],
  glasses:(f)=>[
    {emoji:'🕶', x:f.noseBridge.x, y:f.noseBridge.y, rot:f.tiltDeg, szF:0.70},
  ],
  stars:(f)=>[
    {emoji:'⭐', x:f.hairLeft.x,   y:f.hairLeft.y-f.faceH*0.08,  rot:f.tiltDeg-22, szF:0.20},
    {emoji:'✨', x:f.hairRight.x,  y:f.hairRight.y-f.faceH*0.08, rot:f.tiltDeg+18, szF:0.17},
    {emoji:'⭐', x:f.crown.x-f.faceW*0.1, y:f.crown.y-f.faceH*0.1, rot:f.tiltDeg, szF:0.15},
  ],
};

// ══════════════════ BUILD STICKER STRIP ══════════════════
async function buildStickerStrip(){
  placedStickers=[];blushDataPerSlot={};
  activeStickerEmoji=null;
  document.querySelectorAll('.spick').forEach(s=>s.classList.remove('sel'));
  document.querySelectorAll('.acat').forEach(s=>s.classList.remove('active'));

  const strip=document.getElementById('sticker-strip');
  strip.querySelectorAll('.sp-slot').forEach(s=>s.remove());
  const dateEl=strip.querySelector('.sp-date');
  for(let i=0;i<photos.length;i++){
    const sl=document.createElement('div');sl.className='sp-slot';sl.id=`st-slot-${i}`;
    const img=document.createElement('img');img.src=photos[i];img.id=`st-img-${i}`;
    sl.appendChild(img);
    // blush canvas layer
    const bc=document.createElement('canvas');bc.className='blush-canvas';bc.id=`blush-canvas-${i}`;
    sl.appendChild(bc);
    setupManualSlot(sl,i);
    strip.insertBefore(sl,dateEl);
  }
  deselectSticker();
}

// ══════════════════ AUTO CATS CLICK ══════════════════
document.querySelectorAll('.acat').forEach(btn=>{
  btn.addEventListener('click',async()=>{
    const cat=btn.dataset.cat;
    const wasActive=btn.classList.contains('active');
    document.querySelectorAll('.acat').forEach(b=>b.classList.remove('active'));

    if(wasActive){
      if(cat==='blush') removeBlush();
      else removeAutoStickers(cat);
      document.getElementById('face-status').textContent='Removed.';
      return;
    }
    btn.classList.add('active');
    if(!faceApiReady){document.getElementById('face-status').textContent='Face detection unavailable — put models in ./models/ folder';return;}
    document.getElementById('face-status').textContent='Detecting faces…';

    let placed=0;
    for(let i=0;i<photos.length;i++){
      const imgEl=document.getElementById(`st-img-${i}`);
      const slotEl=document.getElementById(`st-slot-${i}`);
      if(!imgEl||!slotEl)continue;
      const face=await detectFace(imgEl);
      if(!face){document.getElementById('face-status').textContent=`Photo ${i+1}: no face detected`;continue;}

      if(cat==='blush'){
        // Draw blush on canvas overlay
        drawBlushOnCanvas(i,face,slotEl);
        blushDataPerSlot[i]=face; // store face for canvas export
        placed++;
        continue;
      }

      const recipe=AUTO_RECIPES[cat];
      if(!recipe||recipe==='BLUSH')continue;
      const stickers=recipe(face);
      const slotW=slotEl.offsetWidth||184;

      stickers.forEach(sk=>{
        // sz is pixel size based on face width proportion mapped to slot px width
        const pxSize=Math.max(14,Math.round(slotW*(sk.szF*face.faceW/100)));
        const s={id:Date.now()+Math.random(),slotIndex:i,emoji:sk.emoji,
          x:Math.max(1,Math.min(99,sk.x)),
          y:Math.max(1,Math.min(99,sk.y)),
          rot:sk.rot,size:pxSize,isAuto:true,autoCat:cat};
        placedStickers.push(s);
        renderStickerEl(slotEl,s);
        placed++;
      });
    }
    document.getElementById('face-status').textContent=
      placed>0?`✦ Placed ${placed} item${placed>1?'s':''} — drag or rotate to adjust`:'No faces detected in photos.';
  });
});

// ══════════════════ BLUSH CANVAS ══════════════════
function drawBlushOnCanvas(slotIndex,face,slotEl){
  const bc=document.getElementById(`blush-canvas-${slotIndex}`);
  if(!bc)return;
  const w=slotEl.offsetWidth||184;
  const h=slotEl.offsetHeight||138;
  bc.width=w; bc.height=h;
  const ctx=bc.getContext('2d');
  ctx.clearRect(0,0,w,h);
  // Left cheek blush
  drawBlushEllipse(ctx,face.blushLeft,w,h,face.tiltDeg);
  // Right cheek blush
  drawBlushEllipse(ctx,face.blushRight,w,h,face.tiltDeg);
}

function drawBlushEllipse(ctx,bl,w,h,tilt){
  const cx=bl.cx/100*w, cy=bl.cy/100*h;
  const rx=bl.rx/100*w, ry=bl.ry/100*h;
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(tilt*Math.PI/180);
  // Draw soft red background patch
  const g=ctx.createRadialGradient(0,0,0,0,0,Math.max(rx,ry));
  g.addColorStop(0,'rgba(220,100,110,0.22)');
  g.addColorStop(0.6,'rgba(220,100,110,0.12)');
  g.addColorStop(1,'rgba(220,100,110,0)');
  ctx.scale(rx,ry);
  ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);
  ctx.fillStyle=g;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(tilt*Math.PI/180);
  // Draw three vertical lines
  const lineHeight=ry*1.2;
  const lineSpacing=rx*0.35;
  const lineColor='rgba(230,100,120,0.5)';
  ctx.strokeStyle=lineColor;
  ctx.lineWidth=rx*0.15;
  ctx.lineCap='round';
  // Three vertical lines
  for(let i=-1;i<=1;i++){
    ctx.beginPath();
    ctx.moveTo(i*lineSpacing,-lineHeight/2);
    ctx.lineTo(i*lineSpacing,lineHeight/2);
    ctx.stroke();
  }
  ctx.restore();
}

function removeBlush(){
  Object.keys(blushDataPerSlot).forEach(i=>{
    const bc=document.getElementById(`blush-canvas-${i}`);
    if(bc){const ctx=bc.getContext('2d');ctx.clearRect(0,0,bc.width,bc.height);}
  });
  blushDataPerSlot={};
}

function removeAutoStickers(cat){
  const toRemove=placedStickers.filter(s=>s.isAuto&&s.autoCat===cat);
  toRemove.forEach(s=>{const el=document.querySelector(`[data-sid="${s.id}"]`);if(el)el.remove();});
  placedStickers=placedStickers.filter(s=>!(s.isAuto&&s.autoCat===cat));
}

// ══════════════════ MANUAL STICKER PICK ══════════════════
document.querySelectorAll('.spick').forEach(sp=>{
  sp.addEventListener('click',()=>{
    if(activeStickerEmoji===sp.dataset.e){sp.classList.remove('sel');activeStickerEmoji=null;}
    else{document.querySelectorAll('.spick').forEach(s=>s.classList.remove('sel'));sp.classList.add('sel');activeStickerEmoji=sp.dataset.e;}
    deselectSticker();
  });
});

function setupManualSlot(slot,slotIndex){
  slot.addEventListener('click',e=>{
    if(e.target.closest('.psticker'))return;
    if(!activeStickerEmoji)return;
    const rect=slot.getBoundingClientRect();
    const x=((e.clientX-rect.left)/rect.width)*100;
    const y=((e.clientY-rect.top)/rect.height)*100;
    const slotW=slot.offsetWidth||184;
    const s={id:Date.now()+Math.random(),slotIndex,emoji:activeStickerEmoji,x,y,rot:0,size:Math.round(slotW*.18),isAuto:false};
    placedStickers.push(s);
    renderStickerEl(slot,s);
  });
}

// ══════════════════ RENDER STICKER ══════════════════
function renderStickerEl(slot,s){
  const wrap=document.createElement('div');
  wrap.className='psticker';
  wrap.dataset.sid=s.id;
  wrap.style.cssText=`left:${s.x}%;top:${s.y}%;position:absolute;transform:translate(-50%,-50%) rotate(${s.rot||0}deg);`;

  const inner=document.createElement('span');
  inner.className='stk-inner';
  inner.style.fontSize=(s.size||26)+'px';
  inner.textContent=s.emoji;
  wrap.appendChild(inner);

  // Delete handle
  const del=document.createElement('div');del.className='del-handle';del.textContent='×';
  del.addEventListener('click',e=>{e.stopPropagation();wrap.remove();placedStickers=placedStickers.filter(p=>p.id!=s.id);deselectSticker();});
  wrap.appendChild(del);

  // Rotate handle
  const rot=document.createElement('div');rot.className='rot-handle';rot.textContent='↻';
  wrap.appendChild(rot);

  // Resize handle
  const sz=document.createElement('div');sz.className='sz-handle';
  wrap.appendChild(sz);

  // Select + drag on wrap
  wrap.addEventListener('mousedown',e=>{
    if(e.target===rot||e.target===sz||e.target===del)return;
    e.stopPropagation();
    selectSticker(wrap,s,slot);
    startDrag(e,wrap,slot,s);
  });
  wrap.addEventListener('touchstart',e=>{
    if(e.target===rot||e.target===sz)return;
    e.stopPropagation();e.preventDefault();
    selectSticker(wrap,s,slot);
    startDragTouch(e,wrap,slot,s);
  },{passive:false});

  // Rotate
  rot.addEventListener('mousedown',e=>{e.stopPropagation();startRotate(e,wrap,slot,s);});
  rot.addEventListener('touchstart',e=>{e.stopPropagation();e.preventDefault();startRotateTouch(e,wrap,slot,s);},{passive:false});

  // Resize
  sz.addEventListener('mousedown',e=>{e.stopPropagation();startResize(e,wrap,slot,s);});
  sz.addEventListener('touchstart',e=>{e.stopPropagation();e.preventDefault();startResizeTouch(e,wrap,slot,s);},{passive:false});

  slot.appendChild(wrap);
}

function selectSticker(el,s,slot){deselectSticker();selectedStickerEl=el;el.classList.add('selected');}
function deselectSticker(){if(selectedStickerEl){selectedStickerEl.classList.remove('selected');selectedStickerEl=null;}}
document.addEventListener('mousedown',e=>{if(!e.target.closest('.psticker'))deselectSticker();});

// ══════════════════ DRAG ══════════════════
function startDrag(e,wrap,slot,s){
  e.preventDefault();
  const rect=slot.getBoundingClientRect();
  const ox=e.clientX-rect.left-(s.x/100)*rect.width;
  const oy=e.clientY-rect.top-(s.y/100)*rect.height;
  const mm=ev=>{const r=slot.getBoundingClientRect();s.x=Math.max(0,Math.min(100,((ev.clientX-r.left-ox)/r.width)*100));s.y=Math.max(0,Math.min(100,((ev.clientY-r.top-oy)/r.height)*100));wrap.style.left=s.x+'%';wrap.style.top=s.y+'%';};
  const mu=()=>{document.removeEventListener('mousemove',mm);document.removeEventListener('mouseup',mu);};
  document.addEventListener('mousemove',mm);document.addEventListener('mouseup',mu);
}
function startDragTouch(e,wrap,slot,s){
  e.preventDefault();
  const rect=slot.getBoundingClientRect();const t=e.touches[0];
  const ox=t.clientX-rect.left-(s.x/100)*rect.width;const oy=t.clientY-rect.top-(s.y/100)*rect.height;
  const mm=ev=>{const t2=ev.touches[0];const r=slot.getBoundingClientRect();s.x=Math.max(0,Math.min(100,((t2.clientX-r.left-ox)/r.width)*100));s.y=Math.max(0,Math.min(100,((t2.clientY-r.top-oy)/r.height)*100));wrap.style.left=s.x+'%';wrap.style.top=s.y+'%';};
  const mu=()=>{document.removeEventListener('touchmove',mm);document.removeEventListener('touchend',mu);};
  document.addEventListener('touchmove',mm,{passive:false});document.addEventListener('touchend',mu);
}

// ══════════════════ ROTATE ══════════════════
function startRotate(e,wrap,slot,s){
  e.preventDefault();
  const r=slot.getBoundingClientRect();
  const cx=r.left+(s.x/100)*r.width, cy=r.top+(s.y/100)*r.height;
  const start=Math.atan2(e.clientY-cy,e.clientX-cx)*(180/Math.PI);
  const startRot=s.rot||0;
  const mm=ev=>{const a=Math.atan2(ev.clientY-cy,ev.clientX-cx)*(180/Math.PI);s.rot=startRot+(a-start);wrap.style.transform=`translate(-50%,-50%) rotate(${s.rot}deg)`;};
  const mu=()=>{document.removeEventListener('mousemove',mm);document.removeEventListener('mouseup',mu);};
  document.addEventListener('mousemove',mm);document.addEventListener('mouseup',mu);
}
function startRotateTouch(e,wrap,slot,s){
  e.preventDefault();
  const r=slot.getBoundingClientRect();const cx=r.left+(s.x/100)*r.width,cy=r.top+(s.y/100)*r.height;
  const t0=e.touches[0];const start=Math.atan2(t0.clientY-cy,t0.clientX-cx)*(180/Math.PI);const startRot=s.rot||0;
  const mm=ev=>{const t2=ev.touches[0];const a=Math.atan2(t2.clientY-cy,t2.clientX-cx)*(180/Math.PI);s.rot=startRot+(a-start);wrap.style.transform=`translate(-50%,-50%) rotate(${s.rot}deg)`;};
  const mu=()=>{document.removeEventListener('touchmove',mm);document.removeEventListener('touchend',mu);};
  document.addEventListener('touchmove',mm,{passive:false});document.addEventListener('touchend',mu);
}

// ══════════════════ RESIZE ══════════════════
function startResize(e,wrap,slot,s){
  e.preventDefault();
  const startSz=s.size||26;const startY=e.clientY;
  const mm=ev=>{s.size=Math.max(12,Math.min(72,startSz+(ev.clientY-startY)*.45));wrap.querySelector('.stk-inner').style.fontSize=s.size+'px';};
  const mu=()=>{document.removeEventListener('mousemove',mm);document.removeEventListener('mouseup',mu);};
  document.addEventListener('mousemove',mm);document.addEventListener('mouseup',mu);
}
function startResizeTouch(e,wrap,slot,s){
  e.preventDefault();
  const startSz=s.size||26;const t0=e.touches[0];const startY=t0.clientY;
  const mm=ev=>{const t2=ev.touches[0];s.size=Math.max(12,Math.min(72,startSz+(t2.clientY-startY)*.45));wrap.querySelector('.stk-inner').style.fontSize=s.size+'px';};
  const mu=()=>{document.removeEventListener('touchmove',mm);document.removeEventListener('touchend',mu);};
  document.addEventListener('touchmove',mm,{passive:false});document.addEventListener('touchend',mu);
}

// ══════════════════ FINAL STRIP ══════════════════
function buildFinalStrip(){
  // Initialize editable text defaults on first build of this session
  if(!stripSubtitle) stripSubtitle = longDate;
  if(!stripDateText) stripDateText = shortDate;
  document.getElementById('fs-name').textContent = stripTitle;
  document.getElementById('fs-sub').textContent = stripSubtitle;
  document.getElementById('fs-date').textContent = stripDateText;

  const strip=document.getElementById('final-strip');
  strip.querySelectorAll('.fs-slot').forEach(s=>s.remove());
  strip.querySelectorAll('.fs-custom-bg-layer').forEach(s=>s.remove());

  const isCustomImage = chosenBg==='CUSTOM_IMAGE' && customBgImage.dataUrl;

  if(isCustomImage){
    // Base fallback color behind the image (in case opacity < 100%)
    strip.style.background='#e8ddd0';
    const layer=document.createElement('div');
    layer.className='fs-custom-bg-layer';
    layer.style.cssText='position:absolute;inset:0;overflow:hidden;z-index:0;';
    const img=document.createElement('img');
    img.src=customBgImage.dataUrl;
    const stripW=strip.offsetWidth||196, stripH=strip.offsetHeight||320;
    // emulate "cover" sizing then apply pan/zoom/opacity the same way the editor does
    img.style.cssText=`position:absolute;left:50%;top:50%;opacity:${customBgImage.opacity/100};`;
    layer.appendChild(img);
    strip.insertBefore(layer, strip.firstChild);
    img.onload=()=>{
      const coverScale=Math.max(stripW/img.naturalWidth, stripH/img.naturalHeight);
      const baseW=img.naturalWidth*coverScale, baseH=img.naturalHeight*coverScale;
      const scale=customBgImage.zoom/100;
      // Pan offsets were calibrated against the 140x186 editor preview — scale proportionally
      const scaleFactorX = stripW/140, scaleFactorY = stripH/186;
      img.style.width=baseW+'px'; img.style.height=baseH+'px';
      img.style.transform=`translate(-50%,-50%) translate(${customBgImage.offsetX*scaleFactorX}px,${customBgImage.offsetY*scaleFactorY}px) scale(${scale})`;
    };
    // Ensure header/footer/photos render above the bg layer
    strip.querySelectorAll('.fs-header,.fs-footer,.fs-watermark').forEach(el=>el.style.position='relative');
    strip.querySelectorAll('.fs-header,.fs-footer,.fs-watermark').forEach(el=>el.style.zIndex='2');
  } else {
    strip.style.background=chosenBg;
  }

  const footer=strip.querySelector('.fs-footer');
  const dark=chosenBg.includes('#2c2218')||chosenBg.includes('#3d3028')||chosenBg.includes('#1e2a1e')||chosenBg.includes('#1e1e2e');
  const inkC=dark||isCustomImage?'rgba(250,247,242,.92)':'rgba(44,34,24,.85)';
  const mutC=dark||isCustomImage?'rgba(250,247,242,.6)':'#9e8e7a';
  const dashC=dark||isCustomImage?'rgba(250,247,242,.25)':'rgba(44,34,24,.18)';
  strip.querySelectorAll('.fs-name,.fs-sub,.fs-date').forEach(el=>{el.style.color=inkC; el.style.position='relative'; el.style.zIndex='2';});
  strip.querySelectorAll('.fs-header,.fs-footer').forEach(el=>el.style.borderColor=dashC);
  document.getElementById('fs-sub').style.color=mutC;document.getElementById('fs-date').style.color=mutC;

  for(let i=0;i<photos.length;i++){
    const sl=document.createElement('div');sl.className='fs-slot';sl.id=`fs-slot-${i}`;
    const img=document.createElement('img');img.src=photos[i];sl.appendChild(img);
    // blush overlay
    if(blushDataPerSlot[i]){
      const bc=document.createElement('canvas');
      bc.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:5;width:100%;height:100%;';
      sl.appendChild(bc);
      // Draw blush after layout
      setTimeout(()=>{
        bc.width=sl.offsetWidth||184;bc.height=sl.offsetHeight||138;
        const ctx=bc.getContext('2d');
        const face=blushDataPerSlot[i];
        drawBlushEllipse(ctx,face.blushLeft,bc.width,bc.height,face.tiltDeg);
        drawBlushEllipse(ctx,face.blushRight,bc.width,bc.height,face.tiltDeg);
      },80);
    }
    // stickers (read-only)
    placedStickers.filter(s=>s.slotIndex===i).forEach(s=>{
      const el=document.createElement('div');
      el.style.cssText=`position:absolute;left:${s.x}%;top:${s.y}%;transform:translate(-50%,-50%) rotate(${s.rot||0}deg);font-size:${s.size||26}px;line-height:1;pointer-events:none;filter:drop-shadow(1px 1px 2px rgba(0,0,0,.18));z-index:10;`;
      el.textContent=s.emoji;sl.appendChild(el);
    });
    strip.insertBefore(sl,footer);
  }
}

// ══════════════════ CANVAS EXPORT ══════════════════
document.getElementById('btn-download').addEventListener('click',async()=>{
  const c=await buildCanvas();const a=document.createElement('a');a.download=`memoria-${Date.now()}.png`;a.href=c.toDataURL('image/png');a.click();
});
document.getElementById('btn-print').addEventListener('click',async()=>{
  const c=await buildCanvas();
  const w=window.open('','_blank');
  const printCSS = 'body{margin:0;display:flex;justify-content:center;background:#fff;}img{max-height:100vh;width:auto;}@media print{img{height:100vh;}}';
  w.document.write('<html><head><title>Memoria<\/title><'+'style>'+printCSS+'<\/'+'style><\/head><body><img src="'+c.toDataURL('image/png')+'" onload="window.print();window.close()"><\/body><\/html>');
  w.document.close();
});

async function buildCanvas(){
  const SW=320,PAD=17,PW=SW-PAD*2,PH=Math.round(PW*3/4),GAP=10,HEAD=80,FOOT=44;
  const SH=HEAD+(PH+GAP)*photos.length-GAP+FOOT+PAD;
  const canvas=document.createElement('canvas');canvas.width=SW;canvas.height=SH;
  const ctx=canvas.getContext('2d');

  const isCustomImage = chosenBg==='CUSTOM_IMAGE' && customBgImage.dataUrl;

  if(isCustomImage){
    // Fallback fill first (visible if opacity < 100%)
    ctx.fillStyle='#e8ddd0'; ctx.fillRect(0,0,SW,SH);
    const bgImg = await loadImg(customBgImage.dataUrl);
    const coverScale = Math.max(SW/bgImg.width, SH/bgImg.height);
    const baseW = bgImg.width*coverScale, baseH = bgImg.height*coverScale;
    const scale = customBgImage.zoom/100;
    // Editor preview stage is 140x186 — scale pan offsets proportionally to canvas size
    const scaleFactorX = SW/140, scaleFactorY = SH/186;
    const drawW = baseW*scale, drawH = baseH*scale;
    const cx = SW/2 + customBgImage.offsetX*scaleFactorX;
    const cy = SH/2 + customBgImage.offsetY*scaleFactorY;
    ctx.save();
    ctx.globalAlpha = customBgImage.opacity/100;
    ctx.drawImage(bgImg, cx-drawW/2, cy-drawH/2, drawW, drawH);
    ctx.restore();
  } else if(chosenBg.startsWith('linear-gradient')){
    const cols=chosenBg.match(/#[0-9a-fA-F]{3,6}/g)||['#e8ddd0','#dde4da'];
    const g=ctx.createLinearGradient(0,0,SW,SH);g.addColorStop(0,cols[0]);g.addColorStop(1,cols[1]||cols[0]);ctx.fillStyle=g;
    ctx.fillRect(0,0,SW,SH);
  }else{
    ctx.fillStyle=chosenBg;
    ctx.fillRect(0,0,SW,SH);
  }
  // grain (skip heavy grain over custom photos so it doesn't muddy them)
  if(!isCustomImage){
    for(let i=0;i<700;i++){ctx.fillStyle=`rgba(0,0,0,${Math.random()*.022})`;ctx.fillRect(Math.random()*SW,Math.random()*SH,1,1);}
  }

  const dark=chosenBg.includes('#2c2218')||chosenBg.includes('#3d3028')||chosenBg.includes('#1e2a1e')||chosenBg.includes('#1e1e2e');
  const inkC=(dark||isCustomImage)?'rgba(250,247,242,.92)':'rgba(44,34,24,.85)';
  const mutC=(dark||isCustomImage)?'rgba(250,247,242,.65)':'rgba(100,80,65,.7)';
  const dashC=(dark||isCustomImage)?'rgba(250,247,242,.3)':'rgba(44,34,24,.18)';

  ctx.save();ctx.setLineDash([4,4]);ctx.strokeStyle=dashC;ctx.lineWidth=.8;
  ctx.beginPath();ctx.moveTo(PAD,HEAD-8);ctx.lineTo(SW-PAD,HEAD-8);ctx.stroke();ctx.restore();
  ctx.save();ctx.textAlign='center';
  if(isCustomImage){ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=4;}
  ctx.fillStyle=inkC;ctx.font='italic 19px "Palatino Linotype","Georgia",serif';ctx.fillText(stripTitle||'Memoria',SW/2,PAD+24);
  ctx.fillStyle=mutC;ctx.font='10px "Courier New",monospace';ctx.fillText(stripSubtitle||longDate,SW/2,PAD+42);ctx.restore();

  for(let i=0;i<photos.length;i++){
    const img=await loadImg(photos[i]);
    const y=HEAD+i*(PH+GAP);
    // Draw image filling the frame (with crop to maintain aspect ratio)
    ctx.save();ctx.beginPath();rRect(ctx,PAD,y,PW,PH,2);ctx.clip();
    const imgAspect=img.width/img.height;
    const frameAspect=PW/PH;
    // Scale to fill frame while maintaining aspect ratio
    let drawW, drawH, drawX, drawY;
    if(imgAspect>frameAspect){
      // Image wider: scale to frame height, crop sides
      drawH=PH;
      drawW=PH*imgAspect;
      drawX=PAD-(drawW-PW)/2;
      drawY=y;
    }else{
      // Image taller: scale to frame width, crop top/bottom
      drawW=PW;
      drawH=PW/imgAspect;
      drawX=PAD;
      drawY=y-(drawH-PH)/2;
    }
    ctx.drawImage(img,drawX,drawY,drawW,drawH);
    ctx.restore();
    ctx.save();ctx.strokeStyle=dark?'rgba(250,247,242,.12)':'rgba(44,34,24,.1)';ctx.lineWidth=1;ctx.beginPath();rRect(ctx,PAD,y,PW,PH,2);ctx.stroke();ctx.restore();

    // Blush on canvas export
    if(blushDataPerSlot[i]){
      const face=blushDataPerSlot[i];
      // scale blush from slot% → canvas px
      const scaleBlushEllipse=(bl)=>{
        return {cx:PAD+(bl.cx/100)*PW, cy:y+(bl.cy/100)*PH, rx:bl.rx/100*PW, ry:bl.ry/100*PH};
      };
      const drawCanvasBlush=(bl,tilt)=>{
        ctx.save();ctx.translate(bl.cx,bl.cy);ctx.rotate(tilt*Math.PI/180);
        // Draw soft red background patch
        const g=ctx.createRadialGradient(0,0,0,0,0,Math.max(bl.rx,bl.ry));
        g.addColorStop(0,'rgba(220,100,110,0.22)');
        g.addColorStop(0.6,'rgba(220,100,110,0.12)');
        g.addColorStop(1,'rgba(220,100,110,0)');
        ctx.scale(bl.rx,bl.ry);
        ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);
        ctx.fillStyle=g;
        ctx.fill();
        ctx.restore();
        ctx.save();ctx.translate(bl.cx,bl.cy);ctx.rotate(tilt*Math.PI/180);
        // Draw three vertical lines
        const lineHeight=bl.ry*1.2;
        const lineSpacing=bl.rx*0.35;
        const lineColor='rgba(230,100,120,0.5)';
        ctx.strokeStyle=lineColor;
        ctx.lineWidth=bl.rx*0.15;
        ctx.lineCap='round';
        // Three vertical lines
        for(let li=-1;li<=1;li++){
          ctx.beginPath();
          ctx.moveTo(li*lineSpacing,-lineHeight/2);
          ctx.lineTo(li*lineSpacing,lineHeight/2);
          ctx.stroke();
        }
        ctx.restore();
      };
      drawCanvasBlush(scaleBlushEllipse(face.blushLeft),face.tiltDeg);
      drawCanvasBlush(scaleBlushEllipse(face.blushRight),face.tiltDeg);
    }

    // Stickers
    placedStickers.filter(s=>s.slotIndex===i).forEach(s=>{
      const sx=PAD+(s.x/100)*PW, sy=y+(s.y/100)*PH;
      // Scale size: use stored size or estimate from PW
      const baseSlotW=184; // standard slot width in preview
      const scale=PW/baseSlotW;
      const rSz=Math.round((s.size||26)*scale);
      if(s.emoji){
        ctx.save();ctx.translate(sx,sy);ctx.rotate((s.rot||0)*Math.PI/180);
        ctx.font=`${rSz}px serif`;ctx.textBaseline='middle';ctx.textAlign='center';
        ctx.fillStyle='rgba(0,0,0,0.8)';
        ctx.shadowColor='rgba(0,0,0,.2)';ctx.shadowBlur=2;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
        ctx.fillText(s.emoji,0,0);ctx.restore();
      }
    });
  }

  const fy=HEAD+photos.length*(PH+GAP)-GAP+12;
  ctx.save();ctx.setLineDash([4,4]);ctx.strokeStyle=dashC;ctx.lineWidth=.8;
  ctx.beginPath();ctx.moveTo(PAD,fy);ctx.lineTo(SW-PAD,fy);ctx.stroke();ctx.restore();
  ctx.save();ctx.textAlign='center';ctx.fillStyle=mutC;ctx.font='9px "Courier New",monospace';
  ctx.fillText(stripDateText||shortDate,SW/2,fy+20);ctx.restore();
  return canvas;
}

function loadImg(src){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=src;});}
function rRect(ctx,x,y,w,h,r){ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// ══════════════════════════════════════════════════════
//  SUPABASE SETUP
// ══════════════════════════════════════════════════════
// 1. Create a free project at https://supabase.com
// 2. Go to Project Settings → API → copy "Project URL" and "anon public" key
// 3. Paste them below
const SUPABASE_URL = 'https://kicijmckxnlxojpztpuo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpY2lqbWNreG5seG9qcHp0cHVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwMDk0NTMsImV4cCI6MjA5NzU4NTQ1M30.JKia064gxsQXCHdApjxHKKpwypQAbJkbyBeS4kNq-2M';
const MAX_STRIPS_PER_USER = 12; // limit per account

let sb = null;
let currentUser = null;
const supabaseConfigured = SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 20;
if (supabaseConfigured && window.supabase) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ══════════════════════════════════════════════════════
//  AUTH UI WIRING
// ══════════════════════════════════════════════════════
let authMode = 'signin'; // 'signin' | 'signup'

function openAuthModal(mode){
  authMode = mode;
  document.getElementById('auth-modal-overlay').classList.add('show');
  document.getElementById('auth-msg').textContent='';
  document.getElementById('auth-email').value='';
  document.getElementById('auth-password').value='';
  refreshAuthModalText();
}
function closeAuthModal(){ document.getElementById('auth-modal-overlay').classList.remove('show'); }
function refreshAuthModalText(){
  if(authMode==='signin'){
    document.getElementById('auth-modal-title').textContent='Welcome Back';
    document.getElementById('auth-modal-sub').textContent='sign in to save your strips';
    document.getElementById('auth-submit-btn').textContent='Sign In';
    document.getElementById('auth-switch-line').innerHTML='New here? <a id="auth-switch-link">Create an account</a>';
  } else {
    document.getElementById('auth-modal-title').textContent='Create Account';
    document.getElementById('auth-modal-sub').textContent='save your strips across visits';
    document.getElementById('auth-submit-btn').textContent='Sign Up';
    document.getElementById('auth-switch-line').innerHTML='Already have an account? <a id="auth-switch-link">Sign in</a>';
  }
  document.getElementById('auth-switch-link').addEventListener('click',()=>{
    authMode = authMode==='signin' ? 'signup' : 'signin';
    refreshAuthModalText();
  });
}

document.getElementById('btn-open-auth').addEventListener('click',()=>{
  if(!supabaseConfigured){
    alert('Storage is not configured yet.\n\nThe site owner needs to add a Supabase URL and key in the code (search for SUPABASE_URL).');
    return;
  }
  openAuthModal('signin');
});
document.getElementById('auth-modal-close').addEventListener('click',closeAuthModal);
document.getElementById('auth-modal-overlay').addEventListener('click',e=>{
  if(e.target.id==='auth-modal-overlay') closeAuthModal();
});

document.getElementById('auth-submit-btn').addEventListener('click',async()=>{
  const email=document.getElementById('auth-email').value.trim();
  const password=document.getElementById('auth-password').value;
  const msgEl=document.getElementById('auth-msg');
  const btn=document.getElementById('auth-submit-btn');
  if(!email||!password){msgEl.textContent='Please fill in both fields.';msgEl.className='am-msg';return;}
  if(password.length<6){msgEl.textContent='Password must be at least 6 characters.';msgEl.className='am-msg';return;}
  btn.disabled=true; msgEl.textContent='Please wait…'; msgEl.className='am-msg';
  try{
    if(authMode==='signin'){
      const {data,error}=await sb.auth.signInWithPassword({email,password});
      if(error) throw error;
      currentUser=data.user;
      msgEl.textContent='Signed in ✦'; msgEl.className='am-msg ok';
      setTimeout(()=>{closeAuthModal();updateAuthUI();resumePendingSaveIfAny();},500);
    }else{
      const {data,error}=await sb.auth.signUp({email,password});
      if(error) throw error;
      currentUser=data.user;
      msgEl.textContent='Account created ✦'; msgEl.className='am-msg ok';
      setTimeout(()=>{closeAuthModal();updateAuthUI();resumePendingSaveIfAny();},700);
    }
  }catch(e){
    msgEl.textContent=e.message||'Something went wrong.'; msgEl.className='am-msg';
  }finally{
    btn.disabled=false;
  }
});

// If the user had clicked "Save to My Strips" before logging in, finish that
// save automatically the moment login/signup succeeds — nothing is lost.
async function resumePendingSaveIfAny(){
  if(!pendingSave || !currentUser) return;
  const saved = pendingSave;
  pendingSave = null;
  document.getElementById('save-prompt-banner').classList.remove('show');
  // Only makes sense if we're still looking at the final strip screen
  if(document.getElementById('s-final').classList.contains('active')){
    await performSaveToGallery(saved.compressedDataUrl, saved.title, saved.label);
  } else {
    // Save anyway in the background even if they navigated away
    await performSaveToGallery(saved.compressedDataUrl, saved.title, saved.label);
  }
}

document.getElementById('btn-sign-out').addEventListener('click',async()=>{
  if(sb) await sb.auth.signOut();
  currentUser=null;
  updateAuthUI();
});

document.getElementById('btn-my-strips').addEventListener('click',()=>{
  loadGallery();
  goTo('s-gallery');
});
document.getElementById('btn-gallery-back').addEventListener('click',()=>goTo('s-welcome'));

function updateAuthUI(){
  const statusText=document.getElementById('auth-status-text');
  const dot=document.querySelector('#auth-status .acc-dot');
  const signInBtn=document.getElementById('btn-open-auth');
  const myStripsBtn=document.getElementById('btn-my-strips');
  const signOutBtn=document.getElementById('btn-sign-out');
  if(currentUser){
    statusText.textContent=currentUser.email.split('@')[0];
    dot.style.background='var(--sage)';
    signInBtn.style.display='none';
    myStripsBtn.style.display='inline-block';
    signOutBtn.style.display='inline-block';
  }else{
    statusText.textContent='Not signed in';
    dot.style.background='var(--dust)';
    signInBtn.style.display='inline-block';
    myStripsBtn.style.display='none';
    signOutBtn.style.display='none';
  }
}

async function initAuth(){
  if(!supabaseConfigured||!sb)return;
  const {data}=await sb.auth.getSession();
  if(data&&data.session){ currentUser=data.session.user; }
  updateAuthUI();
  sb.auth.onAuthStateChange((_event,session)=>{
    currentUser = session ? session.user : null;
    updateAuthUI();
  });
}
initAuth();

// ══════════════════════════════════════════════════════
//  EDITABLE STRIP TEXT (title / subtitle / date)
// ══════════════════════════════════════════════════════
let stripTitle='Memoria';
let stripSubtitle=''; // filled with longDate by default
let stripDateText=''; // filled with shortDate by default

function makeEditable(el, getCurrentVal, onSave){
  el.addEventListener('click', ()=>{
    if(el.querySelector('input'))return; // already editing
    const oldText = getCurrentVal();
    const input=document.createElement('input');
    input.type='text'; input.className='editable-input'; input.value=oldText;
    el.textContent=''; el.appendChild(input);
    input.focus(); input.select();
    const commit=()=>{
      const v=input.value.trim()||oldText;
      onSave(v);
      el.textContent=v;
    };
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){ e.preventDefault(); commit(); }
      if(e.key==='Escape'){ el.textContent=oldText; }
    });
    input.addEventListener('blur', commit);
  });
}

// Wire up editable fields once final strip exists
function setupEditableStrip(){
  const nameEl=document.getElementById('fs-name');
  const subEl=document.getElementById('fs-sub');
  const dateEl=document.getElementById('fs-date');
  makeEditable(nameEl, ()=>stripTitle, v=>{stripTitle=v;});
  makeEditable(subEl, ()=>stripSubtitle, v=>{stripSubtitle=v;});
  makeEditable(dateEl, ()=>stripDateText, v=>{stripDateText=v;});
}
setupEditableStrip();

// ══════════════════════════════════════════════════════
//  IMAGE COMPRESSION HELPERS (for storage)
// ══════════════════════════════════════════════════════
// Re-encode a dataURL at lower resolution/quality to shrink size
function compressDataUrl(dataUrl, maxWidth, quality){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      let w=img.width, h=img.height;
      if(w>maxWidth){ h=Math.round(h*(maxWidth/w)); w=maxWidth; }
      const c=document.createElement('canvas'); c.width=w; c.height=h;
      const ctx=c.getContext('2d');
      ctx.drawImage(img,0,0,w,h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.src=dataUrl;
  });
}

// Build a compressed version of the full strip canvas for storage
// (Smaller width + JPEG quality ~0.72 keeps strips small but still clear)
async function buildCompressedStripForStorage(){
  const fullCanvas = await buildCanvas(); // existing full-quality strip
  const compressedDataUrl = await compressDataUrl(fullCanvas.toDataURL('image/png'), 280, 0.72);
  return compressedDataUrl;
}

// ══════════════════════════════════════════════════════
//  SAVE TO GALLERY (Supabase Storage + DB row)
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
//  SAVE-WITHOUT-LOGIN FLOW
// ══════════════════════════════════════════════════════
// When a user clicks "Save to My Strips" while logged out, we don't lose
// their work — we capture the exact strip (compressed image + title/date)
// right then, stash it in memory, prompt them to sign in, and the moment
// they successfully sign in or sign up, we automatically finish the save.
let pendingSave = null; // {compressedDataUrl, title, label}

async function performSaveToGallery(compressedDataUrl, title, label){
  const statusEl=document.getElementById('save-status');
  statusEl.textContent='Checking your saved strips…'; statusEl.className='';
  try{
    const {count, error: countErr} = await sb
      .from('strips')
      .select('id', {count:'exact', head:true})
      .eq('user_id', currentUser.id);
    if(countErr) throw countErr;
    if((count||0) >= MAX_STRIPS_PER_USER){
      statusEl.textContent=`Limit reached (${MAX_STRIPS_PER_USER} strips). Delete one in "My Strips" to save a new one.`;
      statusEl.className='err';
      return false;
    }

    statusEl.textContent='Uploading…'; statusEl.className='';
    const blob = await (await fetch(compressedDataUrl)).blob();
    const fileName = `${currentUser.id}/${Date.now()}.jpg`;

    const {error: uploadErr} = await sb.storage.from('strips').upload(fileName, blob, {
      contentType: 'image/jpeg', upsert: false
    });
    if(uploadErr) throw uploadErr;

    const {data: urlData} = sb.storage.from('strips').getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    const {error: insertErr} = await sb.from('strips').insert({
      user_id: currentUser.id,
      image_url: publicUrl,
      storage_path: fileName,
      title: title,
      created_label: label
    });
    if(insertErr) throw insertErr;

    statusEl.textContent='Saved to My Strips ✦'; statusEl.className='ok';
    document.getElementById('save-prompt-banner').classList.remove('show');
    return true;
  }catch(e){
    console.error(e);
    statusEl.textContent='Save failed: '+(e.message||'unknown error'); statusEl.className='err';
    return false;
  }
}

document.getElementById('btn-save-gallery').addEventListener('click', async()=>{
  const statusEl=document.getElementById('save-status');
  const bannerEl=document.getElementById('save-prompt-banner');
  if(!supabaseConfigured){
    statusEl.textContent='Storage not configured by site owner.'; statusEl.className='err'; return;
  }

  // Always build the (compressed) strip NOW, while it's on screen —
  // this is what lets us save it later even if the user isn't logged in yet.
  statusEl.textContent='Preparing your strip…'; statusEl.className='';
  const compressedDataUrl = await buildCompressedStripForStorage();
  const titleSnapshot = stripTitle;
  const labelSnapshot = stripDateText || shortDate;

  if(!currentUser){
    // Stash it and prompt login — nothing is lost
    pendingSave = {compressedDataUrl, title:titleSnapshot, label:labelSnapshot};
    statusEl.textContent=''; statusEl.className='';
    bannerEl.classList.add('show');
    openAuthModal('signin');
    return;
  }

  // Already logged in — save immediately
  await performSaveToGallery(compressedDataUrl, titleSnapshot, labelSnapshot);
});

document.getElementById('save-prompt-login-link').addEventListener('click',()=>{
  openAuthModal('signin');
});

// ══════════════════════════════════════════════════════
//  LOAD / RENDER GALLERY
// ══════════════════════════════════════════════════════
async function loadGallery(){
  const grid=document.getElementById('gallery-grid');
  const limitText=document.getElementById('gallery-limit-text');
  grid.innerHTML='<div class="gallery-empty">Loading…</div>';

  if(!supabaseConfigured){
    grid.innerHTML='<div class="gallery-empty">Storage not configured.</div>';
    return;
  }
  if(!currentUser){
    grid.innerHTML='<div class="gallery-empty">Sign in to see your saved strips.</div>';
    limitText.textContent='';
    return;
  }
  try{
    const {data, error} = await sb
      .from('strips')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('created_at', {ascending:false});
    if(error) throw error;

    limitText.textContent = `${data.length} / ${MAX_STRIPS_PER_USER} strips saved`;
    limitText.className = data.length>=MAX_STRIPS_PER_USER ? 'gallery-limit full' : 'gallery-limit';

    if(!data.length){
      grid.innerHTML='<div class="gallery-empty">No strips saved yet.<br>Take some photos and tap "Save to My Strips"!</div>';
      return;
    }
    grid.innerHTML='';
    data.forEach(row=>{
      const card=document.createElement('div');
      card.className='gallery-card';
      card.innerHTML=`
        <img src="${row.image_url}" alt="strip">
        <div class="gc-date">${row.created_label||''}</div>
        <button class="gc-del" title="Delete">×</button>
      `;
      card.querySelector('img').addEventListener('click',()=>{
        const a=document.createElement('a'); a.href=row.image_url; a.download=`memoria-${row.id}.jpg`; a.click();
      });
      card.querySelector('.gc-del').addEventListener('click', async(e)=>{
        e.stopPropagation();
        if(!confirm('Delete this strip permanently?'))return;
        try{
          await sb.storage.from('strips').remove([row.storage_path]);
          await sb.from('strips').delete().eq('id', row.id);
          loadGallery();
        }catch(err){ alert('Delete failed: '+err.message); }
      });
      grid.appendChild(card);
    });
  }catch(e){
    console.error(e);
    grid.innerHTML='<div class="gallery-empty">Could not load strips.</div>';
  }
}


// ══════════════════ RESTART ══════════════════
document.getElementById('btn-restart').addEventListener('click',()=>{
  photos=[];placedStickers=[];blushDataPerSlot={};chosenBg='#e8ddd0';currentFilter='';totalShots=3;
  stripTitle='Memoria'; stripSubtitle=''; stripDateText='';
  pendingSave=null;
  customBgImage = {dataUrl:null, zoom:100, opacity:85, offsetX:0, offsetY:0};
  document.getElementById('save-status').textContent=''; document.getElementById('save-status').className='';
  document.getElementById('save-prompt-banner').classList.remove('show');
  document.getElementById('img-drop-zone').classList.remove('has-image');
  document.getElementById('img-drop-empty').style.display='block';
  document.getElementById('img-editor').classList.remove('show');
  document.getElementById('img-upload-input').value='';
  updateBgCurrentLabel('');
  document.querySelectorAll('.bg-mode-tab').forEach((t,i)=>{t.classList.remove('active');if(i===0)t.classList.add('active');});
  document.querySelectorAll('.bg-mode-panel').forEach((p,i)=>{p.classList.remove('active');if(i===0)p.classList.add('active');});
  document.querySelectorAll('.fchip').forEach(b=>{b.classList.remove('active');if(b.dataset.f==='')b.classList.add('active');});
  document.querySelectorAll('.schip').forEach(b=>{b.classList.remove('active');if(b.dataset.s==='3')b.classList.add('active');});
  [document.getElementById('fp-video'),document.getElementById('s-video')].forEach(v=>v.className='');
  document.getElementById('shoot-status').textContent='Get ready — smile!';
  document.querySelectorAll('.bg-opt').forEach((x,i)=>{x.classList.remove('active');if(i===0)x.classList.add('active');});
  buildShootStrip();goTo('s-filter');
});
/* aleph-shell.js — chrome compartido de AlephOne (fondo interactivo, vidrio, navegación,
   preferencias guardadas) + utilidades de carga (etapas, avisos, diálogos).
   Cargar DESPUÉS de api.js y al final del <body>. */
(function(global){
'use strict';

const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>Array.from((r||document).querySelectorAll(s));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mqReduce=window.matchMedia('(prefers-reduced-motion: reduce)');
const mqMobile=window.matchMedia('(max-width:900px)');
const mqFine=window.matchMedia('(hover:hover) and (pointer:fine)');
const onMQ=(mq,fn)=>{ if(mq.addEventListener) mq.addEventListener('change',fn); else if(mq.addListener) mq.addListener(fn); };
/* Movimiento reducido: preferencia del sistema o ajuste propio de AlephOne */
const reducedMotion=()=>mqReduce.matches||document.body.classList.contains('a11y-reduce-motion');
const EASE_OUT='cubic-bezier(0.16,1,0.3,1)';

const A11Y_KEYS = ['reduce-motion','reduce-transparency','high-contrast','font-dyslexic','letter-spacing-wide','line-height-wide','underline-links','enhanced-focus','large-targets'];
function applyPersistedPreferences(){
  const themeMode = localStorage.getItem('aleph_theme_mode') || 'dark';
  const prefersLight = themeMode === 'light' || (themeMode === 'auto' && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.body.classList.toggle('theme-light', prefersLight);

  const fsIdx = localStorage.getItem('aleph_font_size_idx');
  if (fsIdx !== null) {
    const sizes = [85,92,100,107,115];
    document.documentElement.style.fontSize = (sizes[+fsIdx] || 100) + '%';
  }

  const vision = localStorage.getItem('aleph_vision') || 'normal';
  ['deuteranopia','protanopia','tritanopia','grayscale'].forEach(m => document.body.classList.remove('vision-' + m));
  if (vision !== 'normal') document.body.classList.add('vision-' + vision);

  A11Y_KEYS.forEach(key => {
    document.body.classList.toggle('a11y-' + key, localStorage.getItem('aleph_a11y_' + key) === 'true');
  });
}
applyPersistedPreferences();

function getStoredIdentity(){
  try { return JSON.parse(localStorage.getItem('aleph_identity') || 'null'); }
  catch { return null; }
}
function applyTheme(themeClass){
  document.body.classList.remove('theme-everest','theme-andes','theme-amazonas','theme-bondi','theme-serengeti');
  document.body.classList.add(themeClass || 'theme-everest');
}
/* La paleta se aplica antes del primer render, así el intro ya nace con los colores del usuario */
applyTheme(getStoredIdentity()?.theme);

const FX=(function(){
  let canvas=null,ctx=null,initialized=false;
  const TAU=Math.PI*2;
  let lowPower=(navigator.hardwareConcurrency||4)<=4||(navigator.deviceMemory||4)<=2;
  let W=0,H=0,dpr=1,T=0,last=0,raf=0,running=false,frames=0,ema=16,active=0,introAt=Infinity;
  const ptr={x:0,y:0,has:false,nx:0,ny:0,sx:0,sy:0};
  const ripples=[];

  /* c: p primario, s secundario, a acento, n neutro, t hora del día */
  const DEFS=[
    {kind:'tod',   fill:true, k:15, x:.86,y:.17,d:.5, c:'t',al:.62,lw:0,  rs:0},
    {kind:'circle',fill:false,k:22, x:.06,y:.16,d:.5, c:'p',al:.45,lw:2.5,rs:0},
    {kind:'square',fill:true, k:12, x:.94,y:.52,d:.9, c:'s',al:.50,lw:0,  rs:.08},
    {kind:'tri',   fill:true, k:12, x:.03,y:.72,d:.8, c:'p',al:.45,lw:0,  rs:-.07},
    {kind:'pill',  fill:true, k:8,  x:.90,y:.86,d:.6, c:'s',al:.40,lw:0,  rs:.05},
    {kind:'circle',fill:true, k:16, x:.48,y:.97,d:.4, c:'n',al:.14,lw:0,  rs:0},
    {kind:'circle',fill:false,k:7,  x:.62,y:.34,d:1.1,c:'a',al:.55,lw:2,  rs:0},
    {kind:'square',fill:true, k:7,  x:.22,y:.90,d:1,  c:'a',al:.55,lw:0,  rs:-.10},
    {kind:'tri',   fill:false,k:8,  x:.42,y:.04,d:.7, c:'n',al:.34,lw:2,  rs:.09},
    {kind:'circle',fill:true, k:4.5,x:.30,y:.46,d:1.2,c:'s',al:.65,lw:0,  rs:0},
    {kind:'pill',  fill:false,k:9,  x:.97,y:.28,d:.5, c:'p',al:.40,lw:2,  rs:-.04}
  ];
  const shapes=DEFS.map(d=>Object.assign({},d,{
    ox:0,oy:0,vx:0,vy:0,spin:0,cx:0,cy:0,hx:0,hy:0,size:0,
    rot:Math.random()*TAU,ph:Math.random()*TAU,fq:.7+Math.random()*.6
  }));

  const TOD={morning:[232,132,58],afternoon:[232,186,64],evening:[98,150,214],night:[136,104,214]};
  let todT=TOD.morning.slice();
  let pal=null,palT=null,alphaMul=1,alphaT=1,edgeA=.16,edgeAT=.16,edgeRgb=[255,255,255],edgeRgbT=[255,255,255];
  const num=(cs,n,f)=>{const v=parseFloat(cs.getPropertyValue(n));return isNaN(v)?f:v;};
  const rgbOf=(cs,n,f)=>{const m=cs.getPropertyValue(n).match(/[\d.]+/g);return m&&m.length>=3?[+m[0],+m[1],+m[2]]:f;};
  function readTheme(){
    const cs=getComputedStyle(document.body);
    palT={
      p:rgbOf(cs,'--primary-rgb',[74,184,200]),
      s:rgbOf(cs,'--secondary-rgb',[109,212,232]),
      a:rgbOf(cs,'--accent-rgb',[255,184,107]),
      n:rgbOf(cs,'--neutral-rgb',[200,225,240]),
      t:todT
    };
    alphaT=num(cs,'--shape-alpha',1);
    edgeAT=num(cs,'--shape-edge-a',.16);
    edgeRgbT=rgbOf(cs,'--shape-edge-rgb',[255,255,255]);
    if(!pal||reducedMotion()){
      pal={p:palT.p.slice(),s:palT.s.slice(),a:palT.a.slice(),n:palT.n.slice(),t:todT.slice()};
      alphaMul=alphaT;edgeA=edgeAT;edgeRgb=edgeRgbT.slice();
    }
  }
  function lerpPal(k){
    ['p','s','a','n','t'].forEach(key=>{for(let i=0;i<3;i++)pal[key][i]+=(palT[key][i]-pal[key][i])*k;});
    alphaMul+=(alphaT-alphaMul)*k;edgeA+=(edgeAT-edgeA)*k;
    for(let i=0;i<3;i++)edgeRgb[i]+=(edgeRgbT[i]-edgeRgb[i])*k;
  }

  function layout(force){
    const nw=window.innerWidth,nh=window.innerHeight;
    if(!force&&mqMobile.matches&&nw===W&&Math.abs(nh-H)<140)return;
    W=nw;H=nh;
    dpr=Math.min(window.devicePixelRatio||1,lowPower?1:1.5);
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const u=clamp(Math.min(W,H)/100,5,11);
    active=lowPower?7:shapes.length;
    shapes.forEach(s=>{s.hx=s.x*W;s.hy=s.y*H;s.size=s.k*u;});
  }

  function simulate(dt,motion){
    T+=dt;
    const sy=motion?(window.pageYOffset||0):0;
    if(motion){
      const k=1-Math.exp(-dt*5);
      ptr.sx+=(ptr.nx-ptr.sx)*k;ptr.sy+=(ptr.ny-ptr.sy)*k;
      lerpPal(1-Math.exp(-dt*6));
    }
    for(let i=0;i<active;i++){
      const s=shapes[i];
      const fx=motion?ptr.sx*s.d*22+Math.sin(T*.35*s.fq+s.ph)*5*s.d:0;
      const fy=motion?ptr.sy*s.d*16+Math.cos(T*.29*s.fq+s.ph)*6*s.d-sy*s.d*.10:0;
      const cx=s.hx+fx+s.ox,cy=s.hy+fy+s.oy;
      if(motion&&ptr.has){
        const dx=cx-ptr.x,dy=cy-ptr.y,d2=dx*dx+dy*dy,R=170+s.size*.35;
        if(d2<R*R&&d2>4){
          const d=Math.sqrt(d2),f=Math.pow(1-d/R,2)*1800*s.d;
          s.vx+=dx/d*f*dt;s.vy+=dy/d*f*dt;
        }
      }
      if(motion){
        s.vx+=(-22*s.ox-9.4*s.vx)*dt;s.vy+=(-22*s.oy-9.4*s.vy)*dt; /* resorte amortiguado, sin rebote */
        s.ox+=s.vx*dt;s.oy+=s.vy*dt;
        s.spin*=Math.exp(-dt*2.2);
        s.rot+=(s.rs+s.spin)*dt;
      }
      s.cx=cx;s.cy=cy;
    }
  }

  function poke(x,y){
    for(let i=0;i<active;i++){
      const s=shapes[i],dx=s.cx-x,dy=s.cy-y,d=Math.hypot(dx,dy)||1,R=430;
      if(d<R){
        const f=Math.pow(1-d/R,1.5)*560*(.6+.5*s.d);
        s.vx+=dx/d*f;s.vy+=dy/d*f;
        s.spin+=(dx>0?1:-1)*(1-d/R)*1.6;
      }
    }
    ripples.push({x:x,y:y,t:T});
    if(ripples.length>4)ripples.shift();
  }
  function burst(){
    if(!initialized||reducedMotion())return;
    for(let i=0;i<active;i++){
      const s=shapes[i],a=Math.random()*TAU,f=140+Math.random()*90;
      s.vx+=Math.cos(a)*f;s.vy+=Math.sin(a)*f;
      s.spin+=(Math.random()<.5?-1:1)*(.5+Math.random()*.6);
    }
  }

  function rr(x,y,w,h,r){
    r=Math.min(r,w/2,h/2);
    ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }
  const rgba=(c,a)=>'rgba('+(c[0]|0)+','+(c[1]|0)+','+(c[2]|0)+','+a.toFixed(3)+')';
  function draw(){
    ctx.clearRect(0,0,W,H);
    const intro=1-Math.pow(1-clamp((T-introAt)/1.1,0,1),3);
    if(intro<=0)return;
    for(let i=0;i<active;i++){
      const s=shapes[i],r=s.size/2,col=pal[s.c];
      const a=s.al*alphaMul*(.65+.35*s.d)*intro;
      ctx.save();
      ctx.translate(s.cx,s.cy);ctx.rotate(s.rot);
      ctx.lineJoin='round';
      if(s.kind==='tod'){
        ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.fillStyle=rgba(col,a);ctx.fill();
        ctx.lineWidth=1.5;
        ctx.beginPath();ctx.arc(0,0,r*1.35,0,TAU);ctx.strokeStyle=rgba(col,a*.55);ctx.stroke();
        ctx.beginPath();ctx.arc(0,0,r*1.75,0,TAU);ctx.strokeStyle=rgba(col,a*.28);ctx.stroke();
        ctx.restore();continue;
      }
      ctx.beginPath();
      if(s.kind==='circle'){ctx.arc(0,0,r,0,TAU);}
      else if(s.kind==='square'){rr(-r,-r,s.size,s.size,r*.32);}
      else if(s.kind==='pill'){rr(-r*1.6,-r*.55,r*3.2,r*1.1,r*.55);}
      else{const R=r*1.1;ctx.moveTo(0,-R);ctx.lineTo(R*.866,R*.5);ctx.lineTo(-R*.866,R*.5);ctx.closePath();}
      if(s.fill){
        ctx.fillStyle=rgba(col,a);ctx.fill();
        if(s.kind==='tri'){ctx.lineWidth=r*.28;ctx.strokeStyle=rgba(col,a);ctx.stroke();}
        else{ctx.lineWidth=1;ctx.strokeStyle=rgba(edgeRgb,edgeA*intro);ctx.stroke();}
      }else{
        ctx.lineWidth=s.lw;ctx.strokeStyle=rgba(col,a);ctx.stroke();
      }
      ctx.restore();
    }
    for(let i=ripples.length-1;i>=0;i--){
      const rp=ripples[i],age=T-rp.t;
      if(age>.75){ripples.splice(i,1);continue;}
      const p=age/.75,e=1-Math.pow(1-p,3);
      ctx.beginPath();ctx.arc(rp.x,rp.y,12+e*130,0,TAU);
      ctx.lineWidth=1.5;ctx.strokeStyle=rgba(pal.p,(1-p)*.35);ctx.stroke();
    }
  }

  function frame(now){
    raf=0;
    if(!running)return;
    if(lowPower&&now-last<32){raf=requestAnimationFrame(frame);return;}
    const dt=Math.min(.05,(now-last)/1000||.016);
    last=now;
    ema+=(dt*1000-ema)*.05;frames++;
    if(frames>150&&!lowPower&&ema>24){lowPower=true;layout(true);}
    simulate(dt,true);
    draw();
    raf=requestAnimationFrame(frame);
  }
  function start(){
    if(!initialized||running||reducedMotion()||document.hidden)return;
    running=true;last=performance.now();raf=requestAnimationFrame(frame);
  }
  function stop(){running=false;if(raf)cancelAnimationFrame(raf);raf=0;}
  function renderStatic(){if(!initialized)return;T=Math.max(T,1.4);simulate(0,false);draw();}
  function syncMode(){
    if(!initialized)return;
    readTheme();
    if(reducedMotion()){stop();shapes.forEach(s=>{s.ox=s.oy=s.vx=s.vy=s.spin=0;});renderStatic();}
    else start();
  }

  /* hora del día: el orbe grande cambia de color (reemplaza el resplandor de fondo) */
  function setTod(key){
    todT=(TOD[key]||TOD.morning).slice();
    if(palT)palT.t=todT;
    if(reducedMotion()&&pal){pal.t=todT.slice();renderStatic();}
  }
  function playIntro(){
    if(!initialized)return;
    introAt=reducedMotion()?-10:T;
    if(reducedMotion())renderStatic();
  }

  /* brillo del vidrio que sigue al cursor */
  let cards=[],sheenRaf=0,sx=0,sy=0;
  function sheen(x,y){
    sx=x;sy=y;
    if(sheenRaf)return;
    sheenRaf=requestAnimationFrame(function(){
      sheenRaf=0;
      cards.forEach(c=>{
        const r=c.getBoundingClientRect();
        const inside=sx>=r.left&&sx<=r.right&&sy>=r.top&&sy<=r.bottom;
        if(inside){c.style.setProperty('--mx',(sx-r.left)+'px');c.style.setProperty('--my',(sy-r.top)+'px');}
        c.classList.toggle('hot',inside);
      });
    });
  }
  function clearSheen(){cards.forEach(c=>c.classList.remove('hot'));}

  function init(){
    if(initialized)return;
    canvas=$('#bgShapes');
    ctx=canvas&&canvas.getContext&&canvas.getContext('2d');
    if(!ctx)return;
    initialized=true;
    cards=$$('.glass');
    readTheme();layout(true);
    if(reducedMotion())renderStatic();else start();

    let rz=0;
    window.addEventListener('resize',function(){
      if(rz)return;
      rz=requestAnimationFrame(function(){rz=0;layout(false);if(reducedMotion())renderStatic();});
    });
    onMQ(mqMobile,function(){layout(true);});
    onMQ(mqReduce,syncMode);
    /* cambios de paleta o de ajustes de accesibilidad (clases del body) */
    new MutationObserver(syncMode).observe(document.body,{attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',function(){document.hidden?stop():start();});

    window.addEventListener('pointermove',function(e){
      if(reducedMotion())return;
      ptr.x=e.clientX;ptr.y=e.clientY;ptr.has=true;
      if(e.pointerType==='touch'){ptr.nx=0;ptr.ny=0;}
      else{ptr.nx=(e.clientX/W-.5)*2;ptr.ny=(e.clientY/H-.5)*2;}
      if(mqFine.matches)sheen(e.clientX,e.clientY);
    },{passive:true});
    window.addEventListener('pointerdown',function(e){
      if(reducedMotion())return;
      poke(e.clientX,e.clientY);
    },{passive:true});
    const release=function(e){if(e.pointerType==='touch'||e.pointerType==='pen'){ptr.has=false;}};
    window.addEventListener('pointerup',release,{passive:true});
    window.addEventListener('pointercancel',release,{passive:true});
    document.documentElement.addEventListener('mouseleave',function(){ptr.has=false;ptr.nx=0;ptr.ny=0;clearSheen();});
  }
  return {init:init,burst:burst,setTod:setTod,playIntro:playIntro,rescan:function(){cards=$$('.glass');}};
})();

/* ══════════════════════════════════════════
   UTILIDADES DE CARGA
══════════════════════════════════════════ */
function timeKey(){const h=new Date().getHours();if(h>=6&&h<13)return'morning';if(h>=13&&h<19)return'afternoon';if(h>=19&&h<24)return'evening';return'night';}

/* Rechaza si la promesa no resuelve a tiempo. No cancela el pedido de fondo: sirve para no dejar la pantalla colgada. */
function withTimeout(p,ms){
  return new Promise((resolve,reject)=>{
    const t=setTimeout(()=>reject(Object.assign(new Error('timeout'),{code:'timeout'})),ms);
    Promise.resolve(p).then(v=>{clearTimeout(t);resolve(v);},e=>{clearTimeout(t);reject(e);});
  });
}
function friendlyError(err){
  const m=(err&&err.message)||'';
  if(err&&err.code==='timeout')return 'Esto está tardando más de lo normal. Puede que el servidor esté despertando o que tu conexión esté lenta.';
  if(/conectar|network|failed to fetch|abort/i.test(m))return 'No pudimos conectar con AlephOne. Revisá tu conexión e intentá de nuevo.';
  return m||'Ocurrió un error inesperado.';
}
/* El backend gratuito se duerme tras un rato sin uso. Un pedido liviano apenas se entra al sitio lo despierta. */
function warmBackend(){
  try{ if(typeof BACKEND_URL==='string')fetch(BACKEND_URL,{mode:'no-cors',cache:'no-store'}).catch(function(){}); }catch(e){}
}

const ICO_OK='<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
/* Pantalla de carga por etapas: muestra qué se está haciendo, cuánto lleva, avisa si el servidor
   está despertando, corta con un tiempo máximo y ofrece reintentar en vez de quedarse colgada. */
function stages(container,defs,opts){
  opts=Object.assign({title:'Preparando tu espacio',slowAfterMs:6000,
    slowText:'El servidor se está despertando. La primera carga del día puede tardar hasta un minuto. No hace falta que recargues.',
    skeleton:'',backHref:'dashboard.html'},opts||{});
  const st={};defs.forEach(d=>{st[d.id]={state:'pending',t0:0};});
  let timer=0,current=null,waiter=null;
  container.setAttribute('aria-busy','true');
  container.innerHTML=
    '<div class="gate"><div class="gate-card glass" role="status" aria-live="polite">'+
    '<div class="gate-title">'+esc(opts.title)+'</div>'+
    '<ol class="gate-steps">'+defs.map(d=>'<li class="step is-pending" data-step="'+d.id+'"><span class="step-ic" aria-hidden="true"></span><span class="step-label">'+esc(d.label)+'</span><span class="step-time"></span></li>').join('')+'</ol>'+
    '<p class="gate-hint" hidden>'+esc(opts.slowText)+'</p>'+
    '<div class="gate-error" hidden role="alert"><p class="gate-error-msg"></p>'+
    '<div class="gate-actions"><button class="btn btn-primary" type="button" data-retry>Reintentar</button><a class="btn btn-ghost" href="'+opts.backHref+'">Volver al inicio</a></div>'+
    '<details><summary>Detalles técnicos</summary><code class="gate-error-detail"></code></details></div>'+
    '</div>'+(opts.skeleton||'')+'</div>';
  const root=container.firstElementChild;
  const stepEl=id=>$('[data-step="'+id+'"]',root);
  function paint(id){
    const s=st[id],el=stepEl(id);
    el.className='step is-'+s.state;
    $('.step-ic',el).innerHTML=s.state==='done'?ICO_OK:(s.state==='error'?'!':'');
  }
  function tick(){
    if(!current)return;
    const s=st[current],secs=Math.floor((Date.now()-s.t0)/1000);
    $('.step-time',stepEl(current)).textContent=secs>=3?secs+' s':'';
    if(Date.now()-s.t0>=opts.slowAfterMs)$('.gate-hint',root).hidden=false;
  }
  function showError(err){
    $('.gate-hint',root).hidden=true;
    $('.gate-error-msg',root).textContent=friendlyError(err);
    $('.gate-error-detail',root).textContent=(err&&err.message)||String(err);
    $('.gate-error',root).hidden=false;
    const b=$('[data-retry]',root);if(b&&b.focus)b.focus();
  }
  async function run(id,fn,o){
    o=o||{};const timeoutMs=o.timeoutMs||45000;
    for(;;){
      current=id;st[id].state='active';st[id].t0=Date.now();paint(id);
      $('.gate-error',root).hidden=true;$('.gate-hint',root).hidden=true;
      $('.step-time',stepEl(id)).textContent='';
      clearInterval(timer);timer=setInterval(tick,1000);
      try{
        const v=await withTimeout(Promise.resolve().then(fn),timeoutMs);
        if(v&&v.ok===false)throw Object.assign(new Error(v.error||'No se pudo completar la operación.'),{code:'api'});
        clearInterval(timer);st[id].state='done';paint(id);$('.step-time',stepEl(id)).textContent='';current=null;
        return v;
      }catch(err){
        clearInterval(timer);st[id].state='error';paint(id);current=null;
        showError(err);
        await new Promise(res=>{waiter=res;});
      }
    }
  }
  root.addEventListener('click',e=>{if(e.target.closest('[data-retry]')&&waiter){const w=waiter;waiter=null;w();}});
  function stop(){clearInterval(timer);container.removeAttribute('aria-busy');}
  return {run:run,stop:stop,tickForTest:tick};
}

/* Avisos breves (reemplazan a alert) */
function toast(msg,opts){
  opts=opts||{};const host=$('#toasts');if(!host)return function(){};
  const el=document.createElement('div');
  el.className='toast '+(opts.kind||'');el.setAttribute('role','status');
  const m=document.createElement('span');m.className='toast-msg';m.textContent=msg;el.appendChild(m);
  const remove=()=>{el.classList.add('out');setTimeout(()=>el.remove(),220);};
  if(opts.action){const b=document.createElement('button');b.type='button';b.className='toast-act';b.textContent=opts.action.label;b.onclick=()=>{opts.action.onClick();remove();};el.appendChild(b);}
  host.appendChild(el);
  while(host.children.length>3)host.firstChild.remove();
  setTimeout(remove,opts.timeout||4200);
  return remove;
}

/* Diálogos accesibles: foco atrapado, Esc, clic afuera y devolución del foco */
const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
function openDialog(root,opts){
  opts=opts||{};
  if(root.classList.contains('open'))return;
  root._prev=document.activeElement;root._onClose=opts.onClose;
  root.classList.add('open');document.body.classList.add('no-scroll');
  root._key=function(e){
    if(e.key==='Escape'){e.stopPropagation();closeDialog(root);return;}
    if(e.key!=='Tab')return;
    const f=$$(FOCUSABLE,root).filter(x=>x.offsetParent!==null);if(!f.length)return;
    const first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  };
  root._down=function(e){if(e.target===root)closeDialog(root);};
  root.addEventListener('keydown',root._key);root.addEventListener('mousedown',root._down);
  requestAnimationFrame(function(){const t=(opts.focus&&$(opts.focus,root))||$$(FOCUSABLE,root)[0];if(t)t.focus();});
}
function closeDialog(root){
  if(!root.classList.contains('open'))return;
  root.classList.remove('open');
  root.removeEventListener('keydown',root._key);root.removeEventListener('mousedown',root._down);
  if(!$('.dialog-wrap.open'))document.body.classList.remove('no-scroll');
  if(root._prev&&root._prev.focus&&document.contains(root._prev))root._prev.focus();
  if(root._onClose)root._onClose();
}

/* ══════════════════════════════════════════
   ESTRUCTURA: fondo, topbar y cápsula de navegación (definidos una sola vez)
══════════════════════════════════════════ */
const FILTERS='<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>'+
  '<filter id="filter-deuteranopia" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0"/></filter>'+
  '<filter id="filter-protanopia" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="0.152 1.053 -0.205 0 0  0.115 0.786 0.099 0 0  -0.004 -0.048 1.052 0 0  0 0 0 1 0"/></filter>'+
  '<filter id="filter-tritanopia" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="1.256 -0.077 -0.179 0 0  -0.078 0.931 0.148 0 0  0.005 0.691 0.304 0 0  0 0 0 1 0"/></filter>'+
  '</defs></svg>';
const ICON_SVG=(d)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
/* Para sumar o renombrar una sección de la app, se cambia solo acá. */
const NAV=[
  {id:'inicio',href:'dashboard.html',label:'Inicio',icon:ICON_SVG('<path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>')},
  {id:'actividades',href:'tareas.html',label:'Actividades',icon:ICON_SVG('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>')},
  {id:'escuela',href:'schools.html',label:'Escuela',icon:ICON_SVG('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>')},
  {id:'comunidad',href:'comunicacion.html',label:'Comunidad',icon:ICON_SVG('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>')}
];
const ICON_GEAR=ICON_SVG('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>');

function mount(opts){
  opts=opts||{};
  const body=document.body;
  body.insertAdjacentHTML('afterbegin',FILTERS+'<div class="bg-layer" aria-hidden="true"><canvas id="bgShapes"></canvas></div><div class="grain" aria-hidden="true"></div><div id="cover" aria-hidden="true"></div><div class="toasts" id="toasts"></div>');
  const shell=$('.shell');
  const links=NAV.map(n=>'<a href="'+n.href+'" class="nav-link'+(n.id===opts.active?' active':'')+'"'+(n.id===opts.active?' aria-current="page"':'')+'><span class="nav-icon">'+n.icon+'</span><span class="nav-text">'+n.label+'</span></a>').join('');
  shell.insertAdjacentHTML('afterbegin',
    '<header class="topbar" id="topbar"><div class="topbar-left">'+
    '<a class="topbar-mark ready" href="dashboard.html" aria-label="AlephOne, inicio"><span class="logo-glyph" aria-hidden="true">ℵ</span></a><span class="topbar-word">AlephOne</span></div>'+
    '<div class="topbar-right"><a class="icon-btn" href="settings.html" title="Ajustes" aria-label="Ajustes">'+ICON_GEAR+'</a>'+
    '<div class="pill"><div class="pill-avatar" id="userAvatar">?</div><span id="username">—</span></div></div></header>'+
    '<nav class="sidebar" id="sidebar" aria-label="Principal"><div class="rail glass" id="rail"><span class="nav-hl" id="navHl" aria-hidden="true"></span>'+
    '<a class="rail-logo ready" id="railLogo" href="dashboard.html" aria-label="AlephOne, inicio"><span class="logo-glyph" aria-hidden="true">ℵ</span></a><span class="rail-sep" aria-hidden="true"></span>'+links+'</div></nav>');

  /* resaltado del rail que sigue al puntero + topbar de vidrio al scrollear */
  const rail=$('#rail'),hl=$('#navHl'),topbar=$('#topbar');
  const show=a=>{
    if(mqMobile.matches)return;
    const r=a.getBoundingClientRect(),n=rail.getBoundingClientRect(),y=(r.top-n.top-rail.clientTop)+'px';
    if(hl.style.opacity!=='1'){hl.style.transition='none';rail.style.setProperty('--hl-y',y);hl.style.height=r.height+'px';void hl.offsetHeight;hl.style.transition='';}
    else{rail.style.setProperty('--hl-y',y);hl.style.height=r.height+'px';}
    hl.style.opacity='1';
  };
  $$('.nav-link',rail).forEach(a=>{a.addEventListener('pointerenter',()=>show(a));a.addEventListener('focus',()=>show(a));});
  rail.addEventListener('pointerleave',()=>{hl.style.opacity='0';});
  rail.addEventListener('focusout',()=>{hl.style.opacity='0';});
  window.addEventListener('scroll',()=>{topbar.classList.toggle('scrolled',(window.pageYOffset||0)>8);},{passive:true});

  if(!reducedMotion())body.classList.add('pre-rise');
  FX.init();FX.setTod(timeKey());
  warmBackend();
  /* red de seguridad: si la página falla antes de llamar a ready(), la cubierta igual se retira */
  setTimeout(()=>{releaseCover();body.classList.remove('pre-rise');},6000);
  window.addEventListener('error',()=>{releaseCover();body.classList.remove('pre-rise');});

  /* preferencias cambiadas desde otra pestaña */
  window.addEventListener('storage',e=>{
    if(e.key==='aleph_identity'){applyTheme((getStoredIdentity()||{}).theme);FX.burst();}
    if(e.key==='aleph_theme_mode'||e.key==='aleph_font_size_idx'||e.key==='aleph_vision'||(e.key&&e.key.startsWith('aleph_a11y_')))applyPersistedPreferences();
  });
}
function setUser(user){
  if(!user)return;
  const a=$('#userAvatar'),n=$('#username');
  if(a)a.textContent=(user.username||'?').charAt(0).toUpperCase();
  if(n)n.textContent=user.username||'—';
}
/* Anima la entrada de los elementos (con movimiento reducido, no hace nada) */
function rise(els,base){
  if(reducedMotion())return;
  Array.from(els).forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(16px)'},{opacity:1,transform:'none'}],{duration:560,delay:(base||0)+i*60,easing:EASE_OUT,fill:'backwards'}));
}
function releaseCover(){
  const cover=$('#cover');
  if(cover){cover.classList.add('fade');setTimeout(()=>cover.remove(),320);}
}
/* Retira la cubierta de carga y hace entrar la página */
function ready(){
  releaseCover();
  document.body.classList.remove('pre-rise');
  FX.playIntro();
  rise($$('.rise'),60);
  const rail=$('#rail');
  if(rail&&!reducedMotion())rail.animate([{opacity:0,transform:mqMobile.matches?'translateY(18px)':'translateX(18px)'},{opacity:1,transform:'none'}],{duration:560,delay:180,easing:EASE_OUT,fill:'backwards'});
}

global.AlephShell={
  $:$,$$:$$,esc:esc,clamp:clamp,reducedMotion:reducedMotion,EASE_OUT:EASE_OUT,mqMobile:mqMobile,
  mount:mount,setUser:setUser,ready:ready,rise:rise,toast:toast,openDialog:openDialog,closeDialog:closeDialog,
  stages:stages,withTimeout:withTimeout,friendlyError:friendlyError,warmBackend:warmBackend,
  applyTheme:applyTheme,getStoredIdentity:getStoredIdentity,applyPersistedPreferences:applyPersistedPreferences,FX:FX
};
})(window);

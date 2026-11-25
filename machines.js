/* Terra Brava. Articulated machinery, in metres. Positive Z is the direction of travel. */
(() => {
  'use strict';
  const Y = '#eeb538', YL = '#ffc74e', YO = '#bd801e', YD = '#956117';
  const D = '#242b2c', D2 = '#394044', EDGE = '#50585b', STEEL = '#96a3a1';
  const RUB = '#282c2b', TREAD = '#363b38', TYREWALL = '#303532';
  const GLASS = '#426268', GLIGHT = '#688788', REF = '#8ba3a0';
  const LIGHT = '#fff0bc', RED = '#c52f27', SOIL = '#84562d';
  const PI = Math.PI, TAU = PI * 2;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  function part(p, pos) { const n = G.group(p); if (pos) n.p = pos.slice(); return n; }
  function box(p, pos, sz, color) { return G.box(p, pos, sz, color); }
  function cyl(p, pos, top, bottom, h, color, seg = 12) { return G.cyl(p,pos,top,bottom,h,color,seg); }
  function axle(p, x,y,z, radius, width, color, seg = 16) {
    const n = cyl(p,[x,y,z],radius,radius,width,color,seg); n.r[2] = PI / 2; return n;
  }
  function triMesh(p, arr, faces, color) { return G.mesh(p, arr.flat(), faces, color); }
  // Profiles follow machine length (z) and height (y). Ear clipping retains concave outlines.
  function prism(p, profile, x, width, color) {
    const pts = profile.slice();
    let area = 0;
    pts.forEach(([z,y],i) => { const b=pts[(i+1)%pts.length]; area+=z*b[1]-b[0]*y; });
    if (area < 0) pts.reverse();
    const size=pts.length, vertices=[], indices=[];
    for (let side of [-1,1]) for (let [z,y] of pts) vertices.push([x+side*width*.5,y,z]);
    let ring=Array.from({length:size},(_,i)=>i);
    const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    for (let guard=0;ring.length>2 && guard<size*size;guard++) {
      let clipped=false;
      for(let j=0;j<ring.length;j++) {
        const a=ring[(j+ring.length-1)%ring.length], b=ring[j], c=ring[(j+1)%ring.length];
        if(cross(pts[a],pts[b],pts[c])<=.000001) continue;
        if(ring.some(i=>i!==a&&i!==b&&i!==c&&cross(pts[a],pts[b],pts[i])>.000001&&cross(pts[b],pts[c],pts[i])>.000001&&cross(pts[c],pts[a],pts[i])>.000001))continue;
        indices.push(a,b,c,c+size,b+size,a+size);
        ring.splice(j,1);clipped=true;break;
      }
      if(!clipped)break;
    }
    for(let i=0;i<size;i++){let j=(i+1)%size;indices.push(i,i+size,j+size,i,j+size,j);}
    return triMesh(p,vertices,indices,color);
  }
  function quad(p, points, color) { return triMesh(p,points,[0,1,2,0,2,3,2,1,0,3,2,0],color); }
  function sticker(p, side, x,y,z, w,h, color) {
    return quad(p,[[side*x,y,z],[side*x,y,z+w],[side*x,y+h,z+w],[side*x,y+h,z]],color);
  }
  function bar(p,a,b,r,col){return G.rod(p,a,b,r,col,8);}
  function rails(p,points,r,col){for(let i=1;i<points.length;i++)bar(p,points[i-1],points[i],r,col);}
  function vents(p,x,y,z,side,count,span,h) {
    for(let i=0;i<count;i++) sticker(p,side,x,y-h/2,z-span/2+i*span/count,.046,h,D);
  }
  function workLight(p,x,y,z,front=true) {
    box(p,[x,y,z],[.21,.18,.12],D);
    box(p,[x,y,z+(front?.065:-.065)],[.163,.125,.022],LIGHT);
  }
  function beacon(p,x,y,z) {
    cyl(p,[x,y,z],.106,.118,.07,D,10);
    cyl(p,[x,y+.10,z],.072,.092,.14,'#ec832b',12);
    cyl(p,[x,y+.18,z],.065,.074,.025,'#ffbf55',12);
  }
  function exhaust(p,x,y,z,h) {
    cyl(p,[x,y+h*.43,z],.077,.092,h*.86,D,10);
    const head=G.rod(p,[x,y+h*.81,z],[x,y+h,z-.095],.079,D2,10);
    return head;
  }
  function stripeID(p,side,x,y,z) {
    sticker(p,side,x,y,z,.51,.19,D);
    for(let i=0;i<3;i++){
      const z0=z+.07+i*.126;
      quad(p,[[side*(x+.004),y+.025,z0],[side*(x+.004),y+.025,z0+.065],[side*(x+.004),y+.16,z0+.131],[side*(x+.004),y+.16,z0+.063]],i===2?YL:'#dfe5d9');
    }
  }
  // Cabs have recessed blue-green glazing, structural pillars, wipers and work lights.
  function cabin(p, x, base, z, w, d, h, roof = Y, whiteTruck=false) {
    const g=part(p,[x,base,z]);
    const front=d*.5, back=-d*.5, top=h-.10, sill=whiteTruck?h*.43:.22;
    const frTop=front-d*(whiteTruck?.155:.11), rearTop=back+d*.055;
    prism(g,[[back,0],[front-.06,0],[front,.16],[front,sill],[frTop,top],[rearTop,top],[back,.42]],0,w,D);
    const bottomRear=back+.11, bottomFront=front-.12, upRear=rearTop+.075, upFront=frTop-.075;
    for(const side of [-1,1]) {
      const sx=side*(w*.5+.006);
      const sideGlass=[[bottomRear,sill+.055],[bottomFront,sill+.055],[upFront,top-.09],[upRear,top-.09]];
      prism(g,sideGlass,sx,.018,GLASS);
      const mid=back+d*(whiteTruck?.38:.36);
      const a=[sx+side*.012,sill+.055,mid], b=[sx+side*.012,top-.09,mid+.018];
      G.beam(g,a,b,.034,.048,D2);
      const sh=side*(w*.5+.018);
      quad(g,[[sh,sill+.10,bottomRear+.05],[sh,sill+.10,bottomRear+.09],[sh,top-.13,upRear+.28],[sh,top-.13,upRear+.235]],GLIGHT);
      if(whiteTruck) {
        prism(g,[[back,.02],[front-.07,.02],[front,.18],[front,sill+.018],[bottomRear,sill+.02]],side*(w*.5+.012),.024,'#e6e9e3');
      }
      box(g,[side*(w*.5+.039),sill+.04,back+d*.22],[.037,.065,.148],D2);
      if(whiteTruck||side===1){
        const mirrorZ=front-.11, out=w*.5+(whiteTruck?.28:.19);
        rails(g,[[side*(w*.5),top-.32,mirrorZ-.12],[side*out,top-.30,mirrorZ],[side*out,top-.50,mirrorZ+.035]],.024,D);
        box(g,[side*out,top-.48,mirrorZ+.035],[.12,whiteTruck?.31:.19,.13],D2);
      }
    }
    const glassF=[[ -w*.5+.075,sill+.065,front-.006],[ w*.5-.075,sill+.065,front-.006],[w*.5-.08,top-.07,frTop+.035],[-w*.5+.08,top-.07,frTop+.035]];
    quad(g,glassF,GLIGHT);
    const fzAt=y=>front-.006+(frTop+.035-(front-.006))*(y-(sill+.065))/(top-.07-(sill+.065));
    const y1=sill+.10,y2=top-.1;
    quad(g,[[-w*.37,y1,fzAt(y1)+.008],[-w*.29,y1,fzAt(y1)+.008],[-w*.02,y2,fzAt(y2)+.008],[-w*.10,y2,fzAt(y2)+.008]],'#779496');
    const y3=sill+.14, y4=sill+(top-sill)*.38;
    bar(g,[-w*.30,y3,fzAt(y3)+.024],[w*.10,y4,fzAt(y4)+.024],.015,D);
    bar(g,[-w*.12,y4-.045,fzAt(y4-.045)+.025],[w*.29,y4+.055,fzAt(y4+.055)+.025],.015,D);
    const bz=back-.002;
    quad(g,[[-w*.40,sill+.15,bz],[w*.4,sill+.15,bz],[w*.4,top-.12,rearTop-.025],[-w*.4,top-.12,rearTop-.025]],GLASS);
    prism(g,[[back-.045,top],[front-.07,top],[front-.12,h],[back+.025,h+.026]],0,w+.095,roof);
    if(!whiteTruck) {
      workLight(g,-w*.34,top+.006,front-.097);
      workLight(g,w*.34,top+.006,front-.097);
      beacon(g,w*.32,h+.04,back+.24);
    }
    return g;
  }
  // One mesh holds all chevron tread lugs on each tyre.
  function tyreTreads(p,r,w,n){
    const vs=[], ix=[];
    for(let i=0;i<n;i++) for(const side of [-1,1]) {
      const a=TAU*i/n, root=vs.length, theta=TAU/n;
      for(let layer of [0,1]) for(let [xFrac,off] of [[.035,-.17],[.47,-.40],[.47,.05],[.035,.28]]) {
        const t=a+theta*off, rad=r*(layer?1:.945)*(xFrac>.46?.993:1);
        vs.push([side*xFrac*w,Math.sin(t)*rad,Math.cos(t)*rad]);
      }
      const faces=[4,5,6,4,6,7,0,4,7,0,7,3,1,5,4,1,4,0,2,6,5,2,5,1,3,7,6,3,6,2];
      for(let j=0;j<faces.length;j+=3) ix.push(root+faces[j],root+faces[j+(side>0?1:2)],root+faces[j+(side>0?2:1)]);
    }
    return triMesh(p,vs,ix,TREAD);
  }
  function wheel(m,p,x,z,r,w,steering=false,rim=Y,y=r){
    const hub=part(p,[x,y,z]), roll=part(hub); m.wheels.push({hub,roll,steering});
    const side=Math.sign(x);
    axle(roll,0,0,0,r*.954,w*.94,RUB,20);
    tyreTreads(roll,r,w,r>.7?17:15);
    axle(roll,side*w*.46,0,0,r*.79,.045,TYREWALL,20);
    axle(roll,side*w*.486,0,0,r*.60,.055,D2,18);
    axle(roll,side*w*.504,0,0,r*.53,.061,rim,18);
    axle(roll,side*w*.555,0,0,r*.28,.085,rim===Y?YO:STEEL,12);
    for(let j=0;j<6;j++){
      const a=j*TAU/6;axle(roll,side*(w*.556+.045),Math.sin(a)*r*.355,Math.cos(a)*r*.355,.029,.023,D2,6);
    }
  }
  // Hydraulic link between a fixed attachment and one on an X-axis hinge.
  function piston(m, frame, anchor, hinge, end, radius, sleeve, sleeveColor=D2) {
    const body=part(frame,anchor), shell=cyl(body,[0,0,0],radius,radius,1,sleeveColor,10);
    const gland=cyl(body,[0,0,0],radius*1.08,radius*1.12,.085,EDGE,10);
    const rod=cyl(body,[0,0,0],radius*.56,radius*.56,1,'#bdc8c5',10);
    axle(frame,anchor[0],anchor[1],anchor[2],radius*1.18,radius*2.45,YO,10);
    m.links.push({body,shell,gland,rod,hinge,end,anchor,sleeve});
  }
  function solvePistons(m){
    for(const a of m.links) {
      const t=a.hinge.r[0], c=Math.cos(t), s=Math.sin(t);
      const y=a.hinge.p[1]+c*a.end[1]-s*a.end[2]-a.anchor[1];
      const z=a.hinge.p[2]+s*a.end[1]+c*a.end[2]-a.anchor[2];
      const length=Math.hypot(y,z), outer=Math.min(a.sleeve,length*.86), chrome=Math.max(.012,length-outer);
      a.body.r[0]=Math.atan2(z,y);
      a.shell.p[1]=outer*.5; a.shell.s[1]=outer;
      a.gland.p[1]=outer-.025;
      a.rod.p[1]=outer+chrome*.5; a.rod.s[1]=chrome;
    }
  }
  function earth(p,pos,scale){
    const n=G.sphere(p,pos,scale,SOIL,9);n.visible=false;return n;
  }
  function tooth(p,x,z,y,dz,dy,width) {
    // The working face tapers in thickness and width toward the cutting point.
    const len=Math.hypot(dz,dy),ny=dz/len,nz=-dy/len;
    const vertices=[];
    for(const [t,w,h] of [[0,width,.097],[1,width*.52,.014]]){
      for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
        vertices.push([x+sx*w/2,y+dy*t+sy*ny*h/2,z+dz*t+sy*nz*h/2]);
      }
    }
    triMesh(p,vertices,[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7],'#87908a');
  }
  function digBucket(m,p,loader=false) {
    const w=loader?2.06:1.02;
    // Loader mouth faces forward. On a digging dipper the heel lies on the
    // OUTSIDE of the pin-to-tip arc, so the open throat faces back uphill to the stick.
    const shell=loader?
      [[-.15,.14],[-.08,.45],[.06,.54],[.18,.53],[.18,.44],[.073,.41],[.04,.18],[.10,-.12],[.27,-.31],[.51,-.38],[1.035,-.419],[1.04,-.496],[.50,-.475],[.21,-.41],[-.006,-.22],[-.12,-.026]]:
      [[-.12,-.19],[-.16,.036],[-.08,.22],[.15,.405],[.42,.527],[.66,.522],[.851,.427],[1.014,.258],[1.075,.05],[1.052,-.220],[.951,-.206],[.964,.039],[.92,.193],[.778,.325],[.636,.413],[.451,.414],[.215,.313],[.026,.147],[-.047,-.003],[-.041,-.161]];
    prism(p,shell,0,w,D2);
    const cheek=loader?
      [[-.024,.39],[.086,.51],[.18,.49],[.99,-.402],[.50,-.45],[.224,-.396],[.01,-.187]]:
      [[-.097,-.142],[-.126,.03],[-.045,.206],[.163,.384],[.428,.497],[.645,.49],[.829,.403],[.986,.232],[1.045,.04],[1.026,-.192],[.97,-.198],[.70,-.129],[.44,-.063],[.264,.009],[.119,.013]];
    for(const side of [-1,1]){
      prism(p,cheek,side*w*.492,.061,EDGE);
      if(!loader){
        // Reinforcing strip follows the convex back of the shell, clear of the mouth.
        prism(p,[[.15,.394],[.42,.51],[.66,.503],[.845,.408],[.827,.365],[.646,.449],[.437,.455],[.172,.346]],side*w*.42,.053,'#717a77');
      }
    }
    const lip=loader?{z:1.017,y:-.45,dz:.191,dy:-.046}:{z:1.014,y:-.19,dz:.068,dy:-.218};
    const lipBar=box(p,[0,lip.y,lip.z],[w+.043,.084,.117],D);
    if(!loader)lipBar.r[0]=1.28;
    const count=loader?7:5;
    for(let i=0;i<count;i++)tooth(p,-w*.425+w*.85*i/(count-1),lip.z,lip.y,lip.dz,lip.dy,loader?.142:.118);
    axle(p,0,0,0,.145,w*.68,YO,12);
    for(const side of [-1,1]){
      prism(p,[[-.13,-.076],[-.108,.161],[.031,.237],[.15,.159],[.241,-.035],[.116,-.123]],side*w*.23,.071,D);
      axle(p,side*w*.269,0,0,.082,.047,STEEL,12);
    }
    const tip=part(p,[0,lip.y+lip.dy,lip.z+lip.dz]);
    const pile=loader?earth(p,[0,-.142,.49],[w*.46,.29,.47]):earth(p,[0,.127,.558],[w*.45,.219,.384]);
    return {tip,earth:pile};
  }
  function arm(m,mount,x,y,z,scale) {
    const base=part(mount,[x,y,z]);base.s=[scale,scale,scale];
    const boom=part(base), elbow=part(boom,[0,.84,3.28]), bucket=part(elbow,[0,0,2.56]);
    prism(boom,[[-.23,-.20],[.34,-.25],[1.18,.38],[1.8,.59],[3.21,.64],[3.44,.78],[3.42,1.0],[3.21,1.10],[1.56,1.08],[1.02,.93],[-.18,.18]],0,.45,Y);
    for(let k of [-1,1]) {
      prism(boom,[[.12,.12],[.96,.85],[1.55,.99],[3.09,.97],[3.1,1.035],[1.53,1.045],[.93,.90],[.10,.19]],k*.231,.018,YL);
      rails(boom,[[k*.21,.25,.28],[k*.24,1.06,1.48],[k*.25,1.13,2.90],[k*.25,1.01,3.22]],.025,D);
    }
    prism(elbow,[[-.45,.30],[-.18,.50],[.05,.48],[.29,.28],[.55,.16],[2.46,.14],[2.68,.04],[2.65,-.14],[2.48,-.19],[.50,-.23],[-.20,-.20]],0,.32,Y);
    for(let i of [-1,1]){
      prism(elbow,[[.46,.10],[2.39,.087],[2.41,.045],[.44,.033]],i*.167,.013,YL);
      rails(elbow,[[i*.14,.29,.29],[i*.17,.245,.56],[i*.17,.215,1.8]],.023,D2);
    }
    axle(base,0,0,0,.254,.66,YO,14);
    axle(base,0,0,0,.133,.69,STEEL,12);
    axle(boom,0,.84,3.28,.22,.56,YO,14); axle(boom,0,.84,3.28,.116,.59,STEEL,12);
    axle(elbow,0,0,2.56,.148,.45,YO,12);
    for(let side of [-1,1])piston(m,base,[side*.31,-.12,.20],boom,[side*.31,.88,1.35],.106,.85,D2);
    piston(m,boom,[0,1.105,1.47],elbow,[0,.38,-.19],.120,1.20,Y);
    piston(m,elbow,[0,.20,.43],bucket,[0,.36,.05],.089,1.22,D2);
    const b = digBucket(m,bucket);
    return {boom, elbow, bucket,tip:b.tip,earth:b.earth};
  }
  function armPose(a, s) {
    a.boom.r[0]=.46-1.19*s.boom;
    a.elbow.r[0]=2.22-1.69*s.stick;
    a.bucket.r[0]=-.44+1.70*s.curl;
  }
  function trackAt(shoe,t) {
    const half=1.37,r=.452,d=half*2,arc=PI*r,cycle=2*(d+arc);
    let u=((t%cycle)+cycle)%cycle, y,z,pitch;
    if(u<d){z=-half+u;y=.503+r;pitch=0;}
    else if((u-=d)<arc){const a=u/r;z=half+Math.sin(a)*r;y=.503+Math.cos(a)*r;pitch=a;}
    else if((u-=arc)<d){z=half-u;y=.503-r;pitch=PI;}
    else{const a=(u-d)/r;z=-half-Math.sin(a)*r;y=.503-Math.cos(a)*r;pitch=PI+a;}
    shoe.p[1]=y;shoe.p[2]=z;shoe.r[0]=pitch;
  }
  function tracked(m) {
    const root=m.root;
    box(root,[0,.56,0],[2.14,.44,2.91],D);
    for(const side of [-1,1]){
      const x=side*1.09;
      const tp=[];
      for(let j=0;j<=8;j++){const a=j*PI/8;tp.push([1.37+.452*Math.sin(a),.503+.452*Math.cos(a)]);}
      for(let j=0;j<=8;j++){const a=j*PI/8;tp.push([-1.37-.452*Math.sin(a),.503-.452*Math.cos(a)]);}
      prism(root,tp,x,.46,D);
      for(let j=0;j<7;j++) {
        const z=(j-3)*.445, r=(j===0||j===6)?.374:.242;
        const y=(j===0||j===6)?.503:.345;
        axle(root,x+side*.204,y,z,r,.095,EDGE,14);
        axle(root,x+side*.265,y,z,r*.58,.043,D2,12);
        axle(root,x+side*.284,y,z,r*.23,.05,'#777e75',8);
      }
      prism(root,[[-1.18,.44],[-.99,.36],[1.08,.36],[1.32,.55],[1.1,.69],[-1.15,.68]],x+side*.28,.057,D2);
      const cycle=2*(2.74+PI*.452), count=40;
      for(let j=0;j<count;j++){
        const n=box(root,[x,0,0],[.63,.071,cycle/count*.84],j%4===0?'#626561':'#495050');
        m.tracks.push({shoe:n,side,offset:j*cycle/count}); trackAt(n,j*cycle/count);
      }
    }
    cyl(root,[0,.98,0],.87,.91,.21,D2,22);
    cyl(root,[0,1.08,0],.81,.85,.092,YO,22);
    const turret=part(root,[0,1.10,0]);m.turret=turret;
    prism(turret,[[-1.96,.14],[-1.94,.43],[-1.75,.56],[1.46,.53],[1.58,.37],[1.49,.13]],0,2.49,D2);
    prism(turret,[[-1.91,.46],[-1.92,1.01],[-1.69,1.32],[-.62,1.42],[.45,1.30],[.89,1.04],[.91,.48]],.29,1.78,Y);
    prism(turret,[[-1.93,.51],[-1.92,1.08],[-1.75,1.26],[-1.36,1.31],[-1.3,.51]],-.71,.90,Y);
    vents(turret,1.185,.94,-1.42,1,7,.67,.34);
    stripeID(turret,1,1.192,.59,-1.09);
    box(turret,[.40,1.403,-.80],[1.11,.065,.65],YO);
    for(let j=0;j<7;j++)box(turret,[.4,1.443,-1.10+j*.087],[.77,.017,.035],D2);
    exhaust(turret,.84,1.35,-.79,.68);
    cabin(turret,-.72,.50,.29,1.00,1.65,1.48,Y);
    box(turret,[-.73,.44,1.36],[.90,.17,.48],Y);
    for(let j=0;j<3;j++)box(turret,[-.74,.53,1.17+j*.098],[.64,.025,.036],D2);
    rails(turret,[[-1.22,.51,1.49],[-1.22,1.12,1.49],[-1.22,1.26,1.36],[-1.22,1.26,1.16]],.03,STEEL);
    for(let side of [-1,1])prism(turret,[[.49,.43],[1.32,.41],[1.27,.83],[.97,1.04],[.68,.96]],.25+side*.32,.13,YO);
    m.arm=arm(m,turret,.25,.70,.98,1);
    m.eye=part(turret,[-.72,1.69,1.18]);
    m.viewAim=part(turret,[-.35,1.25,8.75]);
  }
  function steps(p,x,y,z,side,n=2){
    const edge=x+side*.11;
    for(let j=0;j<n;j++) {
      box(p,[x,y+j*.25,z],[.29,.059,.42],D2);
      for(let k=0;k<3;k++)box(p,[edge,y+.035+j*.25,z-.135+k*.135],[.08,.017,.045],STEEL);
    }
  }
  function axleFrame(p,z,w,y){
    axle(p,0,y,z,.099,w,D,10); box(p,[0,y,z],[.49,.22,.40],D2);
  }
  function backhoe(m) {
    const p=m.root;
    box(p,[0,.83,-.05],[1.32,.49,3.23],D2);
    for(const side of [-1,1]) {
      wheel(m,p,side*.90,-.91,.825,.46);
      wheel(m,p,side*.83,1.27,.56,.375,true);
      prism(p,[[-1.77,1.02],[-1.76,1.39],[-1.58,1.67],[-1.25,1.82],[-.70,1.83],[-.37,1.70],[-.15,1.36],[-.17,1.28],[-.46,1.58],[-.75,1.68],[-1.24,1.67],[-1.48,1.57],[-1.63,1.31]],side*.87,.56,Y);
      steps(p,side*.73,.55,-.10,side,2);
    }
    axleFrame(p,-.91,1.90,.82);axleFrame(p,1.27,1.71,.56);
    prism(p,[[.11,1.02],[1.96,1.02],[2.09,1.20],[2.03,1.46],[1.71,1.68],[.40,1.77],[.14,1.60]],0,1.03,Y);
    box(p,[0,1.32,2.03],[.79,.37,.032],D);
    for(let j=0;j<5;j++)box(p,[0,1.165+j*.071,2.055],[.70,.024,.022],EDGE);
    for(let side of [-1,1]) {stripeID(p,side,.524,1.40,.79);workLight(p,side*.43,1.52,1.98);}
    exhaust(p,-.48,1.63,1.04,1.06);
    cabin(p,0,1.14,-.46,1.53,1.64,1.72);
    for(let side of [-1,1]) {
      prism(p,[[-.16,.96],[.43,1.0],[.43,1.76],[.12,1.84],[-.08,1.60]],side*.685,.154,Y);
      box(p,[side*.65,.91,-1.53],[.35,.32,.36],YO);
    }
    const loader=part(p,[0,1.62,.18]); m.loader=loader;
    for(let side of [-1,1]) {
      const x=side*.715;
      prism(loader,[[-.13,-.11],[-.07,.15],[.19,.19],[1.35,.08],[1.92,-.07],[2.24,-.26],[2.25,-.42],[2.09,-.46],[1.79,-.31],[1.22,-.15],[.09,-.10]],x,.168,Y);
      axle(loader,x,0,0,.163,.23,YO,14);
      axle(loader,x+side*.105,0,0,.078,.055,STEEL,10);
      piston(m,p,[x,.91,.55],loader,[x,-.10,1.35],.094,.75);
    }
    box(loader,[0,-.16,1.79],[1.52,.15,.17],YO);
    m.shovel=part(loader,[0,-.36,2.15]);
    for(let side of [-1,1])piston(m,loader,[side*.58,.095,.96],m.shovel,[side*.58,.28,.09],.069,.79);
    m.front=digBucket(m,m.shovel,true);
    const rear=part(p,[0,1.27,-1.54]); m.rear=rear;
    cyl(rear,[0,0,0],.31,.34,.40,YO,12);
    m.arm=arm(m,rear,0,.04,.12,.66);
    m.legs=[];
    for(const side of [-1,1]){
      const x=side*.99;
      const frame=part(p,[x,1.22,-1.44]);frame.r[2]=side*.16;
      box(frame,[0,-.20,0],[.20,.62,.23],Y);
      const leg=part(frame,[0,-.20,0]);m.legs.push(leg);
      box(leg,[0,-.16,0],[.133,.53,.15],STEEL);
      box(leg,[0,-.45,0],[.33,.09,.37],D2);
    }
    m.eye=part(p,[0,2.57,.50]);m.viewAim=part(p,[0,1.28,8.2]);
    m.rearEye=part(p,[0,2.58,-1.4]);m.rearAim=part(p,[0,1.05,-8]);
  }
  function grader(m) {
    const p=m.root;
    box(p,[0,.94,-1.60],[1.21,.45,3.59],D2);
    box(p,[0,1.18,-1.73],[1.54,.27,3.64],Y);
    for(let side of [-1,1]){
      for(let z of [-2.92,-1.57])wheel(m,p,side*.93,z,.715,.43);
      wheel(m,p,side*.91,2.96,.675,.40,true);
      prism(p,[[-3.03,.71],[-2.91,.54],[-1.72,.55],[-1.44,.72],[-1.48,.87],[-2.90,.89]],side*.77,.36,YO);
      steps(p,side*.79,.60,-.86,side,3);
      rails(p,[[side*.8,1.39,-1.08],[side*.81,1.72,-1.08],[side*.81,1.72,-.88]],.026,D);
    }
    axleFrame(p,-2.92,1.95,.71);axleFrame(p,-1.57,1.95,.71);axleFrame(p,2.96,1.89,.67);
    prism(p,[[-3.70,1.28],[-3.70,1.73],[-3.53,1.98],[-2.99,2.08],[-1.49,2.06],[-1.28,1.81],[-1.29,1.32]],0,1.48,Y);
    for(let side of [-1,1]){vents(p,.749,1.75,-3.16,side,7,.53,.27);stripeID(p,side,.756,1.44,-2.53);}
    exhaust(p,-.55,2.02,-2.57,.95);
    cabin(p,0,1.39,-.94,1.55,1.40,1.81);
    prism(p,[[-.66,1.11],[.07,1.16],[.52,1.38],[2.67,1.58],[2.84,1.51],[2.88,.82],[3.12,.83],[3.15,1.62],[2.94,1.86],[.47,1.82],[-.44,1.62]],0,.38,Y);
    prism(p,[[-.27,1.61],[.52,1.82],[2.96,1.85],[2.89,1.91],[.49,1.88],[-.3,1.67]],0,.405,D2);
    for(let side of [-1,1]) {
      workLight(p,side*.55,1.85,2.92);
      bar(p,[0,1.68,2.82],[side*.55,1.78,2.89],.042,D2);
      rails(p,[[side*.21,1.47,.02],[side*.22,1.61,.88],[side*.22,1.65,2.36]],.026,D);
    }
    m.bladeGroup=part(p,[0,0,.53]);
    m.bladeTurn=part(m.bladeGroup);
    cyl(m.bladeTurn,[0,.49,.08],.65,.60,.13,YO,20);
    cyl(m.bladeTurn,[0,.415,.08],.60,.63,.065,D2,20);
    for(let s of [-1,1]){
      G.beam(m.bladeTurn,[s*.55,.44,.13],[s*1.08,.20,0],.13,.15,Y);
      bar(m.bladeTurn,[s*.47,.50,.20],[s*1.05,.31,.06],.046,STEEL);
    }
    const blade=[[-.11,.57],[-.045,.56],[.025,.41],[.057,.26],[.115,.11],[.23,.019],[.21,-.015],[.113,.01],[.00,.12],[-.075,.31]];
    prism(m.bladeTurn,blade,0,3.26,EDGE);
    prism(m.bladeTurn,[[.10,.075],[.22,.03],[.223,-.018],[.16,-.01]],0,3.32,'#9caaa4');
    for(let side of [-1,1]){
      prism(m.bladeTurn,[[-.18,.54],[-.08,.57],[.17,.06],[.05,.08],[-.12,.31]],side*1.51,.064,Y);
    }
    // Lift cylinders pivot on the bridge and follow the blade carriage.
    m.bladeLegs=[];
    for(let side of [-1,1]) {
      const leg=part(p,[side*.47,1.60,.49]);leg.r[2]=-side*.18;
      cyl(leg,[0,-.29,0],.082,.082,.55,D2,10);
      cyl(leg,[0,-.55,0],.092,.088,.065,YO,10);
      const rod=cyl(leg,[0,-.78,0],.045,.045,.44,STEEL,10);
      m.bladeLegs.push(rod);
      bar(p,[0,1.59,.49],[side*.51,1.64,.49],.075,Y);
    }
    box(p,[0,1.06,-3.66],[1.29,.20,.31],Y);
    for(let x of [-.48,0,.48])prism(p,[[-3.59,1.08],[-3.86,.97],[-3.90,.64],[-3.77,.48],[-3.76,.68],[-3.70,.91],[-3.51,.94]],x,.088,YO);
    m.gradeTip=part(m.bladeTurn,[0,0,.21]);
    m.eye=part(p,[0,2.89,-.13]);m.viewAim=part(p,[0,1.25,8.00]);
  }
  function truck(m) {
    const p=m.root; const WHITE='#e7e9e1', CHAR='#242a2d';
    box(p,[0,.80,.06],[1.0,.36,5.86],D);
    for(let s of [-1,1]){
      box(p,[s*.57,.93,0],[.11,.28,5.65],D2);
      for(const z of [-2.03,-.91])wheel(m,p,s*1.00,z,.565,.43,false,'#a9b1af');
      wheel(m,p,s*.97,2.07,.565,.365,true,'#a9b1af');
      box(p,[s*.925,1.16,-1.45],[.58,.11,2.49],D2);
      box(p,[s*.916,.76,-2.55],[.49,.70,.07],D);
      box(p,[s*.84,.82,.36],[.48,.55,.97],D2);
      for(let z of [.05,.65])box(p,[s*.84,.82,z],[.495,.57,.069],EDGE);
      box(p,[s*1.08,.56,.04],[.095,.084,1.37],STEEL);
      box(p,[s*1.08,.91,.05],[.095,.084,1.37],STEEL);
      steps(p,s*1.00,.54,1.64,s,2);
    }
    for(let z of [-2.03,-.91,2.07])axleFrame(p,z,2.02,.57);
    box(p,[0,1.04,2.49],[2.17,.29,1.40],CHAR);
    const g=cabin(p,0,1.13,2.12,2.15,1.92,1.95,WHITE,true);
    prism(p,[[1.16,1.08],[3.06,1.08],[3.08,1.82],[3.05,2.04],[2.87,2.03],[2.82,1.49],[1.35,1.44]],0,2.16,WHITE);
    for(let side of [-1,1]){
      prism(p,[[1.15,.87],[1.26,1.12],[1.43,1.35],[1.69,1.47],[2.38,1.47],[2.67,1.35],[2.83,1.08],[2.88,.89],[2.77,.89],[2.65,1.13],[2.41,1.26],[1.72,1.28],[1.51,1.19],[1.31,.88]],side*1.017,.25,WHITE);
      box(p,[side*.90,.91,3.115],[.31,.25,.12],EDGE);
      box(p,[side*.90,.937,3.185],[.24,.109,.025],LIGHT);
      box(p,[side*.90,.84,3.185],[.14,.048,.026],'#ffc074');
    }
    box(p,[0,1.57,3.098],[1.36,.55,.061],CHAR);
    for(let j=0;j<4;j++)box(p,[0,1.365+j*.121,3.137],[1.32,.031,.028],'#66706f');
    box(p,[0,1.13,3.106],[2.22,.16,.15],CHAR);
    box(p,[0,.78,3.018],[2.16,.18,.25],CHAR);
    box(p,[0,.97,3.05],[1.5,.23,.21],CHAR);
    box(p,[0,.94,3.165],[.49,.106,.025],'#c8c4a7');
    // The dump body is a hollow shell with replaceable rails and external ribs.
    const bed=part(p,[0,1.33,-2.67]);m.bed=bed;
    box(bed,[0,.075,1.93],[2.21,.15,4.10],YO);
    box(bed,[0,.154,1.91],[2.09,.037,3.96],'#92712f');
    const wall=[[-.12,.05],[3.96,.05],[4.02,.29],[4.02,1.32],[-.12,1.29]];
    for(let side of [-1,1]){
      prism(bed,wall,side*1.076,.098,Y);
      box(bed,[side*1.08,1.31,1.95],[.16,.13,4.21],YL);
      box(bed,[side*1.08,.14,1.94],[.16,.15,4.17],YO);
      for(let i=0;i<6;i++){
        const z=-.075+i*.805;
        prism(bed,[[z-.053,.18],[z+.075,.18],[z+.112,.45],[z+.11,1.26],[z-.012,1.26],[z-.012,.47]],side*1.141,.081,YO);
      }
      for(let i=0;i<5;i++){
        sticker(bed,side,1.133,.27,.17+i*.78,.40,.07,'#e4e4c9');
        sticker(bed,side,1.14,.27,.17+i*.78,.20,.07,RED);
      }
    }
    box(bed,[0,.82,3.96],[2.18,1.48,.108],Y);
    box(bed,[0,1.62,4.08],[2.30,.091,.39],YL);
    const gate=part(bed,[0,1.255,-.105]);m.gate=gate;
    box(gate,[0,-.54,0],[2.11,1.08,.095],Y);
    for(let x of [-.84,-.42,0,.42,.84])box(gate,[x,-.55,-.068],[.071,.97,.075],YO);
    box(gate,[0,-1.04,-.056],[2.15,.14,.12],YO);
    for(let s of [-1,1]){
      axle(gate,s*1.055,0,0,.096,.18,EDGE,10);
      box(p,[s*.85,.85,-2.77],[.33,.14,.13],D2);
      box(p,[s*.85,.85,-2.85],[.24,.085,.039],RED);
    }
    axle(p,0,1.33,-2.67,.13,2.15,D2,12);
    // Telescopic main hoist spans from the frame to the front of the moving body.
    const hoist=part(p,[0,.93,.41]);m.hoist=hoist;m.hoistRods=[];
    for(let j=0;j<4;j++){
      const radius=.18-j*.026;
      m.hoistRods.push(cyl(hoist,[0,0,0],radius,radius,1,j%2?'#acb8b4':D2,12));
    }
    m.cargo=earth(bed,[0,.52,1.91],[1.06,.71,1.93]);
    m.dump=part(bed,[0,.18,-.20]);
    m.eye=part(p,[-.48,2.58,3.16]);m.viewAim=part(p,[-.45,2.00,12.30]);
  }
  function motorbike(m) {
    const p=m.root, blue='#31556a', red='#c14b2d', rubber='#292e30';
    for(const front of [false,true]){
      const z=front?.82:-.81, hub=part(p,[0,.39,z]), roll=part(hub);
      m.wheels.push({hub,roll,steering:front});
      const rim=[], faces=[];
      for(let j=0;j<24;j++){
        const a=j*TAU/24;
        for(let k=0;k<6;k++){
          const b=k*TAU/6,r=.327+.068*Math.cos(b);
          rim.push([.085*Math.sin(b),r*Math.cos(a),r*Math.sin(a)]);
          const u=j*6+k,v=j*6+(k+1)%6,w=((j+1)%24)*6+k,t=((j+1)%24)*6+(k+1)%6;
          faces.push(u,w,v,v,w,t);
        }
        if(j%2===0)bar(roll,[0,0,0],[0,.29*Math.cos(a),.29*Math.sin(a)],.012,STEEL);
      }
      triMesh(roll,rim,faces,rubber);axle(roll,0,0,0,.075,.20,STEEL);
      for(const side of [-1,1])bar(p,[side*.10,.39,z],[side*.13,front?1.08:.65,front?.60:.04],.033,front?STEEL:D2);
    }
    prism(p,[[-.85,.85],[-.23,.66],[.36,.65],[.55,1.08],[.3,1.15],[-.1,.96],[-.85,.94]],0,.31,red);
    box(p,[0,.62,.08],[.34,.29,.36],D2);
    box(p,[0,.99,-.25],[.31,.11,.68],rubber);
    box(p,[0,.85,.78],[.24,.075,.48],red);box(p,[0,1.13,.64],[.21,.21,.08],'#f1e5cb');
    bar(p,[-.34,1.23,.48],[.34,1.23,.48],.028,D2);
    for(const side of [-1,1])bar(p,[0,1.04,.60],[side*.30,1.23,.48],.024,STEEL);
    m.rider=part(p);const rider=m.rider;
    G.sphere(rider,[0,1.33,-.12],[.23,.34,.16],blue,10);
    G.sphere(rider,[0,1.75,-.06],[.155,.18,.16],'#e2b347',12);
    box(rider,[0,1.77,.079],[.245,.073,.09],D);
    for(const side of [-1,1]){
      const k=side;
      G.beam(rider,[k*.12,1.08,-.22],[k*.24,.78,.11],.14,.15,blue);
      G.beam(rider,[k*.24,.78,.11],[k*.22,.48,-.02],.12,.13,blue);
      box(rider,[k*.22,.47,.025],[.14,.12,.24],rubber);
      bar(rider,[k*.18,1.53,-.09],[k*.29,1.31,.12],.071,blue);
      bar(rider,[k*.29,1.31,.12],[k*.30,1.24,.46],.056,'#a77d58');
    }
    m.eye=part(p,[0,1.78,.18]);m.viewAim=part(p,[0,1.3,9]);m.dump=part(p,[0,.4,.86]);
  }
  function pickup(m) {
    const p=m.root, paint='#566f67', ivory='#d7d7bb';
    box(p,[0,.61,0],[1.56,.35,4.35],D2);
    for(const side of [-1,1])for(const z of [-1.36,1.39])wheel(m,p,side*.83,z,.44,.25,z>0,STEEL);
    box(p,[0,.89,0],[1.77,.47,4.35],paint);
    cabin(p,0,1.03,.47,1.73,1.56,1.12,ivory,true);
    prism(p,[[1.08,.99],[2.18,.99],[2.16,1.23],[1.09,1.36]],0,1.75,paint);
    box(p,[0,.76,2.20],[1.84,.16,.17],D2);
    box(p,[0,1.08,2.178],[.87,.16,.04],D);
    for(const side of [-1,1]){
      box(p,[side*.66,1.13,2.18],[.34,.17,.045],'#f6df9e');
      box(p,[side*.83,1.18,-1.28],[.11,.44,1.78],paint);
      box(p,[side*.74,1.13,-2.19],[.19,.18,.057],'#aa392e');
    }
    box(p,[0,1.17,-2.14],[1.69,.40,.10],paint);
    box(p,[0,1.25,-1.08],[1.23,.48,.84],'#c49b4b');
    for(const side of [-1,1])box(p,[side*.36,1.25,-1.08],[.07,.50,.86],D2);
    cyl(p,[-.44,1.32,-1.77],.20,.20,.47,'#586d79',12);
    beacon(p,0,2.16,.28);
    m.eye=part(p,[.39,1.91,1.10]);m.viewAim=part(p,[.39,1.38,10]);m.dump=part(p,[0,.8,2.2]);
  }
  function fill(n,fraction) {
    const f=clamp(fraction,0,1);n.visible=f>.009;
    // Preserve the ellipsoid's source dimensions, scale vertically with load.
    n.s[1]=.17+.83*f;n.s[0]=n.s[2]=.58+.42*Math.sqrt(f);
  }
  function view(m,state={}) {
    const rear=m.type==='back'&&(state.tool||m.tool)==='rear';
    return {eye:G.worldPoint(rear?m.rearEye:m.eye,[0,0,0]),target:G.worldPoint(rear?m.rearAim:m.viewAim,[0,0,0])};
  }
  // Batch rigid pieces in their own joint's coordinate frame. Moving parts and
  // contact sockets retain their original trajectories and remain queryable.
  function batchRigidParts(m) {
    if (!G.freeze) return;
    const moving=new Set([m.root]);
    function keep(n) {
      while(n && !moving.has(n)) {moving.add(n);n=n.parent;}
    }
    for(const w of m.wheels){keep(w.hub);keep(w.roll);}
    for(const t of m.tracks)keep(t.shoe);
    for(const a of m.links){keep(a.body);keep(a.shell);keep(a.gland);keep(a.rod);}
    if(m.arm){for(const n of [m.arm.boom,m.arm.elbow,m.arm.bucket,m.arm.earth])keep(n);}
    for(const n of [m.operator,m.rider,m.turret,m.rear,m.loader,m.shovel,m.front?.earth,m.bladeGroup,m.bladeTurn,m.bed,m.gate,m.cargo,m.hoist])keep(n);
    for(const n of [...(m.legs||[]),...(m.bladeLegs||[]),...(m.hoistRods||[])])keep(n);
    for(const n of moving){
      if(!n.children || n.children.length<2)continue;
      const rigid=n.children.filter(c=>!moving.has(c));
      if(rigid.length<2)continue;
      n.children=n.children.filter(c=>moving.has(c));
      const batch=part(n);
      for(const c of rigid){c.parent=batch;batch.children.push(c);}
      G.freeze(batch);
    }
  }
  function create(type,parent=null){
    const m={type,root:part(parent),wheels:[],links:[],tracks:[],tool:'front'};
    const build={exc:tracked,back:backhoe,grader,truck,bike:motorbike,pickup}[type];
    if(!build)throw new Error('Tipo de máquina desconhecido: '+type);
    build(m);
    if(type!=='bike'){
      // Seated operator follows the excavator turret and the backhoe seat.
      const seat={exc:[-.72,.75,.28],back:[0,1.48,-.46],grader:[0,1.68,-1.17],truck:[-.48,1.55,2.06],pickup:[.39,1.15,.44]}[type];
      m.operator=part(m.turret||m.root,seat);
      G.sphere(m.operator,[0,.45,0],[.19,.29,.14],'#d59334',8);
      G.sphere(m.operator,[0,.82,0],[.13,.16,.13],'#a97855',8);
      G.sphere(m.operator,[0,.93,0],[.15,.085,.15],'#efb23c',8);
      for(const side of [-1,1]){
        G.beam(m.operator,[side*.15,.55,0],[side*.18,.36,.27],.10,.10,'#526578');
        G.beam(m.operator,[side*.10,.22,0],[side*.12,.17,.28],.13,.15,'#3d5162');
      }
      G.freeze(m.operator);
    }
    batchRigidParts(m);pose(m,{});return m;
  }
  function pose(m,input={}) {
    const s={
      boom:input.boom??.52,stick:input.stick??.65,curl:input.curl??.13,
      blade:input.blade??.5,bed:input.bed??0,frontLift:input.frontLift??.13,
      frontCurl:input.frontCurl??.25,load:input.load??0,stabilizers:input.stabilizers??0,
      slew:input.slew??0,bladeAngle:input.bladeAngle??0,
      wheelRoll:input.wheelRoll??0,steer:input.steer??0,tool:input.tool??'front'
    };
    for(const w of m.wheels){w.roll.r[0]=s.wheelRoll;if(w.steering)w.hub.r[1]=s.steer;}
    m.tool=s.tool;
    if(m.operator){m.operator.visible=!!input.occupied;m.operator.r[1]=m.type==='back'&&s.tool==='rear'?PI:0;}
    if(m.rider)m.rider.visible=!!input.occupied;
    switch(m.type) {
      case 'exc':
        for(let i=0;i<m.tracks.length;i++){
          const t=m.tracks[i];
          const distance=(t.side>0?input.leftTravel:input.rightTravel)??s.wheelRoll*.452;
          trackAt(t.shoe,t.offset+distance);
        }
        m.turret.r[1]=s.slew;armPose(m.arm,s);fill(m.arm.earth,s.load/(input.capacity||1.2));break;
      case 'back': {
        const deployed=clamp(s.stabilizers,0,1);
        m.rear.r[1]=PI+clamp(s.slew,-1.25,1.25)*deployed;
        // Unfold with the stabilizer stroke, then follow the rear joysticks.
        const rear=s.tool==='rear';
        armPose(m.arm,{boom:.96+(s.boom-.96)*deployed,stick:.16+(s.stick-.16)*deployed,curl:.84+(s.curl-.84)*deployed});
        m.loader.r[0]=.47-1.50*s.frontLift;
        m.shovel.r[0]=.63-1.72*s.frontCurl-m.loader.r[0];
        m.legs.forEach(n=>{n.p[1]=-.20-.55*s.stabilizers;});
        fill(m.arm.earth,rear?s.load/(input.capacity||.38):(input.rearLoad||0)/.38);
        fill(m.front.earth,rear?(input.frontLoad||0)/.95:s.load/(input.capacity||.95));
        break;
      }
      case 'grader': {
        const lift=-.32+s.blade*.98;
        m.bladeGroup.p[1]=lift;
        m.bladeTurn.r[1]=s.bladeAngle;
        const length=Math.max(.05,1.60-lift-.50-.55);
        for(let n of m.bladeLegs){n.p[1]=-.55-length*.5;n.s[1]=length/.44;}
        break;
      }
      case 'truck': {
        m.bed.r[0]=-s.bed*.97;m.gate.r[0]=s.bed*1.28;
        const a=m.bed.r[0],dy=1.33+.15*Math.cos(a)-3.64*Math.sin(a)-.93;
        const dz=-2.67+.15*Math.sin(a)+3.64*Math.cos(a)-.41, len=Math.hypot(dy,dz);
        m.hoist.r[0]=Math.atan2(dz,dy);
        m.hoistRods.forEach((n,j)=>{n.p[1]=(j+.5)*len/4;n.s[1]=len*.265;});
        fill(m.cargo,s.load/(input.capacity||8));m.cargo.p[1]=.17+Math.min(1,s.load/(input.capacity||8))*.43;
        break;
      }
    }
    solvePistons(m);
  }
  function tip(m) {
    const n=m.type==='exc'?m.arm.tip:m.type==='back'?(m.tool==='rear'?m.arm.tip:m.front.tip):m.type==='grader'?m.gradeTip:m.dump;
    return G.worldPoint(n,[0,0,0]);
  }
  window.Machines={create,pose,tip,view};
})();

/* Terra Brava. One metre height samples shared by the mesh and the implements. */
window.World = (() => {
  "use strict";
  const zones = {cut:{x:0,z:4,r:9},dump:{x:68,z:-13,r:5},depot:{x:-16,z:-15,r:5},contract:{x:6,z:-13,r:4},grade:{x:14,z:-14,r:8}};
  const W=128, D=80, STEP=1, TILE=16, X0=-48, Z0=-40;
  const bounds=Object.freeze({minX:X0,maxX:X0+W*STEP,minZ:Z0,maxZ:Z0+D*STEP});
  const n=(W+1)*(D+1), heights=new Float32Array(n), original=new Float32Array(n);
  const baseColors=new Float32Array(n*3), tiles=[], obstacles=[], dirty=new Set();
  let parent, solids, noiseSeed=38194;
  const clamp=(a,b,c)=>Math.max(b,Math.min(c,a));
  const mix=(a,b,t)=>a+(b-a)*t;
  const ramp=(a,b,x)=>{const v=clamp((x-a)/(b-a),0,1);return v*v*(3-2*v);};
  const fract=x=>x-Math.floor(x);
  const rand=()=>{noiseSeed=(Math.imul(noiseSeed,1664525)+1013904223)>>>0;return noiseSeed/4294967296;};
  const between=(a,b)=>mix(a,b,rand());
  const hash=(x,z)=>fract(Math.sin(x*127.1+z*311.7+31.13)*43758.5453);
  function noise(x,z){
    const i=Math.floor(x),j=Math.floor(z),a=ramp(0,1,x-i),b=ramp(0,1,z-j);
    return mix(mix(hash(i,j),hash(i+1,j),a),mix(hash(i,j+1),hash(i+1,j+1),a),b);
  }
  const fbm=(x,z)=>noise(x,z)*0.61+noise(x*2.01+72,z*2.01-51)*0.27+noise(x*4.07,z*4.07)*0.12;
  const path=[[-48,17],[-35,11],[-24,-1],[-12,-9],[4,-10],[16,-6],[24,3],[26,14],[28,24],[41,34],[52,38]];
  function roadDistance(x,z){
    // Acesso de caminhões entre o pátio e a estrada municipal.
    const t=clamp(((x-19)*27-(z-11)*27)/1458,0,1);
    let best=Math.hypot(x-19-27*t,z-11+27*t);
    for(let i=1;i<path.length;i++){
      const [ax,az]=path[i-1],[bx,bz]=path[i],dx=bx-ax,dz=bz-az;
      const t=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz),0,1);
      best=Math.min(best,Math.hypot(x-ax-dx*t,z-az-dz*t));
    }
    return best;
  }
  function shelfDepth(x,z){
    const back=(-z-27+1.3*Math.sin(x*.165)+1.9*Math.sin(x*.072));
    const west=(-x-35+2.8*Math.cos(z*.125));
    return Math.max(back,west);
  }
  function ground(x,z){
    const rd=roadDistance(x,z);
    const cut=2.35*Math.exp(-((x+1.1)**2/15+(z-5.8)**2/7))
             +1.25*Math.exp(-((x+4.3)**2/12+(z-2.7)**2/13));
    const ripple=0.34*Math.cos((x-z)*1.26)*(1-ramp(3,9,Math.hypot(x-14,z+14)));
    const depth=shelfDepth(x,z);
    const bench=ramp(0,2.8,depth)*2.8+ramp(5.7,8.8,depth)*3.1+ramp(11,17,depth)*1.7;
    const green=ramp(25,39,Math.max(Math.abs(x)*.88,z));
    const edge=green*(1.2+1.0*Math.sin(x*.143)+1.2*fbm(x*.15,z*.15));
    const rough=(fbm(x*.16,z*.16)-.47)*.28+(fbm(x*.046,z*.046)-.5)*.46;
    const corridor=(1-ramp(2.4,5,Math.abs(z+16)))*ramp(9,14,x)*(1-ramp(65,70,x));
    const ruts=corridor*(.17*Math.cos(x*1.44)+.15*Math.sin(z*1.92+x*.49));
    return ruts+rough+bench+edge+cut+ripple-.1*(1-ramp(2.5,4,rd));
  }
  function sample(x,z,arr=heights){
    let gx=clamp((x-X0)/STEP,0,W-1e-5),gz=clamp((z-Z0)/STEP,0,D-1e-5);
    const ix=Math.floor(gx),iz=Math.floor(gz),f=gx-ix,g=gz-iz,i=ix+iz*(W+1);
    if(f+g<=1) return arr[i]+(arr[i+1]-arr[i])*f+(arr[i+W+1]-arr[i])*g;
    const k=i+W+2;
    return arr[k]+(arr[k-1]-arr[k])*(1-f)+(arr[k-W-1]-arr[k])*(1-g);
  }
  const height=(x,z)=>sample(x,z);
  const color=(r,g,b)=>[r/255,g/255,b/255];
  const blend=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
  const clay=color(171,117,76), grit=color(189,149,105), greenColor=color(116,124,77);
  function terrainColor(x,z){
    const rd=roadDistance(x,z), d=shelfDepth(x,z);
    const und=fbm(x*.20,z*.20), fine=noise(x*.65,z*.65);
    const river=fbm(x*.085+40,z*.084);
    let c=blend(clay,grit,clamp(und*.84+(river-.37)*1.32+(1-ramp(2.4,4.8,rd))*.59,0,1));
    const garden=ramp(26,38,Math.max(Math.abs(x)*.87,z)+6*(river-.45))*ramp(3,6,rd);
    const ledge=ramp(2.55,3.3,d)*(1-ramp(5,6,d))+ramp(8.65,10,d);
    c=blend(c,greenColor,Math.max(garden,ledge*(.31+und*.69)));
    const rock=ramp(.1,1.6,d)*(1-ramp(2.2,3.3,d))+ramp(5.6,6.8,d)*(1-ramp(8.4,9.15,d));
    c=blend(c,blend(color(150,103,80),color(176,141,112),.5+.44*Math.sin(d*4.21+und*4)),rock*.93);
    const trench=(1-ramp(1.6,5.7,Math.hypot(x+1.2,z-5.4)));
    c=blend(c,color(163,107,66),trench*.68);
    const variation=1+(und-.5)*.18+(fine-.5)*.055;
    return c.map(k=>k*variation);
  }
  function groundTile(tx,tz){
    const indices=[],pos=[],colors=[],shade=[];
    const i0=tx*TILE,j0=tz*TILE,si=TILE+1;
    for(let z=0;z<=TILE;z++) for(let x=0;x<=TILE;x++){
      const idx=i0+x+(j0+z)*(W+1);
      pos.push(X0+(i0+x)*STEP,heights[idx],Z0+(j0+z)*STEP);
      colors.push(...baseColors.subarray(idx*3,idx*3+3));
      shade.push(idx);
      if(z<TILE&&x<TILE){const a=x+z*si;indices.push(a,a+si,a+1,a+1,a+si,a+si+1);}
    }
    const tile={node:G.mesh(parent,pos,indices,'#ffffff',colors),pos,indices,colors,shade, marks:[], mp:[],mc:[],mi:[],mn:null};
    tile.node._geom.soil=true;
    tiles[tx+tz*(W/TILE)]=tile;
  }
  function flag(ix,iz){
    const tx=Math.floor(ix/TILE), tz=Math.floor(iz/TILE);
    for(let z=(iz%TILE===0?tz-1:tz);z<=tz;z++)for(let x=(ix%TILE===0?tx-1:tx);x<=tx;x++)
      if(x>=0&&z>=0&&x<W/TILE&&z<D/TILE)dirty.add(x+z*(W/TILE));
  }
  function samples(x,z,rad){
    rad=Math.max(1.05,rad);
    const hits=[];
    const left=Math.max(1,Math.ceil((x-rad-X0)/STEP)),right=Math.min(W-1,Math.floor((x+rad-X0)/STEP));
    const back=Math.max(1,Math.ceil((z-rad-Z0)/STEP)),front=Math.min(D-1,Math.floor((z+rad-Z0)/STEP));
    for(let iz=back;iz<=front;iz++)for(let ix=left;ix<=right;ix++){
      const dx=X0+ix*STEP-x,dz=Z0+iz*STEP-z,d=(dx*dx+dz*dz)/(rad*rad);
      if(d<1)hits.push({ix,iz,i:ix+iz*(W+1),dx,dz,w:(1-d)**1.2});
    }
    return hits;
  }
  function moveSoil(x,z,rad,volume,direction){
    if(!(volume>0&&Number.isFinite(volume)))return 0;
    const hits=samples(x,z,rad);let moved=0,rest=volume;
    for(let pass=0;pass<4&&rest>.000001;pass++){
      let weights=0;
      for(const q of hits){
        const room=direction>0?original[q.i]+7-heights[q.i]:heights[q.i]-(original[q.i]-3);
        q.room=Math.max(0,room)*STEP*STEP;
        if(q.room>.000001)weights+=q.w;
      }
      if(weights<.000001)break;
      let step=0;
      for(const q of hits)if(q.room>.000001){
        const v=Math.min(q.room,rest*q.w/weights),old=heights[q.i];
        heights[q.i]+=direction*v/(STEP*STEP);
        const net=Math.abs(heights[q.i]-old)*STEP*STEP;
        if(net){flag(q.ix,q.iz);step+=net;}
      }
      moved+=step;rest-=step;
    }
    return moved;
  }
  function grade(x,z,rad,volume,angle=0){
    if(!(volume>0&&Number.isFinite(volume)))return 0;
    const hits=samples(x,z,Math.max(1.85,rad));if(hits.length<3)return 0;
    let sum=0,weight=0,cut=0,fill=0;
    const slope=.035*Math.sin(angle||0);
    for(const q of hits){sum+=(heights[q.i]-slope*q.dx)*q.w;weight+=q.w;}
    const level=sum/weight;
    for(const q of hits){
      const diff=heights[q.i]-level-slope*q.dx;
      const room=diff>0?heights[q.i]-original[q.i]+3:original[q.i]+7-heights[q.i];
      q.signed=Math.sign(diff)*Math.max(0,Math.min(Math.abs(diff)*q.w,room))*STEP*STEP;
      if(q.signed>0)cut+=q.signed;else fill-=q.signed;
    }
    const moved=Math.min(cut,fill,volume);if(moved<.00001)return 0;
    for(const q of hits){
      heights[q.i]-=q.signed/(q.signed>0?cut:fill)*moved/(STEP*STEP);flag(q.ix,q.iz);
    }
    return moved;
  }
  function updateTile(t){
    for(let j=0;j<t.shade.length;j++){
      const i=t.shade[j], delta=heights[i]-original[i];
      t.pos[j*3+1]=heights[i];
      const factor=1-Math.min(.28,Math.abs(Math.min(0,delta))*.14)-Math.min(.07,Math.max(0,delta)*.06);
      for(let k=0;k<3;k++)t.colors[j*3+k]=baseColors[i*3+k]*factor;
    }
    G.updateMesh(t.node,t.pos,t.indices,'#ffffff',t.colors);
    if(t.mn){
      t.mp.length=0;
      for(const p of t.marks){
        const surface=height(p[0],p[1]),erased=p[3]&&Math.abs(surface-p[4])>.12;
        t.mp.push(p[0],surface+p[2]-(erased?.13:0),p[1]);
      }
      G.updateMesh(t.mn,t.mp,t.mi,'#ffffff',t.mc);
    }
  }
  function flush(){ for(const id of dirty)updateTile(tiles[id]);dirty.clear(); }
  function mark(points,c,lift=.024,erases=true){
    let x=0,z=0;for(const a of points){x+=a[0]/points.length;z+=a[1]/points.length;}
    const t=tiles[clamp(Math.floor((x-X0)/TILE),0,W/TILE-1)+clamp(Math.floor((z-Z0)/TILE),0,D/TILE-1)*(W/TILE)];
    let ofs=t.marks.length;
    for(const p of points){const surface=height(p[0],p[1]);t.marks.push([p[0],p[1],lift,erases,surface]);t.mp.push(p[0],surface+lift,p[1]);t.mc.push(...c);}
    // Projected XZ clockwise contour is front-facing from above.
    for(let k=1;k<points.length-1;k++)t.mi.push(ofs,ofs+k,ofs+k+1);
  }
  function stripe(ax,az,bx,bz,width,c,offset,erases){
    const m=Math.hypot(bx-ax,bz-az),rx=(bz-az)/m*width/2,rz=-(bx-ax)/m*width/2;
    mark([[ax-rx,az-rz],[bx-rx,bz-rz],[bx+rx,bz+rz],[ax+rx,az+rz]],c,offset,erases);
  }
  function details(){
    // Paired tire bars and discolorations follow the service lane.
    const dirt=color(147,113,79);
    for(let i=1;i<path.length;i++){
      const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
      for(let d=.3;d<length;d+=.57){
        const px=a[0]+ux*d,pz=a[1]+uz*d;if(Math.abs(px)>45||Math.abs(pz)>37)continue;
        for(const side of [-1,1]){
          const off=side*(1.02+.055*Math.sin(d*.44+i));
          const tx=px+uz*off,tz=pz-ux*off;
          if(rand()<.3)continue;
          stripe(tx-uz*.13-ux*.08,tz+ux*.13-uz*.08,tx+uz*.13+ux*.08,tz-ux*.13+uz*.08,.087,dirt,.023,true);
        }
      }
    }
    // Small stones are ground decals; active tools erase them where the surface changes.
    for(let i=0;i<2300;i++){
      const x=between(-43,43),z=between(-36,36),sx=between(.045,.22),sz=sx*between(.38,1.1);
      const c=blend(terrainColor(x,z),rand()<.5?color(117,94,78):color(212,181,136),between(.22,.7));
      mark([[x-sx,z],[x,z+sz],[x+sx,z+sz*.14],[x+sx*.13,z-sz*.61]],c,.025,true);
    }
    for(const [key,sz,col] of [['dump',5.1,color(241,190,79)],['grade',5.9,color(218,204,156)]]){
      const o=zones[key];
      for(const x of [-1,1])for(const z of [-1,1]){
        const px=o.x+sz*x,pz=o.z+sz*z;
        stripe(px,pz,px-1.64*x,pz,.18,col,.052,false);
        stripe(px,pz,px,pz-1.64*z,.18,col,.052,false);
      }
    }
    for(const t of tiles)if(t.marks.length)t.mn=G.mesh(parent,t.mp,t.mi,'#ffffff',t.mc);
  }
  const box=(p,x,y,z,w,h,d,c)=>G.box(p,[x,y,z],[w,h,d],c);
  function circularObstacle(x,z,r){obstacles.push({x,z,r});}
  function rectObstacle(x,z,w,d){obstacles.push({x,z,hw:w/2,hd:d/2});}
  function collides(x,z,r=.5){
    if(x-r<X0+1.4||x+r>X0+W-1.4||z-r<Z0+1.4||z+r>Z0+D-1.4)return true;
    for(const o of obstacles){
      if(o.r){if(Math.hypot(x-o.x,z-o.z)<o.r+r)return true;}
      else if(Math.hypot(Math.max(0,Math.abs(x-o.x)-o.hw),Math.max(0,Math.abs(z-o.z)-o.hd))<r)return true;
    }
    return false;
  }
  function meshBuilder(){
    const p=[],ix=[],colors=[];
    return {
      v(x,y,z,col){const i=p.length/3;p.push(x,y,z);colors.push(...col);return i;},
      face(a,b,c){ix.push(a,b,c);},
      emit(){return ix.length?G.mesh(solids,p,ix,'#ffffff',colors):null;}
    };
  }
  function landscape(){
    const m=meshBuilder(), count=100, rings=[40,55,64,82,108,138,190,270];
    const grid=[], coords=[], cols=[color(119,132,85),color(105,126,87),color(105,129,91),color(107,135,108),color(104,132,122),color(116,145,141),color(136,157,158),color(155,172,171)];
    for(let j=0;j<rings.length;j++){
      const ring=[], points=[];
      for(let i=0;i<count;i++){
        const a=i/count*Math.PI*2, co=Math.cos(a),si=Math.sin(a);
        const edgeDist=Math.min((co>0?80:48)/(Math.abs(co)+.00001),40/(Math.abs(si)+.00001));
        const rad=j===0?edgeDist*.992:edgeDist+rings[j]-40;
        const x=rad*co,z=rad*si,base=ground(edgeDist*.992*co,edgeDist*.992*si);
        const hills=fbm(x*.035+j*4,z*.035+j*2), fac=Math.sin(a*3.0+j*.64)*.5+.5;
        const relief=[0,4.4,1.7,12,18,15,28,12][j];
        const y=j===0?base-.12:mix(base,3,Math.min(1,j*.33))+relief*(.24+hills*1.09)+fac*[0,1.3,.8,4.5,9,5,14,6][j];
        ring.push(m.v(x,y,z,cols[j].map(v=>v*(.89+hills*.20))));points.push([x,y,z]);
      }
      grid.push(ring);coords.push(points);
    }
    for(let j=1;j<rings.length;j++)for(let i=0;i<count;i++){
      const k=(i+1)%count;
      m.face(grid[j-1][i],grid[j-1][k],grid[j][i]);
      m.face(grid[j-1][k],grid[j][k],grid[j][i]);
      if(j>0&&j<5&&hash(i*.25,j*3.7)>.61){
        // Distant groves use a single canopy silhouette and share the ridge mesh.
        const a=coords[j-1][i],b=coords[j-1][k],c=coords[j][i];
        for(let q=0;q<3;q++){
          let u=hash(i+q*4.4,j*8.1),v=hash(i*6.2,j+q*2.8);if(u+v>1){u=1-u;v=1-v;}
          const xyz=a.map((val,axis)=>val+(b[axis]-val)*u+(c[axis]-val)*v);
          const [x,y,z]=xyz,h=2.3+hash(i*3.72+q,j*5.7)*3.9,r=h*.28;
          const col=blend(color(72,104,75),color(92,120,89),hash(i,j+q));
          const bark=color(96,91,72), foot=[], stem=[], lower=[], upper=[];
          const tip=m.v(x+.16*r,y+h,z-.09*r,col.map(t=>t*1.08));
          for(let k=0;k<5;k++){
            const aa=k*2*Math.PI/5+u, cx=Math.cos(aa), cz=Math.sin(aa);
            foot.push(m.v(x+cx*r*.10,y-.32,z+cz*r*.10,bark));
            stem.push(m.v(x+cx*r*.08,y+h*.50,z+cz*r*.08,bark));
            lower.push(m.v(x+cx*r*(.86+.13*v),y+h*(.36+.05*cx),z+cz*r,col.map(t=>t*.84)));
            upper.push(m.v(x+cx*r*.80,y+h*(.72+.045*cz),z+cz*r*.83,col));
          }
          for(let k=0;k<5;k++){
            const n=(k+1)%5;
            m.face(foot[k],stem[k],foot[n]);m.face(foot[n],stem[k],stem[n]);
            m.face(stem[k],lower[k],lower[n]);
            m.face(lower[k],upper[k],lower[n]);m.face(lower[n],upper[k],upper[n]);
            m.face(tip,upper[n],upper[k]);
          }
        }
      }
    }
    m.emit();
  }
  // Irregular faceted crowns are built once along with the trees, sparse grass and boulders.
  function form(m,x,y,z,rx,ry,rz,col,amp=0.19,segments=8,seed=rand()*700){
    const layers=[];
    for(let j=0;j<3;j++){
      const level=[-.64,.04,.64][j],width=[.63,1,.73][j], row=[];
      for(let k=0;k<segments;k++){
        const a=(k+(j%2)*.3)*2*Math.PI/segments;
        const rand1=hash(k+j*13,seed);
        const r=width*(1+amp*(rand1-.5)*2);
        const factor=1+(.52-level)*-.10+(hash(k*3.2+j,seed+7)-.5)*.115;
        row.push(m.v(x+Math.cos(a)*rx*r,y+(level+(hash(k+j*9,seed+3)-.5)*amp)*ry,z+Math.sin(a)*rz*r,col.map(v=>v*factor)));
      }
      layers.push(row);
    }
    const b=m.v(x,y-ry,z,col.map(v=>v*.82)),t=m.v(x+rx*.03,y+ry,z,col.map(v=>v*1.07));
    for(let k=0;k<segments;k++){
      const q=(k+1)%segments;
      m.face(b,layers[0][k],layers[0][q]);m.face(t,layers[2][q],layers[2][k]);
      for(let j=1;j<3;j++){
        m.face(layers[j-1][k],layers[j][k],layers[j-1][q]);
        m.face(layers[j-1][q],layers[j][k],layers[j][q]);
      }
    }
  }
  function forest(){
    const forms=meshBuilder(), colors=[color(66,97,62),color(83,113,69),color(100,127,81),color(91,115,75)];
    const forestPoints=[];
    for(let i=0;i<680&&forestPoints.length<94;i++){
      const x=between(-46,46),z=between(-39,39);
      if(x>9&&Math.abs(z+16)<5)continue;
      if((Math.abs(x)<36.5&&z>-32&&z<31.5)||roadDistance(x,z)<8.5)continue;
      if(forestPoints.some(a=>Math.hypot(x-a[0],z-a[1])<2.4))continue;
      if(z<-22&&x>-30&&x<8&&z>-31)continue;
      forestPoints.push([x,z]);
    }
    for(const [x,z] of forestPoints){
      const y=height(x,z),h=between(4.5,9.4),scale=between(.81,1.13);
      const r=h*.032,accent=colors[Math.floor(rand()*colors.length)];
      const leanX=between(-.32,.32),leanZ=between(-.32,.32),cx=x+leanX,cz=z+leanZ;
      const top=[cx,y+h*.72,cz];
      G.rod(solids,[x,y-.07,z],top,r,'#786955',6);
      if(rand()<.29){
        // Layered silhouettes of araucarias, with a lifted canopy on a straight trunk.
        for(let j=0;j<3;j++){
          const a=rand()*6.283,cx2=cx+Math.cos(a)*h*.14,cz2=cz+Math.sin(a)*h*.14;
          G.rod(solids,[cx,y+h*(.50+j*.065),cz],[cx2,y+h*(.66+j*.065),cz2],r*.49,'#72624d',5);
          form(forms,cx2,y+h*(.70+j*.065),cz2,h*.21*scale,h*.075,h*.20*scale,accent,.28,7);
        }
        form(forms,cx,y+h*.94,cz,h*.15,h*.07,h*.16,accent,.2,8);
      }else{
        for(let j=0;j<3;j++){
          const a=(j+rand()*.56)*2.094,extra=j===0?.045:.17;
          const bx=cx+Math.cos(a)*h*extra,bz=cz+Math.sin(a)*h*extra;
          const by=y+h*(j===0?.84:between(.57,.75));
          if(j>0) G.rod(solids,[x,y+h*.37,z],[bx,by,bz],r*.55,'#82725b',5);
          form(forms,bx,by,bz,h*between(.16,.22)*scale,h*between(.18,.26),h*between(.16,.22)*scale,accent,.30,7);
        }
      }
      circularObstacle(x,z,r*1.05);
    }
    for(let i=0;i<122;i++){
      const x=between(-46,46),z=between(-39,39),sd=shelfDepth(x,z);
      if(x>9&&Math.abs(z+16)<5)continue;
      if(Math.abs(x)<32&&z>-27&&z<28)continue;
      if(roadDistance(x,z)<7)continue;
      const y=height(x,z),r=between(.28,1.16);
      if(i%3===0){
        form(forms,x,y+r*.12,z,r,r*.62,r*.76,blend(color(143,127,110),color(170,147,121),rand()),.37,6);
        if(r>.66)circularObstacle(x,z,r*.62);
      }else{
        form(forms,x,y+r*.33,z,r,r*between(.53,1.0),r*.78,blend(color(101,117,75),color(130,141,89),rand()),.36,6);
      }
    }
    for(let i=0;i<1700;i++){
      const x=between(-45,45),z=between(-37,37),d=shelfDepth(x,z);
      const swath=Math.max(Math.abs(x)*.89,z);
      if((swath<24&&d<2.5)||roadDistance(x,z)<3.4)continue;
      if(d>0&&d<2.6||d>5.4&&d<8.4)continue;
      const y=height(x,z)-.03, h=between(.15,.48);
      const c=blend(color(127,131,76),color(153,148,92),rand());
      for(let k=0;k<3;k++){
        const a=rand()*Math.PI*2,dx=Math.cos(a)*.11,dz=Math.sin(a)*.11;
        const u=forms.v(x-dx,y,z-dz,c),v=forms.v(x+dx,y,z+dz,c),w=forms.v(x+dz*1.9,y+h*between(.69,1.0),z-dx*1.9,c.map(q=>q*1.13));forms.face(u,v,w);forms.face(v,u,w);
      }
    }
    forms.emit();
  }
  const glyphs={
    A:['010','101','111','101','101'],B:['110','101','110','101','110'],C:['111','100','100','100','111'],D:['110','101','101','101','110'],
    E:['111','100','110','100','111'],F:['111','100','110','100','100'],G:['111','100','101','101','111'],I:['111','010','010','010','111'],
    L:['100','100','100','100','111'],N:['1001','1101','1011','1001','1001'],O:['111','101','101','101','111'],P:['110','101','110','100','100'],
    R:['110','101','110','101','101'],S:['111','100','111','001','111'],T:['111','010','010','010','010'],U:['101','101','101','101','111'],
    V:['101','101','101','101','010'],'-':['0','0','1','0','0'],' ':['0','0','0','0','0']
  };
  function lettering(p,text,x,y,z,size,c){
    const letters=[...text].map(k=>glyphs[k]||glyphs[' ']);
    const width=letters.reduce((a,f)=>a+f[0].length+1,-1)*size;
    let cursor=x-width/2;
    const pos=[],ix=[];
    for(const glyph of letters){
      for(let row=0;row<5;row++)for(let bit=0;bit<glyph[row].length;bit++)if(glyph[row][bit]==='1'){
        const a=pos.length/3,l=cursor+bit*size,h=y+(2.5-row)*size;
        pos.push(l,h,z,l,h-size,z,l+size,h-size,z,l+size,h,z);
        ix.push(a,a+1,a+2,a,a+2,a+3);
      }
      cursor+=(glyph[0].length+1)*size;
    }
    G.mesh(p,pos,ix,c);
  }
  function sign(x,z,label,angle=0,width=4.2,high=1){
    const p=G.group(solids); p.p=[x,height(x,z),z];p.r[1]=angle;
    for(const side of [-1,1]) box(p,side*width*.34,.87,0,.086,1.76,.095,'#777768');
    box(p,0,1.52+high*.13,0,width,high,.15,'#303a34');
    box(p,0,1.53+high*.13-high*.44,.09,width,.065,.04,'#e8ab45');
    lettering(p,label,0,1.56+high*.13,.081,Math.min(width/(label.length*4+.4),high*.119),'#f0deaf');
    rectObstacle(x,z,width*.65,.2);
  }
  function cone(x,z,h=.64){
    const y=height(x,z);
    box(solids,x,y+.045,z,h*.52,.09,h*.52,'#454846');
    G.cyl(solids,[x,y+h*.50,z],h*.055,h*.235,h*.92,'#d96b2f',8);
    G.cyl(solids,[x,y+h*.57,z],h*.116,h*.153,h*.17,'#ebe4c7',8);
  }
  function stake(x,z,h=1.0){
    const y=height(x,z);
    box(solids,x,y+h*.5,z,.075,h,.075,'#a78964');
    box(solids,x,y+h*.92,z,.084,h*.19,.084,'#f28542');
    const head=G.group(solids);head.p=[x,y+h*.92,z];
    G.mesh(head,[0,0,0,.47,-.07,.048,0,-.14,0],[0,2,1,1,2,0],'#ec7539');
  }
  function facilities(){
    // Workshops sit outside the haul lane. The sloping metal roof has an open equipment bay.
    const x=-16.3,z=-22.5,y=height(x,z),shed=G.group(solids);
    shed.p=[x,y,z];
    const steel='#516265',iron='#3b4b4c',panel='#738381',edging='#a3a89a',roof='#858f8b';
    box(shed,0,.08,0,13.6,.22,6.7,'#9d927c');
    box(shed,0,1.66,-2.96,13,3.26,.11,panel);
    box(shed,-6.35,1.66,0,.12,3.26,6.0,panel);
    box(shed,6.35,1.66,0,.12,3.26,6.0,panel);
    for(let i=0;i<=26;i++)
      box(shed,-6.35+i*.49,1.65,-2.86,.05,3.2,.08,steel);
    for(const cx of [-6.24,.1,6.24])for(const cz of [-2.8,2.9]){
      box(shed,cx,1.72,cz,.16,3.45,.16,iron);
      if(cz>0){box(shed,cx,.56,cz,.27,1.05,.25,'#dba648');box(shed,cx,.73,cz,.28,.15,.27,'#303b38');}
    }
    for(const side of [-1,1]){
      const pad=box(shed,0,3.66,side*1.60,13.78,.15,3.36,roof);pad.r[0]=side*.135;
      for(let i=0;i<26;i++){const rib=box(shed,-6.6+i*.53,3.757,side*1.60,.055,.038,3.36,edging);rib.r[0]=side*.135;}
    }
    for(const xx of [-6.37,.1,6.36]){
      G.beam(shed,[xx,3.38,3.14],[xx,3.83,0],.13,.12,iron);
      G.beam(shed,[xx,3.83,0],[xx,3.38,-3.14],.13,.12,iron);
    }
    box(shed,-3.1,1.35,2.97,5.8,2.48,.09,'#8d9893');
    for(let i=0;i<10;i++)box(shed,-3.1,.25+i*.24,3.026,5.73,.035,.045,steel);
    box(shed,0,3.24,3.09,12.88,.43,.18,iron);
    box(shed,0,3.02,3.191,12.87,.061,.05,'#dfaa51');
    lettering(shed,'OFICINA',-3,3.25,3.194,.060,'#f3e8cc');
    for(const wheel of [1.55,2.7]){
      const t=G.cyl(shed,[wheel,.56,1.12],.52,.52,.45,'#383c36',12);t.r[0]=Math.PI/2;
      const hub=G.cyl(shed,[wheel,.56,1.355],.235,.235,.029,'#8b8a6f',10);hub.r[0]=Math.PI/2;
    }
    box(shed,3.89,.64,-1.44,3.1,.15,.76,'#a48c68');
    for(const xx of [2.6,5.2])box(shed,xx,.36,-1.44,.125,.64,.51,iron);
    rectObstacle(x,z,13.4,6.25);
    // Portable office with glazing, a door and a stepped entry.
    const ox=-31,oz=-6.5,office=G.group(solids);office.p=[ox,height(ox,oz),oz];office.r[1]=.20;
    box(office,0,.19,0,8.37,.34,3.05,'#4b5550');
    box(office,0,1.52,0,8.22,2.49,2.86,'#c5c5ab');
    box(office,0,2.82,0,8.55,.15,3.17,'#616b66');
    box(office,0,.57,1.446,8.2,.22,.05,'#637a72');
    for(let i=0;i<=17;i++)box(office,-3.98+i*.466,1.56,-1.45,.036,2.32,.035,'#9caa96');
    for(const off of [-2.55,-.32]){
      box(office,off,1.68,1.45,1.48,.94,.1,iron);box(office,off,1.68,1.51,1.31,.77,.05,'#67817d');
      box(office,off,1.68,1.55,.057,.8,.043,edging);
    }
    box(office,2.51,1.39,1.46,1.06,2.1,.115,steel);
    box(office,2.51,1.64,1.531,.75,.86,.04,'#7f9790');
    box(office,2.8,1.16,1.58,.11,.04,.06,'#c6c9a8');
    box(office,2.51,.13,1.89,1.44,.24,.78,'#968b77');
    rectObstacle(ox,oz,8.7,3.9);
    // Aggregate bays at the far corner and stacked drainage culverts near the shop.
    for(let i=0;i<2;i++){
      const bx=28+i*5.0,bz=-24.1,by=height(bx,bz);
      box(solids,bx,by+.71,bz-2.4,5.34,1.44,.3,'#98917e');
      box(solids,bx-2.5,by+.71,bz,.28,1.42,5,'#a69a82');
      if(i===1)box(solids,bx+2.5,by+.71,bz,.28,1.42,5,'#988d79');
      G.sphere(solids,[bx,by+.18,bz-.56],[2.3,1.07,1.93],i?'#a39580':'#9b7960',8);
      rectObstacle(bx,bz-.4,5.1,4.8);
    }
    for(let i=0;i<5;i++){
      const xx=-27.5+(i%3)*1.1,zz=-18.8,yy=height(xx,zz)+.52+(i>2?.89:0),outer=.55,inner=.405,len=2.92,count=12;
      const pos=[],ind=[];
      for(let q=0;q<4;q++)for(let t=0;t<count;t++){
        const a=t*2*Math.PI/count,rr=q<2?outer:inner;
        pos.push(xx+Math.cos(a)*rr,yy+Math.sin(a)*rr,zz+(q%2?len/2:-len/2));
      }
      for(let t=0;t<count;t++){
        const f=(t+1)%count;
        ind.push(t,f,t+count,f,f+count,t+count, t+2*count,t+3*count,f+2*count, f+2*count,t+3*count,f+3*count);
        ind.push(t+count,f+count,t+3*count, t+3*count,f+count,f+3*count, t,t+2*count,f, f,t+2*count,f+2*count);
      }
      G.mesh(solids,pos,ind,'#a8a18d');
    }
    rectObstacle(-26.2,-18.8,3.5,3);
    sign(-25.6,-11.8,'SERRA ALTA',.58,5.9,1.15);
    sign(70,-8,'DESCARGA',Math.PI,4,.9);
    sign(6,-10.5,'OBRA',Math.PI,3,.9);
    sign(-19,-14,'DEPOSITO',.35,3.8,.9);
    for(let x=14;x<=65;x+=5){stake(x,-18.55,.72);stake(x,-13.45,.72);}
    for(const [x,z,w,d,h,tint] of [
      [53,-5,6,5,3.4,'#c18567'],[63,-3,6,6,3.8,'#cdb28c'],
      [73,-2,5,6,3,'#839c8d'],[54,7,6,5,4,'#b7ae93'],
      [65,8,7,6,3.7,'#c29a82'],[74,-24,5,6,3.2,'#adb5a1']]){
      const house=G.group(solids);house.p=[x,height(x,z),z];
      box(house,0,h/2-.18,0,w,h+.36,d,tint);
      for(const side of [-1,1]){
        const roof=box(house,0,h+.38,side*d*.26,w+.54,.21,d*.57,'#965d43');
        roof.r[0]=side*.28;
        box(house,side*w*.31,h*.57,-d/2-.035,w*.22,1.03,.09,'#546f71');
        box(house,side*w*.31,h*.57,-d/2-.09,.055,1.03,.04,'#dac9ac');
      }
      box(house,0,1,-d/2-.04,.94,2,.08,'#695c48');
      rectObstacle(x,z,w,d);
    }
    sign(54,-10,'VILA SERRA',-Math.PI/2,4,.82);
    for(const x of [-18,-16])G.cyl(solids,[x,height(x,-18)+.75,-18],.58,.58,1.5,'#8e9d8c',12);
    for(const [dx,dz] of [[-1,-1],[-1,1],[1,-1],[1,1]]){
      stake(zones.dump.x+dx*5.6,zones.dump.z+dz*5.6,.82);
      stake(zones.grade.x+dx*6.45,zones.grade.z+dz*6.45,.64);
    }
    cone(-9,-17.7);cone(-11,-17.9);cone(-13.2,-18.2);
    for(let i=0;i<4;i++)cone(35.5+i*.17,-12+i*2.3,.82);
    // Boundary fence and utility poles read clearly from across the pit.
    for(let i=0;i<13;i++){
      const xx=-32+i*5.2, zz=-31.1, yy=height(xx,zz);box(solids,xx,yy+.78,zz,.13,1.58,.13,'#85765b');
      if(i<12){
        const h2=height(xx+5.2,zz);
        for(const lift of [.59,1.13])G.rod(solids,[xx,yy+lift,zz],[xx+5.2,h2+lift,zz],.019,'#7a7e69',4);
      }
    }
    const poles=[[-39,-13],[-37,-28],[-22,-32],[0,-32],[23,-32]];
    for(let i=0;i<poles.length;i++){
      const [px,pz]=poles[i],y=height(px,pz);
      G.cyl(solids,[px,y+3.53,pz],.105,.17,7.1,'#87735a',8);
      box(solids,px,y+6.65,pz,1.72,.123,.13,'#756d56');
      for(const s of [-.65,.65]){
        G.cyl(solids,[px+s,y+6.82,pz],.089,.084,.22,'#a0b0a1',6);
        if(i>0){
          const [xx,zz]=poles[i-1],yyy=height(xx,zz),mid=[(xx+px)/2+s,(yyy+y)/2+6.39,(zz+pz)/2];
          G.rod(solids,[xx+s,yyy+6.9,zz],mid,.016,'#565e50',4);G.rod(solids,mid,[px+s,y+6.90,pz],.016,'#565e50',4);
        }
      }
      circularObstacle(px,pz,.19);
    }
  }
  function snapshot(){
    // [sample index, millimetres from original] pairs retain soil edits compactly.
    const changes=[];for(let i=0;i<n;i++){const mm=Math.round((heights[i]-original[i])*1000);if(mm)changes.push(i,mm);}
    return changes;
  }
  function restore(saved){
    if(!Array.isArray(saved)||saved.length%2||saved.length>n*2)return false;
    for(let p=0;p<saved.length;p+=2)if(!Number.isInteger(saved[p])||saved[p]<0||saved[p]>=n||!Number.isFinite(saved[p+1]))return false;
    for(let i=0;i<n;i++)if(heights[i]!==original[i]){heights[i]=original[i];flag(i%(W+1),Math.floor(i/(W+1)));}
    for(let p=0;p<saved.length;p+=2){
      const i=saved[p];heights[i]=original[i]+clamp(saved[p+1]/1000,-3,7);flag(i%(W+1),Math.floor(i/(W+1)));
    }
    flush();return true;
  }
  function create(root){
    noiseSeed=38194;tiles.length=0;obstacles.length=0;dirty.clear();parent=G.group(root);solids=G.group(parent);
    for(let iz=0;iz<=D;iz++)for(let ix=0;ix<=W;ix++){
      const x=X0+ix*STEP,z=Z0+iz*STEP,i=ix+iz*(W+1);
      heights[i]=original[i]=ground(x,z);baseColors.set(terrainColor(x,z),i*3);
    }
    for(let z=0;z<D/TILE;z++)for(let x=0;x<W/TILE;x++)groundTile(x,z);
    landscape();details();facilities();forest();G.freeze(solids);return parent;
  }
  return {create,height,dig:(x,z,r,v)=>moveSoil(x,z,r,v,-1),deposit:(x,z,r,v)=>moveSoil(x,z,r,v,1),grade,collides,flush,zones,bounds,snapshot,restore};
})();

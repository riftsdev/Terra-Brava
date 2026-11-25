/* Terra Brava · small, dependency-free WebGL scene renderer. World units are metres. */
(function (scope) {
  "use strict";
  const identity = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  const white = [1,1,1];
  const colorCache = new Map();
  function rgb(value) {
    if (Array.isArray(value) || ArrayBuffer.isView(value)) return value;
    if (value == null) return white;
    if (colorCache.has(value)) return colorCache.get(value);
    let n;
    if (typeof value === "number") n = value;
    else {
      let hex = value.replace("#", "");
      if (hex.length === 3) hex = hex.split("").map(c => c+c).join("");
      n = parseInt(hex,16);
    }
    const c = Number.isFinite(n) ? [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255] : white;
    colorCache.set(value,c);
    return c;
  }
  function multiply(out,a,b) {
    for (let j=0; j<16; j+=4) {
      const x=b[j], y=b[j+1], z=b[j+2], w=b[j+3];
      out[j]   = a[0]*x+a[4]*y+a[8]*z+a[12]*w;
      out[j+1] = a[1]*x+a[5]*y+a[9]*z+a[13]*w;
      out[j+2] = a[2]*x+a[6]*y+a[10]*z+a[14]*w;
      out[j+3] = a[3]*x+a[7]*y+a[11]*z+a[15]*w;
    }
    return out;
  }
  function compose(o,p,r,s) {
    const a=Math.cos(r[0]), b=Math.sin(r[0]), c=Math.cos(r[1]), d=Math.sin(r[1]), e=Math.cos(r[2]), f=Math.sin(r[2]);
    o[0]=(c*e+d*b*f)*s[0]; o[1]=a*f*s[0]; o[2]=(-d*e+c*b*f)*s[0];
    o[4]=(-c*f+d*b*e)*s[1]; o[5]=a*e*s[1]; o[6]=(d*f+c*b*e)*s[1];
    o[8]=d*a*s[2]; o[9]=-b*s[2]; o[10]=c*a*s[2];
    o[12]=p[0]; o[13]=p[1]; o[14]=p[2]; return o;
  }
  function group(parent=null) {
    const node={parent, children:[], p:[0,0,0],r:[0,0,0],s:[1,1,1],visible:true,
      _local:identity(),_world:identity(),_shape:identity(),_stamp:new Float64Array(9).fill(NaN),
      _v:0,_parentV:-1,_intr:[1,1,1],_geom:null,_tint:white,_frozen:false};
    if(parent)parent.children.push(node);
    return node;
  }
  function updateWorld(n) {
    const p=n.p, r=n.r, s=n.s, a=n._stamp, pv=n.parent?n.parent._v:0;
    const dirty=a[0]!==p[0]||a[1]!==p[1]||a[2]!==p[2]||a[3]!==r[0]||a[4]!==r[1]||a[5]!==r[2]||a[6]!==s[0]||a[7]!==s[1]||a[8]!==s[2];
    if(!dirty && pv===n._parentV)return;
    if(dirty){
      compose(n._local,p,r,s);
      for(let i=0;i<3;i++){a[i]=p[i];a[3+i]=r[i];a[6+i]=s[i];}
    }
    if(n.parent)multiply(n._world,n.parent._world,n._local);else n._world.set(n._local);
    n._parentV=pv; n._v++;
  }
  function worldPoint(n,p=[0,0,0]) {
    function setup(k){if(k.parent)setup(k.parent);updateWorld(k);}
    setup(n);
    const m=n._world,x=p[0],y=p[1],z=p[2];
    return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];
  }
  function withScale(out,m,s) {
    for(let i=0;i<12;i++)out[i]=m[i]*s[(i/4)|0];
    out[12]=m[12];out[13]=m[13];out[14]=m[14];out[15]=1;
    return out;
  }
  function geom(data) {
    return {vertices:data instanceof Float32Array?data:new Float32Array(data), revision:1, gpu:null};
  }
  function meshGeometry(positions,indices,colors) {
    const length=indices?indices.length:(positions.length/3)|0, dst=new Float32Array(Math.floor(length/3)*27);
    for(let i=0,o=0;i+2<length;i+=3){
      const a=(indices?indices[i]:i)*3,b=(indices?indices[i+1]:i+1)*3,c=(indices?indices[i+2]:i+2)*3;
      const abx=positions[b]-positions[a],aby=positions[b+1]-positions[a+1],abz=positions[b+2]-positions[a+2];
      const acx=positions[c]-positions[a],acy=positions[c+1]-positions[a+1],acz=positions[c+2]-positions[a+2];
      let nx=aby*acz-abz*acy, ny=abz*acx-abx*acz, nz=abx*acy-aby*acx;
      const inv=1/(Math.hypot(nx,ny,nz)||1); nx*=inv;ny*=inv;nz*=inv;
      for(let j=0;j<3;j++){
        const k=j===0?a:j===1?b:c;
        dst[o++]=positions[k];dst[o++]=positions[k+1];dst[o++]=positions[k+2];
        dst[o++]=nx;dst[o++]=ny;dst[o++]=nz;
        dst[o++]=colors?colors[k]:1;dst[o++]=colors?colors[k+1]:1;dst[o++]=colors?colors[k+2]:1;
      }
    }
    return dst;
  }
  function shape(parent,p,dimensions,geometry,color) {
    const n=group(parent);n.p=p.slice();n._intr=dimensions.slice();n._geom=geometry;n._tint=rgb(color);return n;
  }
  let cube;
  function box(parent,p,dimensions,color) {
    if(!cube){
      const v=[-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5];
      const i=[0,2,1,0,3,2,4,5,6,4,6,7,0,4,7,0,7,3,1,2,6,1,6,5,3,7,6,3,6,2,0,1,5,0,5,4];
      cube=geom(meshGeometry(v,i));
    }
    return shape(parent,p,dimensions,cube,color);
  }
  const tubes=new Map(),balls=new Map();const TAU=2*Math.PI;
  function cyl(parent,p,rt,rb,h,color,segments=12) {
    segments=Math.max(3,segments|0);
    const scale=Math.max(rt,rb,1e-7),top=rt/scale,bot=rb/scale;
    const key=segments+"/"+top.toFixed(4)+"/"+bot.toFixed(4);
    if(!tubes.has(key)){
      const data=[], slope=bot-top, q=1/Math.hypot(1,slope);
      const emit=(x,y,z,nx,ny,nz)=>data.push(x,y,z,nx,ny,nz,1,1,1);
      for(let j=0;j<segments;j++){
        const a=TAU*j/segments,b=TAU*(j+1)/segments, x=Math.cos(a),z=Math.sin(a),X=Math.cos(b),Z=Math.sin(b);
        const side=(high,second)=>{
          const k=high?top:bot,xx=second?X:x,zz=second?Z:z;emit(xx*k,high?.5:-.5,zz*k,xx*q,slope*q,zz*q);
        };
        side(false,false);side(true,false);side(true,true);
        side(false,false);side(true,true);side(false,true);
        if(top>0){emit(0,.5,0,0,1,0);emit(X*top,.5,Z*top,0,1,0);emit(x*top,.5,z*top,0,1,0);}
        if(bot>0){emit(0,-.5,0,0,-1,0);emit(x*bot,-.5,z*bot,0,-1,0);emit(X*bot,-.5,Z*bot,0,-1,0);}
      }
      tubes.set(key,geom(data));
    }
    return shape(parent,p,[scale,h,scale],tubes.get(key),color);
  }
  function sphere(parent,p,radii,color,segments=12){
    segments=Math.max(4,segments|0);
    if(!balls.has(segments)){
      const data=[],rings=Math.max(3,Math.floor(segments/2));
      function emit(j,k){
        const a=j*TAU/segments,b=k*Math.PI/rings-Math.PI/2,x=Math.cos(a)*Math.cos(b),y=Math.sin(b),z=Math.sin(a)*Math.cos(b);
        data.push(x,y,z,x,y,z,1,1,1);
      }
      for(let k=0;k<rings;k++)for(let j=0;j<segments;j++){
        if(k>0){emit(j,k);emit(j,k+1);emit(j+1,k);}
        if(k<rings-1){emit(j+1,k);emit(j,k+1);emit(j+1,k+1);}
      }
      balls.set(segments,geom(data));
    }
    return shape(parent,p,radii,balls.get(segments),color);
  }
  function mesh(parent,positions,indices,color,colors){
    return shape(parent,[0,0,0],[1,1,1],geom(meshGeometry(positions,indices,colors)),colors?white:color);
  }
  function updateMesh(n,positions,indices,color,colors){
    n._geom.vertices=meshGeometry(positions,indices,colors);n._geom.revision++;n._tint=colors?white:rgb(color);
    return n;
  }
  function align(node,a,b){
    const x=b[0]-a[0],y=b[1]-a[1],z=b[2]-a[2],d=Math.hypot(x,y,z);
    for(let i=0;i<3;i++)node.p[i]=(a[i]+b[i])*.5;
    node._intr[1]=Math.max(.00001,d);
    node.r[0]=d?Math.acos(Math.min(1,Math.max(-1,y/d))):0;
    node.r[1]=Math.atan2(x,z);node.r[2]=0;return node;
  }
  function beam(parent,a,b,w,d,color){return align(box(parent,[0,0,0],[w,1,d],color),a,b);}
  function rod(parent,a,b,r,color,segments=8){return align(cyl(parent,[0,0,0],r,r,1,color,segments),a,b);}
  /* Bake relative to this group, preserving its pivots and original hierarchy for socket queries. */
  function freeze(root){
    if(root._frozen)return root;
    const chunks=[];let size=0;
    function append(n,m){
      if(!n.visible)return;
      if(n._geom){const data=n._geom.vertices;chunks.push([data,withScale(identity(),m,n._intr),n._tint]);size+=data.length;}
      if(!n._frozen)for(const child of n.children){const local=compose(identity(),child.p,child.r,child.s);append(child,multiply(identity(),m,local));}
    }
    append(root,identity());
    if(!size)return root;
    const dst=new Float32Array(size);let j=0;
    for(const [data,m,c] of chunks){
      // Cofactors implement the inverse transpose for any nonsingular 3x3 transform.
      const ax=m[0],ay=m[1],az=m[2],bx=m[4],by=m[5],bz=m[6],cx=m[8],cy=m[9],cz=m[10];
      const nx0=by*cz-bz*cy,ny0=bz*cx-bx*cz,nz0=bx*cy-by*cx;
      const nx1=cy*az-cz*ay,ny1=cz*ax-cx*az,nz1=cx*ay-cy*ax;
      const nx2=ay*bz-az*by,ny2=az*bx-ax*bz,nz2=ax*by-ay*bx;
      const sign=(ax*nx0+ay*ny0+az*nz0)<0?-1:1;
      for(let i=0;i<data.length;i+=9){
        const x=data[i],y=data[i+1],z=data[i+2],u=data[i+3],v=data[i+4],w=data[i+5];
        dst[j++]=ax*x+bx*y+cx*z+m[12]; dst[j++]=ay*x+by*y+cy*z+m[13]; dst[j++]=az*x+bz*y+cz*z+m[14];
        const dx=nx0*u+nx1*v+nx2*w,dy=ny0*u+ny1*v+ny2*w,dz=nz0*u+nz1*v+nz2*w;
        const inv=sign/(Math.hypot(dx,dy,dz)||1);dst[j++]=dx*inv;dst[j++]=dy*inv;dst[j++]=dz*inv;
        dst[j++]=data[i+6]*c[0];dst[j++]=data[i+7]*c[1];dst[j++]=data[i+8]*c[2];
      }
    }
    root._geom=geom(dst);root._intr=[1,1,1];root._tint=white;root._frozen=true;
    return root;
  }
  const sun=[-.54,.742,.397];
  const objectVertex=`
    attribute vec3 aPosition,aNormal,aColor,aTint;
    attribute mat4 aModel;
    uniform mat4 uVP,uSunVP;
    varying highp vec3 vWorld,vShadow;
    varying mediump vec3 vNorm,vColor;
    void main(){
      vec4 w=aModel*vec4(aPosition,1.);
      vec3 x=aModel[0].xyz,y=aModel[1].xyz,z=aModel[2].xyz;
      vec3 co0=cross(y,z),co1=cross(z,x),co2=cross(x,y);
      vec3 n=co0*aNormal.x+co1*aNormal.y+co2*aNormal.z;
      vNorm=normalize(n)*(dot(x,co0)<0.?-1.:1.);
      vWorld=w.xyz; vColor=aColor*aTint;
      vShadow=(uSunVP*w).xyz*.5+.5;
      gl_Position=uVP*w;
    }`;
  const fragment=`
    precision highp float;
    varying highp vec3 vWorld,vShadow;
    varying mediump vec3 vNorm,vColor;
    uniform highp vec3 uEye;
    uniform sampler2D uShadows,uNoise,uClay;
    uniform float uSoil;
    uniform float uShadow,uTexel;
    const vec3 sun=vec3(-.54,.742,.397);
    float visibility(vec2 uv,float depth){
      vec2 d=texture2D(uShadows,uv).rg;
      return step(depth,d.r+d.g/255.);
    }
    void main(){
      vec3 n=normalize(vNorm),v=normalize(uEye-vWorld);
      float nl=max(0.,dot(n,sun)), shadow=1.;
      vec3 s=vShadow;
      if(uShadow>.5 && nl>.001 && all(greaterThan(s,vec3(.002))) && all(lessThan(s,vec3(.998)))){
        float bias=.00024+.00125*(1.-nl),d=s.z-bias;
        vec2 grid=s.xy/uTexel-.5,base=(floor(grid)+.5)*uTexel,fr=fract(grid);
        float t=uTexel;
        shadow=mix(mix(visibility(base,d),visibility(base+vec2(t,0.),d),fr.x),
                   mix(visibility(base+vec2(0.,t),d),visibility(base+vec2(t,t),d),fr.x),fr.y);
        float edge=min(min(s.x,1.-s.x),min(s.y,1.-s.y));
        shadow=mix(1.,shadow,smoothstep(.0,.05,edge));
      }
      float dist=length(vWorld-uEye),hemi=.5+.5*n.y;
      vec3 base=vColor;
      // Broad patches and fine gravel on unpainted soil and vegetation.
      float earth=step(.035,base.r-base.b)*step(base.b,base.g)*step(base.r,.78)*step(.22,base.g/max(base.r,.02))*step(base.g*.50,base.b);
      float grain=texture2D(uNoise,vWorld.xz*.005+vWorld.y*.001).r-.5;
      float grit=texture2D(uNoise,vWorld.xz*.11+vWorld.y*.023).g-.5;
      base*=1.+earth*(grain*.14+grit*.12*(1.-smoothstep(6.,55.,dist)));
      if(uSoil>.5)base*=1.+(texture2D(uClay,vWorld.xz*.33).r-.5)*.55;
      vec3 ambient=mix(vec3(.51,.48,.46),vec3(.76,.80,.83),hemi);
      vec3 lit=base*(ambient+vec3(.39,.345,.278)*nl*shadow);
      vec3 halfway=normalize(sun+v);
      float spec=pow(max(0.,dot(n,halfway)),32.)*.048*(1.-earth*.78)*nl*shadow;
      lit+=spec*vec3(1.,.90,.74);
      float fog=1.-exp(-max(0.,dist-18.)*.004);
      float toward=pow(max(0.,dot(-v,sun)),3.);
      vec3 haze=mix(vec3(.78,.82,.80),vec3(.93,.84,.69),toward);
      gl_FragColor=vec4(mix(lit,haze,min(.87,fog)),1.);
    }`;
  const depthVert=`
    attribute vec3 aPosition;attribute mat4 aModel;uniform mat4 uVP;
    void main(){gl_Position=uVP*aModel*vec4(aPosition,1.);}
  `;
  const depthFrag=`
    precision highp float;
    void main(){float d=gl_FragCoord.z*255.;gl_FragColor=vec4(floor(d)/255.,fract(d),0.,1.);}
  `;
  const skyVert=`
    attribute vec2 aPosition;varying vec2 uv;
    void main(){uv=aPosition;gl_Position=vec4(aPosition,1.,1.);}
  `;
  const skyFrag=`
    precision highp float;varying vec2 uv;
    uniform vec3 uForward,uRight,uUp;uniform vec2 uScale;uniform sampler2D uNoise;
    const vec3 sun=vec3(-.54,.742,.397);
    float cloud(vec2 q){
      return texture2D(uNoise,q*.013).r*.55+texture2D(uNoise,q*.032+vec2(.27,.41)).r*.27+
             texture2D(uNoise,q*.074+vec2(.14,.21)).r*.13+texture2D(uNoise,q*.141).r*.05;
    }
    void main(){
      vec3 ray=normalize(uForward+uRight*uv.x*uScale.x+uUp*uv.y*uScale.y);
      float h=max(0.,ray.y),angle=max(0.,dot(ray,sun));
      vec3 edge=mix(vec3(.82,.85,.82),vec3(.96,.86,.70),pow(angle,2.));
      vec3 sky=mix(edge,vec3(.37,.63,.77),pow(h,.52));
      vec2 p=ray.xz/(.11+h)*.72;
      float clouds=smoothstep(.54,.74,cloud(p+vec2(6.4,1.1)))*smoothstep(.008,.13,h);
      sky=mix(sky,vec3(.96,.94,.86),clouds*.70);
      sky+=vec3(.17,.11,.045)*pow(angle,20.)+vec3(.40,.33,.20)*smoothstep(.9993,.99986,angle);
      gl_FragColor=vec4(sky,1.);
    }`;
  let rt=null, soft=null, ctxGeneration=0;
  /* CPU rasterizer for embedded browsers where the WebGL drawing context is disabled. */
  function softwareRenderer(canvas) {
    const ctx=canvas.getContext("2d",{alpha:false,desynchronized:true});
    if(!ctx)throw Error("O navegador não disponibilizou uma superfície de desenho.");
    const cache=new WeakMap(), fogLut=new Float32Array(600);
    for(let i=0;i<fogLut.length;i++)fogLut[i]=Math.min(.87,1-Math.exp(-Math.max(0,i-16)*.0042));
    let image,frame,background,depth,width=0,height=0,cx,cy,focal,near,far,stats;
    let lastSky=[9,9,9], skyFov=0, budget=335000, slow=0, camera,eye,fx,fy,fz,rx,rz,ux,uy,uz,fr,fg,fb;
    const mul8=(a,b,c)=>0xff000000|a|(b<<8)|(c<<16);
    const hash=(x,y)=>{let h=Math.imul(x|0,73856093)^Math.imul(y|0,19349663);h=Math.imul(h^(h>>>16),2246822519);return ((h^(h>>>13))>>>0)/4294967295;};
    function noise(x,y){const i=Math.floor(x),j=Math.floor(y);let a=x-i,b=y-j;a*=a*(3-2*a);b*=b*(3-2*b);
      return (hash(i,j)*(1-a)+hash(i+1,j)*a)*(1-b)+(hash(i,j+1)*(1-a)+hash(i+1,j+1)*a)*b;}
    function sky(fov) {
      if(Math.abs(fx-lastSky[0])+Math.abs(fy-lastSky[1])+Math.abs(fz-lastSky[2])<.013&&skyFov===fov)return;
      lastSky=[fx,fy,fz];skyFov=fov;
      // Sample the atmosphere in small tiles, then interpolate along each scanline.
      let top=new Float32Array((Math.ceil(width/8)+1)*3),bottom=new Float32Array(top.length);
      function row(out,y){
        for(let i=0;i<out.length;i+=3){
          const t=(i/3*8-cx)/focal, p=(cy-y)/focal;
          const vx=fx+rx*t+ux*p,vy=fy+uy*p,vz=fz+rz*t+uz*p;
          const inv=1/Math.hypot(vx,vy,vz),vx1=vx*inv,vy1=vy*inv,vz1=vz*inv;
          const h=Math.max(0,vy1),u=Math.sqrt(h),dot=Math.max(0,vx1*sun[0]+vy1*sun[1]+vz1*sun[2]);
          const xx=vx1/(.12+h)*3.4+24,zz=vz1/(.12+h)*3.4+12;
          const cloud=Math.min(.52,Math.max(0,((noise(xx,zz)*.63+noise(xx*2.9,zz*2.9)*.27+noise(xx*6.3,zz*6.3)*.10)-.49)*1.8))*Math.min(1,h*9);
          const glow=Math.pow(dot,26),daylight=dot*dot;
          const a=(.82+.11*daylight)*(1-u)+.40*u+.13*glow,b=(.85+.016*daylight)*(1-u)+.65*u+.068*glow,c=(.83-.091*daylight)*(1-u)+.79*u;
          out[i]=255*(a*(1-cloud)+.98*cloud);out[i+1]=255*(b*(1-cloud)+.96*cloud);out[i+2]=255*(c*(1-cloud)+.91*cloud);
        }
      }
      row(top,0);
      for(let y=0;y<height;y+=8){
        row(bottom,y+8);
        for(let dy=0;dy<8&&y+dy<height;dy++){
          const t=dy/8,s=1-t;let k=(y+dy)*width;
          for(let x=0,i=0;x<width;x+=8,i+=3){
            let r=top[i]*s+bottom[i]*t,g=top[i+1]*s+bottom[i+1]*t,b=top[i+2]*s+bottom[i+2]*t;
            const dr=((top[i+3]*s+bottom[i+3]*t)-r)/8,dg=((top[i+4]*s+bottom[i+4]*t)-g)/8,db=((top[i+5]*s+bottom[i+5]*t)-b)/8;
            for(let dx=0;dx<8&&x+dx<width;dx++){background[k++]=mul8(Math.min(255,r)|0,Math.min(255,g)|0,Math.min(255,b)|0);r+=dr;g+=dg;b+=db;}
          }
        }
        const swap=top;top=bottom;bottom=swap;
      }
    }
    function resizeSoft() {
      const w=canvas.clientWidth||640,h=canvas.clientHeight||360;
      const scale=Math.min(1.4,Math.sqrt(budget/(w*h)));
      const W=Math.max(2,Math.round(w*scale)),H=Math.max(2,Math.round(h*scale));
      if(W===width&&H===height)return [W,H];
      width=canvas.width=W;height=canvas.height=H;cx=W*.5;cy=H*.5;
      image=ctx.createImageData(W,H);frame=new Uint32Array(image.data.buffer);background=new Uint32Array(W*H);depth=new Float32Array(W*H);skyFov=0;
      return [W,H];
    }
    function prepare(g){
      let existing=cache.get(g);
      if(existing&&existing.rev===g.revision)return existing.parts;
      const a=g.vertices,map=new Map(),big=a.length>3600*27,thin=a.length<80*27;
      for(let j=0;j<a.length;j+=27){
        const key=big?(Math.floor((a[j]+a[j+9]+a[j+18])/60)+256)*1024+(Math.floor((a[j+2]+a[j+11]+a[j+20])/60)+256):0;
        let part=map.get(key);
        if(!part){part={pos:[],ind:[],normal:[],col:[],lookup:new Map(),min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};map.set(key,part);}
        for(let t=0;t<27;t+=9){
          const k=j+t,x=a[k],y=a[k+1],z=a[k+2];
          const key=(Math.round(x*32768))+','+(Math.round(y*32768))+','+(Math.round(z*32768));
          let index=part.lookup.get(key);
          if(index===undefined){index=part.pos.length/3;part.lookup.set(key,index);part.pos.push(x,y,z);
            part.min[0]=Math.min(part.min[0],x);part.min[1]=Math.min(part.min[1],y);part.min[2]=Math.min(part.min[2],z);
            part.max[0]=Math.max(part.max[0],x);part.max[1]=Math.max(part.max[1],y);part.max[2]=Math.max(part.max[2],z);}
          part.ind.push(index);
        }
        const nx=a[j+3]+a[j+12]+a[j+21],ny=a[j+4]+a[j+13]+a[j+22],nz=a[j+5]+a[j+14]+a[j+23],den=1/(Math.hypot(nx,ny,nz)||1);
        part.normal.push(nx*den,ny*den,nz*den);part.col.push((a[j+6]+a[j+15]+a[j+24])/3,(a[j+7]+a[j+16]+a[j+25])/3,(a[j+8]+a[j+17]+a[j+26])/3);
      }
      const parts=[];
      for(const p of map.values()){
        const center=p.min.map((a,j)=>(a+p.max[j])/2),radius=Math.hypot(...p.max.map((a,j)=>a-center[j]));
        parts.push({pos:Float32Array.from(p.pos),ind:Uint32Array.from(p.ind),normal:Float32Array.from(p.normal),col:Float32Array.from(p.col),center,radius,thin});
      }
      cache.set(g,{rev:g.revision,parts});return parts;
    }
    function triangle(x0,y0,z0,x1,y1,z1,x2,y2,z2,color){
      if((x0<0&&x1<0&&x2<0)||(y0<0&&y1<0&&y2<0)||(x0>=width&&x1>=width&&x2>=width)||(y0>=height&&y1>=height&&y2>=height))return;
      const area=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);
      if(Math.abs(area)<.065)return;
      if(y0>y1){let q=x0;x0=x1;x1=q;q=y0;y0=y1;y1=q;q=z0;z0=z1;z1=q;}
      if(y0>y2){let q=x0;x0=x2;x2=q;q=y0;y0=y2;y2=q;q=z0;z0=z2;z2=q;}
      if(y1>y2){let q=x1;x1=x2;x2=q;q=y1;y1=y2;y2=q;q=z1;z1=z2;z2=q;}
      const totalY=y2-y0;if(totalY<1e-6)return;
      const dxLong=(x2-x0)/totalY,dzLong=(z2-z0)/totalY;
      const xAtMid=x0+dxLong*(y1-y0), span=x1-xAtMid;
      if(Math.abs(span)<.000005)return;
      const dzdx=(z1-z0-dzLong*(y1-y0))/span;
      const sy=.5,from=Math.max(0,Math.ceil(y0-sy)),middle=Math.min(height,Math.max(from,Math.ceil(y1-sy))),end=Math.min(height,Math.ceil(y2-sy));
      for(let half=0;half<2;half++){
        const ya=half?y1:y0,yb=half?y2:y1;
        const first=half?middle:from,last=half?end:middle;
        if(last<=first||yb-ya<1e-6)continue;
        const xa=half?x1:x0,xb=half?x2:x1,dxShort=(xb-xa)/(yb-ya);
        let l=x0+(first+sy-y0)*dxLong,r=xa+(first+sy-ya)*dxShort,zz=z0+(first+sy-y0)*dzLong;
        for(let y=first;y<last;y++,l+=dxLong,r+=dxShort,zz+=dzLong){
          const lo=Math.max(0,Math.ceil(Math.min(l,r)-.5)),hi=Math.min(width-1,Math.floor(Math.max(l,r)-.5)),stop=y*width+hi;
          let q=zz+(lo+.5-l)*dzdx;
          for(let k=y*width+lo;k<=stop;k++,q+=dzdx)if(q>depth[k]){depth[k]=q;frame[k]=color;}
        }
      }
    }
    const cv=new Float32Array(12);
    function clipped(v,ia,ib,ic,col){
      // Clip view-space triangles to the near plane before projecting cabin views.
      let out=0,p=ic;for(let j=0;j<3;j++){
        const k=j===0?ia:j===1?ib:ic,zA=v[p+2],zB=v[k+2],inA=zA>=near,inB=zB>=near;
        if(inA!==inB){const t=(near-zA)/(zB-zA);cv[out++]=v[p]+(v[k]-v[p])*t;cv[out++]=v[p+1]+(v[k+1]-v[p+1])*t;cv[out++]=near;}
        if(inB){cv[out++]=v[k];cv[out++]=v[k+1];cv[out++]=zB;}p=k;
      }
      for(let j=0;j<out;j+=3){const iz=1/cv[j+2];cv[j]=cx+focal*cv[j]*iz;cv[j+1]=cy-focal*cv[j+1]*iz;cv[j+2]=iz;}
      for(let j=3;j+3<out;j+=3)triangle(cv[0],cv[1],cv[2],cv[j],cv[j+1],cv[j+2],cv[j+3],cv[j+4],cv[j+5],col);
    }
    function renderNode(n,m) {
      const parts=prepare(n._geom), rev=n._geom.revision;
      if(!n._soft||n._soft.parts!==parts)n._soft={parts,render:[]};
      const coeff=n._soft.render;
      const x0=m[0]*rx+m[2]*rz,x1=m[4]*rx+m[6]*rz,x2=m[8]*rx+m[10]*rz;
      const y0=m[0]*ux+m[1]*uy+m[2]*uz,y1=m[4]*ux+m[5]*uy+m[6]*uz,y2=m[8]*ux+m[9]*uy+m[10]*uz;
      const z0=m[0]*fx+m[1]*fy+m[2]*fz,z1=m[4]*fx+m[5]*fy+m[6]*fz,z2=m[8]*fx+m[9]*fy+m[10]*fz;
      const tx=m[12]-eye[0],ty=m[13]-eye[1],tz=m[14]-eye[2],X=tx*rx+tz*rz,Y=tx*ux+ty*uy+tz*uz,Z=tx*fx+ty*fy+tz*fz;
      const scale=Math.max(Math.hypot(m[0],m[1],m[2]),Math.hypot(m[4],m[5],m[6]),Math.hypot(m[8],m[9],m[10]));
      for(let pi=0;pi<parts.length;pi++){
        const p=parts[pi],cc=p.center,x=x0*cc[0]+x1*cc[1]+x2*cc[2]+X,y=y0*cc[0]+y1*cc[1]+y2*cc[2]+Y,z=z0*cc[0]+z1*cc[1]+z2*cc[2]+Z,r=p.radius*scale;
        if(z+r<near||z-r>far||Math.abs(x)>Math.max(0,z)*cx/focal+r*(1+cx/focal)||Math.abs(y)>Math.max(0,z)*cy/focal+r*(1+cy/focal))continue;
        if(z>0&&r*focal/z<.31)continue;
        let pass=coeff[pi];
        if(!pass){pass=coeff[pi]={v:new Float32Array(p.pos.length*2),colors:new Uint8Array(p.col.length),stamp:-1,intr:''};}
        // Normals and sun are world-space; cache the material response for parked machines and all scenery.
        if(pass.stamp!==n._v||pass.h!==n._intr[1]||pass.rev!==rev){
          const colors=pass.colors,t=n._tint;
          for(let f=0;f<p.normal.length;f+=3){
            const nx=p.normal[f],ny=p.normal[f+1],nz=p.normal[f+2];
            const t0=nx/(m[0]*m[0]+m[1]*m[1]+m[2]*m[2]||1),t1=ny/(m[4]*m[4]+m[5]*m[5]+m[6]*m[6]||1),t2=nz/(m[8]*m[8]+m[9]*m[9]+m[10]*m[10]||1);
            const a=m[0]*t0+m[4]*t1+m[8]*t2,b=m[1]*t0+m[5]*t1+m[9]*t2,c=m[2]*t0+m[6]*t1+m[10]*t2;
            const inv=1/(Math.hypot(a,b,c)||1),h=.5+.5*b*inv,light=Math.max(0,(a*sun[0]+b*sun[1]+c*sun[2])*inv);
            colors[f]=Math.min(255,255*p.col[f]*t[0]*(.51+.25*h+.40*light));
            colors[f+1]=Math.min(255,255*p.col[f+1]*t[1]*(.48+.32*h+.35*light));
            colors[f+2]=Math.min(255,255*p.col[f+2]*t[2]*(.46+.37*h+.28*light));
          }
          pass.stamp=n._v;pass.h=n._intr[1];pass.rev=rev;
        }
        const v=pass.v,pos=p.pos,ind=p.ind,colors=pass.colors;
        for(let i=0,k=0;i<pos.length;i+=3,k+=6){
          const a=pos[i],b=pos[i+1],c=pos[i+2],xx=x0*a+x1*b+x2*c+X,yy=y0*a+y1*b+y2*c+Y,zz=z0*a+z1*b+z2*c+Z;
          const q=1/(zz||.000001);v[k]=xx;v[k+1]=yy;v[k+2]=zz;v[k+3]=cx+xx*q*focal;v[k+4]=cy-yy*q*focal;v[k+5]=q;
        }
        for(let i=0;i<ind.length;i+=3){
          const a=ind[i]*6,b=ind[i+1]*6,c=ind[i+2]*6,da=v[a+2],db=v[b+2],dc=v[c+2];
          if(da<near&&db<near&&dc<near)continue;
          const f=fogLut[Math.min(599,Math.max(0,(da+db+dc)/3|0))],g=1-f;
          const color=mul8(colors[i]*g+fr*f,colors[i+1]*g+fg*f,colors[i+2]*g+fb*f);
          if(da<near||db<near||dc<near){clipped(v,a,b,c,color);continue;}
          const ax=v[a+3],ay=v[a+4],bx=v[b+3],by=v[b+4],cx=v[c+3],cy=v[c+4];
          if((bx-ax)*(cy-ay)-(cx-ax)*(by-ay)>.1&&!p.thin)continue;
          triangle(ax,ay,v[a+5],bx,by,v[b+5],cx,cy,v[c+5],color);
        }
        stats.triangles+=ind.length/3;stats.draws++;
      }
    }
    function walk(n){if(!n.visible)return;updateWorld(n);if(n._geom&&n._geom.vertices.length){stats.instances++;renderNode(n,withScale(n._shape,n._world,n._intr));}if(!n._frozen)for(const ch of n.children)walk(ch);}
    function project(x,y,z){
      x-=eye[0];y-=eye[1];z-=eye[2];const d=x*fx+y*fy+z*fz,inv=1/d;
      return [cx+(x*rx+z*rz)*focal*inv,cy-(x*ux+y*uy+z*uz)*focal*inv,d];
    }
    function contacts(list){
      for(const s of list||[]){
        const co=Math.cos(s.heading),si=Math.sin(s.heading),w=s.width*.73,l=s.length*.64,terrain=(x,z)=>scope.World&&scope.World.height?scope.World.height(x,z):s.y||0;
        const p=project(s.x,terrain(s.x,s.z)+.04,s.z),ab=[s.x+w*co,s.z-w*si],al=[s.x+l*si,s.z+l*co];
        const a=project(ab[0],terrain(...ab)+.04,ab[1]),b=project(al[0],terrain(...al)+.04,al[1]);
        if(p[2]<near||a[2]<near||b[2]<near)continue;
        const ax=a[0]-p[0],ay=a[1]-p[1],bx=b[0]-p[0],by=b[1]-p[1],det=ax*by-ay*bx;
        if(Math.abs(det)<2)continue;
        const dx=Math.hypot(ax,bx),dy=Math.hypot(ay,by);
        const x0=Math.max(0,Math.floor(p[0]-dx)),x1=Math.min(width-1,Math.ceil(p[0]+dx)),y0=Math.max(0,Math.floor(p[1]-dy)),y1=Math.min(height-1,Math.ceil(p[1]+dy));
        for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
          const u=((x-p[0])*by-(y-p[1])*bx)/det,v=((y-p[1])*ax-(x-p[0])*ay)/det,d=u*u+v*v;
          if(d>=1)continue;const k=y*width+x,z=p[2]+u*(a[2]-p[2])+v*(b[2]-p[2]);
          if(Math.abs(1/depth[k]-z)>.38)continue;
          const col=frame[k],sh=1-.36*(1-d)*(1-d);
          frame[k]=mul8((col&255)*sh,(col>>>8&255)*sh,(col>>>16&255)*sh);
        }
      }
    }
    function drawSoft(root,e,target,opts={}){
      const start=performance.now();eye=e;resizeSoft();camera=view(e,target);
      [fx,fy,fz]=camera.forward;[rx,,rz]=camera.right;[ux,uy,uz]=camera.up;
      const fov=opts.fov||49;focal=height/2/Math.tan(fov*Math.PI/360);near=opts.near||.13;far=opts.far||570;
      const warm=Math.pow(Math.max(0,fx*sun[0]+fy*sun[1]+fz*sun[2]),3);fr=199+35*warm;fg=209+5*warm;fb=204-26*warm;
      sky(fov);frame.set(background);depth.fill(0);stats={draws:0,triangles:0,instances:0,software:true};
      walk(root);contacts(opts.contactShadows);ctx.putImageData(image,0,0);
      const elapsed=performance.now()-start;if(elapsed>39)slow++;else slow=Math.max(0,slow-.35);
      if(slow>12&&budget>155000){budget=Math.max(155000,budget*.82);slow=0;}
      return stats;
    }
    return {draw:drawSoft,resize:resizeSoft,get stats(){return stats;}};
  }

  function shaderProgram(gl,vert,frag,names){
    function compile(type,src){
      const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;
    }
    const vs=compile(gl.VERTEX_SHADER,vert),fs=compile(gl.FRAGMENT_SHADER,frag),p=gl.createProgram();
    gl.attachShader(p,vs);gl.attachShader(p,fs);
    const attribs=["aPosition","aNormal","aColor","aModel",null,null,null,"aTint"];
    attribs.forEach((name,i)=>{if(name)gl.bindAttribLocation(p,i,name);});
    gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
    const uniforms={};for(const name of names)uniforms[name]=gl.getUniformLocation(p,name);
    return {program:p,u:uniforms};
  }
  function noiseTexture(gl){
    const len=128,pixels=new Uint8Array(len*len*4);let seed=2587254;
    for(let i=0;i<pixels.length;i+=4){
      seed=(Math.imul(1664525,seed)+1013904223)>>>0;pixels[i]=seed>>>24;
      seed=(Math.imul(1664525,seed)+1013904223)>>>0;pixels[i+1]=seed>>>24;pixels[i+2]=120;pixels[i+3]=255;
    }
    const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,len,len,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);return t;
  }
  function shadowMap(gl){
    const size=Math.min(1024,gl.getParameter(gl.MAX_TEXTURE_SIZE)),fb=gl.createFramebuffer(),depth=gl.createRenderbuffer(),tex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,size,size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,size,size);
    gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
    const ready=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);return {size,fb,tex,ready};
  }
  function init(canvas){
    const gl=canvas.getContext("webgl",{alpha:false,antialias:true,depth:true,stencil:false,preserveDrawingBuffer:false,powerPreference:"high-performance"});
    if(!gl){rt=null;soft=softwareRenderer(canvas);return true;}
    soft=null;
    rt={canvas,gl,gen:++ctxGeneration,inst:gl.getExtension("ANGLE_instanced_arrays"),batches:new Map(),live:[],stats:{}};
    rt.lit=shaderProgram(gl,objectVertex,fragment,["uVP","uSunVP","uEye","uShadows","uNoise","uSoil","uClay","uShadow","uTexel"]);
    rt.depth=shaderProgram(gl,depthVert,depthFrag,["uVP"]);
    rt.sky=shaderProgram(gl,skyVert,skyFrag,["uForward","uRight","uUp","uScale","uNoise"]);
    rt.clay=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,rt.clay);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,128,128,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,window.Argila);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);
    rt.noise=noiseTexture(gl);rt.shadow=shadowMap(gl);rt.quad=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,rt.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    return true;
  }
  function norm(x,y,z){const t=Math.hypot(x,y,z)||1;return [x/t,y/t,z/t];}
  function view(eye,at){
    const z=norm(eye[0]-at[0],eye[1]-at[1],eye[2]-at[2]);
    const x=Math.abs(z[1])>.99999?[1,0,0]:norm(z[2],0,-z[0]);
    const y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
    const dot=v=>v[0]*eye[0]+v[1]*eye[1]+v[2]*eye[2];
    return {m:new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x),-dot(y),-dot(z),1]),right:x,up:y,forward:z.map(t=>-t)};
  }
  function perspective(fov,asp,near,far){
    const f=1/Math.tan(fov*Math.PI/360),d=1/(near-far);
    return new Float32Array([f/asp,0,0,0,0,f,0,0,0,0,(far+near)*d,-1,0,0,2*far*near*d,0]);
  }
  function sunMatrix(at,range,size){
    const source=[at[0]+sun[0]*130,at[1]+sun[1]*130,at[2]+sun[2]*130],m=view(source,at).m;
    const unit=range*2/size;
    m[12]=Math.round(m[12]/unit)*unit;m[13]=Math.round(m[13]/unit)*unit;
    const o=new Float32Array([1/range,0,0,0,0,1/range,0,0,0,0,-2/280,0,0,0,-1,1]);
    return multiply(identity(),o,m);
  }
  function resize(pixelRatio){
    if(soft)return soft.resize();
    const c=rt.canvas, dpr=Math.min(pixelRatio||1.6,scope.devicePixelRatio||1);
    const cssW=c.clientWidth||c.width||640,cssH=c.clientHeight||c.height||360;
    const resolution=Math.min(dpr,Math.sqrt(1700000/(cssW*cssH)));
    const w=Math.max(1,Math.round(cssW*resolution)),h=Math.max(1,Math.round(cssH*resolution));
    if(w!==c.width||h!==c.height){c.width=w;c.height=h;}
    return [w,h];
  }
  function batchFor(g){
    let b=rt.batches.get(g);
    if(!b){b={g,count:0,data:new Float32Array(19*8),buffer:null,bytes:0};rt.batches.set(g,b);}
    if(!b.count)rt.live.push(b);
    if((b.count+1)*19>b.data.length){const newData=new Float32Array(b.data.length*2);newData.set(b.data);b.data=newData;}
    return b;
  }
  function gather(n){
    if(!n.visible)return;
    updateWorld(n);
    if(n._geom&&n._geom.vertices.length){
      const b=batchFor(n._geom),k=b.count++*19;
      const m=withScale(n._shape,n._world,n._intr);
      b.data.set(m,k);b.data.set(n._tint,k+16);
    }
    if(!n._frozen)for(const c of n.children)gather(c);
  }
  function prepareBatch(b){
    const gl=rt.gl,g=b.g;let gpu=g.gpu;
    if(!gpu||gpu.gen!==rt.gen){gpu=g.gpu={gen:rt.gen,buffer:gl.createBuffer(),revision:0,bytes:0};}
    if(gpu.revision!==g.revision){
      gl.bindBuffer(gl.ARRAY_BUFFER,gpu.buffer);
      if(gpu.bytes===g.vertices.byteLength)gl.bufferSubData(gl.ARRAY_BUFFER,0,g.vertices);
      else{gl.bufferData(gl.ARRAY_BUFFER,g.vertices,g.revision===1?gl.STATIC_DRAW:gl.DYNAMIC_DRAW);gpu.bytes=g.vertices.byteLength;}
      gpu.revision=g.revision;
    }
    if(b.count>1 && rt.inst){
      if(!b.buffer)b.buffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);
      if(b.bytes<b.data.byteLength){gl.bufferData(gl.ARRAY_BUFFER,b.data.byteLength,gl.DYNAMIC_DRAW);b.bytes=b.data.byteLength;}
      gl.bufferSubData(gl.ARRAY_BUFFER,0,b.data.subarray(0,b.count*19));
    }
  }
  function renderBatches(full){
    const gl=rt.gl,ext=rt.inst;
    gl.enableVertexAttribArray(0);
    if(full){gl.enableVertexAttribArray(1);gl.enableVertexAttribArray(2);}
    else{gl.disableVertexAttribArray(1);gl.disableVertexAttribArray(2);}
    for(const b of rt.live){
      if(full)gl.uniform1f(rt.lit.u.uSoil,b.g.soil?1:0);
      const count=b.g.vertices.length/9;
      gl.bindBuffer(gl.ARRAY_BUFFER,b.g.gpu.buffer);
      gl.vertexAttribPointer(0,3,gl.FLOAT,false,36,0);
      if(full){gl.vertexAttribPointer(1,3,gl.FLOAT,false,36,12);gl.vertexAttribPointer(2,3,gl.FLOAT,false,36,24);}
      if(b.count>1&&ext){
        gl.bindBuffer(gl.ARRAY_BUFFER,b.buffer);
        for(let i=0;i<4;i++){
          const k=3+i;gl.enableVertexAttribArray(k);gl.vertexAttribPointer(k,4,gl.FLOAT,false,76,i*16);ext.vertexAttribDivisorANGLE(k,1);
        }
        if(full){gl.enableVertexAttribArray(7);gl.vertexAttribPointer(7,3,gl.FLOAT,false,76,64);ext.vertexAttribDivisorANGLE(7,1);}
        ext.drawArraysInstancedANGLE(gl.TRIANGLES,0,count,b.count);
        for(let k=3;k<8;k++){ext.vertexAttribDivisorANGLE(k,0);gl.disableVertexAttribArray(k);}
        rt.stats.draws++;
      }else{
        for(let j=0;j<b.count;j++){
          const a=b.data,k=j*19;
          for(let col=0;col<4;col++){const x=k+col*4;gl.vertexAttrib4f(3+col,a[x],a[x+1],a[x+2],a[x+3]);}
          if(full)gl.vertexAttrib3f(7,a[k+16],a[k+17],a[k+18]);
          gl.drawArrays(gl.TRIANGLES,0,count);rt.stats.draws++;
        }
      }
    }
    gl.disableVertexAttribArray(1);gl.disableVertexAttribArray(2);
  }
  function draw(root,eye,target,opts={}){
    if(soft)return soft.draw(root,eye,target,opts);
    if(!rt)throw Error("Renderização 3D ainda não iniciada.");
    const {gl,shadow,sky,depth,lit}=rt;if(gl.isContextLost())return;
    const [width,height]=resize(opts.pixelRatio),fov=opts.fov||49,asp=width/height,camera=view(eye,target);
    const projection=perspective(fov,asp,opts.near||.08,opts.far||570);
    const vp=multiply(identity(),projection,camera.m);
    const lightVP=sunMatrix(target,opts.shadowRange||37,shadow.size),enableShadow=shadow.ready&&opts.shadows!==false;
    for(const b of rt.live)b.count=0;rt.live.length=0;
    gather(root);rt.stats={draws:0,triangles:0,instances:0};
    for(const b of rt.live){prepareBatch(b);rt.stats.instances+=b.count;rt.stats.triangles+=b.count*b.g.vertices.length/27;}
    gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,null);
    if(enableShadow){
      gl.bindFramebuffer(gl.FRAMEBUFFER,shadow.fb);gl.viewport(0,0,shadow.size,shadow.size);
      gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(depth.program);gl.uniformMatrix4fv(depth.u.uVP,false,lightVP);renderBatches(false);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST);gl.depthMask(false);gl.useProgram(sky.program);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,rt.noise);gl.uniform1i(sky.u.uNoise,1);
    gl.uniform3fv(sky.u.uForward,camera.forward);gl.uniform3fv(sky.u.uRight,camera.right);gl.uniform3fv(sky.u.uUp,camera.up);
    const t=Math.tan(fov*Math.PI/360);gl.uniform2f(sky.u.uScale,t*asp,t);
    gl.bindBuffer(gl.ARRAY_BUFFER,rt.quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.enable(gl.DEPTH_TEST);gl.depthMask(true);gl.useProgram(lit.program);
    gl.uniformMatrix4fv(lit.u.uVP,false,vp);gl.uniformMatrix4fv(lit.u.uSunVP,false,lightVP);gl.uniform3fv(lit.u.uEye,eye);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,shadow.tex);gl.uniform1i(lit.u.uShadows,0);
    gl.uniform1i(lit.u.uNoise,1);gl.uniform1f(lit.u.uShadow,enableShadow?1:0);gl.uniform1f(lit.u.uTexel,1/shadow.size);
    gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,rt.clay);gl.uniform1i(lit.u.uClay,2);
    renderBatches(true);return rt.stats;
  }
  scope.G={group,box,cyl,beam,rod,align,mesh,updateMesh,sphere,freeze,worldPoint,init,draw,resize,
    get ready(){return !!soft || !!rt && !rt.gl.isContextLost();},get software(){return !!soft;},get stats(){return soft?soft.stats:rt?rt.stats:null;}};
})(typeof window!=="undefined"?window:globalThis);

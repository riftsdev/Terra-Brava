/* Terra Brava — operator on foot, articulated character and orbit camera. */
(() => {
  'use strict';
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const ease=(rate,dt)=>1-Math.exp(-rate*dt);
  const axis=v=>Number.isFinite(v)?clamp(v,-1,1):0;
  // Body half width, rear and front extents, longitudinal position of the cab.
  const shapes={exc:[1.40,-1.97,1.84,.55],back:[1.16,-2.04,2.03,-.12],grader:[1.24,-3.28,3.65,-1.14],truck:[1.27,-2.85,3.94,2.45],bike:[.36,-1.1,1.13,0],pickup:[.95,-2.25,2.25,.45]};
  const radius=.25;
  let actor,body,torso,arms=[],legs=[],on=false,lastFleet=[];
  let x=0,y=0,z=0,heading=0,yaw=0,pitch=.30,vx=0,vz=0,phase=0,amplitude=0;
  const groupAt=(p,xyz)=>{const g=G.group(p);g.p=xyz;return g;};
  function character(parent){
    actor=G.group(parent);body=groupAt(actor,[0,0,0]);torso=groupAt(body,[0,.90,0]);
    const blue='#2b4657',seam='#3d5a68', vest='#ef771e',stripe='#e9da98',skin='#a97150',boot='#39332d';
    G.sphere(torso,[0,.27,-.008],[.221,.33,.143],blue,8);
    G.box(torso,[0,.279,0],[.393,.42,.25],vest);
    G.box(torso,[0,.098,0],[.407,.048,.259],'#785337');
    G.box(torso,[0,.157,0],[.400,.04,.256],stripe);
    G.box(torso,[0,.238,0],[.400,.035,.256],stripe);
    for(const side of [-1,1]){
      G.box(torso,[side*.115,.393,0],[.038,.193,.261],stripe);
      G.box(torso,[side*.112,.081,.145],[.095,.107,.046],blue);
      G.box(torso,[side*.091,.299,.135],[.090,.048,.018],'#c86222');
    }
    G.box(torso,[0,.29,.134],[.016,.382,.013],'#613f34');
    G.box(torso,[-.117,.400,.150],[.060,.079,.045],'#39464a');
    G.rod(torso,[-.123,.433,.153],[-.124,.492,.153],.006,'#39464a',5);
    G.cyl(torso,[0,.508,0],.069,.072,.078,skin,9);
    G.sphere(torso,[0,.651,0],[.137,.162,.125],skin,10);
    G.box(torso,[0,.655,.117],[.045,.055,.043],skin);
    G.box(torso,[0,.685,.119],[.205,.037,.016],'#393b38');
    G.sphere(torso,[0,.684,-.052],[.136,.116,.089],'#48382c',9);
    G.sphere(torso,[0,.762,-.006],[.159,.101,.147],'#edb435',12);
    G.cyl(torso,[0,.744,.012],.172,.173,.029,'#f7c348',14);
    G.box(torso,[0,.835,-.002],[.047,.038,.174],'#f7ca55');
    G.box(torso,[0,.750,.115],[.216,.026,.115],'#f5c14c');
    G.freeze(torso);
    arms=[];legs=[];
    for(const side of [-1,1]){
      const arm=groupAt(body,[side*.231,1.337,0]);
      const upper=groupAt(arm,[0,0,0]);
      G.sphere(upper,[0,-.075,0],[.076,.115,.077],blue,8);
      G.cyl(upper,[0,-.167,0],.062,.055,.168,blue,8);
      G.cyl(upper,[0,-.175,0],.064,.061,.029,stripe,8);G.freeze(upper);
      const elbow=groupAt(arm,[0,-.246,0]);elbow.r[0]=-.16;
      G.cyl(elbow,[0,-.094,0],.052,.045,.188,seam,8);
      G.sphere(elbow,[0,-.224,0],[.053,.074,.046],'#634f39',8);G.freeze(elbow);
      arms.push({node:arm,elbow,side});
      const leg=groupAt(body,[side*.105,.914,0]),thigh=groupAt(leg,[0,0,0]);
      G.sphere(thigh,[0,-.178,0],[.104,.217,.095],blue,8);
      G.box(thigh,[side*.071,-.178,.01],[.057,.104,.117],seam);G.freeze(thigh);
      const knee=groupAt(leg,[0,-.40,0]);
      G.cyl(knee,[0,-.185,0],.084,.067,.362,blue,8);
      G.cyl(knee,[0,-.267,0],.075,.073,.029,stripe,8);
      const foot=groupAt(knee,[0,-.405,0]);
      G.box(foot,[0,-.035,.035],[.151,.124,.239],boot);
      G.box(foot,[0,-.090,.035],[.156,.034,.245],'#292b29');
      G.box(foot,[0,.010,.087],[.141,.039,.083],'#594631');
      legs.push({node:leg,knee,foot,side});
    }
    actor.visible=false;
  }
  function init(parent){character(parent);on=false;lastFleet=[];return actor;}
  function local(m,px,pz){const dx=px-m.x,dz=pz-m.z,s=Math.sin(m.heading),c=Math.cos(m.heading);return [dx*c-dz*s,dx*s+dz*c];}
  function world(m,side,along){const s=Math.sin(m.heading),c=Math.cos(m.heading);return [m.x+c*side+s*along,m.z-s*side+c*along];}
  function bodyHit(m,px,pz,r){
    const sh=shapes[m.type];if(!sh)return false;
    const q=local(m,px,pz),lx=Math.max(0,Math.abs(q[0])-sh[0]),lz=Math.max(sh[1]-q[1],q[1]-sh[2],0);
    return lx*lx+lz*lz<r*r;
  }
  function blocked(px,pz,fleet,oldHeight){
    if(World.collides(px,pz,radius))return true;
    const surface=World.height(px,pz);
    if(!Number.isFinite(surface)||(oldHeight!==undefined&&surface>oldHeight+.185))return true;
    for(const m of fleet){
      if(bodyHit(m,px,pz,radius))return true;
      if(!m.model||m.type==='truck'||m.type==='grader'||Math.hypot(px-m.x,pz-m.z)>9)continue;
      const p=Machines.tip(m.model),reach=m.type==='back'&&m.tool==='front'?.87:.57;
      if(p[1]<surface+1.67&&p[1]>surface-.65&&Math.hypot(p[0]-px,p[2]-pz)<reach+radius)return true;
    }
    return false;
  }
  function doors(m){
    const sh=shapes[m.type], list=[];
    if(!sh)return list;
    // The excavator cab travels with its upper structure. Access remains beside the tracks.
    if(m.type==='exc'){
      const upper={x:m.x,z:m.z,heading:m.heading+(m.slew||0)};
      for(const side of [-1,1])for(const offset of [0,.58,-.58]){
        list.push({pos:world(upper,side*1.98,sh[3]+offset),side});
      }
    }
    for(const side of [-1,1])for(const off of [0,.58,-.58]){
      list.push({pos:world(m,side*(sh[0]+.58),sh[3]+off),side});
    }
    return list;
  }
  function animate(dt,distance){
    const speed=dt>0?distance/dt:0,weight=clamp(speed/2.8,0,1);
    amplitude+= (weight-amplitude)*ease(11,dt);phase=(phase+distance*5.9)%(Math.PI*2);
    body.p[1]=.017*amplitude*(1-Math.cos(phase*2));torso.r[2]=.032*amplitude*Math.sin(phase);
    for(const q of legs){
      const wave=Math.sin(phase+(q.side<0?Math.PI:0));
      q.node.r[0]=-.50*wave*amplitude;
      q.knee.r[0]=.68*Math.max(0,-Math.cos(phase+(q.side<0?Math.PI:0)))*amplitude;
      q.foot.r[0]=-(q.node.r[0]+q.knee.r[0])*.70;
    }
    for(const q of arms){
      const swing=Math.sin(phase+(q.side<0?Math.PI:0))*amplitude;
      q.node.r[0]=swing*.42;q.node.r[2]=q.side*.061;q.elbow.r[0]=-.18-.17*Math.max(0,-swing);
    }
    actor.p[0]=x;actor.p[1]=y;actor.p[2]=z;actor.r[1]=heading;
  }
  function exit(m,fleet){
    if(!actor||!m||!Array.isArray(fleet)||Math.abs(m.speed||0)>.25)return false;
    const candidate=doors(m).find(d=>!blocked(d.pos[0],d.pos[1],fleet));
    if(!candidate)return false;
    [x,z]=candidate.pos;y=World.height(x,z);vx=vz=phase=amplitude=0;
    const actualSide=local(m,x,z)[0]<0?-1:1;
    heading=yaw=wrap(m.heading-actualSide*.65);pitch=.29;
    lastFleet=fleet;on=true;actor.visible=true;animate(0,0);return true;
  }
  function enterable(fleet){
    if(!on)return null;
    let dist=1.65,nearest=null;
    for(const m of fleet){
      if(Math.abs(m.speed||0)>.25||Math.hypot(m.x-x,m.z-z)>6)continue;
      for(const d of doors(m)){
        const away=Math.hypot(x-d.pos[0],z-d.pos[1]);if(away>=dist)continue;
        // The route from the operator to the step cannot cross a wall or another machine.
        const mx=(d.pos[0]+x)*.5,mz=(d.pos[1]+z)*.5;
        if(World.collides(mx,mz,.12)||fleet.some(o=>o!==m&&bodyHit(o,mx,mz,.13)))continue;
        dist=away;nearest=m;
      }
    }
    return nearest;
  }
  function update(dt,input={},fleet=[]){
    if(!on||!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(.1,dt);lastFleet=fleet;
    yaw=wrap(yaw-axis(input.lookX)*dt*2.35);pitch=clamp(pitch-axis(input.lookY)*dt*1.1,-.06,.94);
    let ix=-axis(input.x),iz=axis(input.y),norm=Math.hypot(ix,iz);
    if(norm>1){ix/=norm;iz/=norm;}
    const s=Math.sin(yaw),c=Math.cos(yaw),rate=ease(norm>.02?10:14,dt);
    vx+=((c*ix+s*iz)*2.75-vx)*rate;vz+=((-s*ix+c*iz)*2.75-vz)*rate;
    const ox=x,oz=z,groundY=World.height(x,z);
    const nx=x+vx*dt,nz=z+vz*dt;
    if(!blocked(nx,nz,fleet,groundY)){x=nx;z=nz;}
    else if(!blocked(nx,z,fleet,groundY)){x=nx;vz=0;}
    else if(!blocked(x,nz,fleet,groundY)){z=nz;vx=0;}
    else {vx=vz=0;}
    const travel=Math.hypot(x-ox,z-oz);
    if(travel>.0005)heading=wrap(heading+wrap(Math.atan2(x-ox,z-oz)-heading)*ease(13,dt));
    y+=(World.height(x,z)-y)*ease(22,dt);
    animate(dt,travel);
  }
  function view(){
    const target=[x,y+1.12,z],s=Math.sin(yaw),c=Math.cos(yaw);
    const horizontal=4.0*Math.cos(pitch),vertical=4.0*Math.sin(pitch)+.22;
    let fraction=1;
    for(let j=1;j<=14;j++){
      const f=j/14,px=x-s*horizontal*f,pz=z-c*horizontal*f,h=target[1]+vertical*f;
      if(h<World.height(px,pz)+.18||World.collides(px,pz,.10)||lastFleet.some(m=>h<m.y+3.3&&bodyHit(m,px,pz,.10))){
        fraction=Math.max(.13,(j-1)/14);break;
      }
    }
    const ex=x-s*horizontal*fraction,ez=z-c*horizontal*fraction;
    return {eye:[ex,Math.max(World.height(ex,ez)+.20,target[1]+vertical*fraction),ez],target};
  }
  function rotate(dx,dy){if(!on)return;yaw=wrap(yaw-(Number.isFinite(dx)?dx:0)*.007);pitch=clamp(pitch+(Number.isFinite(dy)?dy:0)*.006,-.06,.94);}
  function hide(){on=false;if(actor)actor.visible=false;vx=vz=0;}
  window.Walker={init,exit,enterable,update,view,rotate,hide,pos:()=>({x,z,heading})};
})();

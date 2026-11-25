/* Terra Brava | operação, câmera, áudio e efeitos de contato. */
(function () {
  'use strict';

  const types = ['exc', 'back', 'grader', 'truck', 'bike', 'pickup'];
  const canvas = document.getElementById('scene');
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  const mix = (a, b, t) => a + (b - a) * t;
  const ease = (k, dt) => 1 - Math.exp(-k * dt);
  const steerAngle = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
  const storageKey = 'terrabrava.canteiro.v1';
  const sticks = {left: [0, 0], right: [0, 0]};
  const keys = new Set();
  let root = null, ready = false, playing = false, paused = false, starting = false;
  let frame = 0, lastTime = 0, bank = 0, hudClock = 1, saveClock = 0, dirty = false;
  let mode = 'work', selected = 'exc', footBrake = false, contextLost = false;
  let onFoot = false, inverted = true;
  try { inverted = localStorage.getItem('terrabrava.hidraulica') !== 'anterior'; } catch (_) {}
  let sounds = true, rpm = 760, tier = 0, slowFrames = 0;
  const cameraNames = ['Orbital', 'Ferramenta', 'Cabine'];
  const cam = {kind: 0, yaw: 0.91, pitch: 0.36, zoom: 1, hold: 0, eye: [0, 0, 0], target: [0, 0, 0], snap: true};
  const fingers = new Map();
  let pinch = null;
  let engineAudio = null;

  function clearInput() {
    Pad.reset();
    keys.clear();
    for (const p of Object.values(sticks)) { p[0] = 0; p[1] = 0; }
    fingers.clear();
    footBrake = false;
    pinch = null;
    if (window.UI && UI.releaseControls) UI.releaseControls();
  }
  function notice(text) { if (window.UI && UI.notice) UI.notice(text); }

  // A frequência fundamental acompanha os ciclos de combustão do motor.
  function startAudio() {
    if (!sounds) return;
    try {
      if (!engineAudio) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) { sounds = false; return; }
        const ctx = new Audio(), master = ctx.createGain(), motor = ctx.createOscillator();
        const filter = ctx.createBiquadFilter(), hyd = ctx.createOscillator(), hGain = ctx.createGain();
        const reverse = ctx.createOscillator(), reverseGain = ctx.createGain();
        const air = ctx.createBufferSource(), airGain = ctx.createGain(), airFilter = ctx.createBiquadFilter();
        const re = new Float32Array(15);
        const im = new Float32Array([0, .8, .35, .50, .16, .27, .07, .15, .1, .05, .07, .04, .03, .02, .01]);
        motor.setPeriodicWave(ctx.createPeriodicWave(re, im));
        motor.frequency.value = 38;
        filter.type = 'lowpass'; filter.frequency.value = 250; filter.Q.value = .55;
        motor.connect(filter); filter.connect(master);
        hyd.type = 'sine'; hyd.frequency.value = 260; hGain.gain.value = 0;
        hyd.connect(hGain); hGain.connect(master);
        const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), buf = buffer.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < buf.length; i++) { brown = (brown + .09 * (Math.random() * 2 - 1)) / 1.05; buf[i] = brown; }
        air.buffer = buffer; air.loop = true;
        airFilter.type = 'bandpass'; airFilter.frequency.value = 700; airFilter.Q.value = .75;
        airGain.gain.value = .18; air.connect(airFilter); airFilter.connect(airGain); airGain.connect(master);
        master.gain.value = 0; master.connect(ctx.destination);
        reverse.type = 'sine'; reverse.frequency.value = 812; reverseGain.gain.value = 0;
        reverse.connect(reverseGain); reverseGain.connect(master);
        motor.start(); hyd.start(); air.start(); reverse.start();
        engineAudio = {ctx, master, motor, filter, hyd, hGain, airGain, reverseGain};
      }
      if (engineAudio.ctx.state === 'suspended') engineAudio.ctx.resume().catch(() => {});
    } catch (_) { sounds = false; }
  }
  function audioStep(input, m, dt) {
    const toolInput = Math.max(Math.abs(input.leftX), Math.abs(input.leftY), Math.abs(input.rightX), Math.abs(input.rightY));
    const effort = Math.max(Math.abs(input.drive), Math.abs(m.speed) / (m.type === 'truck' ? 9 : 4));
    const target = m.rpm || (720 + 870 * Math.min(1, effort) + 300 * toolInput);
    rpm = mix(rpm, target, ease(3, dt));
    if (!engineAudio || !sounds) return;
    const a = engineAudio, t = a.ctx.currentTime;
    a.motor.frequency.setTargetAtTime(rpm / 120 * (m.type === 'truck' ? 6 : 4), t, .12);
    a.filter.frequency.setTargetAtTime(190 + 260 * effort + 75 * toolInput, t, .13);
    a.hGain.gain.setTargetAtTime(.027 * toolInput, t, .12);
    const reversing = m.speed < -.16 && t % .9 < .26;
    a.reverseGain.gain.setTargetAtTime(reversing ? .16 : 0, t, .018);
    a.hyd.frequency.setTargetAtTime(200 + 170 * toolInput + 25 * effort, t, .15);
    a.airGain.gain.setTargetAtTime(.15 + .4 * Math.min(Math.abs(m.speed) / 5, 1), t, .18);
    a.master.gain.setTargetAtTime(.078, t, .20);
  }
  function silence() {
    if (engineAudio) engineAudio.master.gain.setTargetAtTime(0, engineAudio.ctx.currentTime, .035);
  }

  const goods = {tracks: [], dust: [], index: 0, dustIndex: 0, distance: 0, sample: 0, lastMachine: null};
  const guide = {root: null, soil: null, bed: null, dashes: []};
  function buildLandingGuide() {
    guide.root = G.group(root);
    function ring(color) {
      const node = G.group(guide.root);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        const bar = G.box(node, [Math.sin(a)*.26, 0, Math.cos(a)*.26], [.25, .025, .042], color);
        bar.r[1] = a;
      }
      for (let i=0; i<5; i++) {
        const dash=G.box(node,[0,0,0],[.027,.09,.027],color);
        guide.dashes.push({dash,order:i});
      }
      return node;
    }
    guide.soil = ring('#ffe2a5'); guide.bed = ring('#8fe6a2');
    guide.root.visible=false;
  }
  function updateLandingGuide(m) {
    const show = m.load > .015 && (m.type === 'exc' || m.type === 'back') && mode === 'work';
    guide.root.visible = show;
    if (!show) return;
    const tip = Machines.tip(m.model), truck = Sim.all().find(v => v.type === 'truck');
    const dx = tip[0]-truck.x, dz = tip[2]-truck.z, sh=Math.sin(truck.heading), ch=Math.cos(truck.heading);
    const along=dx*sh+dz*ch, across=dx*ch-dz*sh;
    const overBed = truck.bed < .22 && truck.load < truck.capacity-.01 && Math.abs(across)<1.04 && along>-2.55 && along<1.13 && tip[1]>truck.y+2.6;
    const receiving = overBed ? Math.max(truck.y+2.51,truck.y+1.70+truck.load/truck.capacity*.9) : World.height(tip[0],tip[2])+.065;
    const fall = tip[1]-receiving;
    guide.root.visible = fall>.3;
    if (!guide.root.visible) return;
    guide.root.p = [tip[0],receiving,tip[2]];
    guide.bed.visible = overBed; guide.soil.visible = !overBed;
    guide.dashes.forEach(({dash,order}) => {
      dash.p[1] = (order+1)*fall/6;
      dash.s[1] = Math.min(1.65,fall*.45);
    });
  }
  function setupContact() {
    const layer = G.group(root);
    for (let i = 0; i < 100; i++) {
      const mark = G.box(layer, [0, 0, 0], [1, 1, 1], i % 4 < 2 ? '#866043' : '#805b3e');
      mark.visible = false; goods.tracks.push(mark);
    }
    for (let i = 0; i < 25; i++) {
      const p = G.sphere(layer, [0, 0, 0], [1, 1, 1], ['#b29270', '#bd9973', '#b28c64'][i % 3], 5);
      p.visible = false; goods.dust.push({p, life: 0, vx: 0, vy: 0, vz: 0, scale: 0});
    }
  }
  function contact(m, dt) {
    if (m !== goods.lastMachine) { goods.distance = 0; goods.lastMachine = m; }
    const sp = Math.abs(m.speed), sh = Math.sin(m.heading), ch = Math.cos(m.heading);
    const track = m.type === 'exc', halfWidth = track ? 1.18 : m.type === 'truck' ? .93 : 1.02;
    goods.distance += dt * sp;
    if (goods.distance > (track ? .49 : .64)) {
      goods.distance = 0;
      const back = (track ? 1.1 : 1.62) * (m.speed < 0 ? -1 : 1);
      for (const side of [-1, 1]) {
        const x = m.x + side * halfWidth * ch - back * sh, z = m.z - side * halfWidth * sh - back * ch;
        const mark = goods.tracks[goods.index++ % goods.tracks.length];
        const ground = World.height(x, z);
        const length = track ? .16 : .24;
        const gradeF = (World.height(x + sh * .3, z + ch * .3) - World.height(x - sh * .3, z - ch * .3)) / .6;
        const gradeS = (World.height(x + ch * .3, z - sh * .3) - World.height(x - ch * .3, z + sh * .3)) / .6;
        mark.p = [x, ground + .012, z]; mark.s = [track ? .48 : .28, .012, length];
        mark.r = [-Math.atan(gradeF), m.heading + (track ? 0 : side * .16), Math.atan(gradeS)]; mark.visible = true;
        if (sp > .5 && (tier < 2 || side === 1)) {
          const d = goods.dust[goods.dustIndex++ % goods.dust.length];
          d.p.p = [x, ground + .08, z]; d.p.visible = true;
          d.vx = (Math.random() - .5) * .48 - sh * m.speed * .12;
          d.vz = (Math.random() - .5) * .48 - ch * m.speed * .12; d.vy = .36 + Math.random() * .42;
          d.life = .48 + Math.random() * .25; d.scale = .04 + .055 * Math.random();
        }
      }
    }
    for (const d of goods.dust) {
      if (d.life <= 0) continue;
      d.life -= dt; d.p.visible = d.life > 0;
      d.p.p[0] += d.vx * dt; d.p.p[1] += d.vy * dt; d.p.p[2] += d.vz * dt;
      const size = d.scale * Math.min(1, Math.max(0, d.life * 5)); d.p.s = [size, size * .73, size];
    }
    goods.sample += dt;
    if (goods.sample >= .45) {
      goods.sample = 0;
      for (const mark of goods.tracks) if (mark.visible && Math.abs(World.height(mark.p[0], mark.p[2]) - mark.p[1]) > .09) mark.visible = false;
    }
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && saved.v === 1 && saved.terrain && saved.fleet && World.restore && Sim.restore) {
        // A grade antiga tinha 97 amostras por linha; a expansão foi para leste.
        const terrain=saved.width===129?saved.terrain:saved.terrain.map((v,i)=>i%2?v:v%97+Math.floor(v/97)*129);
        World.restore(terrain); Sim.restore(saved.fleet); Obra.restore(saved.obra); World.flush();
      }
    } catch (_) { /* Navegação privada e versões antigas podem não ter um turno salvo. */ }
  }
  function save() {
    if (!ready || !dirty || !World.snapshot || !Sim.snapshot) return;
    try {
      const snapshot = {v: 1, width:129, obra:Obra.snapshot(), terrain: World.snapshot(), fleet: Sim.snapshot()};
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
      dirty = false;
    } catch (_) { /* O turno continua em memória mesmo sem espaço no dispositivo. */ }
  }
  function boot() {
    if (ready) return;
    G.init(canvas);
    root = G.group();
    World.create(root);
    Sim.init(root);
    Walker.init(root);
    setupContact();
    buildLandingGuide();
    ready = true;
    restore();
  }
  function requestFrame() {
    if (!frame && playing && !paused && !document.hidden && !contextLost) frame = requestAnimationFrame(loop);
  }
  function start(type) {
    if (!types.includes(type) || starting) return;
    startAudio();
    starting = true;
    if (ready) { enter(type); return; }
    const button = document.getElementById('start');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    document.getElementById('startLabel').textContent = 'Preparando canteiro…';
    requestAnimationFrame(() => requestAnimationFrame(() => enter(type)));
  }
  function enter(type) {
    try {
      boot();
      onFoot = false; Walker.hide(); clearInput(); Sim.select(type); selected = type;
      const m = Sim.active(); Sim.occupy(m,true);
      mode = type === 'exc' || (type === 'back' && m.tool === 'rear') ? 'work' : 'drive';
      playing = true; paused = false; bank = 0; lastTime = 0; hudClock = 1;
      cam.kind = 0; cam.snap = true; cam.hold = 3; cam.zoom = 1;
      cam.yaw = m.heading + Math.PI;
      cam.pitch = type === 'exc' ? .24 : .32; tier = 0; slowFrames = 0;
      UI.play(type); updateHUD(); draw(1 / 60); requestFrame();
    } catch (error) {
      playing = false; silence(); UI.garage(type);
      console.error('Terra Brava:', error);
      notice('O cenário 3D não abriu. Ative a aceleração gráfica ou abra o jogo no Safari ou Chrome atualizado.');
    } finally {
      const button = document.getElementById('start');
      button.disabled = false;
      button.removeAttribute('aria-busy');
      document.getElementById('startLabel').textContent = 'Operar máquina';
      starting = false;
    }
  }
  function garage() {
    if (playing) { Sim.occupy(Sim.active(),false); dirty = true; save(); }
    playing = false; paused = false; clearInput(); silence();
    cancelAnimationFrame(frame); frame = 0; UI.garage(selected);
  }
  function pause(value) {
    paused = !!value;
    clearInput(); lastTime = 0; bank = 0;
    if (paused) { cancelAnimationFrame(frame); frame = 0; silence(); dirty = true; save(); }
    else requestFrame();
  }
  function toggleInversion() {
    inverted = !inverted;
    try { localStorage.setItem('terrabrava.hidraulica', inverted ? 'novo' : 'anterior'); } catch (_) {}
    clearInput(); updateHUD(); return inverted;
  }
  function interact() {
    if (!playing || paused) return;
    if (onFoot) {
      const machine = Walker.enterable(Sim.all());
      if (!machine) { notice('Aproxime-se de uma cabine para entrar.'); return; }
      enter(machine.type);
    } else {
      if (Math.abs(Sim.active().speed) > .25) { notice('Pare a máquina antes de sair.'); return; }
      if (!Walker.exit(Sim.active(),Sim.all())) { notice('Estacione onde haja espaço ao lado da cabine.'); return; }
      onFoot = true; Sim.occupy(Sim.active(),false); dirty=true; clearInput(); silence(); cam.snap = true; updateHUD();
    }
  }
  function setMode(value) {
    if (!playing || onFoot || !['work', 'drive'].includes(value) || mode === value) return;
    mode = value; clearInput(); updateHUD();
  }
  function toggleTool() {
    if (!playing || onFoot || selected !== 'back') return;
    if (!Sim.active().running){notice('Ligue o motor para trocar o implemento.');return;}
    if (!Sim.toggleTool()) { notice('Pare a retroescavadeira para trocar de implemento.'); return; }
    const m = Sim.active();
    mode = m.tool === 'rear' ? 'work' : 'drive'; clearInput(); dirty = true;
    if (cam.kind === 0) { cam.yaw = m.heading + (m.tool === 'rear' ? 2.54 : .90); cam.hold = 4; }
    notice(m.tool === 'rear' ? 'Braço traseiro selecionado. As patolas vão descer.' : 'Pá dianteira selecionada. As patolas vão recolher.');
    updateHUD();
  }
  function ignition(){
    if(!playing||paused||onFoot)return;
    const running=Sim.ignition(); dirty=true;
    if(running)startAudio();else silence();
    notice(running?'Motor ligado.':Sim.active().fuel&&Sim.active().oil?'Motor desligado.':'Verifique combustível e óleo.');
    updateHUD();
  }
  function service(){
    if(!playing||paused)return;
    const v=Sim.active(),pos=onFoot?Walker.pos():v;
    const q=World.zones.contract,near=Math.hypot(pos.x-q.x,pos.z-q.z)<=q.r;
    if(near&&!Obra.state().active){
      if(!onFoot&&Math.abs(v.speed)>.20){notice('Pare junto à placa para aceitar a obra.');return;}
      Obra.accept(pos);notice('Obra aceita • siga as estacas até a Vila Serra.');
    }else if(!onFoot&&v.type==='pickup')notice(Sim.service());
    else notice('Aproxime-se da placa OBRA para aceitar o contrato.');
    dirty=true;save();updateHUD();
  }
  function cycleCamera() {
    if (!playing || onFoot) return;
    cam.kind = (cam.kind + 1) % cameraNames.length; cam.snap = true; updateHUD();
  }
  function toggleSound() {
    sounds = !sounds;
    if (sounds && playing) startAudio(); else silence();
    try { localStorage.setItem('terrabrava.som', sounds ? '1' : '0'); } catch (_) {}
    updateHUD(); return sounds;
  }
  function setStick(side, x, y) {
    if (playing && !paused && sticks[side]) { sticks[side][0] = clamp(Number(x) || 0, -1, 1); sticks[side][1] = clamp(Number(y) || 0, -1, 1); }
  }
  function pressed(positive, negative) { return Number(keys.has(positive)) - Number(keys.has(negative)); }
  function collectInput(m, pad) {
    const drives = ['bike','pickup'].includes(m.type) || mode === 'drive' || m.type === 'truck' || m.type === 'grader' || (m.type === 'back' && m.tool === 'front');
    const leftX = sticks.left[0] + pad.leftX, leftY = sticks.left[1] + pad.leftY;
    const rightX = sticks.right[0] + pad.rightX, rightY = sticks.right[1] + pad.rightY;
    const axis = value => clamp(value, -1, 1);
    const forward = pressed('KeyW','KeyS') + pressed('ArrowUp','ArrowDown');
    const steer = pressed('KeyD','KeyA') + pressed('ArrowRight','ArrowLeft');
    if (onFoot) return {x:axis(steer+leftX), y:axis(forward+leftY), lookX:axis(rightX), lookY:axis(rightY)};
    const hydraulic = value => axis(value) * (inverted ? -1 : 1);
    return {
      drive: axis(forward + (m.type==='exc'?0:pad.triggers) + (drives ? sticks.left[1] : 0)),
      leftTrack:pad.leftTrack,rightTrack:pad.rightTrack,trackControl:m.type==='exc'&&!!(pad.leftTrack||pad.rightTrack),
      turn: axis(steer + pad.steer + (drives ? sticks.left[0] : 0) + (m.type!=='exc'&&drives?pad.leftX:0)),
      leftX: hydraulic(pressed('KeyH','KeyF') + ((drives?0:sticks.left[0])+(m.type==='exc'||!drives?pad.leftX:0))),
      leftY: hydraulic(pressed('KeyT','KeyG') + ((drives?0:sticks.left[1])+(m.type==='exc'||!drives?pad.leftY:0))),
      rightX: (m.type==='exc'||m.type==='back'?axis:hydraulic)(pressed('KeyL','KeyJ') + rightX),
      rightY: hydraulic(pressed('KeyI','KeyK') + rightY),
      brake: footBrake || keys.has('Space') || pad.brake, mode:m.type==='exc'?'work':mode
    };
  }
  function updateHUD() {
    if (!playing || !window.UI) return;
    const m=Sim.active(), obj=Sim.objective(), pos=onFoot?Walker.pos():m;
    const names={exc:'Escavadeira',back:'Retroescavadeira',grader:'Motoniveladora',truck:'Caminhão',bike:'Moto',pickup:'Picape'};
    const near=onFoot && Walker.enterable(Sim.all());
    const machines=Sim.all().map(v=>({type:v.type,x:v.x,z:v.z,heading:v.heading}));
    if(onFoot) machines.push({type:'person',x:pos.x,z:pos.z,heading:pos.heading});
    const work=Obra.state(),q=World.zones.contract;
    const nearSite=Math.hypot(pos.x-q.x,pos.z-q.z)<=q.r;
    if(work.active){
      obj.progress=work.count/work.total;obj.objective=work.next?'Estrada para a Vila Serra':'Estrada concluída';
      obj.hint=work.next?work.count+'/'+work.total+' m medidos • próximo trecho a '+Math.round(Math.hypot(pos.x-work.next.x,pos.z-work.next.z))+' m. Lâmina baixa entre as estacas.':'Obra paga integralmente • operação livre.';
    }else if(nearSite){
      obj.objective='Obra disponível • R$ 1.250';obj.hint='Aceite aqui. A patrol recebe R$ 25 por metro nivelado.';obj.progress=0;
    }
    if(!work.active&&!nearSite&&obj.stage===0){
      obj.hint+=' • Contrato da estrada na placa OBRA, junto à patrol.';
    }
    UI.hud({running:m.running,fuel:m.fuel,oil:m.oil,diesel:m.dieselCargo,oilCargo:m.oilCargo,work,nearSite,type:m.type,mode,tool:m.tool,onFoot,inverted,nearMachine:near?names[near.type]:null,
      speed:Math.abs(m.speed)*3.6, load:m.load,capacity:m.capacity,camera:cameraNames[cam.kind],sound:sounds,rpm:Math.round(m.rpm),
      ...obj,map:{work,machines,zones:World.zones,onFoot,heading:pos.heading,x:pos.x,z:pos.z}});
  }

  function getCamera(m, dt) {
    if (cam.kind === 2 && Machines.view) {
      const v = Machines.view(m.model, m);
      if (v && v.eye && v.target) return [v.eye, v.target, 68];
    }
    const heading = m.heading, pivot = [m.x, m.y + 1.60, m.z];
    const tip = Machines.tip(m.model);
    let az = cam.yaw, el = cam.pitch, distance = 11.9;
    const aspect = Math.max(.35, canvas.clientWidth / Math.max(1, canvas.clientHeight));
    cam.hold = Math.max(0, cam.hold - dt);
    if (cam.kind === 0) {
      if (Math.abs(m.speed) > .45 && cam.hold === 0) cam.yaw = steerAngle(cam.yaw, heading + Math.PI, ease(.95, dt));
      az = cam.yaw;
      const look = m.type === 'exc' ? (aspect < .9 ? .38 : .26) : m.type === 'back' && m.tool === 'rear' ? .17 : .06;
      pivot[0] = mix(pivot[0], tip[0], look); pivot[2] = mix(pivot[2], tip[2], look);
      distance = m.type === 'grader' || m.type === 'truck' ? 13.0 : 12.1;
    } else if (cam.kind === 1) {
      az = heading + (m.type === 'exc' ? m.slew : m.type === 'back' && m.tool === 'rear' ? m.slew + Math.PI : 0) - 1.48;
      el = .32;
      pivot[0] = mix(m.x, tip[0], .64); pivot[2] = mix(m.z, tip[2], .64);
      pivot[1] = clamp(mix(m.y + 1.9, tip[1] + .3, .6), m.y + .65, m.y + 6);
      distance = m.type === 'truck' ? 10.2 : 8.2;
    } else {
      const front = G.worldPoint(m.model.root,[0,3.1,1.0]), far = G.worldPoint(m.model.root,[0,2.6,11]);
      return [front, far, 67];
    }
    distance *= cam.zoom * (aspect < 1.18 ? Math.min(1.93, 1.18 / aspect) : 1);
    const v = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    const eye = pivot.map((p, i) => p + v[i] * distance);
    // Levanta a linha de visão sobre as encostas entre o alvo e a câmera.
    for (let k = 2; k <= 8; k++) {
      const t = k / 8, x = mix(pivot[0], eye[0], t), z = mix(pivot[2], eye[2], t);
      let clearance = World.height(x, z) + .55;
      if (t >= .375) {
        for (const other of Sim.all()) {
          if (other === m) continue;
          const dx = x-other.x, dz = z-other.z, si=Math.sin(other.heading), co=Math.cos(other.heading);
          const [len,wid]=chassisSize[other.type];
          if (Math.abs(dx*co-dz*si)<wid*.5+.16 && Math.abs(dx*si+dz*co)<len*.5+.16)
            clearance = Math.max(clearance, other.y+3.25);
        }
      }
      const lineY = mix(pivot[1], eye[1], t);
      eye[1] += Math.max(0, clearance - lineY) / t;
    }
    return [eye, pivot, aspect < .9 ? 50 : 45];
  }
  const chassisSize = {exc:[3.7,2.6], back:[4.0,2.15], grader:[6.55,2.15], truck:[6.65,2.35],bike:[2.1,.65],pickup:[4.5,1.9]};
  let shadows = [];
  function contactShadows() {
    if (!shadows.length) shadows = Sim.all().map(v => ({x:v.x,z:v.z,heading:v.heading,length:chassisSize[v.type][0],width:chassisSize[v.type][1]}));
    Sim.all().forEach((v,i) => { shadows[i].x=v.x; shadows[i].z=v.z; shadows[i].y=World.height(v.x,v.z); shadows[i].heading=v.heading; });
    return shadows;
  }
  function draw(dt) {
    const m = Sim.active(), walkView=onFoot?Walker.view():null;
    const view=walkView?[walkView.eye,walkView.target,58]:getCamera(m,dt);
    if(onFoot) guide.root.visible=false; else updateLandingGuide(m);
    const f = cam.snap || cam.kind === 2 ? 1 : ease(8, dt);
    cam.snap = false;
    for (let j = 0; j < 3; j++) { cam.eye[j] = mix(cam.eye[j], view[0][j], f); cam.target[j] = mix(cam.target[j], view[1][j], f); }
    const maxRatio = tier === 2 ? 0.85 : tier === 1 ? 1.08 : 1.55;
    G.draw(root, cam.eye, cam.target, {fov: view[2], pixelRatio: Math.min(window.devicePixelRatio || 1, maxRatio), shadows: tier < 2, shadowRange: 32, contactShadows: contactShadows()});
  }

  function loop(now) {
    frame = 0;
    if (!playing || paused || document.hidden || contextLost) return;
    const elapsed = lastTime ? Math.max(0, (now - lastTime) / 1000) : 1 / 60;
    lastTime = now;
    if (elapsed > .045 && elapsed < .8) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - .24);
    if (slowFrames > 24 && tier < 2) { tier++; slowFrames = 0; }
    const dt = Math.min(elapsed, .10);
    const pad = Pad.poll();
    if (pad.interact) interact();
    if (pad.mode) setMode(mode === 'drive' ? 'work' : 'drive');
    if (pad.camera) cycleCamera();
    if (pad.ignition) ignition();
    if (pad.service) service();
    if (pad.tool) toggleTool();
    const m=Sim.active(), input=collectInput(m,pad);
    bank = Math.min(.115, bank + dt);
    while (bank >= 1 / 60) {
      Sim.update(1 / 60, onFoot ? {brake:true} : input);
      if(onFoot) Walker.update(1 / 60,input,Sim.all());
      bank -= 1 / 60;
    }
    World.flush();
    contact(m, dt); if (!onFoot && m.running) audioStep(input, m, dt);else silence();
    if (Math.abs(m.speed) > .01 || Object.values(input).some(v => typeof v === 'number' && Math.abs(v) > .01)) dirty = true;
    hudClock += dt; saveClock += dt;
    if (hudClock >= .12) { hudClock = 0; updateHUD(); }
    if (saveClock >= 5.0) { saveClock = 0; save(); }
    draw(dt);
    requestFrame();
  }

  const keyCodes = new Set(['KeyW','KeyS','KeyA','KeyD','KeyI','KeyK','KeyJ','KeyL','KeyF','KeyH','KeyT','KeyG','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyC','KeyM','KeyX','KeyE','KeyR','KeyV']);
  window.addEventListener('keydown', e => {
    if (!playing || paused || e.metaKey || e.ctrlKey || e.altKey || !keyCodes.has(e.code)) return;
    if (e.code === 'Space' && e.target instanceof HTMLButtonElement && !e.repeat) e.target.blur();
    e.preventDefault(); keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'KeyE') interact();
    if (e.code === 'KeyR') ignition();
    if (e.code === 'KeyV') service();
    if (e.code === 'KeyM') garage();
    if (e.code === 'KeyC') cycleCamera();
    if (e.code === 'KeyX') toggleTool();
  });
  window.addEventListener('keyup', e => { keys.delete(e.code); });
  function pairDistance() {
    const pair = [...fingers.values()];
    return pair.length < 2 ? 0 : Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
  }
  canvas.addEventListener('pointerdown', e => {
    if (!playing || paused || (e.pointerType === 'mouse' && e.button !== 0)) return;
    fingers.set(e.pointerId, {x:e.clientX,y:e.clientY}); canvas.setPointerCapture(e.pointerId);
    if (fingers.size === 2) pinch = pairDistance();
  });
  canvas.addEventListener('pointermove', e => {
    const old = fingers.get(e.pointerId); if (!old || !playing || paused) return;
    fingers.set(e.pointerId, {x:e.clientX,y:e.clientY});
    if (onFoot) { Walker.rotate(e.clientX-old.x,e.clientY-old.y); return; }
    if (fingers.size === 2) {
      const d = pairDistance(); if (d > 5 && pinch > 5) cam.zoom = clamp(cam.zoom * pinch / d, .65, 2.1); pinch = d;
    } else if (cam.kind === 0) {
      cam.yaw -= (e.clientX - old.x) * .007; cam.pitch = clamp(cam.pitch + (e.clientY - old.y) * .006, .05, 1.25); cam.hold = 4;
    }
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(evt => canvas.addEventListener(evt, e => { fingers.delete(e.pointerId); pinch = null; }));
  canvas.addEventListener('wheel', e => {
    if (!playing || paused || cam.kind === 2) return; e.preventDefault();
    cam.zoom = clamp(cam.zoom * Math.exp(clamp(e.deltaY, -120, 120) * .0015), .65, 2.1);
  }, {passive:false});
  window.addEventListener('blur', () => { clearInput(); silence(); save(); });
  window.addEventListener('pagehide', () => { clearInput(); if (playing) dirty = true; save(); silence(); });
  document.addEventListener('visibilitychange', () => {
    clearInput(); lastTime = 0; bank = 0;
    if (document.hidden) { silence(); if (playing) dirty = true; save(); cancelAnimationFrame(frame); frame = 0; }
    else requestFrame();
  });
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); contextLost = true; save(); silence(); clearInput();
    if (playing) { playing = false; cancelAnimationFrame(frame); frame = 0; UI.garage(selected); }
    notice('A placa gráfica pausou o cenário. Reabra o jogo para continuar o turno salvo.');
  });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  try { sounds = localStorage.getItem('terrabrava.som') !== '0'; } catch (_) {}
  window.Game = {start, ignition,service, garage, interact, toggleInversion, isInverted:()=>inverted, setMode, setStick, toggleTool, cycleCamera, toggleSound, setBrake(value) { footBrake = !!value; }, pause};
})();

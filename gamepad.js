/* Terra Brava · controles com mapeamento padrão da Gamepad API */
(() => {
  'use strict';

  const neutral = Object.freeze({
    leftX: 0, leftY: 0, rightX: 0, rightY: 0, triggers: 0, leftTrack:0,rightTrack:0,steer: 0,
    brake: false, interact: false, mode: false, camera: false, tool: false, connected: false
  });
  const zone = .16;
  let previous = null;
  let selected = null;
  let nav = 0;
  let frame = 0;
  let searchTimer = 0;
  const garage = document.getElementById('garage');
  const fleet = document.getElementById('fleetList');
  const startButton = document.getElementById('start');

  function reset() {
    previous = null;
    selected = null;
    nav = 0;
  }
  function canRead() {
    const focused = typeof document.hasFocus !== 'function' || document.hasFocus();
    return !document.hidden && focused;
  }
  function stick(x, y) {
    const h = Number.isFinite(x) ? x : 0;
    const v = Number.isFinite(y) ? -y : 0;
    const length = Math.hypot(h, v);
    if (length <= zone) return [0, 0];
    const scale = (Math.min(length, 1) - zone) / ((1 - zone) * length);
    return [h * scale, v * scale];
  }
  function value(button) {
    if (typeof button === 'number') return Math.min(1, Math.max(0, button));
    if (button && Number.isFinite(button.value)) return Math.min(1, Math.max(0, button.value));
    return button?.pressed ? 1 : 0;
  }
  function poll() {
    nav = 0;
    if (!canRead() || typeof navigator.getGamepads !== 'function') {
      reset();
      return neutral;
    }
    let devices;
    try { devices = navigator.getGamepads(); }
    catch (_) { reset(); return neutral; }
    const valid = p => p && p.connected !== false && p.mapping === 'standard';
    let pad = Array.from(devices || []).find(p => valid(p) && p.index === selected);
    if (!pad) pad = Array.from(devices || []).find(valid);
    if (!pad) { reset(); return neutral; }
    if (pad.index !== selected) previous = null;
    selected = pad.index;

    const pressed = i => !!pad.buttons[i]?.pressed || value(pad.buttons[i]) > .52;
    let buttons = 0;
    for (const i of [0,1,2,3,8,9,10,11,12,13,14,15]) {
      if (pressed(i)) buttons |= 1 << i;
    }
    const down = previous === null ? 0 : buttons & ~previous;
    previous = buttons;
    const edge = i => !!(down & (1 << i));
    nav = Number(edge(15) || edge(13)) - Number(edge(14) || edge(12));
    const [leftX, leftY] = stick(pad.axes[0], pad.axes[1]);
    const [rightX, rightY] = stick(pad.axes[2], pad.axes[3]);
    return {
      leftX, leftY, rightX, rightY,
      triggers: value(pad.buttons[7]) - value(pad.buttons[6]),
      leftTrack:value(pad.buttons[4])-value(pad.buttons[6]),
      rightTrack:value(pad.buttons[5])-value(pad.buttons[7]),
      back:edge(1), horizontal:Number(edge(15))-Number(edge(14)),
      steer: Number(pressed(15)) - Number(pressed(14)),
      brake: pressed(1), interact: edge(0), mode: edge(10), camera: edge(11), tool: edge(3), ignition:edge(2),service:edge(9), connected: true
    };
  }
  function stopMenu() {
    if (frame) cancelAnimationFrame(frame);
    if (searchTimer) clearTimeout(searchTimer);
    frame = searchTimer = 0;
  }
  function menuActive() {
    return canRead() && (document.querySelector('dialog[open]')||!document.getElementById('cover').hidden||!garage.hidden);
  }
  function requestMenu() {
    searchTimer = 0;
    if (menuActive() && !frame) frame = requestAnimationFrame(menuFrame);
  }
  function menuFrame() {
    frame = 0;
    if (!menuActive()) return;
    const input = poll();
    if (!input.connected) {
      searchTimer = setTimeout(requestMenu, 650);
      return;
    }
    const dialog=document.querySelector('dialog[open]');
    const cover=document.getElementById('cover');
    if(dialog){
      const items=Array.from(dialog.querySelectorAll('button,select')).filter(el=>!el.disabled&&el.offsetWidth);
      const focused=document.activeElement,index=items.indexOf(focused);
      if(input.back){dialog.close();}
      else if(input.horizontal&&focused?.tagName==='SELECT'){
        focused.selectedIndex=(focused.selectedIndex+input.horizontal+focused.length)%focused.length;
        focused.dispatchEvent(new Event('change'));
      }else if(nav&&items.length)items[(index+nav+items.length)%items.length].focus();
      else if(input.interact&&focused?.tagName==='BUTTON')focused.click();
    }else if(!cover.hidden){
      const items=[document.getElementById('coverStart'),document.getElementById('coverSettings')];
      let index=items.indexOf(document.activeElement);
      if(nav){index=index<0?(nav>0?1:0):1-index;items[index].focus();}
      if(input.interact)items[Math.max(0,index)].click();
    }else{
      if(nav && fleet && !startButton.disabled){
        const cards=Array.from(fleet.querySelectorAll('button[data-machine]'));
        const index=cards.findIndex(card=>card.getAttribute('aria-pressed')==='true');
        if(cards.length){const card=cards[(index+nav+cards.length)%cards.length];card.click();card.focus();}
      }
      if(input.interact && !startButton.disabled)startButton.click();
    }
    requestMenu();
  }
  function restart() {
    stopMenu();
    reset();
    requestMenu();
  }
  function suspend() { stopMenu(); reset(); }
  window.Pad = {poll, reset};
  if (typeof navigator.getGamepads !== 'function') return;
  window.addEventListener('gamepadconnected', restart);
  window.addEventListener('gamepaddisconnected', restart);
  window.addEventListener('focus', restart);
  window.addEventListener('blur', suspend);
  window.addEventListener('pagehide', suspend);
  window.addEventListener('pageshow', restart);
  document.addEventListener('visibilitychange', restart);
  // No segundo plano e fora da garagem, apenas o loop ativo do jogo lê o controle.
  const observer = new MutationObserver(restart);
  observer.observe(document.getElementById('cover'),{attributes:true,attributeFilter:['hidden']});
  if (garage) observer.observe(garage, {attributes: true, attributeFilter: ['hidden']});
  for (const modal of document.querySelectorAll('dialog')) {
    observer.observe(modal, {attributes: true, attributeFilter: ['open']});
  }
  requestMenu();
})();

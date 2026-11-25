/* Medição do contrato. Cada metro tem orçamento próprio e recebe crédito apenas
   pelo volume redistribuído pela lâmina dentro da faixa demarcada. */
window.Obra = (() => {
  'use strict';
  const start=14, length=50, centerZ=-16, price=25, required=.045;
  let active=false, measured=new Float64Array(length);
  const paid=()=>measured.reduce((n,v)=>n+Number(v>=required)*price,0);
  function accept(pos) {
    const q=World.zones.contract;
    if(Math.hypot(pos.x-q.x,pos.z-q.z)>q.r)return false;
    active=true;return true;
  }
  function measure(x,z,moved) {
    const index=Math.floor(x-start);
    if(!active||index<0||index>=length||Math.abs(z-centerZ)>2||moved<=0)return;
    measured[index]=Math.min(required,measured[index]+moved);
  }
  function state(){
    const balance=paid(),count=balance/price,next=measured.findIndex(v=>v<required);
    return {active,balance,count,total:length,next:next<0?null:{x:start+next+.5,z:centerZ},
      start,end:start+length,z:centerZ,done:Array.from(measured,v=>v>=required)};
  }
  function restore(s){
    if(!s||typeof s.active!=='boolean'||!Array.isArray(s.measured)||s.measured.length!==length||
       s.measured.some(v=>!Number.isFinite(v)||v<0||v>required))return false;
    active=s.active;measured=Float64Array.from(s.measured);return true;
  }
  return {accept,measure,state,restore,snapshot:()=>({active,measured:Array.from(measured)})};
})();

// bots.js – heuristic Rentz bot (loaded before the game script; the game falls back to random bots without it).
// A bot sees only what a real player sees: its hand, the trick/layout, and the cards already played.
// Interface:  smartBot.choose(availableContracts, R, {hand,tot,seat})  and  smartBot.move(obs, legalCards, R)
const smartBot=(()=>{
  const isKH=c=>c.r===13&&c.s===2, is10C=c=>c.r===10&&c.s===0, key=c=>c.s*20+c.r;
  const ALL=[];for(let s=0;s<4;s++)for(let r=7;r<=14;r++)ALL.push({s,r});
  const unseen=o=>{const seen=new Set([...o.hand,...o.played].map(key));return ALL.filter(c=>!seen.has(key(c)))};
  // points a player gets for capturing card c under contract k (negative = bad). Uses the SC table from the game.
  function val(c,k){let v=0;
    if(k==='kingHearts'||k==='totals')v+=isKH(c)?SC.kingHearts:0;
    if(k==='queens'||k==='totals')v+=c.r===12?SC.queens:0;
    if(k==='diamonds'||k==='totals')v+=c.s===1?SC.diamonds:0;
    if(k==='tenClubs'||k==='totals')v+=is10C(c)?SC.tenClubs:0;
    return v}
  const base=k=>({tricks:SC.tricks,totals:SC.tricks,whist:SC.whist})[k]||0;      // points per trick won
  const neg=k=>k!=='whist'&&k!=='tenClubs';                                       // contracts where taking things hurts

  // ---- playing a card in a trick contract ----
  function trickMove(o,legal,R){
    const k=o.contract,un=unseen(o),tr=o.trick||[],later=3-tr.length,n=o.hand.length;
    const onTable=tr.reduce((a,t)=>a+val(t.c,k),0);
    let best=null,bs=-1e9;
    for(const c of legal){
      const led=tr.length?tr[0].c.s:c.s,follows=c.s===led;
      const curHi=tr.filter(t=>t.c.s===led).reduce((m,t)=>Math.max(m,t.c.r),0);
      const higher=un.filter(u=>u.s===led&&u.r>c.r).length;
      // chance nobody still to play holds a higher card of the led suit
      const pWin=follows&&c.r>curHi?Math.pow(Math.max(0,1-later*n/Math.max(1,un.length)),higher):0;
      const su=un.filter(u=>u.s===led),avg=su.length?su.reduce((a,u)=>a+val(u,k),0)/su.length:0;
      const gain=val(c,k)+onTable+later*avg+base(k);       // what winning this trick is worth to me
      const danger=-Math.min(0,val(c,k));                  // penalty card I'd like to give away
      let u=pWin*gain+(1-pWin)*danger*0.6;
      u+=(neg(k)?1:-1)*0.05*c.r*(1-pWin);                  // shed high cards in negative games, low ones in positive games
      u+=R()*0.001;
      if(u>bs){bs=u;best=c}
    }
    return best}

  // ---- playing a card in Rentz (domino-like): unlock my own cards, avoid unlocking the others' ----
  function rentzMove(o,legal,R){
    const L=o.layout||{},un=unseen(o);let best=null,bs=-1e9;
    for(const c of legal){
      const old=L[c.s],lo=old?Math.min(old.lo,c.r):c.r,hi=old?Math.max(old.hi,c.r):c.r;
      const mine=o.hand.filter(h=>h!==c&&h.s===c.s&&(h.r===lo-1||h.r===hi+1)).length;
      const theirs=[lo-1,hi+1].filter(r=>r>=7&&r<=14&&!o.hand.some(h=>h.s===c.s&&h.r===r)&&un.some(u=>u.s===c.s&&u.r===r)).length;
      const u=2*mine-theirs+0.1*o.hand.filter(h=>h.s===c.s).length+R()*0.01;
      if(u>bs){bs=u;best=c}
    }
    return best}

  // ---- choosing a contract: estimate my own points, compare with what the others should average ----
  const EX=k=>({kingHearts:SC.kingHearts,queens:4*SC.queens,diamonds:8*SC.diamonds,tenClubs:SC.tenClubs,tricks:8*SC.tricks,whist:8*SC.whist,
    totals:SC.kingHearts+4*SC.queens+8*SC.diamonds+SC.tenClubs+8*SC.tricks,rentz:SC.rentz.reduce((a,b)=>a+b)})[k];
  function est(k,hand){
    const has=c=>hand.some(h=>h.s===c.s&&h.r===c.r),len=s=>hand.filter(h=>h.s===s).length;
    if(k==='rentz'){const j=hand.filter(c=>c.r===11).length;
      const pairs=hand.filter(c=>hand.some(h=>h.s===c.s&&h.r===c.r+1)).length;
      return 25+9*(j-1)+2*pairs}
    let m=0;
    for(const c of ALL){const v=val(c,k);if(!v)continue;
      if(has(c)){const l=len(c.s),risk=l<=1?1:l<=2?.8:l<=3?.5:.3;m+=v<0?v*risk*(c.r>=11?1:.55):v*.5}
      else m+=v*.22}                                       // cards held by others land on me now and then
    const b=base(k);
    if(b){const T=hand.reduce((a,c)=>a+(c.r===14?.85:c.r===13?.55:c.r===12?.3:c.r===11?.15:c.r===10?.07:.02),0);m+=b*T}
    return m}

  return{
    choose(avail,R,ctx){
      if(!ctx||!ctx.hand)return avail[Math.floor(R()*avail.length)];
      let best=avail[0],bs=-1e9;
      for(const k of avail){const adv=(4*est(k,ctx.hand)-EX(k))/3+R()*1.5;if(adv>bs){bs=adv;best=k}}
      return best},
    move(o,legal,R){return (o.contract==='rentz'?rentzMove:trickMove)(o,legal,R)||legal[Math.floor(R()*legal.length)]}
  };
})();

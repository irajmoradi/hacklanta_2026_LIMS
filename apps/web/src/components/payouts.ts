import type {CompetitionDetail,PayoutMode} from '../api/types';
export function parseSplit(value:string):number[] {
  const parts=value.split(/[\/,]/).map(s=>s.trim());
  if(parts.length<1||parts.length>10||parts.some(s=>!/^\d+(?:\.\d{1,2})?$/.test(s)))throw new Error('Enter 1-10 percentages with at most two decimals.');
  const bps=parts.map(s=>Math.round(Number(s)*100));
  if(bps.some(n=>n<=0)||bps.reduce((a,b)=>a+b,0)!==10000)throw new Error('Positive percentages must total 100%.');
  return bps;
}
export function allocate(total:bigint,scores:bigint[],mode:PayoutMode,split:number[]=[]):bigint[]{
  const order=scores.map((s,i)=>({s,i})).filter(x=>x.s>0n).sort((a,b)=>a.s===b.s?a.i-b.i:a.s>b.s?-1:1);
  const weights=scores.map(()=>0n);
  if(!order.length)return weights;
  if(mode==='winner_take_all')weights[order[0].i]=1n;
  else if(mode==='proportional')scores.forEach((s,i)=>weights[i]=s);
  else order.slice(0,split.length).forEach((x,i)=>weights[x.i]=BigInt(split[i]));
  const sum=weights.reduce((a,b)=>a+b,0n);if(!sum)return weights;
  const payouts=weights.map(w=>total*w/sum);let dust=total-payouts.reduce((a,b)=>a+b,0n);
  weights.forEach((w,i)=>{if(dust&&w){payouts[i]++;dust--;}});return payouts;
}
export const payoutLabel=(mode?:PayoutMode)=>({winner_take_all:'Winner takes all',proportional:'Proportional to score',ranked:'Ranked split'}[mode??'winner_take_all']);
export function localProjection(c:CompetitionDetail){
  const scores=c.participants.map(p=>BigInt(Math.floor(c.entries.filter(e=>e.user_id===p.user_id&&e.decision==='confirmed').reduce((s,e)=>s+(c.scoring==='scoreboard'?(e.value??0):e.points),0)*1e6)));
  const entry=BigInt(c.entry_coins||c.entry_lamports||0),total=entry*BigInt(scores.length),fee=total*BigInt(c.auditor_fee_bps||0)/10000n;
  const amounts=allocate(total-fee,scores,c.payout_mode??'winner_take_all',c.ranked_bps);
  return {currency:c.entry_coins?'coins':'lamports',fee:fee.toString(),refund:!scores.some(s=>s>0n),payouts:c.participants.map((p,i)=>({user_id:p.user_id,amount:amounts[i].toString()}))};
}

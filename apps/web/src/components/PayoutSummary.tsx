import type {CompetitionDetail,Village} from '../api/types';
import {localProjection,payoutLabel} from './payouts';
export function PayoutSummary({competition:c,village}:{competition:CompetitionDetail;village:Village}){
  const p=c.projected_payouts??localProjection(c);
  return <section aria-label="Payout terms"><strong>{payoutLabel(c.payout_mode)}{c.payout_mode==='ranked'?` - ${(c.ranked_bps??[]).map(n=>n/100).join(' / ')}%`:''}</strong><p>Terms fixed at creation. Equal scores favor earlier joins. Empty ranked places redistribute proportionally; remainder goes in join order.</p><h4>Projected payouts</h4>{!p.payouts.length?<p>Join and submit confirmed progress to see projections.</p>:p.payouts.map(r=><p key={r.user_id}>{village.villagers.find(v=>v.user_id===r.user_id)?.display_name??'Villager'}: {p.currency==='lamports'?`${Number(r.amount)/1e9} devnet SOL`:`${r.amount} coins`}</p>)}{p.refund&&<small>No positive scores yet. SOL refunds open 72 hours after deadline.</small>}</section>;
}

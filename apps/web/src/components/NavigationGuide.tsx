import { Dialog } from './shared';
import './friends.css';

export const places = [
  {id:'checkin', title:'Check in', copy:'Share a small update or progress on your goal.', key:'C'},
  {id:'goal', title:'Goals', copy:'Pick your goal for the week and track your progress.', key:'I'},
  {id:'friends', title:'Friends', copy:'See who could use a cheer. Send a wave, message, or challenge.', key:'B'},
  {id:'accomplishments', title:'Accomplishments', copy:'See finished goals and rewards. Leave a reaction to celebrate.', key:'Alt+A'},
  {id:'shop', title:'Shop', copy:'Spend earned coins on clothes, pets, and things for your house.', key:'Alt+S'},
  {id:'house', title:'Houses', copy:'Open your house, go inside, or visit a friend through Friends.', key:''},
  {id:'mayor', title:'Mayor', copy:'Read village updates and join the current events.', key:'M'},
  {id:'compete', title:'Colosseum', copy:'Start a friendly challenge or join one with your friends.', key:'P'},
  {id:'library', title:'Library', copy:'Choose Studying in Settings to send your avatar to the library study tables.', key:''},
] as const;
export type Place = typeof places[number]['id'];
export function NavigationGuide({onClose,onGo,onTour}: {onClose: () => void; onGo: (place: Place) => void; onTour: () => void}) {
  return <Dialog title="What can I do here?" eyebrow="WELCOME TO THE VILLAGE" onClose={onClose} wide>
    <p>Start with a check-in, then see how your friends are doing. You can return here with Help.</p>
    <button className="button secondary" onClick={onTour}>Start the tour</button>
    <div className="guide-grid">{places.map(p => <article className="guide-card" key={p.id}><h3>{p.title}</h3><p>{p.copy}</p>{p.key && <p className="help-text">Shortcut: {p.key}</p>}<button className="button secondary" aria-label={`Take me to ${p.title}`} onClick={() => onGo(p.id)}>Take me there</button></article>)}</div>
  </Dialog>;
}

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { places, type Place } from './NavigationGuide';
export const tourSteps = places.map(p => [p.title, p.copy]);
export function Tour({ step, onStep, onClose, featuredName, onGo }: { featuredName: string; onGo: (place: Place) => void; step: number; onStep: (step: number) => void; onClose: () => void }) {
  // Native dialogs enter the browser top layer. Keep the guide inside that layer when open.
  const [host, setHost] = useState<Element>(document.body);
  useEffect(() => {
    const update = () => { const dialogs = document.querySelectorAll('dialog[open]'); setHost(dialogs[dialogs.length - 1] ?? document.body); };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open'] });
    return () => observer.disconnect();
  }, []);
  return createPortal(<section className="tour-guide" aria-label="Village tour"><small>THREE-MINUTE TOUR · {step + 1} / {tourSteps.length}</small><h3>{tourSteps[step][0]}</h3><p>{tourSteps[step][1].replace('{name}', featuredName)}</p><div><button className="button secondary" onClick={() => onGo(places[step].id)}>Take me there</button><button className="text-button" onClick={onClose}>End tour</button><button className="button secondary" disabled={step === 0} onClick={() => onStep(step - 1)}>Back</button><button className="button primary" onClick={() => step === tourSteps.length - 1 ? onClose() : onStep(step + 1)}>{step === tourSteps.length - 1 ? 'Finish' : 'Next'}</button></div></section>, host);
}

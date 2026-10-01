import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Basket, CalendarDots, Carrot, DeviceMobile, DownloadSimple, Package, PencilSimpleLine, ShieldCheck, UploadSimple, type Icon } from '@phosphor-icons/react';
import { setSetting } from '../data/actions';
import { loadStarterPack } from '../data/starter';
import { todayKey } from '../domain/dates';
import { useInstallPrompt } from '../ui/install';

const STEPS = 3;

function Point({ icon: I, color, title, text }: { icon: Icon; color: string; title: string; text: string }) {
  return (
    <div className="onb-point">
      <span className="onb-point__icon" style={{ color, background: `color-mix(in srgb, ${color} 18%, transparent)` }}>
        <I weight="duotone" />
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="onb-point__title">{title}</span>
        <span className="onb-point__text">{text}</span>
      </span>
    </div>
  );
}

/** First-launch intro (PRD route 11): three screens, then an optional starter pack. */
export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const install = useInstallPrompt();

  useEffect(() => {
    document.getElementById('onb-title')?.focus();
  }, [step]);

  const finish = async (to: string, starter: boolean) => {
    if (busy) return;
    setBusy(true);
    if (starter) await loadStarterPack(todayKey());
    await setSetting('onboarded', true);
    // Asking here, after the user has read why, beats asking silently on boot.
    await navigator.storage?.persist?.().catch(() => false);
    await setSetting('persistAsked', true);
    navigate(to, { replace: true });
  };

  return (
    <div className="app onb">
      <div className="glows" aria-hidden>
        <div className="glow glow--a" style={{ background: 'radial-gradient(circle,rgba(15,157,118,.28),transparent 68%)' }} />
        <div className="glow glow--b" />
      </div>

      <div className="onb__top">
        <div className="onb__dots" aria-label={`Step ${step + 1} of ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} data-on={i === step} />
          ))}
        </div>
        {step < STEPS - 1 && (
          <button type="button" className="onb__skip" onClick={() => setStep(STEPS - 1)}>
            Skip
          </button>
        )}
      </div>

      <main className="onb__body" key={step}>
        {step === 0 && (
          <>
            <div className="onb__hero" aria-hidden>
              <Carrot weight="duotone" />
            </div>
            <h1 id="onb-title" tabIndex={-1} className="onb__title">
              Know what's in the fridge before you shop
            </h1>
            <p className="onb__lead">Fridge Follower plans your meals, tracks your kitchen, and writes the shopping list for you.</p>
          </>
        )}

        {step === 1 && (
          <>
            <h1 id="onb-title" tabIndex={-1} className="onb__title">
              How it works
            </h1>
            <div className="onb__points">
              <Point icon={CalendarDots} color="var(--sapphire-t)" title="Plan five meals a day" text="Breakfast, two snacks, lunch and dinner. Pick a recipe or type anything." />
              <Point icon={Carrot} color="var(--emerald-t)" title="One tap per item" text="Mark items Full, High, Medium, Low or Out. No weighing, no counting." />
              <Point icon={Basket} color="var(--topaz-t)" title="The list writes itself" text="Next week's meals, minus what you already have, grouped by aisle." />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 id="onb-title" tabIndex={-1} className="onb__title">
              Your kitchen stays on this phone
            </h1>
            <div className="onb__points">
              <Point icon={ShieldCheck} color="var(--emerald-t)" title="No account, no server" text="Works offline. Nothing leaves your device." />
              <Point icon={DownloadSimple} color="var(--amethyst-t)" title="Back up now and then" text="Clearing browser data erases it. Settings has a one-tap backup file." />
              {install.canInstall && <Point icon={DeviceMobile} color="var(--citrine)" title="Add it to your home screen" text="It opens like an app and your data is less likely to be cleared." />}
            </div>
            {install.canInstall && (
              <button type="button" className="btn-soft onb__install" onClick={install.prompt}>
                <DeviceMobile weight="duotone" />
                Install app
              </button>
            )}
          </>
        )}
      </main>

      <div className="onb__actions">
        {step < STEPS - 1 ? (
          <button type="button" className="btn-cta" onClick={() => setStep(step + 1)}>
            Next
            <ArrowRight weight="bold" />
          </button>
        ) : (
          <>
            <button type="button" className="btn-cta btn-cta--violet" disabled={busy} onClick={() => finish('/', true)}>
              <Package weight="duotone" size={20} />
              Start with a sample kitchen
            </button>
            <button type="button" className="btn-cta onb__ghost" disabled={busy} onClick={() => finish('/fridge', false)}>
              <PencilSimpleLine weight="duotone" size={20} />
              Start empty
            </button>
            <button type="button" className="onb__link" disabled={busy} onClick={() => finish('/settings', false)}>
              <UploadSimple weight="duotone" />
              I have a backup file
            </button>
          </>
        )}
      </div>
    </div>
  );
}

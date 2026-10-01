import { useNavigate } from 'react-router';
import { Basket, GearSix, Package, PencilSimpleLine, WarningDiamond } from '@phosphor-icons/react';
import { useKitchen, usePlan, useSettings, useShopping, useToday } from '../data/hooks';
import { dayInfo } from '../domain/dates';
import { SLOTS } from '../domain/constants';
import { loadStarterPack } from '../data/starter';
import { toast, useUI } from '../state/ui';
import { IconButton } from '../ui/kit';
import { SlotList } from './SlotList';

export function Today() {
  const navigate = useNavigate();
  const today = useToday();
  const kitchen = useKitchen();
  const plan = usePlan();
  const shop = useShopping();
  const settings = useSettings();
  const set = useUI((s) => s.set);
  const d = dayInfo(today);
  const planned = plan ? SLOTS.filter((sl) => plan.some((e) => e.date === today && e.slot === sl.k)).length : 0;
  const toBuy = shop?.filter((x) => !x.checked).length ?? 0;
  const lowCount = kitchen?.lowItems.length ?? 0;
  const firstRun = kitchen && !kitchen.items.length && !kitchen.recipes.length;

  const starter = async () => {
    const { rec, added } = await loadStarterPack(today);
    toast(`Added ${added.items} items, ${added.recipes} recipes and ${added.meals} meals`, rec.undo);
  };

  return (
    <>
      <header className="page-head">
        <div className="page-head__titles">
          <span className="eyebrow" style={{ color: 'var(--citrine)' }}>
            {d.dowLong}
          </span>
          <h1 className="title">{d.short}</h1>
        </div>
        <div className="page-head__actions">
          <IconButton label="Settings" icon={GearSix} onClick={() => navigate('/settings')} />
        </div>
      </header>
      <main className="scroll" style={{ gap: 12 }}>
        {firstRun && (
          <div className="welcome">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ font: "600 17px var(--display)" }}>Welcome to Fridge Follower</span>
              <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--text-soft)' }}>
                Everything stays on this phone. Start with a sample kitchen, or add your first item.
              </span>
            </div>
            <div className="welcome__row">
              <button type="button" onClick={starter} style={{ background: 'var(--amethyst)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Package weight="duotone" size={18} />
                Starter pack
              </button>
              <button
                type="button"
                onClick={() => useUI.getState().openSheet({ type: 'add', mode: 'inv' })}
                style={{ background: 'rgba(255,255,255,.08)', color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <PencilSimpleLine weight="duotone" size={18} />
                Add an item
              </button>
            </div>
          </div>
        )}
        <div className="stat-row">
          <button
            type="button"
            className="stat"
            onClick={() => {
              set({ lowOnly: true, q: '' });
              navigate('/fridge');
            }}
            style={{ borderColor: 'rgba(214,38,79,.3)', background: 'linear-gradient(160deg,rgba(214,38,79,.24),rgba(214,38,79,.06))' }}
          >
            <span className="stat__icon" style={{ background: 'rgba(214,38,79,.25)', color: 'var(--ruby-t)' }}>
              <WarningDiamond weight="duotone" />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="stat__num">{lowCount}</span>
              <span className="stat__label" style={{ color: '#D9C9D6' }}>
                Low or out
              </span>
            </span>
          </button>
          <button
            type="button"
            className="stat"
            onClick={() => navigate('/shop')}
            style={{ borderColor: 'rgba(227,162,26,.3)', background: 'linear-gradient(160deg,rgba(227,162,26,.22),rgba(227,162,26,.05))' }}
          >
            <span className="stat__icon" style={{ background: 'rgba(227,162,26,.25)', color: 'var(--topaz-t)' }}>
              <Basket weight="duotone" />
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span className="stat__num">{toBuy}</span>
              <span className="stat__label" style={{ color: '#D9D2C2' }}>
                On your list
              </span>
            </span>
          </button>
        </div>
        <div className="progress-row">
          <span className="section-title">Today's meals</span>
          <span className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={5} aria-valuenow={planned}>
            <span style={{ width: `${(planned / 5) * 100}%` }} />
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{planned}/5</span>
        </div>
        <SlotList date={today} kitchen={kitchen} plan={plan} cookDecrements={settings.cookDecrements} />
      </main>
    </>
  );
}

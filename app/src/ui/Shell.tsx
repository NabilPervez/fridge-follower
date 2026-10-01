import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { Basket, CalendarDots, Carrot, CookingPot, Plus, Sun, type Icon } from '@phosphor-icons/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../data/db';
import { useItems, useShopping, useToday } from '../data/hooks';
import { regenerate } from '../state/feedback';
import { JEWEL, rgba, type Jewel } from '../domain/constants';
import { useUI } from '../state/ui';
import { SheetHost } from '../sheets/SheetHost';

const TABS: { to: string; name: string; icon: Icon; j: Jewel }[] = [
  { to: '/', name: 'Today', icon: Sun, j: 'citrine' },
  { to: '/plan', name: 'Plan', icon: CalendarDots, j: 'sapphire' },
  { to: '/recipes', name: 'Recipes', icon: CookingPot, j: 'amethyst' },
  { to: '/fridge', name: 'Fridge', icon: Carrot, j: 'emerald' },
  { to: '/shop', name: 'Shop', icon: Basket, j: 'topaz' },
];

/** Which top-level area a path belongs to. Settings is reached from Today. */
function areaOf(path: string) {
  if (path.startsWith('/plan')) return '/plan';
  if (path.startsWith('/recipes')) return '/recipes';
  if (path.startsWith('/fridge')) return '/fridge';
  if (path.startsWith('/shop')) return '/shop';
  return '/';
}

const ACCENT: Record<string, Jewel> = { '/': 'citrine', '/plan': 'sapphire', '/recipes': 'amethyst', '/fridge': 'emerald', '/shop': 'topaz' };

export function Shell() {
  const { pathname } = useLocation();
  const area = areaOf(pathname);
  const isSettings = pathname.startsWith('/settings');
  const isEditor = pathname === '/recipes/new' || pathname.endsWith('/edit');
  const isRecipeDetail = /^\/recipes\/[^/]+$/.test(pathname) && !isEditor;
  const accent = JEWEL[isSettings ? 'sapphire' : ACCENT[area]];
  const shop = useShopping();
  const toBuy = shop?.filter((x) => !x.checked).length ?? 0;
  const inCart = shop?.some((x) => x.checked) ?? false;
  const openSheet = useUI((s) => s.openSheet);
  const ui = useUI();

  // Build the shopping list the first time there is something in the kitchen,
  // so the Today and tab-bar counts are right before Shop is ever opened.
  const items = useItems();
  const generatedFor = useLiveQuery(async () => ((await db.settings.get('shopGeneratedFor'))?.value as string | undefined) ?? null, [], 'loading');
  const today = useToday();
  const building = useRef(false);
  useEffect(() => {
    if (building.current || !items?.length || generatedFor !== null) return;
    building.current = true;
    void regenerate(today, true).finally(() => (building.current = false));
  }, [items, generatedFor, today]);

  // Close any sheet on navigation.
  useEffect(() => useUI.getState().closeSheet(), [pathname]);

  const fab = isSettings || isEditor || isRecipeDetail ? null : area === '/recipes' ? 'recipes' : area === '/shop' ? (inCart ? null : 'shop') : 'inv';
  const fabJ = JEWEL[fab === 'recipes' ? 'amethyst' : fab === 'shop' ? 'topaz' : 'emerald'];
  const onFab = () => {
    if (fab === 'recipes') openSheet({ type: 'newRecipe' });
    else openSheet({ type: 'add', mode: fab === 'shop' ? 'shop' : 'inv' });
  };

  return (
    <div className="app">
      <div className="glows" aria-hidden>
        <div className="glow glow--a" style={{ background: `radial-gradient(circle,${rgba(accent[0], 0.28)},transparent 68%)` }} />
        <div className="glow glow--b" />
      </div>

      <Outlet />

      {fab && (
        <button
          type="button"
          className="fab"
          aria-label={fab === 'recipes' ? 'New recipe' : fab === 'shop' ? 'Add to list' : 'Quick add'}
          onClick={onFab}
          style={{
            background: `linear-gradient(135deg,${fabJ[1]},${fabJ[0]})`,
            boxShadow: `0 12px 30px ${rgba(fabJ[0], 0.45)},0 4px 10px rgba(0,0,0,.4)`,
          }}
        >
          <Plus weight="bold" />
        </button>
      )}

      {!isEditor && (
        <nav className="tabbar" aria-label="Main">
          {TABS.map((t) => {
            const on = t.to === area;
            const [base, tint] = JEWEL[t.j];
            const I = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                className="tab"
                aria-current={on ? 'page' : undefined}
                style={{ background: on ? rgba(base, 0.18) : 'transparent', color: on ? tint : '#A9A6C4' }}
              >
                <I weight={on ? 'fill' : 'regular'} />
                {t.name}
                {t.to === '/shop' && toBuy > 0 && !on && (
                  <span className="tab__badge" aria-label={`${toBuy} to buy`}>
                    {toBuy}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      )}

      {ui.toast && (
        <div key={ui.toast.id} className={`toast${isEditor ? ' toast--low' : ''}`} role="status">
          <span className="toast__msg">{ui.toast.msg}</span>
          {ui.toast.undo && (
            <button
              type="button"
              onClick={() => {
                const u = ui.toast?.undo;
                ui.hideToast();
                void u?.();
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}

      <SheetHost />
    </div>
  );
}

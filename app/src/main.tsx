import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, redirect, RouterProvider } from 'react-router';
// Self-hosted (PRD §6.2), Latin subsets only to keep the offline cache small.
import '@fontsource/geist/latin-400.css';
import '@fontsource/geist/latin-ext-400.css';
import '@fontsource/geist/latin-500.css';
import '@fontsource/geist/latin-ext-500.css';
import '@fontsource/geist/latin-600.css';
import '@fontsource/geist/latin-ext-600.css';
import '@fontsource/geist/latin-700.css';
import '@fontsource/geist/latin-ext-700.css';
import '@fontsource/space-grotesk/latin-500.css';
import '@fontsource/space-grotesk/latin-ext-500.css';
import '@fontsource/space-grotesk/latin-600.css';
import '@fontsource/space-grotesk/latin-ext-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import '@fontsource/space-grotesk/latin-ext-700.css';
import './styles.css';
import { Shell } from './ui/Shell';
import { Today } from './pages/Today';
import { Plan } from './pages/Plan';
import { Fridge } from './pages/Fridge';
import { Shop } from './pages/Shop';
import { Recipes } from './pages/Recipes';
import { RecipeDetail } from './pages/RecipeDetail';
import { RecipeEditor } from './pages/RecipeEditor';
import { Settings } from './pages/Settings';
import { Onboarding } from './pages/Onboarding';
import { getSetting, setSetting } from './data/actions';
import { db } from './data/db';
import './ui/install';

/**
 * First launch goes to /onboarding. People who already have data (from before
 * onboarding existed, or a restore) are marked onboarded and never see it.
 */
async function onboardingGate() {
  if (await getSetting('onboarded')) return null;
  if ((await db.items.count()) || (await db.recipes.count())) {
    await setSetting('onboarded', true);
    return null;
  }
  return redirect('/onboarding');
}

const router = createBrowserRouter([
  { path: '/onboarding', element: <Onboarding /> },
  {
    element: <Shell />,
    loader: onboardingGate,
    children: [
      { path: '/', element: <Today /> },
      { path: '/plan', element: <Plan /> },
      { path: '/fridge', element: <Fridge /> },
      { path: '/shop', element: <Shop /> },
      { path: '/recipes', element: <Recipes /> },
      { path: '/recipes/new', element: <RecipeEditor /> },
      { path: '/recipes/:id', element: <RecipeDetail /> },
      { path: '/recipes/:id/edit', element: <RecipeEditor /> },
      { path: '/settings', element: <Settings /> },
      { path: '*', element: <Today /> },
    ],
  },
]);

// PRD §5.2: ask for persistent storage once, on first launch.
void (async () => {
  // New users are asked at the end of onboarding instead.
  if ((await getSetting('persistAsked')) || !(await getSetting('onboarded'))) return;
  await setSetting('persistAsked', true);
  await navigator.storage?.persist?.().catch(() => false);
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

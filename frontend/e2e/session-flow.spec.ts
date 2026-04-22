import { test, expect } from '@playwright/test';
import { createUserWithRole, newAuthenticatedApi, newAuthenticatedPage } from './support/helpers';

test('facilitator and player can create, join, start, play, and reveal a scripted session', async ({ browser }) => {
  const facilitator = await createUserWithRole('FACILITATOR', 'facilitator-session');
  const player = await createUserWithRole('PLAYER', 'player-session');

  const facilitatorApi = await newAuthenticatedApi(facilitator);

  const scenariosResponse = await facilitatorApi.get('/api/scenarios');
  expect(scenariosResponse.status(), await scenariosResponse.text()).toBe(200);
  const { scenarios } = await scenariosResponse.json();
  expect(scenarios.length).toBeGreaterThan(0);

  const createResponse = await facilitatorApi.post('/api/sessions', {
    data: {
      scenarioId: scenarios[0].id,
      sessionName: `E2E scripted flow ${Date.now()}`,
      settings: {
        speedBonusEnabled: false,
        showLeaderboard: true,
        showFeedbackImmediately: false,
      },
    },
  });
  expect(createResponse.status(), await createResponse.text()).toBe(201);
  const { session } = await createResponse.json();
  expect(session.id).toBeTruthy();
  expect(session.joinCode).toMatch(/^[A-Z0-9]{6}$/);

  const facilitatorPage = await newAuthenticatedPage(browser, facilitator);
  const playerPage = await newAuthenticatedPage(browser, player);

  try {
    await playerPage.goto(`/join/${session.joinCode}`);
    await playerPage.getByRole('button', { name: 'Join Session' }).click();
    await expect(playerPage).toHaveURL(new RegExp(`/game/${session.id}$`));
    await expect(playerPage.getByText('Waiting for the facilitator to present an inject')).toBeVisible();

    await facilitatorPage.goto(`/sessions/${session.id}/lobby`);
    await expect(facilitatorPage.getByRole('heading', { name: 'Session Lobby' })).toBeVisible();
    await expect(facilitatorPage.getByText(player.displayName)).toBeVisible();

    await facilitatorPage.getByRole('button', { name: /Start Session/ }).click();
    await expect(facilitatorPage).toHaveURL(new RegExp(`/game/${session.id}$`));
    await expect(facilitatorPage.getByText('FACILITATOR CONTROLS')).toBeVisible();

    const nextInjectSelect = facilitatorPage.locator('select').first();
    await expect(nextInjectSelect).toBeVisible();
    await nextInjectSelect.selectOption({ index: 1 });
    await facilitatorPage.getByRole('button', { name: /^Next$/ }).click();

    await expect(playerPage.getByText('Select your response:')).toBeVisible();
    await playerPage.locator('.decision-option').first().click();
    await playerPage.getByRole('button', { name: /Submit Decision/ }).click();
    await expect(playerPage.getByRole('heading', { name: 'Decision Submitted' })).toBeVisible();

    const revealButton = facilitatorPage.getByRole('button', { name: 'Reveal Results' });
    await expect(revealButton).toBeEnabled();
    await revealButton.click();

    await expect(facilitatorPage.getByRole('heading', { name: 'Response Distribution' })).toBeVisible();
    await expect(facilitatorPage.getByText(player.displayName).first()).toBeVisible();
    await expect(playerPage.getByRole('heading', { name: 'Results' })).toBeVisible();
  } finally {
    await facilitatorPage.context().close();
    await playerPage.context().close();
    await facilitatorApi.dispose();
  }
});

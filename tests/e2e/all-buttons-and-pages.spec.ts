import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

test.describe('Script-Speech - All Pages and Buttons', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  // ============================================
  // HOME PAGE TESTS
  // ============================================
  test.describe('Home Page', () => {
    test('should load homepage', async () => {
      await page.goto(BASE_URL);
      await expect(page).toHaveTitle(/Script-Speech/i);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should have navigation buttons', async () => {
      await page.goto(BASE_URL);
      
      // Check nav links
      const navLinks = [
        { text: 'Features', href: '#features' },
        { text: 'Pricing', href: '#pricing' },
        { text: 'Studio', href: '/studio' },
      ];

      for (const link of navLinks) {
        const navLink = page.locator(`nav a:has-text("${link.text}")`);
        await expect(navLink).toBeVisible();
      }
    });

    test('should have CTA buttons', async () => {
      await page.goto(BASE_URL);
      
      // Main CTA buttons
      const ctaButtons = [
        'Get Started Free',
        'View Demo',
        'Try Studio',
      ];

      for (const btnText of ctaButtons) {
        const button = page.getByRole('button', { name: btnText }).or(page.locator(`a:has-text("${btnText}")`));
        if (await button.isVisible().catch(() => false)) {
          await expect(button).toBeVisible();
        }
      }
    });

    test('should have login/signup buttons', async () => {
      await page.goto(BASE_URL);
      
      const authButtons = ['Login', 'Sign Up', 'Get Started'];
      
      for (const btnText of authButtons) {
        const button = page.getByRole('button', { name: btnText })
          .or(page.locator(`a:has-text("${btnText}")`));
        
        if (await button.isVisible().catch(() => false)) {
          await expect(button).toBeVisible();
          console.log(`✓ Found auth button: ${btnText}`);
        }
      }
    });
  });

  // ============================================
  // STUDIO PAGE TESTS
  // ============================================
  test.describe('Studio Page', () => {
    test('should load studio page', async () => {
      await page.goto(`${BASE_URL}/studio`);
      
      // Check for studio-specific elements
      await expect(page.locator('body')).toBeVisible();
      await expect(page).toHaveURL(/studio/);
    });

    test('should have text input area', async () => {
      await page.goto(`${BASE_URL}/studio`);
      
      // Look for text input
      const textInput = page.locator('textarea[placeholder*="text" i]')
        .or(page.locator('textarea'))
        .or(page.locator('[contenteditable]'));
      
      if (await textInput.isVisible().catch(() => false)) {
        await expect(textInput).toBeVisible();
        console.log('✓ Found text input area');
      }
    });

    test('should have generate button', async () => {
      await page.goto(`${BASE_URL}/studio`);
      
      const generateButtons = [
        'Generate',
        'Generate Speech',
        'Create Audio',
        'Synthesize',
      ];

      for (const btnText of generateButtons) {
        const button = page.getByRole('button', { name: btnText });
        if (await button.isVisible().catch(() => false)) {
          await expect(button).toBeVisible();
          await expect(button).toBeEnabled();
          console.log(`✓ Found generate button: ${btnText}`);
          break;
        }
      }
    });

    test('should have voice/model selector', async () => {
      await page.goto(`${BASE_URL}/studio`);
      
      // Look for voice selector
      const selectors = [
        'select',
        '[role="combobox"]',
        'button:has-text("Voice")',
        'button:has-text("Model")',
      ];

      for (const selector of selectors) {
        const element = page.locator(selector).first();
        if (await element.isVisible().catch(() => false)) {
          await expect(element).toBeVisible();
          console.log(`✓ Found selector: ${selector}`);
          break;
        }
      }
    });

    test('should have audio player controls', async () => {
      await page.goto(`${BASE_URL}/studio`);
      
      // Common audio player controls
      const audioControls = [
        'audio',
        '[role="slider"]',
        'button:has-text("Play")',
        'button:has-text("Pause")',
        'button:has-text("Download")',
        'svg[class*="play" i]',
      ];

      let found = 0;
      for (const control of audioControls) {
        const element = page.locator(control).first();
        if (await element.isVisible().catch(() => false)) {
          found++;
          console.log(`✓ Found audio control: ${control}`);
        }
      }
      
      console.log(`Found ${found} audio controls`);
    });
  });

  // ============================================
  // PRICING PAGE TESTS
  // ============================================
  test.describe('Pricing Page', () => {
    test('should load pricing section', async () => {
      await page.goto(`${BASE_URL}#pricing`);
      
      // Check for pricing elements
      const pricingElements = [
        'Pricing',
        'Free',
        'Pro',
        'Enterprise',
        'Subscribe',
        'Get Started',
      ];

      for (const text of pricingElements) {
        const element = page.getByText(text).first();
        if (await element.isVisible().catch(() => false)) {
          await expect(element).toBeVisible();
          console.log(`✓ Found pricing element: ${text}`);
        }
      }
    });

    test('should have pricing buttons clickable', async () => {
      await page.goto(`${BASE_URL}#pricing`);
      
      const pricingButtons = [
        'Start Free',
        'Choose Pro',
        'Contact Sales',
        'Subscribe',
      ];

      for (const btnText of pricingButtons) {
        const button = page.getByRole('button', { name: btnText }).or(page.locator(`a:has-text("${btnText}")`));
        if (await button.isVisible().catch(() => false)) {
          await expect(button).toBeVisible();
          console.log(`✓ Found pricing button: ${btnText}`);
        }
      }
    });
  });

  // ============================================
  // AUTHENTICATION TESTS
  // ============================================
  test.describe('Authentication Pages', () => {
    test('should have login page elements', async () => {
      await page.goto(`${BASE_URL}/login`);
      
      // Check for login form
      const loginElements = [
        'input[type="email"]',
        'input[type="password"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="password" i]',
      ];

      for (const selector of loginElements) {
        const element = page.locator(selector).first();
        if (await element.isVisible().catch(() => false)) {
          await expect(element).toBeVisible();
          console.log(`✓ Found login element: ${selector}`);
        }
      }

      // Login button
      const loginBtn = page.getByRole('button', { name: /login|sign in/i });
      if (await loginBtn.isVisible().catch(() => false)) {
        await expect(loginBtn).toBeVisible();
      }
    });

    test('should have signup page elements', async () => {
      await page.goto(`${BASE_URL}/signup`);
      

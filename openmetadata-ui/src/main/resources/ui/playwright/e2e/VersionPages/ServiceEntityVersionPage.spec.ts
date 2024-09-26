/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import test, { expect } from '@playwright/test';
import { ApiCollectionClass } from '../../support/entity/ApiCollectionClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { ApiServiceClass } from '../../support/entity/service/ApiServiceClass';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { MessagingServiceClass } from '../../support/entity/service/MessagingServiceClass';
import { MlmodelServiceClass } from '../../support/entity/service/MlmodelServiceClass';
import { PipelineServiceClass } from '../../support/entity/service/PipelineServiceClass';
import { SearchIndexServiceClass } from '../../support/entity/service/SearchIndexServiceClass';
import { StorageServiceClass } from '../../support/entity/service/StorageServiceClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { addMultiOwner, assignTier } from '../../utils/entity';

const entities = [
  ApiServiceClass,
  ApiCollectionClass,
  DatabaseServiceClass,
  DashboardServiceClass,
  MessagingServiceClass,
  MlmodelServiceClass,
  PipelineServiceClass,
  SearchIndexServiceClass,
  StorageServiceClass,
  DatabaseClass,
  DatabaseSchemaClass,
] as const;

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

entities.forEach((EntityClass) => {
  const entity = new EntityClass();

  test.describe(entity.getType(), () => {
    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);

      await EntityDataClass.preRequisitesForTests(apiContext);
      await entity.create(apiContext);
      const domain = EntityDataClass.domain1.responseData;
      await entity.patch(apiContext, [
        {
          op: 'add',
          path: '/tags/0',
          value: {
            labelType: 'Manual',
            state: 'Confirmed',
            source: 'Classification',
            tagFQN: 'PersonalData.SpecialCategory',
          },
        },
        {
          op: 'add',
          path: '/tags/1',
          value: {
            labelType: 'Manual',
            state: 'Confirmed',
            source: 'Classification',
            tagFQN: 'PII.Sensitive',
          },
        },
        {
          op: 'add',
          path: '/description',
          value: 'Description for newly added service',
        },
        {
          op: 'add',
          path: '/domain',
          value: {
            id: domain.id,
            type: 'domain',
            name: domain.name,
            description: domain.description,
          },
        },
      ]);

      await afterAction();
    });

    test.beforeEach('Visit entity details page', async ({ page }) => {
      await redirectToHomePage(page);
      await entity.visitEntityPage(page);
    });

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await createNewPage(browser);
      await entity.delete(apiContext);
      await EntityDataClass.postRequisitesForTests(apiContext);
      await afterAction();
    });

    test('Version page', async ({ page }) => {
      const versionDetailResponse = page.waitForResponse(`**/versions/0.2`);
      await page.locator('[data-testid="version-button"]').click();
      await versionDetailResponse;

      await test.step(
        'should show edited tags and description changes',
        async () => {
          await expect(
            page.locator(
              '[data-testid="domain-link"] [data-testid="diff-added"]'
            )
          ).toBeVisible();

          await expect(
            page.locator(
              '[data-testid="viewer-container"] [data-testid="diff-added"]'
            )
          ).toBeVisible();

          await expect(
            page.locator(
              '[data-testid="entity-right-panel"] .diff-added [data-testid="tag-PersonalData.SpecialCategory"]'
            )
          ).toBeVisible();

          await expect(
            page.locator(
              '[data-testid="entity-right-panel"] .diff-added [data-testid="tag-PII.Sensitive"]'
            )
          ).toBeVisible();
        }
      );

      await test.step('should show owner changes', async () => {
        await page.locator('[data-testid="version-button"]').click();
        const OWNER1 = EntityDataClass.user1.getUserName();

        await addMultiOwner({
          page,
          ownerNames: [OWNER1],
          activatorBtnDataTestId: 'edit-owner',
          resultTestId: 'data-assets-header',
          endpoint: entity.endpoint,
          type: 'Users',
        });

        const versionDetailResponse = page.waitForResponse(`**/versions/0.2`);
        await page.locator('[data-testid="version-button"]').click();
        await versionDetailResponse;

        await expect(
          page.locator(
            '[data-testid="owner-link"] > [data-testid="diff-added"]'
          )
        ).toBeVisible();
      });

      await test.step('should show tier changes', async () => {
        await page.locator('[data-testid="version-button"]').click();

        await assignTier(page, 'Tier1', entity.endpoint);

        const versionDetailResponse = page.waitForResponse(`**/versions/0.2`);
        await page.locator('[data-testid="version-button"]').click();
        await versionDetailResponse;

        await expect(
          page.locator('[data-testid="Tier"] > [data-testid="diff-added"]')
        ).toBeVisible();
      });

      await test.step(
        'should show version details after soft deleted',
        async () => {
          await page.locator('[data-testid="version-button"]').click();

          await page.click('[data-testid="manage-button"]');
          await page.click('[data-testid="delete-button"]');

          await page.waitForSelector('[role="dialog"].ant-modal');

          await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

          await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');
          const deleteResponse = page.waitForResponse(
            `/api/v1/${entity.endpoint}/*?hardDelete=false&recursive=true`
          );
          await page.click('[data-testid="confirm-button"]');

          await deleteResponse;

          await expect(page.locator('.Toastify__toast-body')).toHaveText(
            /deleted successfully!/
          );

          await page.click('.Toastify__close-button');

          await page.reload();

          const deletedBadge = page.locator('[data-testid="deleted-badge"]');

          await expect(deletedBadge).toHaveText('Deleted');

          const versionDetailResponse = page.waitForResponse(`**/versions/0.3`);
          await page.locator('[data-testid="version-button"]').click();
          await versionDetailResponse;

          // Deleted badge should be visible
          await expect(
            page.locator('[data-testid="deleted-badge"]')
          ).toBeVisible();
        }
      );
    });
  });
});
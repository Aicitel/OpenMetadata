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
import { Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { get, isEmpty, isUndefined } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DomainIcon } from '../../../assets/svg/ic-domain.svg';
import { ReactComponent as InheritIcon } from '../../../assets/svg/ic-inherit.svg';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { EntityReference } from '../../../generated/entity/type';
import {
  getAPIfromSource,
  getEntityAPIfromSource,
} from '../../../utils/Assets/AssetsUtils';
import {
  getDomainFieldFromEntityType,
  renderDomainLink,
} from '../../../utils/DomainUtils';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { DomainLabelProps } from '../../common/DomainLabel/DomainLabel.interface';
import DomainSelectableList from '../../common/DomainSelectableList/DomainSelectableList.component';
import { useGenericContext } from '../../GenericProvider/GenericProvider';
import { AssetsUnion } from '../AssetsSelectionModal/AssetSelectionModal.interface';
import { DataAssetWithDomains } from '../DataAssetsHeader/DataAssetsHeader.interface';

export const DomainLabelV2 = <
  T extends {
    domain?: EntityReference | EntityReference[];
    id: string;
    fullyQualifiedName: string;
  }
>(
  props: Partial<DomainLabelProps>
) => {
  const { data, permissions, type: entityType } = useGenericContext<T>();
  const { id: entityId, fullyQualifiedName: entityFqn, domain } = data;
  const { t } = useTranslation();
  const [activeDomain, setActiveDomain] = useState<EntityReference[]>([]);
  const hasPermission = permissions.EditAll;

  const handleDomainSave = useCallback(
    async (selectedDomain: EntityReference | EntityReference[]) => {
      const fieldData = getDomainFieldFromEntityType(entityType);

      const entityDetails = getEntityAPIfromSource(entityType as AssetsUnion)(
        entityFqn,
        { fields: fieldData }
      );

      try {
        const entityDetailsResponse = await entityDetails;
        if (entityDetailsResponse) {
          const jsonPatch = compare(entityDetailsResponse, {
            ...entityDetailsResponse,
            [fieldData]: selectedDomain,
          });

          const api = getAPIfromSource(entityType as AssetsUnion);
          const res = await api(entityId, jsonPatch);

          const entityDomains = get(res, fieldData, {});
          if (Array.isArray(entityDomains)) {
            setActiveDomain(entityDomains);
          } else {
            // update the domain details here
            setActiveDomain(isEmpty(entityDomains) ? [] : [entityDomains]);
          }
          !isUndefined(props.afterDomainUpdateAction) &&
            props.afterDomainUpdateAction(res as DataAssetWithDomains);
        }
      } catch (err) {
        // Handle errors as needed
        showErrorToast(err as AxiosError);
      }
    },
    [entityType, entityId, entityFqn]
  );

  useEffect(() => {
    if (domain) {
      if (Array.isArray(domain)) {
        setActiveDomain(domain);
      } else {
        setActiveDomain([domain]);
      }
    }
  }, [domain]);

  const domainLink = useMemo(() => {
    if (
      activeDomain &&
      Array.isArray(activeDomain) &&
      activeDomain.length > 0
    ) {
      return activeDomain.map((domain) => {
        const inheritedIcon = domain?.inherited ? (
          <Tooltip
            title={t('label.inherited-entity', {
              entity: t('label.domain'),
            })}>
            <InheritIcon className="inherit-icon cursor-pointer" width={14} />
          </Tooltip>
        ) : null;

        return (
          <div className="d-flex items-center gap-1" key={domain.id}>
            <Typography.Text className="self-center text-xs whitespace-nowrap">
              <DomainIcon
                className="d-flex"
                color={DE_ACTIVE_COLOR}
                height={16}
                name="folder"
                width={16}
              />
            </Typography.Text>
            {renderDomainLink(domain, getEntityName(domain), true, '')}
            {inheritedIcon && <div className="d-flex">{inheritedIcon}</div>}
          </div>
        );
      });
    } else {
      return (
        <Typography.Text
          className={classNames(
            'domain-link',
            { 'font-medium text-xs': !props.showDomainHeading },
            props.textClassName
          )}
          data-testid="no-domain-text">
          {t('label.no-entity', { entity: t('label.domain') })}
        </Typography.Text>
      );
    }
  }, [activeDomain]);

  const selectableList = useMemo(() => {
    return (
      hasPermission && (
        <DomainSelectableList
          hasPermission={Boolean(hasPermission)}
          multiple={props.multiple}
          selectedDomain={activeDomain}
          onUpdate={handleDomainSave}
        />
      )
    );
  }, [hasPermission, activeDomain, handleDomainSave]);

  const label = useMemo(() => {
    if (props.showDomainHeading) {
      return (
        <>
          <div className="d-flex items-center m-b-xs">
            <Typography.Text className="right-panel-label m-r-xss">
              {t('label.domain')}
            </Typography.Text>
            {selectableList}
          </div>

          <div className="d-flex items-center gap-1 flex-wrap">
            {domainLink}
          </div>
        </>
      );
    }

    return (
      <div
        className="d-flex items-center gap-1 flex-wrap"
        data-testid="header-domain-container">
        {domainLink}
        {selectableList}
      </div>
    );
  }, [activeDomain, hasPermission, selectableList]);

  return label;
};
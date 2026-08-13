import {
  ROLE_DEFINITIONS,
  ROLE_DEFINITIONS_BY_NAME,
  hasCapability,
  scopeCovers,
  Capability,
} from './capabilities';

describe('Capabilities', () => {
  describe('Role Definitions', () => {
    test('Master Admin has all capabilities', () => {
      const masterRole = ROLE_DEFINITIONS_BY_NAME.get('Master');
      expect(masterRole).toBeDefined();
      expect(masterRole?.capabilities).toContain('users.manage');
      expect(masterRole?.capabilities).toContain('companies.manage');
      expect(masterRole?.capabilities).toContain('documents.delete');
      expect(masterRole?.capabilities).toContain('documents.sign');
      expect(masterRole?.capabilities).toContain('documents.request_signature');
      expect(masterRole?.capabilities).toContain('manage_permissions');
      expect(masterRole?.capabilities).toContain('documents.download');
      expect(masterRole?.dataScope).toBe('all');
    });

    test('Group Secretary has expected capabilities', () => {
      const groupSecretaryRole = ROLE_DEFINITIONS_BY_NAME.get('Group Secretary');
      expect(groupSecretaryRole).toBeDefined();
      expect(groupSecretaryRole?.capabilities).toContain('users.manage');
      expect(groupSecretaryRole?.capabilities).toContain('companies.view_all');
      expect(groupSecretaryRole?.capabilities).toContain('documents.delete');
      expect(groupSecretaryRole?.capabilities).toContain('documents.sign');
      expect(groupSecretaryRole?.capabilities).toContain('documents.request_signature');
      expect(groupSecretaryRole?.capabilities).toContain('activity.view_all');
      expect(groupSecretaryRole?.capabilities).toContain('documents.download');
      expect(groupSecretaryRole?.capabilities).toContain('manage_permissions');
      expect(groupSecretaryRole?.dataScope).toBe('all');
    });

    test('Company Admin has company-level capabilities', () => {
      const companyAdminRole = ROLE_DEFINITIONS_BY_NAME.get('Company Admin');
      expect(companyAdminRole).toBeDefined();
      expect(companyAdminRole?.capabilities).toContain('users.manage');
      expect(companyAdminRole?.capabilities).toContain('documents.delete');
      expect(companyAdminRole?.capabilities).toContain('documents.sign');
      expect(companyAdminRole?.capabilities).toContain('documents.request_signature');
      expect(companyAdminRole?.capabilities).toContain('manage_permissions');
      expect(companyAdminRole?.capabilities).not.toContain('documents.download');
      expect(companyAdminRole?.dataScope).toBe('company');
    });

    test('Department Head has department-level capabilities', () => {
      const deptHeadRole = ROLE_DEFINITIONS_BY_NAME.get('Department Head');
      expect(deptHeadRole).toBeDefined();
      expect(deptHeadRole?.capabilities).toContain('documents.delete');
      expect(deptHeadRole?.capabilities).toContain('documents.sign');
      expect(deptHeadRole?.capabilities).toContain('documents.request_signature');
      expect(deptHeadRole?.capabilities).toContain('users.view');
      expect(deptHeadRole?.capabilities).not.toContain('users.manage');
      expect(deptHeadRole?.capabilities).toContain('documents.inherit_domain');
      expect(deptHeadRole?.dataScope).toBe('department');
    });

    test('Company Secretary has appropriate signature capabilities', () => {
      const companySecretaryRole = ROLE_DEFINITIONS_BY_NAME.get('Company Secretary');
      expect(companySecretaryRole).toBeDefined();
      expect(companySecretaryRole?.capabilities).toContain('documents.sign');
      expect(companySecretaryRole?.capabilities).toContain('documents.request_signature');
      expect(companySecretaryRole?.capabilities).toContain('users.view');
      expect(companySecretaryRole?.capabilities).not.toContain('users.manage');
      expect(companySecretaryRole?.dataScope).toBe('company');
    });

    test('Department Secretary has limited capabilities', () => {
      const deptSecretaryRole = ROLE_DEFINITIONS_BY_NAME.get('Department Secretary');
      expect(deptSecretaryRole).toBeDefined();
      expect(deptSecretaryRole?.capabilities).toContain('documents.sign');
      expect(deptSecretaryRole?.capabilities).toContain('users.view');
      expect(deptSecretaryRole?.capabilities).not.toContain('users.manage');
      expect(deptSecretaryRole?.capabilities).not.toContain('documents.delete');
      expect(deptSecretaryRole?.capabilities).toContain('documents.inherit_domain');
      expect(deptSecretaryRole?.dataScope).toBe('department');
    });

    test('Division Head has division-level capabilities', () => {
      const divisionHeadRole = ROLE_DEFINITIONS_BY_NAME.get('Division Head');
      expect(divisionHeadRole).toBeDefined();
      expect(divisionHeadRole?.capabilities).toContain('documents.delete');
      expect(divisionHeadRole?.capabilities).toContain('documents.sign');
      expect(divisionHeadRole?.capabilities).not.toContain('documents.request_signature');
      expect(divisionHeadRole?.capabilities).toContain('users.view');
      expect(divisionHeadRole?.capabilities).toContain('documents.inherit_domain');
      expect(divisionHeadRole?.capabilities).not.toContain('users.manage');
      expect(divisionHeadRole?.dataScope).toBe('division');
    });

    test('Manager has basic management capabilities', () => {
      const managerRole = ROLE_DEFINITIONS_BY_NAME.get('Manager');
      expect(managerRole).toBeDefined();
      expect(managerRole?.capabilities).toContain('documents.create');
      expect(managerRole?.capabilities).toContain('documents.edit');
      expect(managerRole?.capabilities).toContain('documents.sign');
      expect(managerRole?.capabilities).toContain('documents.share');
      expect(managerRole?.capabilities).not.toContain('documents.delete');
      expect(managerRole?.capabilities).not.toContain('documents.inherit_domain');
      expect(managerRole?.capabilities).not.toContain('users.manage');
      expect(managerRole?.dataScope).toBe('own');
    });

    test('Staff has contributor capabilities', () => {
      const staffRole = ROLE_DEFINITIONS_BY_NAME.get('Staff');
      expect(staffRole).toBeDefined();
      expect(staffRole?.capabilities).toContain('documents.create');
      expect(staffRole?.capabilities).toContain('documents.edit');
      expect(staffRole?.capabilities).toContain('documents.sign');
      expect(staffRole?.capabilities).toContain('documents.view');
      expect(staffRole?.capabilities).toContain('workflows.create');
      expect(staffRole?.capabilities).not.toContain('documents.delete');
      expect(staffRole?.capabilities).not.toContain('documents.inherit_domain');
      expect(staffRole?.capabilities).not.toContain('documents.download');
      expect(staffRole?.capabilities).not.toContain('users.manage');
      expect(staffRole?.dataScope).toBe('division');
    });

    test('Receptionist has limited capabilities', () => {
      const receptionistRole = ROLE_DEFINITIONS_BY_NAME.get('Receptionist');
      expect(receptionistRole).toBeDefined();
      expect(receptionistRole?.capabilities).toContain('documents.create');
      expect(receptionistRole?.capabilities).toContain('documents.view');
      expect(receptionistRole?.capabilities).not.toContain('documents.edit');
      expect(receptionistRole?.capabilities).not.toContain('documents.delete');
      expect(receptionistRole?.capabilities).not.toContain('users.manage');
      expect(receptionistRole?.capabilities).not.toContain('documents.sign');
      expect(receptionistRole?.dataScope).toBe('own');
    });
  });

  describe('hasCapability', () => {
    test('returns true when user has capability', () => {
      const permissions = {
        capabilities: ['documents.view', 'documents.edit'] as Capability[],
      };
      
      expect(hasCapability(permissions, 'documents.view')).toBe(true);
      expect(hasCapability(permissions, 'documents.edit')).toBe(true);
    });

    test('returns false when user lacks capability', () => {
      const permissions = {
        capabilities: ['documents.view'] as Capability[],
      };
      
      expect(hasCapability(permissions, 'documents.edit')).toBe(false);
      expect(hasCapability(permissions, 'users.manage')).toBe(false);
    });

    test('returns false for null/undefined permissions', () => {
      expect(hasCapability(null, 'documents.view')).toBe(false);
      expect(hasCapability(undefined, 'documents.view')).toBe(false);
      expect(hasCapability({ capabilities: undefined }, 'documents.view')).toBe(false);
    });
  });

  describe('scopeCovers', () => {
    test('all scope covers everything', () => {
      expect(scopeCovers('all', 'all')).toBe(true);
      expect(scopeCovers('all', 'company')).toBe(true);
      expect(scopeCovers('all', 'department')).toBe(true);
      expect(scopeCovers('all', 'division')).toBe(true);
      expect(scopeCovers('all', 'own')).toBe(true);
    });

    test('company scope covers company and below', () => {
      expect(scopeCovers('company', 'all')).toBe(false);
      expect(scopeCovers('company', 'company')).toBe(true);
      expect(scopeCovers('company', 'department')).toBe(true);
      expect(scopeCovers('company', 'division')).toBe(true);
      expect(scopeCovers('company', 'own')).toBe(true);
    });

    test('department scope covers department and below', () => {
      expect(scopeCovers('department', 'all')).toBe(false);
      expect(scopeCovers('department', 'company')).toBe(false);
      expect(scopeCovers('department', 'department')).toBe(true);
      expect(scopeCovers('department', 'division')).toBe(true);
      expect(scopeCovers('department', 'own')).toBe(true);
    });

    test('division scope covers division and own', () => {
      expect(scopeCovers('division', 'all')).toBe(false);
      expect(scopeCovers('division', 'company')).toBe(false);
      expect(scopeCovers('division', 'department')).toBe(false);
      expect(scopeCovers('division', 'division')).toBe(true);
      expect(scopeCovers('division', 'own')).toBe(true);
    });

    test('own scope only covers own', () => {
      expect(scopeCovers('own', 'all')).toBe(false);
      expect(scopeCovers('own', 'company')).toBe(false);
      expect(scopeCovers('own', 'department')).toBe(false);
      expect(scopeCovers('own', 'division')).toBe(false);
      expect(scopeCovers('own', 'own')).toBe(true);
    });
  });

  describe('Role consistency', () => {
    test('all roles have unique names', () => {
      const names = ROLE_DEFINITIONS.map(role => role.name);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });

    test('all roles have valid data scopes', () => {
      const validScopes = ['all', 'company', 'department', 'division', 'own'];
      
      ROLE_DEFINITIONS.forEach(role => {
        expect(validScopes).toContain(role.dataScope);
      });
    });

    test('higher level roles have more capabilities', () => {
      const masterRole = ROLE_DEFINITIONS_BY_NAME.get('Master');
      const staffRole = ROLE_DEFINITIONS_BY_NAME.get('Staff');
      
      expect(masterRole?.capabilities.length).toBeGreaterThan(staffRole?.capabilities.length || 0);
    });

    test('all roles with documents.edit also have documents.sign', () => {
      ROLE_DEFINITIONS.forEach(role => {
        const hasEdit = role.capabilities.includes('documents.edit');
        const hasSign = role.capabilities.includes('documents.sign');
        
        if (hasEdit && role.name !== 'Receptionist') {
          expect(hasSign).toBe(true);
        }
      });
    });
  });
});
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { CapabilityGuard, REQUIRED_CAPABILITIES_KEY } from './require-capability.decorator';
import { EffectivePermissions, Capability } from './capabilities';

describe('CapabilityGuard', () => {
  let guard: CapabilityGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CapabilityGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<CapabilityGuard>(CapabilityGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  const createMockContext = (user?: any, requiredCapabilities?: Capability[]): ExecutionContext => {
    const mockRequest = {
      user,
    };

    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;

    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(requiredCapabilities);

    return mockContext;
  };

  const createUserWithPermissions = (capabilities: Capability[]): any => {
    const permissions: EffectivePermissions = {
      role: 'Test Role',
      roles: ['Test Role'],
      dataScope: 'company',
      capabilities,
      canAssignDocuments: false,
      companyId: 'test-company-id',
      departmentIds: [],
      divisionIds: [],
    };

    return {
      id: 'test-user-id',
      permissions,
    };
  };

  describe('canActivate', () => {
    test('allows access when no capabilities are required', () => {
      const context = createMockContext(
        createUserWithPermissions([]),
        undefined // No required capabilities
      );

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    test('allows access when empty capabilities array is required', () => {
      const context = createMockContext(
        createUserWithPermissions([]),
        [] // Empty required capabilities
      );

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    test('throws UnauthorizedException when user is not present', () => {
      const context = createMockContext(
        undefined, // No user
        ['documents.view']
      );

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    test('throws ForbiddenException when user has no permissions', () => {
      const context = createMockContext(
        { id: 'test-user-id' }, // User without permissions
        ['documents.view']
      );

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    test('allows access when user has all required capabilities', () => {
      const user = createUserWithPermissions([
        'documents.view',
        'documents.edit',
        'users.manage',
      ]);
      
      const context = createMockContext(user, ['documents.view', 'documents.edit']);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    test('throws ForbiddenException when user is missing some capabilities', () => {
      const user = createUserWithPermissions([
        'documents.view',
      ]);
      
      const context = createMockContext(user, ['documents.view', 'documents.edit']);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Your role does not allow this action (missing: documents.edit).'
      );
    });

    test('throws ForbiddenException when user is missing all capabilities', () => {
      const user = createUserWithPermissions([
        'workflows.view',
      ]);
      
      const context = createMockContext(user, ['documents.view', 'users.manage']);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(() => guard.canActivate(context)).toThrow(
        'Your role does not allow this action (missing: documents.view, users.manage).'
      );
    });

    test('allows access when user has extra capabilities beyond required', () => {
      const user = createUserWithPermissions([
        'documents.view',
        'documents.edit',
        'documents.delete',
        'users.manage',
      ]);
      
      const context = createMockContext(user, ['documents.view']);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    test('handles single required capability', () => {
      const user = createUserWithPermissions(['users.view']);
      const context = createMockContext(user, ['users.view']);

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    test('handles user with empty capabilities array', () => {
      const user = createUserWithPermissions([]);
      const context = createMockContext(user, ['documents.view']);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    test('calls reflector with correct parameters', () => {
      const user = createUserWithPermissions(['documents.view']);
      const context = createMockContext(user, ['documents.view']);

      guard.canActivate(context);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
        REQUIRED_CAPABILITIES_KEY,
        [context.getHandler(), context.getClass()]
      );
    });
  });

  describe('error messages', () => {
    test('provides helpful error message for single missing capability', () => {
      const user = createUserWithPermissions([]);
      const context = createMockContext(user, ['users.manage']);

      try {
        guard.canActivate(context);
        fail('Expected ForbiddenException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.message).toBe(
          'Your role does not allow this action (missing: users.manage).'
        );
      }
    });

    test('provides helpful error message for multiple missing capabilities', () => {
      const user = createUserWithPermissions(['documents.view']);
      const context = createMockContext(user, ['documents.edit', 'users.manage', 'companies.manage']);

      try {
        guard.canActivate(context);
        fail('Expected ForbiddenException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenException);
        expect(error.message).toBe(
          'Your role does not allow this action (missing: documents.edit, users.manage, companies.manage).'
        );
      }
    });
  });
});
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DATA_SCOPE_RANK,
  ROLE_DEFINITIONS_BY_NAME,
  DataScope,
} from '../permissions/capabilities';
import * as bcrypt from 'bcrypt';

/** Everything the API needs to resolve a user's role, scope and memberships. */
const USER_INCLUDE = {
  company: true,
  userRoles: {
    include: {
      role: true,
    },
  },
  userDepartments: {
    include: {
      department: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  userDivisions: {
    include: {
      division: {
        select: {
          id: true,
          name: true,
          departmentId: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: USER_INCLUDE,
    });

    return decorateUser(user);
  }

  /**
   * Same as `findByEmail`, but retains `passwordHash` for credential checking.
   * Only the auth service should call this — every other path must use
   * `findByEmail` so the hash never reaches a response body.
   */
  async findByEmailForAuth(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: USER_INCLUDE,
    });

    if (!user) return null;

    return { ...decorateUser(user), passwordHash: user.passwordHash };
  }

  async findOne(id: string, currentUser?: any) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: USER_INCLUDE,
    });

    const decorated = decorateUser(user);
    if (decorated && currentUser) {
      this.assertSameTenant(decorated, currentUser);
    }
    return decorated;
  }

  /** Block cross-company user reads/mutations unless caller has instance scope. */
  private assertSameTenant(target: { companyId?: string | null }, currentUser: any) {
    if (currentUser?.permissions?.dataScope === 'all') return;
    if (!currentUser?.companyId || target.companyId !== currentUser.companyId) {
      throw new ForbiddenException('That user belongs to another company.');
    }
  }

  /**
   * Only instance-scoped callers may assign Master / Group Secretary (or any
   * role whose dataScope is wider than the caller's).
   */
  private async assertAssignableRole(roleId: string, currentUser: any) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new BadRequestException('Role not found');
    }

    const def = ROLE_DEFINITIONS_BY_NAME.get(role.name);
    const targetScope: DataScope = def?.dataScope ?? 'own';
    const callerScope: DataScope =
      currentUser?.permissions?.dataScope ?? 'own';

    if (DATA_SCOPE_RANK[targetScope] > DATA_SCOPE_RANK[callerScope]) {
      throw new ForbiddenException(
        `You cannot assign the "${role.name}" role.`,
      );
    }

    return role;
  }

  async findAll(currentUser?: any) {
    const where: any = {};

    // Only a user whose scope spans the whole instance sees other companies.
    const seesAllCompanies = currentUser?.permissions?.dataScope === 'all';
    if (currentUser && !seesAllCompanies && currentUser.companyId) {
      where.companyId = currentUser.companyId;
    }

    const users = await this.prisma.user.findMany({
      where,
      include: USER_INCLUDE,
      orderBy: { name: 'asc' },
    });

    return users.map((user) => decorateUser(user));
  }

  async create(data: {
    email: string;
    password: string;
    name?: string;
    companyId?: string;
  }) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        companyId: data.companyId,
      },
    });
  }

  async invite(data: {
    email: string;
    name: string;
    roleId?: string;
    departmentIds?: string[];
  }, currentUser: any) {
    const companyId = currentUser.companyId as string | undefined;
    if (!companyId) {
      throw new BadRequestException('Current user has no company');
    }

    // Placeholder hash until the invitee sets a password via reset flow
    const passwordHash = await bcrypt.hash(
      `invite-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      10,
    );

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        status: 'invited',
        company: { connect: { id: companyId } },
      },
    });

    if (data.roleId) {
      await this.assertAssignableRole(data.roleId, currentUser);
      await this.prisma.userRole.create({
        data: {
          user: { connect: { id: user.id } },
          role: { connect: { id: data.roleId } },
          company: { connect: { id: companyId } },
        },
      });
    }

    if (data.departmentIds && data.departmentIds.length > 0) {
      await this.prisma.userDepartment.createMany({
        data: data.departmentIds.map((departmentId) => ({
          userId: user.id,
          departmentId,
        })),
      });
    }

    return decorateUser(
      await this.prisma.user.findUnique({
        where: { id: user.id },
        include: USER_INCLUDE,
      }),
    );
  }

  async createUser(
    data: {
      email: string;
      name: string;
      password?: string;
      roleId?: string;
      departmentIds?: string[];
      divisionIds?: string[];
      status?: string;
      /** Required when the caller is Master / has no home company. */
      companyId?: string;
    },
    currentUser: any,
  ) {
    const seesAll = currentUser?.permissions?.dataScope === 'all';
    const companyId =
      (seesAll && data.companyId) ||
      (currentUser.companyId as string | undefined);

    if (!companyId) {
      throw new BadRequestException(
        'companyId is required (pass it explicitly when creating users as Master)',
      );
    }

    if (data.roleId) {
      await this.assertAssignableRole(data.roleId, currentUser);
    }

    const passwordHash = await bcrypt.hash(
      data.password ||
        `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      10,
    );

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        status: (data.status || 'active').toLowerCase(),
        company: { connect: { id: companyId } },
      },
    });

    if (data.roleId) {
      await this.prisma.userRole.create({
        data: {
          user: { connect: { id: user.id } },
          role: { connect: { id: data.roleId } },
          company: { connect: { id: companyId } },
        },
      });
    }

    if (data.departmentIds && data.departmentIds.length > 0) {
      await this.prisma.userDepartment.createMany({
        data: data.departmentIds.map((departmentId) => ({
          userId: user.id,
          departmentId,
        })),
      });
    }

    if (data.divisionIds && data.divisionIds.length > 0) {
      await this.prisma.userDivision.createMany({
        data: data.divisionIds.map((divisionId) => ({
          userId: user.id,
          divisionId,
        })),
      });
    }

    return decorateUser(
      await this.prisma.user.findUnique({
        where: { id: user.id },
        include: USER_INCLUDE,
      }),
    );
  }

  /**
   * Update the caller's own profile. Only the fields a person owns about
   * themselves — everything governing access stays with `updateUser`.
   */
  async updateOwnProfile(
    userId: string,
    data: { name?: string; phone?: string },
  ) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.phone !== undefined) updateData.phone = data.phone.trim();

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    return decorateUser(
      await this.prisma.user.findUnique({
        where: { id: userId },
        include: USER_INCLUDE,
      }),
    );
  }

  async updateUser(
    id: string,
    data: {
      name?: string;
      status?: string;
      roleId?: string;
      departmentIds?: string[];
    },
    currentUser: any,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    this.assertSameTenant(existing, currentUser);

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.status !== undefined) updateData.status = data.status.toLowerCase();

    await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    // Prefer the target user's company for role assignment (Masters have null).
    const roleCompanyId = existing.companyId || currentUser.companyId;

    if (data.roleId !== undefined && roleCompanyId) {
      if (data.roleId) {
        await this.assertAssignableRole(data.roleId, currentUser);
      }

      await this.prisma.userRole.deleteMany({
        where: { userId: id },
      });

      if (data.roleId) {
        await this.prisma.userRole.create({
          data: {
            user: { connect: { id } },
            role: { connect: { id: data.roleId } },
            company: { connect: { id: roleCompanyId } },
          },
        });
      }
    }

    if (data.departmentIds !== undefined) {
      await this.prisma.userDepartment.deleteMany({
        where: { userId: id },
      });

      if (data.departmentIds.length > 0) {
        await this.prisma.userDepartment.createMany({
          data: data.departmentIds.map((departmentId) => ({
            userId: id,
            departmentId,
          })),
        });
      }
    }

    return decorateUser(
      await this.prisma.user.findUnique({
        where: { id },
        include: USER_INCLUDE,
      }),
    );
  }

  async deactivateUser(id: string, currentUser: any) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    this.assertSameTenant(existing, currentUser);

    await this.prisma.user.update({
      where: { id },
      data: { status: 'inactive' },
    });

    return { success: true, message: 'User deactivated successfully' };
  }
}

/**
 * Flatten the relational shape into the fields the frontend reads, and drop the
 * password hash so it can never leak through a response.
 */
function decorateUser(user: Record<string, any> | null): any {
  if (!user) return null;

  const { passwordHash, ...safe } = user;

  const departments = (safe.userDepartments ?? []).map((ud: any) => ud.department);
  const divisions = (safe.userDivisions ?? []).map((ud: any) => ud.division);

  return {
    ...safe,
    role: safe.userRoles?.[0]?.role?.name || 'Staff',
    roles: (safe.userRoles ?? []).map((ur: any) => ur.role?.name).filter(Boolean),
    // `department`/`division` (singular) are kept for existing callers that
    // expect a single name.
    department: departments[0]?.name ?? null,
    departments: departments.map((d: any) => d.name),
    departmentIds: departments.map((d: any) => d.id),
    division: divisions[0]?.name ?? null,
    divisions: divisions.map((d: any) => d.name),
    divisionIds: divisions.map((d: any) => d.id),
  };
}

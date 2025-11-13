/**
 * Serializer for Branch entities
 * Transforms database models to API response DTOs
 *
 * Example usage:
 * ```typescript
 * const serialized = BranchesSerializer.toResponse(branch);
 * const serializedArray = BranchesSerializer.toResponseArray(branches);
 * ```
 */
export class BranchesSerializer {
  /**
   * Serialize a single branch to response format
   */
  static toResponse(branch: {
    id: string;
    name: string;
    address: string;
    phone: string | null;
    isActive: boolean;
    organizationId: string;
    createdAt: Date;
    updatedAt: Date;
    _count?: {
      userBranches: number;
    };
  }): {
    id: string;
    name: string;
    address: string;
    phone: string | null;
    isActive: boolean;
    userCount: number;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: branch.id,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      isActive: branch.isActive,
      userCount: branch._count?.userBranches || 0,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  }

  /**
   * Serialize multiple branches to response format
   */
  static toResponseArray(
    branches: Array<{
      id: string;
      name: string;
      address: string;
      phone: string | null;
      isActive: boolean;
      organizationId: string;
      createdAt: Date;
      updatedAt: Date;
      _count?: {
        userBranches: number;
      };
    }>,
  ): Array<{
    id: string;
    name: string;
    address: string;
    phone: string | null;
    isActive: boolean;
    userCount: number;
    createdAt: Date;
    updatedAt: Date;
  }> {
    return branches.map((branch) => this.toResponse(branch));
  }
}

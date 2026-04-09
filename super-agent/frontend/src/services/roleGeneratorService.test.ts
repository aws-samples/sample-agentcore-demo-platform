/**
 * Role Generator Service Tests
 * 
 * Tests for the role generation service including:
 * - Kebab-case format output for English names
 * - Kebab-case format output for Chinese names (pinyin conversion)
 * - Exactly 5 roles are generated
 * - Domain keyword matching
 * 
 * Property Tests:
 * - Property 3: Role ID Format Consistency
 * - Property 5: Generation Produces Exactly 5 Roles
 * 
 * Validates: Requirements 3.1, 3.3
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  generateRoleId,
  generateRoles,
  generateAgents,
  RoleGeneratorService,
} from './roleGeneratorService';

// ============================================================================
// Unit Tests
// ============================================================================

describe('RoleGeneratorService', () => {
  describe('generateRoleId', () => {
    describe('English names', () => {
      it('should convert simple English name to kebab-case', () => {
        expect(generateRoleId('Tech Recruiter')).toBe('tech-recruiter');
      });

      it('should convert multi-word English name to kebab-case', () => {
        expect(generateRoleId('Sales Development Rep')).toBe('sales-development-rep');
      });

      it('should handle single word names', () => {
        expect(generateRoleId('Manager')).toBe('manager');
      });

      it('should remove special characters', () => {
        expect(generateRoleId('IT Support & Specialist')).toBe('it-support-specialist');
      });

      it('should handle multiple spaces', () => {
        expect(generateRoleId('Tech   Recruiter')).toBe('tech-recruiter');
      });

      it('should convert to lowercase', () => {
        expect(generateRoleId('TECH RECRUITER')).toBe('tech-recruiter');
      });
    });

    describe('Chinese names', () => {
      it('should convert Chinese name to pinyin kebab-case', () => {
        const result = generateRoleId('风险策略师');
        expect(result).toMatch(/^[a-z]+(-[a-z]+)*$/);
        expect(result).toBe('feng-xian-ce-lue-shi');
      });

      it('should convert another Chinese name to pinyin kebab-case', () => {
        const result = generateRoleId('大数据画像分析师');
        expect(result).toMatch(/^[a-z]+(-[a-z]+)*$/);
      });

      it('should handle Chinese name with unknown characters', () => {
        const result = generateRoleId('测试角色');
        // Should still produce valid kebab-case even with unknown chars
        expect(result).toMatch(/^[a-z]+(-[a-z]+)*$/);
      });
    });
  });

  describe('generateRoles', () => {
    it('should generate exactly 5 roles by default', async () => {
      const roles = await generateRoles('Human Resources');
      expect(roles).toHaveLength(5);
    });

    it('should generate specified number of roles', async () => {
      const roles = await generateRoles('Human Resources', 3);
      expect(roles).toHaveLength(3);
    });

    it('should match Chinese domain keywords', async () => {
      const roles = await generateRoles('逾期资产治理');
      expect(roles).toHaveLength(5);
      // Should contain roles related to asset management
      const roleNames = roles.map(r => r.roleName);
      expect(roleNames.some(name => name.includes('策略') || name.includes('分析'))).toBe(true);
    });

    it('should match English domain keywords', async () => {
      const roles = await generateRoles('HR Department');
      expect(roles).toHaveLength(5);
      // Should contain HR-related roles
      const roleNames = roles.map(r => r.roleName);
      expect(roleNames.some(name => 
        name.toLowerCase().includes('recruiter') || 
        name.toLowerCase().includes('onboarding')
      )).toBe(true);
    });

    it('should return default roles for unknown domains', async () => {
      const roles = await generateRoles('Unknown Department XYZ');
      expect(roles).toHaveLength(5);
    });

    it('should generate valid role IDs for all roles', async () => {
      const roles = await generateRoles('IT Support');
      roles.forEach(role => {
        expect(role.roleId).toMatch(/^[a-z]+(-[a-z]+)*$/);
      });
    });

    it('should include responsibilities and capabilities', async () => {
      const roles = await generateRoles('Marketing');
      roles.forEach(role => {
        expect(role.coreResponsibilities.length).toBeGreaterThan(0);
        expect(role.keyCapabilities.length).toBeGreaterThan(0);
        expect(role.suggestedTools.length).toBeGreaterThan(0);
      });
    });
  });

  describe('generateAgents', () => {
    it('should generate exactly 5 agents by default', async () => {
      const agents = await generateAgents('Sales Team');
      expect(agents).toHaveLength(5);
    });

    it('should generate agents with all required fields', async () => {
      const agents = await generateAgents('Customer Support');
      agents.forEach(agent => {
        expect(agent.id).toBeDefined();
        expect(agent.name).toBeDefined();
        expect(agent.roleId).toBeDefined();
        expect(agent.role).toBeDefined();
        expect(agent.avatar).toBeDefined();
        expect(agent.description).toBeDefined();
        expect(agent.responsibilities).toBeDefined();
        expect(agent.capabilities).toBeDefined();
        expect(agent.systemPromptSummary).toBeDefined();
        expect(agent.tools).toBeDefined();
      });
    });

    it('should generate unique agent IDs', async () => {
      const agents = await generateAgents('IT Department');
      const ids = agents.map(a => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should generate valid avatars', async () => {
      const agents = await generateAgents('HR');
      agents.forEach(agent => {
        expect(agent.avatar.length).toBeGreaterThan(0);
        expect(agent.avatar.length).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Service export', () => {
    it('should export all functions via RoleGeneratorService', () => {
      expect(RoleGeneratorService.generateRoleId).toBeDefined();
      expect(RoleGeneratorService.generateRoles).toBeDefined();
      expect(RoleGeneratorService.generateAgents).toBeDefined();
    });
  });
});

// ============================================================================
// Property-Based Tests
// ============================================================================

describe('RoleGeneratorService - Property-Based Tests', () => {
  /**
   * Property 3: Role ID Format Consistency
   * 
   * *For any* generated role, the roleId SHALL match the pattern 
   * ^[a-z]+(-[a-z]+)* (lowercase letters with hyphens, kebab-case format).
   * 
   * **Validates: Requirements 3.3**
   */
  describe('Property 3: Role ID Format Consistency', () => {
    // Kebab-case pattern: lowercase letters with hyphens
    const KEBAB_CASE_PATTERN = /^[a-z]+(-[a-z]+)*$/;

    it('should generate valid kebab-case IDs for any English role name', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ '), { minLength: 1, maxLength: 50 })
            .map(chars => chars.join('')),
          (roleName: string) => {
            // Filter out empty or whitespace-only strings
            if (roleName.trim().length === 0) return true;
            
            const roleId = generateRoleId(roleName);
            
            // Role ID should match kebab-case pattern
            expect(roleId).toMatch(KEBAB_CASE_PATTERN);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate valid kebab-case IDs for any generated role', async () => {
      // Test with various domain names
      const domains = [
        'Human Resources',
        'IT Support',
        'Marketing',
        'Sales',
        'Customer Service',
        '逾期资产治理',
        '人力资源',
        'Unknown Domain',
      ];

      for (const domain of domains) {
        const roles = await generateRoles(domain);
        roles.forEach(role => {
          expect(role.roleId).toMatch(KEBAB_CASE_PATTERN);
        });
      }
    });

    it('should produce consistent kebab-case format for repeated calls', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Tech Recruiter', 'Sales Manager', 'IT Support', 'HR Assistant'),
          (roleName) => {
            const id1 = generateRoleId(roleName);
            const id2 = generateRoleId(roleName);
            
            // Same input should produce same output
            expect(id1).toBe(id2);
            // Both should be valid kebab-case
            expect(id1).toMatch(KEBAB_CASE_PATTERN);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Generation Produces Exactly 5 Roles
   * 
   * *For any* successful business scope generation, the system SHALL produce 
   * exactly 5 generated roles (unless explicitly configured otherwise).
   * 
   * **Validates: Requirements 3.1, 3.4**
   */
  describe('Property 5: Generation Produces Exactly 5 Roles', () => {
    it('should always generate exactly 5 roles for any domain name', async () => {
      // Test with various random-like domain names
      const domains = [
        'Human Resources',
        'IT Department',
        'Marketing Team',
        'Sales Division',
        'Customer Support',
        '逾期资产治理',
        '人力资源部门',
        'Random Department XYZ',
        'Finance',
        'Legal',
        'Operations',
        'Research and Development',
      ];

      for (const domain of domains) {
        const roles = await generateRoles(domain);
        expect(roles).toHaveLength(5);
      }
    });

    it('should generate exactly 5 agents for any domain name', async () => {
      const domains = [
        'HR',
        'IT',
        'Marketing',
        '资产管理',
        'Unknown',
      ];

      for (const domain of domains) {
        const agents = await generateAgents(domain);
        expect(agents).toHaveLength(5);
      }
    });

    it('should respect custom count parameter', () => {
      fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (count) => {
            const roles = await generateRoles('Test Domain', count);
            expect(roles).toHaveLength(count);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate exactly 5 roles with all required fields', async () => {
      const roles = await generateRoles('Test Business Scope');
      
      expect(roles).toHaveLength(5);
      
      roles.forEach(role => {
        // Each role should have all required fields
        expect(role.roleId).toBeDefined();
        expect(role.roleId.length).toBeGreaterThan(0);
        expect(role.roleName).toBeDefined();
        expect(role.roleName.length).toBeGreaterThan(0);
        expect(Array.isArray(role.coreResponsibilities)).toBe(true);
        expect(role.coreResponsibilities.length).toBeGreaterThan(0);
        expect(Array.isArray(role.keyCapabilities)).toBe(true);
        expect(role.keyCapabilities.length).toBeGreaterThan(0);
        expect(Array.isArray(role.suggestedTools)).toBe(true);
        expect(role.suggestedTools.length).toBeGreaterThan(0);
      });
    });
  });
});

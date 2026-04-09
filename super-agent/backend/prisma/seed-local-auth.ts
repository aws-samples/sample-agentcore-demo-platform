/**
 * Local Auth Seed Script
 *
 * Sets up the existing admin@example.com user for local auth mode
 * by adding a password_hash. If no profile exists, creates one with
 * the same structure as the main seed.
 *
 * Default credentials:
 *   Username: admin@example.com
 *   Password: admin123
 *
 * Run with: npx tsx prisma/seed-local-auth.ts
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_USERNAME = 'admin@example.com';
const DEFAULT_PASSWORD = 'admin123';
const DEFAULT_FULL_NAME = 'Admin User';

async function main() {
  console.log('🔐 Setting up local auth...');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // Try to find the existing admin profile
  let profile = await prisma.profiles.findUnique({
    where: { username: DEFAULT_USERNAME },
  });

  if (profile) {
    // Update existing profile with password_hash
    await prisma.profiles.update({
      where: { id: profile.id },
      data: { password_hash: passwordHash },
    });
    console.log(`✅ Updated existing profile "${DEFAULT_USERNAME}" with password hash`);
  } else {
    // Create new profile + org + membership (same as main seed)
    let org = await prisma.organizations.findFirst();
    if (!org) {
      org = await prisma.organizations.create({
        data: {
          name: 'Demo Company',
          slug: 'demo-company',
          plan_type: 'enterprise',
        },
      });
      console.log(`   Created organization: ${org.name}`);
    }

    profile = await prisma.profiles.create({
      data: {
        id: crypto.randomUUID(),
        username: DEFAULT_USERNAME,
        full_name: DEFAULT_FULL_NAME,
        password_hash: passwordHash,
        active_organization_id: org.id,
      },
    });

    await prisma.memberships.create({
      data: {
        user_id: profile.id,
        organization_id: org.id,
        role: 'owner',
      },
    });

    console.log(`✅ Created new profile "${DEFAULT_USERNAME}" with owner role`);
  }

  console.log(`\n📋 Local auth credentials:`);
  console.log(`   Username: ${DEFAULT_USERNAME}`);
  console.log(`   Password: ${DEFAULT_PASSWORD}`);
  console.log(`\n⚠️  Change the password after first login in production!`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

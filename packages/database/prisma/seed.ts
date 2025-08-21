// Package: @repo/database
// Path: packages/database/prisma/seed.ts
// Purpose: Comprehensive seed script with realistic test data using Faker

import { PrismaClient, PostStatus, Platform, ConnectionStatus } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Helper function to generate platform-specific content
function generatePlatformContent(platform: Platform): string {
  switch (platform) {
    case 'TWITTER':
      return faker.lorem.sentence({ min: 5, max: 15 }).substring(0, 280);
    case 'FACEBOOK':
      return faker.lorem.paragraphs({ min: 1, max: 3 });
    case 'INSTAGRAM':
      const hashtags = Array.from({ length: faker.number.int({ min: 3, max: 8 }) })
        .map(() => `#${faker.word.noun()}`)
        .join(' ');
      return `${faker.lorem.paragraph()}\n\n${hashtags}`;
    case 'LINKEDIN':
      return faker.lorem.paragraphs({ min: 2, max: 4 });
    case 'YOUTUBE':
      return faker.lorem.paragraph();
    case 'TIKTOK':
      return faker.lorem.sentence({ min: 3, max: 10 });
    default:
      return faker.lorem.paragraph();
  }
}

// Helper to generate realistic social media handles
function generateSocialHandle(platform: Platform): string {
  const username = faker.internet.username();
  switch (platform) {
    case 'TWITTER':
      return `@${username}`;
    case 'INSTAGRAM':
      return username.toLowerCase();
    case 'FACEBOOK':
      return faker.company.name().replace(/\s+/g, '');
    case 'YOUTUBE':
      return `${faker.internet.username()}Channel`;
    case 'LINKEDIN':
      return faker.company.name();
    case 'TIKTOK':
      return `@${username.toLowerCase()}`;
    default:
      return username;
  }
}

async function main() {
  console.log('🧹 Cleaning database...');
  
  // Clean in correct order to respect foreign key constraints
  await prisma.auditLog.deleteMany();
  await prisma.analytics.deleteMany();
  await prisma.mediaAsset.deleteMany();
  await prisma.publication.deleteMany();
  await prisma.post.deleteMany();
  await prisma.template.deleteMany();
  await prisma.connection.deleteMany();
  await prisma.account.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  
  console.log('🌱 Starting database seed...');
  
  // Create teams with different plans
  const teams = await Promise.all([
    prisma.team.create({
      data: {
        name: 'Demo Agency',
        slug: 'demo-agency',
        plan: 'enterprise',
        bio: 'Leading social media management agency',
        website: 'https://demo-agency.example.com',
        monthlyPostLimit: 10000,
        teamMemberLimit: 50,
        settings: {
          timezone: 'America/New_York',
          defaultPlatforms: ['TWITTER', 'FACEBOOK', 'INSTAGRAM'],
          autoPublish: false,
          notifications: { email: true, inApp: true }
        },
        stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
        stripeSubscriptionId: `sub_${faker.string.alphanumeric(14)}`,
      }
    }),
    prisma.team.create({
      data: {
        name: 'Startup Hub',
        slug: 'startup-hub',
        plan: 'pro',
        bio: 'Growing startup with active social presence',
        website: 'https://startup-hub.example.com',
        monthlyPostLimit: 500,
        teamMemberLimit: 10,
        settings: {
          timezone: 'Europe/London',
          defaultPlatforms: ['LINKEDIN', 'TWITTER'],
          autoPublish: true,
          notifications: { email: true, inApp: false }
        },
        stripeCustomerId: `cus_${faker.string.alphanumeric(14)}`,
      }
    }),
    prisma.team.create({
      data: {
        name: 'Personal Brand',
        slug: 'personal-brand',
        plan: 'free',
        bio: 'Building my personal brand',
        monthlyPostLimit: 100,
        teamMemberLimit: 1,
        settings: {
          timezone: 'Asia/Tokyo',
          defaultPlatforms: ['TWITTER'],
          autoPublish: false,
          notifications: { email: false, inApp: true }
        },
        trialEndsAt: faker.date.future({ days: 14 }),
      }
    }),
  ]);
  
  console.log('✅ Created teams:', teams.map(t => t.name).join(', '));
  
  // Create users with hashed passwords
  const password = await hash('Test123!@#');
  
  const users = [];
  for (const team of teams) {
    // Owner
    const owner = await prisma.user.create({
      data: {
        email: `owner@${team.slug}.com`,
        password,
        name: faker.person.fullName(),
        role: 'OWNER',
        teamId: team.id,
        emailVerified: true,
        image: faker.image.avatar(),
        twoFactorEnabled: team.plan === 'enterprise',
      }
    });
    users.push(owner);
    
    // Admin (for non-free plans)
    if (team.plan !== 'free') {
      const admin = await prisma.user.create({
        data: {
          email: `admin@${team.slug}.com`,
          password,
          name: faker.person.fullName(),
          role: 'ADMIN',
          teamId: team.id,
          emailVerified: true,
          image: faker.image.avatar(),
        }
      });
      users.push(admin);
    }
    
    // Members (based on team size)
    const memberCount = team.plan === 'enterprise' ? 5 : team.plan === 'pro' ? 2 : 0;
    for (let i = 0; i < memberCount; i++) {
      const member = await prisma.user.create({
        data: {
          email: faker.internet.email({ provider: `${team.slug}.com` }),
          password,
          name: faker.person.fullName(),
          role: 'MEMBER',
          teamId: team.id,
          emailVerified: faker.datatype.boolean({ probability: 0.8 }),
          image: faker.image.avatar(),
        }
      });
      users.push(member);
    }
  }
  
  console.log('✅ Created', users.length, 'users');
  
  // Create connections for each team
  const connections = [];
  const platforms: Platform[] = ['TWITTER', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'YOUTUBE', 'TIKTOK'];
  
  for (const team of teams) {
    // Number of connections based on plan
    const connectionCount = team.plan === 'enterprise' ? 6 : team.plan === 'pro' ? 3 : 1;
    const teamPlatforms = faker.helpers.arrayElements(platforms, connectionCount);
    
    for (const platform of teamPlatforms) {
      const connection = await prisma.connection.create({
        data: {
          teamId: team.id,
          platform,
          accountName: generateSocialHandle(platform),
          accountId: faker.string.alphanumeric(15),
          accessToken: faker.string.alphanumeric(40),
          refreshToken: faker.string.alphanumeric(40),
          expiresAt: faker.date.future({ days: 30 }),
          status: faker.helpers.arrayElement(['ACTIVE', 'ACTIVE', 'ACTIVE', 'EXPIRED'] as ConnectionStatus[]),
          metadata: {
            followers: faker.number.int({ min: 100, max: 100000 }),
            verified: faker.datatype.boolean({ probability: 0.2 }),
          },
          lastSync: faker.date.recent({ days: 1 }),
          postsPublished: faker.number.int({ min: 0, max: 100 }),
        }
      });
      connections.push(connection);
    }
  }
  
  console.log('✅ Created', connections.length, 'connections');
  
  // Create templates for teams
  const templates = [];
  const templateCategories = ['Product Launch', 'Announcement', 'Engagement', 'Educational', 'Promotional'];
  
  for (const team of teams.slice(0, 2)) { // Only for paid teams
    for (let i = 0; i < 5; i++) {
      const template = await prisma.template.create({
        data: {
          teamId: team.id,
          name: faker.commerce.productName() + ' Template',
          description: faker.commerce.productDescription(),
          content: `🚀 Introducing {{product_name}}!\n\n${faker.lorem.paragraph()}\n\n✨ Features:\n{{features}}\n\n🔗 Learn more: {{link}}`,
          platforms: faker.helpers.arrayElements(platforms, 3),
          hashtags: Array.from({ length: 5 }, () => faker.word.noun()),
          mediaUrls: [faker.image.url()],
          variables: [
            { name: 'product_name', type: 'text', required: true },
            { name: 'features', type: 'textarea', required: true },
            { name: 'link', type: 'url', required: false },
          ],
          category: faker.helpers.arrayElement(templateCategories),
          tags: faker.helpers.arrayElements(['marketing', 'sales', 'announcement', 'product', 'event'], 2),
          usageCount: faker.number.int({ min: 0, max: 50 }),
          lastUsedAt: faker.date.recent({ days: 7 }),
        }
      });
      templates.push(template);
    }
  }
  
  console.log('✅ Created', templates.length, 'templates');
  
  // Create posts with various statuses
  const posts = [];
  const postStatuses: PostStatus[] = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'];
  
  for (const team of teams) {
    const teamUsers = users.filter(u => u.teamId === team.id);
    const teamConnections = connections.filter(c => c.teamId === team.id);
    const teamTemplates = templates.filter(t => t.teamId === team.id);
    
    // Number of posts based on plan
    const postCount = team.plan === 'enterprise' ? 50 : team.plan === 'pro' ? 20 : 5;
    
    for (let i = 0; i < postCount; i++) {
      const status = faker.helpers.arrayElement(postStatuses);
      const author = faker.helpers.arrayElement(teamUsers);
      const postPlatforms = faker.helpers.arrayElements(
        teamConnections.map(c => c.platform),
        faker.number.int({ min: 1, max: Math.min(3, teamConnections.length) })
      );
      
      const post = await prisma.post.create({
        data: {
          teamId: team.id,
          userId: author.id,
          content: generatePlatformContent(postPlatforms[0]),
          mediaUrls: faker.datatype.boolean({ probability: 0.6 }) 
            ? Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () => faker.image.url())
            : [],
          platforms: postPlatforms,
          hashtags: Array.from({ length: faker.number.int({ min: 2, max: 8 }) }, () => faker.word.noun()),
          status,
          scheduledAt: status === 'SCHEDULED' ? faker.date.future({ days: 30 }) : null,
          publishedAt: status === 'PUBLISHED' ? faker.date.past({ days: 30 }) : null,
          failedAt: status === 'FAILED' ? faker.date.recent({ days: 2 }) : null,
          failureReason: status === 'FAILED' ? faker.helpers.arrayElement([
            'Rate limit exceeded',
            'Invalid credentials',
            'Platform API error',
            'Media upload failed'
          ]) : null,
          aiGenerated: faker.datatype.boolean({ probability: 0.3 }),
          aiModel: faker.datatype.boolean({ probability: 0.3 }) ? 'gpt-4' : null,
          templateId: teamTemplates.length > 0 && faker.datatype.boolean({ probability: 0.2 }) 
            ? faker.helpers.arrayElement(teamTemplates).id 
            : null,
          metadata: {
            campaign: faker.datatype.boolean({ probability: 0.3 }) ? faker.commerce.department() : null,
            priority: faker.helpers.arrayElement(['low', 'medium', 'high']),
          },
        }
      });
      posts.push(post);
      
      // Create publications for published posts
      if (status === 'PUBLISHED') {
        for (const platform of postPlatforms) {
          await prisma.publication.create({
            data: {
              postId: post.id,
              platform,
              externalId: faker.string.alphanumeric(20),
              status: 'PUBLISHED',
              publishedAt: post.publishedAt!,
              url: `https://${platform.toLowerCase()}.com/post/${faker.string.alphanumeric(10)}`,
              views: faker.number.int({ min: 100, max: 50000 }),
              likes: faker.number.int({ min: 10, max: 5000 }),
              shares: faker.number.int({ min: 0, max: 1000 }),
              comments: faker.number.int({ min: 0, max: 500 }),
              clicks: faker.number.int({ min: 0, max: 2000 }),
              saves: faker.number.int({ min: 0, max: 300 }),
              metadata: {
                reach: faker.number.int({ min: 500, max: 100000 }),
                impressions: faker.number.int({ min: 1000, max: 200000 }),
              },
              lastSyncAt: faker.date.recent({ days: 1 }),
            }
          });
        }
      }
      
      // Create failed publications
      if (status === 'FAILED') {
        for (const platform of postPlatforms) {
          await prisma.publication.create({
            data: {
              postId: post.id,
              platform,
              status: 'FAILED',
              error: post.failureReason!,
              retryCount: faker.number.int({ min: 1, max: 3 }),
            }
          });
        }
      }
    }
  }
  
  console.log('✅ Created', posts.length, 'posts with publications');
  
  // Create media assets for some posts
  const mediaAssets = [];
  const postsWithMedia = posts.filter(p => p.mediaUrls.length > 0).slice(0, 20);
  
  for (const post of postsWithMedia) {
    for (const url of post.mediaUrls.slice(0, 2)) {
      const isVideo = faker.datatype.boolean({ probability: 0.2 });
      const asset = await prisma.mediaAsset.create({
        data: {
          teamId: post.teamId,
          postId: post.id,
          url,
          key: `media/${post.teamId}/${faker.string.alphanumeric(20)}`,
          filename: faker.system.fileName(),
          mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
          size: faker.number.int({ min: 100000, max: 10000000 }),
          width: isVideo ? 1920 : faker.number.int({ min: 800, max: 4000 }),
          height: isVideo ? 1080 : faker.number.int({ min: 600, max: 3000 }),
          duration: isVideo ? faker.number.int({ min: 10, max: 180 }) : null,
          status: 'ready',
          thumbnailUrl: faker.image.url(),
          altText: faker.lorem.sentence(),
          caption: faker.lorem.sentence(),
          metadata: {
            uploadedBy: post.userId,
            originalName: faker.system.fileName(),
          },
        }
      });
      mediaAssets.push(asset);
    }
  }
  
  console.log('✅ Created', mediaAssets.length, 'media assets');
  
  // Create analytics for published posts
  const publishedPosts = posts.filter(p => p.status === 'PUBLISHED').slice(0, 30);
  
  for (const post of publishedPosts) {
    const platforms = post.platforms;
    for (const platform of platforms) {
      // Create analytics for last 7 days
      for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
        await prisma.analytics.create({
          data: {
            postId: post.id,
            platform,
            date: faker.date.recent({ days: daysAgo }),
            impressions: faker.number.int({ min: 1000, max: 50000 }),
            reach: faker.number.int({ min: 500, max: 30000 }),
            engagement: faker.number.int({ min: 50, max: 5000 }),
            clicks: faker.number.int({ min: 10, max: 2000 }),
            demographics: {
              age: {
                '18-24': faker.number.int({ min: 10, max: 30 }),
                '25-34': faker.number.int({ min: 20, max: 40 }),
                '35-44': faker.number.int({ min: 15, max: 35 }),
                '45+': faker.number.int({ min: 10, max: 25 }),
              },
              gender: {
                male: faker.number.int({ min: 30, max: 70 }),
                female: faker.number.int({ min: 30, max: 70 }),
              },
              location: {
                US: faker.number.int({ min: 20, max: 60 }),
                UK: faker.number.int({ min: 10, max: 30 }),
                Other: faker.number.int({ min: 10, max: 40 }),
              },
            },
          }
        });
      }
    }
  }
  
  console.log('✅ Created analytics data');
  
  // Create audit logs
  const actions = ['create', 'update', 'delete', 'login', 'logout', 'export'];
  const resources = ['post', 'connection', 'team', 'user', 'template'];
  
  for (let i = 0; i < 100; i++) {
    const user = faker.helpers.arrayElement(users);
    const action = faker.helpers.arrayElement(actions);
    const resource = faker.helpers.arrayElement(resources);
    
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        teamId: user.teamId,
        action,
        resource,
        resourceId: faker.string.uuid(),
        ipAddress: faker.internet.ipv4(),
        userAgent: faker.internet.userAgent(),
        method: faker.helpers.arrayElement(['GET', 'POST', 'PUT', 'DELETE']),
        path: `/api/${resource}/${faker.string.uuid()}`,
        details: {
          timestamp: faker.date.recent({ days: 30 }),
          success: faker.datatype.boolean({ probability: 0.95 }),
        },
        createdAt: faker.date.recent({ days: 30 }),
      }
    });
  }
  
  console.log('✅ Created audit logs');
  
  // Create some active sessions
  for (const user of users.slice(0, 10)) {
    await prisma.session.create({
      data: {
        userId: user.id,
        token: faker.string.alphanumeric(32),
        expiresAt: faker.date.future({ days: 7 }),
        ipAddress: faker.internet.ipv4(),
        userAgent: faker.internet.userAgent(),
        lastActivity: faker.date.recent({ days: 1 }),
      }
    });
  }
  
  console.log('✅ Created active sessions');
  
  console.log('\n🎉 Seed completed successfully!');
  console.log('📊 Summary:');
  console.log(`  - ${teams.length} teams`);
  console.log(`  - ${users.length} users`);
  console.log(`  - ${connections.length} connections`);
  console.log(`  - ${templates.length} templates`);
  console.log(`  - ${posts.length} posts`);
  console.log(`  - ${mediaAssets.length} media assets`);
  console.log('\n🔑 Test credentials:');
  console.log('  Email: owner@demo-agency.com');
  console.log('  Password: Test123!@#');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
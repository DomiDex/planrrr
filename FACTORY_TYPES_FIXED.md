# Test Factory Type Errors Fixed ✅

## Problem
All test factory files had TypeScript errors due to:
1. Missing required fields from Prisma schema
2. Incorrect field names (e.g., `errorMessage` instead of `failureReason`)
3. Missing type assertions for enums
4. Incorrect property names (e.g., `image` instead of `logo` for Team)

## Solutions Applied

### 1. User Factory (`test/factories/user.factory.ts`)
- Added missing `twoFactorSecret: null` field
- Added type assertion for `Role` enum
- Cast return type to `User` for type safety

### 2. Team Factory (`test/factories/team.factory.ts`)
- Changed `image` to `logo` (correct field name)
- Removed non-existent `stripePriceId` field
- Added missing fields: `website`, `bio`, `settings`, `monthlyPostLimit`, `teamMemberLimit`, `trialEndsAt`
- Changed plan values to lowercase ('free', 'pro', 'enterprise')
- Added `Prisma.JsonValue` type for `settings` field

### 3. Post Factory (`test/factories/post.factory.ts`)
- Changed `errorMessage` to `failureReason` (correct field name)
- Removed `retryCount` (doesn't exist in schema)
- Added missing AI-related fields: `aiGenerated`, `aiPrompt`, `aiModel`
- Added threading fields: `parentPostId`, `threadPosition`
- Added type assertions for `PostStatus` enum
- Added `Prisma.JsonValue` type for `metadata` field
- Created new `createAIGeneratedPostFixture` helper

### 4. Connection Factory (`test/factories/connection.factory.ts`)
- Removed non-existent fields: `accountImage`, `scope`, `isActive`, `userId`
- Added missing fields: `lastSync`, `syncErrors`, `postsPublished`
- Added `ConnectionStatus` enum import and type assertions
- Updated metadata to use `Prisma.JsonValue` type
- Created platform-specific metadata generators
- Added new helpers: `createInactiveConnectionFixture`, updated `createExpiredConnectionFixture`

## Type Safety Improvements

All factories now:
- Import necessary types from `@repo/database`
- Use proper enum types (`Role`, `PostStatus`, `Platform`, `ConnectionStatus`)
- Cast JSON fields to `Prisma.JsonValue`
- Include all required fields from Prisma schema
- Use type assertions for better TypeScript inference

## Usage Example

```typescript
import { createUserFixture, createTeamFixture, createPostFixture } from './test/factories';

// Create test data with full type safety
const team = createTeamFixture({ plan: 'pro' });
const user = createUserFixture({ teamId: team.id, role: 'OWNER' as Role });
const post = createPostFixture({ 
  teamId: team.id, 
  userId: user.id,
  status: 'SCHEDULED' as PostStatus
});
```

## Files Modified
- `/test/factories/user.factory.ts`
- `/test/factories/team.factory.ts`
- `/test/factories/post.factory.ts`
- `/test/factories/connection.factory.ts`

All TypeScript errors in the factory files have been resolved!
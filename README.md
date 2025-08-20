# 🚀 planrrr.io - Open Source Social Media Scheduling Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Railway](https://img.shields.io/badge/Railway-Ready-purple)](https://railway.app/)

planrrr.io is an open-source, self-hostable social media scheduling platform that helps teams plan, create, and publish content across multiple social channels including Facebook, Instagram, X (Twitter), and YouTube.

## 🌟 Features

- 📅 **Visual Content Calendar** - Drag-and-drop scheduling interface
- 🌐 **Multi-Platform Publishing** - Support for Facebook, Instagram, X, YouTube
- 👥 **Team Collaboration** - Role-based access control and approval workflows
- 📊 **Analytics Dashboard** - Track post performance and engagement
- 🤖 **AI Content Generation** - Powered by OpenAI for caption suggestions
- 🔄 **Bulk Operations** - CSV import and bulk scheduling
- 🔒 **Self-Hostable** - Full control over your data

## 🏗️ Architecture

Built as a Turborepo monorepo with three-service architecture:

```
┌─────────────────────────┐
│   Next.js (Vercel)      │  ← Frontend
│   - React UI            │
│   - Server Components   │
└───────────┬─────────────┘
            │ HTTPS
            ▼
┌─────────────────────────┐
│   API (Railway)         │  ← Backend
│   - Hono Framework      │
│   - Business Logic      │
│   - Authentication      │
└───────────┬─────────────┘
            │ Internal
            ▼
┌─────────────────────────┐
│   Worker (Railway)      │  ← Jobs
│   - BullMQ              │
│   - Social Publishing   │
│   - Scheduled Tasks     │
└─────────────────────────┘
```

## 📦 Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS v4
- **Backend**: Hono.js, Prisma ORM, Better Auth
- **Database**: PostgreSQL (Neon)
- **Queue**: BullMQ with Redis (Upstash)
- **Deployment**: Vercel (Frontend) + Railway (Backend)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 9.0.0
- PostgreSQL database (Neon recommended)
- Redis instance (Upstash recommended)

### Development Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/planrrr.git
cd planrrr
```

2. **Run setup script**

Windows:
```bash
setup.bat
```

macOS/Linux:
```bash
chmod +x setup.sh
./setup.sh
```

3. **Configure environment variables**

Edit the generated `.env` files:
- `apps/api/.env` - API configuration
- `apps/worker/.env` - Worker configuration  
- `apps/web/.env.local` - Frontend configuration

Required variables:
```env
DATABASE_URL=postgresql://...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
JWT_SECRET=generate-32-char-secret
INTERNAL_API_KEY=generate-api-key
```

4. **Set up database**
```bash
pnpm db:push
```

5. **Start development servers**
```bash
pnpm dev
```

The application will be available at:
- Frontend: http://localhost:3000
- API: http://localhost:4000
- API Health: http://localhost:4000/health

## 📚 Documentation

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Production deployment instructions
- [TASK_MASTER.md](./TASK_MASTER.md) - Development roadmap and tasks
- [IMPLEMENTATION_REPORT.md](./IMPLEMENTATION_REPORT.md) - Current implementation status
- [CODE_REVIEW_REPORT.md](./CODE_REVIEW_REPORT.md) - Code quality analysis
- [Architecture Documentation](./.claude/context/architecture-update.md)

## 🛠️ Available Commands

```bash
# Development
pnpm dev              # Start all services
pnpm dev:web          # Start frontend only
pnpm dev:api          # Start API only
pnpm dev:worker       # Start worker only

# Database
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to database
pnpm db:studio        # Open Prisma Studio

# Building
pnpm build            # Build all packages
pnpm lint             # Run linter
pnpm check-types      # TypeScript type checking
pnpm test             # Run tests

# Deployment
./deploy.sh           # Deploy to production
```

## 🚢 Deployment

### Quick Deploy

1. **Railway (API & Worker)**
```bash
railway init
railway up
```

2. **Vercel (Frontend)**
```bash
cd apps/web
vercel --prod
```

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.

## 📊 Project Status

### ✅ Completed
- Infrastructure setup
- Deployment configuration
- Database schema
- Security middleware
- Health monitoring

### 🚧 In Progress
- Authentication system
- Post management
- Social media publishers
- Team collaboration
- Calendar UI

### 📋 Planned
- Analytics dashboard
- AI content generation
- Bulk operations
- Mobile app

See [IMPLEMENTATION_REPORT.md](./IMPLEMENTATION_REPORT.md) for detailed status.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards

- Follow the guidelines in [code-standards.md](./.claude/context/code-standards.md)
- Write tests for new features
- Ensure all tests pass before submitting PR
- Keep PRs focused and atomic

## 🔒 Security

- All secrets must be stored in environment variables
- Never commit `.env` files
- Use rate limiting on all API endpoints
- Report security vulnerabilities to security@planrrr.io

## 📈 Performance

Current targets:
- API response time: < 200ms (p95)
- Frontend Core Web Vitals: All green
- Database queries: < 100ms
- Worker job processing: < 30s

## 💰 Costs

Self-hosting costs (estimated):
- **Small (< 100 users)**: ~$10/month
- **Medium (< 1000 users)**: ~$50-100/month
- **Large (< 10000 users)**: ~$200-500/month

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - React framework
- [Hono](https://hono.dev/) - Web framework
- [Prisma](https://www.prisma.io/) - Database ORM
- [BullMQ](https://docs.bullmq.io/) - Job queue
- [Railway](https://railway.app/) - Deployment platform
- [Vercel](https://vercel.com/) - Frontend hosting

## 📞 Support

- 📧 Email: support@planrrr.io
- 💬 Discord: [Join our community](https://discord.gg/planrrr)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/planrrr/issues)
- 📖 Docs: [docs.planrrr.io](https://docs.planrrr.io)

## 🚀 Getting Help

If you need help getting started:

1. Check the [documentation](./docs)
2. Search [existing issues](https://github.com/yourusername/planrrr/issues)
3. Join our [Discord community](https://discord.gg/planrrr)
4. Open a [new issue](https://github.com/yourusername/planrrr/issues/new)

---

Built with ❤️ by the planrrr.io community
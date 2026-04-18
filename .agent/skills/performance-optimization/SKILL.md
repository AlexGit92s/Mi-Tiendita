---
name: performance-optimization
description: Application performance optimization covering profiling, caching, database queries, bundle size, and rendering optimization.
license: MIT
---

# Performance Optimization Guidelines

## Project Context
- **Project Path**: C:\laragon\www\Mi-Tiendita
- **Framework**: {{FRAMEWORK}}
- **Database**: Not specified
- **Build Tool**: Vite

## Core Principles
- Measure before optimizing — profile first, optimize second
- Optimize for the common case, not edge cases
- Caching is the biggest performance win — but invalidation is the hardest problem
- Reduce, reuse, compress: reduce payloads, reuse connections, compress responses
- Performance is a feature — set budgets and enforce them

## Performance Budgets
- First Contentful Paint (FCP): < 1.8s
- Largest Contentful Paint (LCP): < 2.5s
- Time to Interactive (TTI): < 3.8s
- Cumulative Layout Shift (CLS): < 0.1
- First Input Delay (FID): < 100ms
- Total Bundle Size: < 250KB (gzipped)
- API Response Time: < 200ms (p95)

## Database Optimization

### Query Optimization
```sql
-- Always EXPLAIN ANALYZE before optimizing
EXPLAIN ANALYZE
SELECT u.email, COUNT(a.id) AS article_count
FROM users u
LEFT JOIN articles a ON a.author_id = u.id
WHERE a.status = 'published'
GROUP BY u.email
ORDER BY article_count DESC;
```

```sql
-- Use proper indexes
CREATE INDEX idx_articles_author_id ON articles(author_id);
CREATE INDEX idx_articles_status_created ON articles(status, created_at DESC);
CREATE INDEX idx_articles_published ON articles(created_at DESC)
    WHERE status = 'published';
```

### Avoid N+1 Queries
```typescript
// BAD — N+1 query
const articles = await db.article.findMany();
for (const article of articles) {
  const author = await db.user.findUnique({ where: { id: article.authorId } });
}

// GOOD — eager load
const articles = await db.article.findMany({ include: { author: true } });
```

```php
// BAD — N+1 in Eloquent
$articles = Article::all();
foreach ($articles as $article) {
    echo $article->author->name;
}

// GOOD — eager load
$articles = Article::with('author')->get();
```

### Pagination
```typescript
// Keyset pagination (cursor-based) — fast for large datasets
const articles = await db.article.findMany({
  take: 20,
  orderBy: { createdAt: 'desc' },
  where: {
    status: 'PUBLISHED',
    ...(cursor && { createdAt: { lt: cursorDate } }),
  },
});

const lastItem = articles[articles.length - 1];
res.json({
  data: articles,
  nextCursor: lastItem ? { id: lastItem.id, date: lastItem.createdAt } : null,
});
```

## API Optimization

### Response Optimization
```typescript
// Only return needed fields
const users = await db.user.findMany({
  select: { id: true, name: true, email: true },
});

// Gzip/Brotli compression
import compression from 'compression';
app.use(compression());

// HTTP caching
res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
res.set('ETag', generateETag(data));
```

## Caching Strategy

### Cache Hierarchy
1. **Browser Cache** — Static assets (images, CSS, JS)
2. **CDN Cache** — API responses, pages
3. **Application Cache** — Redis/Memcached for computed data
4. **Database Cache** — Query result cache, buffer pool

### Redis Caching
```typescript
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

async function getCached<T>(key: string, fetcher: () => Promise<T>, ttl = 300): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const data = await fetcher();
  await redis.set(key, JSON.stringify(data), { EX: ttl });
  return data;
}

// Usage
const stats = await getCached('dashboard:stats', async () => {
  return {
    totalUsers: await db.user.count(),
    totalRevenue: await db.payment.aggregate({ _sum: { amount: true } }),
  };
}, 600);
```

## Frontend Optimization

### Bundle Size
- Analyze bundle with `webpack-bundle-analyzer` or `rollup-plugin-visualizer`
- Code split by route
- Lazy load components and routes
- Tree shake unused code

```typescript
// Route-level code splitting
const DashboardPage = lazy(() => import('./pages/Dashboard'));

// Dynamic imports for heavy components
const loadChart = () => import('./heavy-chart').then(m => m.HeavyChart);
```

### Image Optimization
- Use modern formats (WebP, AVIF)
- Implement responsive images with `srcset`
- Lazy load below-the-fold images
- Use CDN for image delivery and transformation

```html
<img
  src="/images/hero-800.webp"
  srcset="/images/hero-400.webp 400w, /images/hero-800.webp 800w, /images/hero-1200.webp 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  alt="Hero image"
  loading="lazy"
  decoding="async"
/>
```

### Virtualized Lists
```tsx
import { VirtualizedList } from '@/components/ui/virtualized-list';

function UserList({ users }: { users: User[] }) {
  return (
    <VirtualizedList
      items={users}
      itemHeight={60}
      renderItem={(user) => <UserCard user={user} />}
    />
  );
}
```

## Rendering Optimization
- Use server-side rendering for initial page load
- Stream content with Suspense boundaries
- Defer non-critical content with `use deferredValue`
- Memoize expensive computations with `useMemo`/`useCallback` (only when profiling shows benefit)

## Monitoring and Profiling
- Use Lighthouse CI for automated performance testing
- Set up Real User Monitoring (RUM) with Web Vitals
- Use APM tools (New Relic, Datadog, Sentry) for server-side profiling
- Track p50, p95, p99 response times — averages hide outliers
- Log slow queries and set alerts for regressions

## Common Pitfalls
- ❌ Don't optimize without measuring — you'll waste time on the wrong things
- ❌ Don't skip database indexing — it's the #1 cause of slow APIs
- ❌ Don't use `OFFSET` pagination on large tables — use keyset pagination
- ❌ Don't cache without an invalidation strategy — stale data is worse than slow data
- ❌ Don't load all data at once — paginate, virtualize, and stream
- ✅ Profile before and after every optimization
- ✅ Set performance budgets and enforce them in CI
- ✅ Use CDN caching for static and semi-static content
- ✅ Compress all responses (Brotli > gzip)
- ✅ Monitor Web Vitals in production, not just locally

## When to Use
- Investigating slow page loads or API responses
- Before deploying performance-critical features
- During code reviews of data-heavy operations
- Setting up monitoring and alerting
- Reducing bundle size or improving Core Web Vitals

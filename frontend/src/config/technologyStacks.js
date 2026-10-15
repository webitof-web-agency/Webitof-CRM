export const TECHNOLOGY_STACK_GROUPS = [
  {
    id: 'frontend',
    title: 'Frontend Development',
    icon: 'monitor',
    color: '#0ea5e9',
    description: 'Responsive, interactive, and search-friendly web interfaces built with modern rendering libraries.',
    technologies: ['HTML5', 'CSS3', 'JavaScript', 'TypeScript', 'React.js', 'Next.js', 'Angular', 'Vue.js', 'Bootstrap', 'Tailwind CSS', 'Material UI', 'jQuery', 'Vite', 'Redux Toolkit', 'Svelte', 'SvelteKit', 'Nuxt.js']
  },
  {
    id: 'backend',
    title: 'Backend Development',
    icon: 'settings',
    color: '#22c55e',
    description: 'Secure, scalable server architectures, RESTful endpoints, and custom business logic controllers.',
    technologies: ['Node.js', 'Express.js', 'PHP', 'Laravel', 'CodeIgniter', 'NestJS', 'Python', 'Django', 'FastAPI', 'Java', 'Spring Boot', 'ASP.NET Core', 'REST API', 'GraphQL', 'Socket.io', 'JWT Authentication', 'OAuth']
  },
  {
    id: 'mern',
    title: 'MERN Stack',
    icon: 'layers',
    color: '#38bdf8',
    description: 'MERN Stack Development for scalable web applications, dashboards, CRM, SaaS platforms and custom business software.',
    technologies: ['MongoDB', 'Express.js', 'React.js', 'Node.js']
  },
  {
    id: 'database',
    title: 'Database Technologies',
    icon: 'database',
    color: '#06b6d4',
    description: 'Structured, optimized relational tables and flexible document schemas mapped for rapid queries.',
    technologies: ['MySQL', 'PostgreSQL', 'MongoDB', 'Firebase', 'Redis', 'SQLite', 'MariaDB', 'Supabase', 'Prisma ORM', 'Microsoft SQL Server', 'Elasticsearch', 'DynamoDB', 'Pinecone']
  },
  {
    id: 'mobile',
    title: 'Mobile App Development',
    icon: 'smartphone',
    color: '#3b82f6',
    description: 'High-performance cross-platform hybrid and native mobile products built for iOS & Android systems.',
    technologies: ['Flutter', 'React Native', 'Android', 'iOS', 'Dart', 'Kotlin', 'Swift', 'Expo']
  },
  {
    id: 'cms',
    title: 'CMS & Website Platforms',
    icon: 'panels',
    color: '#2563eb',
    description: 'Custom content systems, themes, and page-builders tailored for easy client publishing control.',
    technologies: ['WordPress', 'Custom WordPress Theme Development', 'WordPress Plugin Development', 'WooCommerce', 'Shopify', 'Elementor', 'Gutenberg', 'Webflow', 'Strapi', 'Sanity', 'Contentful', 'Magento / Adobe Commerce']
  },
  {
    id: 'ecommerce',
    title: 'E-commerce Development',
    icon: 'cart',
    color: '#8b5cf6',
    description: 'Scalable shopping engines, cart systems, shipping integrations, and payment gateways for growth.',
    technologies: ['WooCommerce', 'Shopify', 'Custom E-commerce Development', 'Payment Gateway Integration', 'Razorpay', 'Stripe', 'PayPal', 'Instamojo', 'Cashfree', 'Shiprocket Integration']
  },
  {
    id: 'cloud',
    title: 'Cloud & DevOps',
    icon: 'server',
    color: '#0ea5e9',
    description: 'Automated server pipelines, horizontal auto-scaling, horizontal routing, and hosting setups.',
    technologies: ['AWS', 'Microsoft Azure', 'Google Cloud Platform', 'DigitalOcean', 'Hostinger VPS', 'cPanel', 'Cloudflare', 'Docker', 'GitHub Actions', 'CI/CD Pipeline', 'Server Deployment', 'Load Balancing', 'Auto Scaling', 'CDN Setup', 'SSL Configuration', 'Domain & DNS Management', 'Vercel', 'Netlify', 'Nginx', 'Kubernetes', 'Terraform', 'Jenkins']
  },
  {
    id: 'api',
    title: 'API & Integrations',
    icon: 'network',
    color: '#14b8a6',
    description: 'Seamless third-party web service connections, messaging gateways, and back-office synchronizations.',
    technologies: ['REST API Development', 'Third-party API Integration', 'Payment Gateway API', 'WhatsApp API', 'SMS API', 'Email API', 'Google Maps API', 'Google Analytics', 'Meta Pixel', 'CRM Integration', 'ERP Integration', 'Chatbot Integration', 'Webhooks', 'OpenAPI / Swagger', 'Twilio', 'Firebase Cloud Messaging']
  },
  {
    id: 'design',
    title: 'UI/UX & Design Tools',
    icon: 'pen',
    color: '#ec4899',
    description: 'Interactive low-fidelity wireframes, premium components, brand design, and UI prototypes.',
    technologies: ['Figma', 'Photoshop', 'Illustrator', 'Canva', 'Wireframing', 'Prototyping', 'Responsive UI Design']
  },
  {
    id: 'seo',
    title: 'SEO & Performance',
    icon: 'gauge',
    color: '#f59e0b',
    description: 'Optimization workflows to hit high Core Web Vitals, speed metrics, and Google crawler visibility.',
    technologies: ['Technical SEO', 'On-page SEO', 'Schema Markup', 'Google Search Console', 'Google Analytics', 'Page Speed Optimization', 'Core Web Vitals', 'Image Optimization', 'Caching', 'Lazy Loading', 'Lighthouse', 'PageSpeed Insights', 'GTmetrix', 'Screaming Frog']
  },
  {
    id: 'tools',
    title: 'Version Control & Project Tools',
    icon: 'briefcase',
    color: '#6366f1',
    description: 'Collaborative source control repository flows, task tracking, and direct developer communication channels.',
    technologies: ['Git', 'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Trello', 'Slack', 'Notion', 'Postman']
  },
  {
    id: 'testing',
    title: 'Testing & Quality Assurance',
    icon: 'testing',
    color: '#8b5cf6',
    description: 'Automated functional, API, unit, cross-browser, and end-to-end quality assurance workflows.',
    technologies: ['Playwright', 'Cypress', 'Jest', 'Vitest', 'Selenium', 'PHPUnit', 'Postman / Newman', 'API Testing', 'Unit Testing', 'E2E Testing']
  },
  {
    id: 'ai-automation',
    title: 'AI & Automation',
    icon: 'ai',
    color: '#ec4899',
    description: 'AI-powered applications, knowledge assistants, integrations, and automated business workflows.',
    technologies: ['OpenAI API', 'Gemini API', 'AI Chatbot Development', 'RAG Integration', 'LangChain', 'Vector Database', 'n8n', 'Zapier', 'Make', 'Workflow Automation']
  },
  {
    id: 'monitoring-security',
    title: 'Monitoring & Reliability',
    icon: 'security',
    color: '#10b981',
    description: 'Production monitoring, error tracking, availability, recovery, and infrastructure health.',
    technologies: ['Sentry', 'Prometheus', 'Grafana', 'AWS CloudWatch', 'Application Monitoring', 'Error Tracking', 'Backup & Disaster Recovery']
  },
  {
    id: 'application-security',
    title: 'Application Security',
    icon: 'app-security',
    color: '#ef4444',
    description: 'Secure development, vulnerability assessment, penetration testing, and automated code scanning.',
    technologies: ['OWASP Top 10', 'VAPT', 'Penetration Testing', 'Secure Code Review', 'API Security Testing', 'SAST', 'DAST', 'Dependency Vulnerability Scanning', 'Secrets Scanning', 'Burp Suite', 'OWASP ZAP', 'Nmap', 'SonarQube', 'Snyk', 'Trivy', 'GitHub Dependabot', 'XSS Prevention', 'SQL Injection Prevention', 'CSRF Protection', 'Vulnerability Testing']
  },
  {
    id: 'identity-infrastructure-security',
    title: 'Identity & Infrastructure Security',
    icon: 'identity-security',
    color: '#0f766e',
    description: 'Identity, access control, encryption, perimeter protection, secrets, and infrastructure hardening.',
    technologies: ['Web Application Firewall', 'Cloudflare WAF', 'AWS WAF', 'DDoS Protection', 'Rate Limiting', 'Security Headers / CSP', 'CORS Security', 'SSL / TLS Security', 'Data Encryption', 'HashiCorp Vault', 'Role-Based Access Control', 'MFA / 2FA', 'SSO / SAML / OIDC', 'Audit Logging', "Let's Encrypt", 'Auth0', 'Keycloak']
  }
];

function technologyId(name) {
  return `tech-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

const technologyMap = new Map();
TECHNOLOGY_STACK_GROUPS.forEach((group, groupIndex) => {
  group.technologies.forEach((name, technologyIndex) => {
    const id = technologyId(name);
    const current = technologyMap.get(id);
    if (current) {
      if (!current.groups.includes(group.title)) current.groups.push(group.title);
      return;
    }
    technologyMap.set(id, {
      id,
      name,
      category: group.title,
      groups: [group.title],
      description: group.description,
      isActive: true,
      sortOrder: (groupIndex * 100) + technologyIndex
    });
  });
});

export const STATIC_TECHNOLOGIES = Array.from(technologyMap.values());


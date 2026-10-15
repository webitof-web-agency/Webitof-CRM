const TECHNOLOGY_STACK_GROUPS = [
  ['Frontend Development', ['HTML5', 'CSS3', 'JavaScript', 'TypeScript', 'React.js', 'Next.js', 'Angular', 'Vue.js', 'Bootstrap', 'Tailwind CSS', 'Material UI', 'jQuery', 'Vite', 'Redux Toolkit', 'Svelte', 'SvelteKit', 'Nuxt.js']],
  ['Backend Development', ['Node.js', 'Express.js', 'PHP', 'Laravel', 'CodeIgniter', 'NestJS', 'Python', 'Django', 'FastAPI', 'Java', 'Spring Boot', 'ASP.NET Core', 'REST API', 'GraphQL', 'Socket.io', 'JWT Authentication', 'OAuth']],
  ['MERN Stack', ['MongoDB', 'Express.js', 'React.js', 'Node.js']],
  ['Database Technologies', ['MySQL', 'PostgreSQL', 'MongoDB', 'Firebase', 'Redis', 'SQLite', 'MariaDB', 'Supabase', 'Prisma ORM', 'Microsoft SQL Server', 'Elasticsearch', 'DynamoDB', 'Pinecone']],
  ['Mobile App Development', ['Flutter', 'React Native', 'Android', 'iOS', 'Dart', 'Kotlin', 'Swift', 'Expo']],
  ['CMS & Website Platforms', ['WordPress', 'Custom WordPress Theme Development', 'WordPress Plugin Development', 'WooCommerce', 'Shopify', 'Elementor', 'Gutenberg', 'Webflow', 'Strapi', 'Sanity', 'Contentful', 'Magento / Adobe Commerce']],
  ['E-commerce Development', ['WooCommerce', 'Shopify', 'Custom E-commerce Development', 'Payment Gateway Integration', 'Razorpay', 'Stripe', 'PayPal', 'Instamojo', 'Cashfree', 'Shiprocket Integration']],
  ['Cloud & DevOps', ['AWS', 'Microsoft Azure', 'Google Cloud Platform', 'DigitalOcean', 'Hostinger VPS', 'cPanel', 'Cloudflare', 'Docker', 'GitHub Actions', 'CI/CD Pipeline', 'Server Deployment', 'Load Balancing', 'Auto Scaling', 'CDN Setup', 'SSL Configuration', 'Domain & DNS Management', 'Vercel', 'Netlify', 'Nginx', 'Kubernetes', 'Terraform', 'Jenkins']],
  ['API & Integrations', ['REST API Development', 'Third-party API Integration', 'Payment Gateway API', 'WhatsApp API', 'SMS API', 'Email API', 'Google Maps API', 'Google Analytics', 'Meta Pixel', 'CRM Integration', 'ERP Integration', 'Chatbot Integration', 'Webhooks', 'OpenAPI / Swagger', 'Twilio', 'Firebase Cloud Messaging']],
  ['UI/UX & Design Tools', ['Figma', 'Photoshop', 'Illustrator', 'Canva', 'Wireframing', 'Prototyping', 'Responsive UI Design']],
  ['SEO & Performance', ['Technical SEO', 'On-page SEO', 'Schema Markup', 'Google Search Console', 'Google Analytics', 'Page Speed Optimization', 'Core Web Vitals', 'Image Optimization', 'Caching', 'Lazy Loading', 'Lighthouse', 'PageSpeed Insights', 'GTmetrix', 'Screaming Frog']],
  ['Version Control & Project Tools', ['Git', 'GitHub', 'GitLab', 'Bitbucket', 'Jira', 'Trello', 'Slack', 'Notion', 'Postman']],
  ['Testing & Quality Assurance', ['Playwright', 'Cypress', 'Jest', 'Vitest', 'Selenium', 'PHPUnit', 'Postman / Newman', 'API Testing', 'Unit Testing', 'E2E Testing']],
  ['AI & Automation', ['OpenAI API', 'Gemini API', 'AI Chatbot Development', 'RAG Integration', 'LangChain', 'Vector Database', 'n8n', 'Zapier', 'Make', 'Workflow Automation']],
  ['Monitoring & Reliability', ['Sentry', 'Prometheus', 'Grafana', 'AWS CloudWatch', 'Application Monitoring', 'Error Tracking', 'Backup & Disaster Recovery']],
  ['Application Security', ['OWASP Top 10', 'VAPT', 'Penetration Testing', 'Secure Code Review', 'API Security Testing', 'SAST', 'DAST', 'Dependency Vulnerability Scanning', 'Secrets Scanning', 'Burp Suite', 'OWASP ZAP', 'Nmap', 'SonarQube', 'Snyk', 'Trivy', 'GitHub Dependabot', 'XSS Prevention', 'SQL Injection Prevention', 'CSRF Protection', 'Vulnerability Testing']],
  ['Identity & Infrastructure Security', ['Web Application Firewall', 'Cloudflare WAF', 'AWS WAF', 'DDoS Protection', 'Rate Limiting', 'Security Headers / CSP', 'CORS Security', 'SSL / TLS Security', 'Data Encryption', 'HashiCorp Vault', 'Role-Based Access Control', 'MFA / 2FA', 'SSO / SAML / OIDC', 'Audit Logging', "Let's Encrypt", 'Auth0', 'Keycloak']]
];

function technologyId(name) {
  return `tech-${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

const technologyMap = new Map();
for (const [group, technologies] of TECHNOLOGY_STACK_GROUPS) {
  for (const name of technologies) {
    const id = technologyId(name);
    const current = technologyMap.get(id);
    if (current) {
      if (!current.groups.includes(group)) current.groups.push(group);
      continue;
    }
    technologyMap.set(id, { id, name, category: group, groups: [group] });
  }
}

const TECHNOLOGY_STACKS = Array.from(technologyMap.values());

module.exports = { TECHNOLOGY_STACK_GROUPS, TECHNOLOGY_STACKS };

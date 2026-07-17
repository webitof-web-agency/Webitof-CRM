const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool, query, closePool } = require('../config/db');
const { createRole, createUser } = require('../services/auth.service');
const defaultData = require('./defaultData');

const settingsModel = require('../models/settings.model');
const permissionModel = require('../models/permission.model');
const roleModel = require('../models/role.model');
const masterItemModel = require('../models/masterItem.model');
const clientModel = require('../models/client.model');
const projectModel = require('../models/project.model');
const invoiceModel = require('../models/invoice.model');
const paymentModel = require('../models/payment.model');
const expenseModel = require('../models/expense.model');
const amcModel = require('../models/amc.model');
const bankAccountModel = require('../models/bankAccount.model');
const bankTransactionModel = require('../models/bankTransaction.model');
const leadContactModel = require('../models/leadContact.model');
const clientContactModel = require('../models/clientContact.model');
const { createId, nowIso } = require('../utils/format');

async function seed() {
  console.log('--- Database Seeding Started ---');
  
  try {
    // 1. Clear existing data
    console.log('Clearing old data...');
    await query(`
      TRUNCATE TABLE 
        app_settings, permissions, roles, users, password_reset_tokens, 
        user_roles, role_permissions, master_items, clients, projects, 
        invoices, payments, expenses, outsourcing_expenses, leads, lead_contacts, client_contacts, lead_events, lead_commissions, 
        bank_accounts, bank_transactions, amcs, renewals 
      CASCADE;
    `);

    // 2. Insert App Settings
    console.log('Inserting default settings...');
    await settingsModel.settingsRepository.create({
      id: 'default',
      ...defaultData.DEFAULT_SETTINGS
    });

    // 3. Insert Master Items
    console.log('Inserting master items...');
    const allItems = [
      ...defaultData.DEFAULT_SERVICE_CATEGORIES,
      ...defaultData.DEFAULT_SERVICES,
      ...defaultData.DEFAULT_EXPENSE_CATEGORIES,
      ...defaultData.DEFAULT_TAX_RATES,
      ...defaultData.DEFAULT_VENDORS,
      ...defaultData.DEFAULT_RENEWAL_PROVIDERS,
      ...defaultData.DEFAULT_AMC_TYPES,
      ...defaultData.DEFAULT_BILLING_CYCLES,
      ...defaultData.DEFAULT_INVOICE_TERMS
    ];
    for (const item of allItems) {
      const nextItem = { ...item };
      if (nextItem.type === 'service') {
        const price = Number(nextItem.payload?.defaultPrice ?? 0);
        const seededAt = nowIso();
        nextItem.payload = {
          ...(nextItem.payload || {}),
          defaultPrice: price,
          priceHistory: [
            {
              id: createId('svc-price'),
              from: price,
              to: price,
              reason: 'seeded',
              changedAt: seededAt,
              changedBy: {
                id: 'system',
                name: 'System',
                username: 'system',
                email: null
              }
            }
          ],
          lastPriceChangeAt: seededAt,
          lastPriceChangeBy: {
            id: 'system',
            name: 'System',
            username: 'system',
            email: null
          }
        };
      }
      await masterItemModel.masterItemRepository.create(nextItem);
    }

    // 4. Create Base Permissions & Roles
    console.log('Creating permissions & roles...');
    const defaultPermissions = [
      { module: 'dashboard', action: 'view', name: 'View Dashboard' },
      { module: 'clients', action: 'read', name: 'Read Clients' },
      { module: 'clients', action: 'write', name: 'Manage Clients' },
      { module: 'clients', action: 'delete', name: 'Delete Clients' },
      { module: 'projects', action: 'read', name: 'Read Projects' },
      { module: 'projects', action: 'write', name: 'Manage Projects' },
      { module: 'projects', action: 'delete', name: 'Delete Projects' },
      { module: 'invoices', action: 'read', name: 'Read Invoices' },
      { module: 'invoices', action: 'write', name: 'Manage Invoices' },
      { module: 'invoices', action: 'delete', name: 'Delete Invoices' },
      { module: 'payments', action: 'read', name: 'Read Payments' },
      { module: 'payments', action: 'write', name: 'Manage Payments' },
      { module: 'expenses', action: 'read', name: 'Read Expenses' },
      { module: 'expenses', action: 'write', name: 'Manage Expenses' },
      { module: 'outsourcing', action: 'read', name: 'Read Outsourcing' },
      { module: 'lead-commissions', action: 'read', name: 'Read Lead Commissions' },
      { module: 'banking', action: 'read', name: 'Read Banking' },
      { module: 'amc', action: 'read', name: 'Read AMC' },
      { module: 'renewals', action: 'read', name: 'Read Renewals' },
      { module: 'masters', action: 'read', name: 'Read Masters' },
      { module: 'reports', action: 'view', name: 'View Reports' },
      { module: 'files', action: 'read', name: 'Read Files' },
      { module: 'users', action: 'manage', name: 'Manage Users' },
      { module: 'roles', action: 'manage', name: 'Manage Roles' },
      { module: 'permissions', action: 'manage', name: 'Manage Permissions' },
      { module: 'settings', action: 'read', name: 'Read Settings' },
      { module: 'settings', action: 'write', name: 'Manage Settings' }
    ];

    for (const p of defaultPermissions) {
      await permissionModel.create({
        code: `${p.module}.${p.action}`,
        name: p.name,
        module: p.module,
        action: p.action,
        description: `Allow ${p.action} access to ${p.module}`
      });
    }

    const allPermsRes = await query('SELECT id, code FROM permissions');
    const allPermIds = allPermsRes.rows.map((row) => row.id);
    const permissionIdByCode = new Map(allPermsRes.rows.map((row) => [row.code, row.id]));
    const permissionIdsFor = (codes = []) => codes
      .map((code) => permissionIdByCode.get(code))
      .filter(Boolean);

    const adminRole = await createRole({
      code: 'admin',
      name: 'System Admin',
      description: 'Super Administrator with all permissions',
      isSystem: true,
      permissionIds: allPermIds
    });

    await createRole({
      code: 'accountant',
      name: 'Accountant',
      description: 'Financial operations',
      isSystem: true
    });

    const salesRole = await createRole({
      code: 'sales',
      name: 'Sales',
      description: 'CRM & Client management',
      isSystem: true,
      permissionIds: permissionIdsFor([
        'dashboard.view',
        'clients.read',
        'clients.write',
        'projects.read',
        'projects.write',
        'invoices.read',
        'invoices.write',
        'files.read'
      ])
    });

    const managerRole = await createRole({
      code: 'manager',
      name: 'Manager',
      description: 'Sales and client oversight',
      isSystem: true,
      permissionIds: permissionIdsFor([
        'dashboard.view',
        'clients.read',
        'clients.write',
        'clients.delete',
        'projects.read',
        'projects.write',
        'projects.delete',
        'invoices.read',
        'invoices.write',
        'invoices.delete',
        'payments.read',
        'payments.write',
        'expenses.read',
        'expenses.write',
        'lead-commissions.read',
        'banking.read',
        'amc.read',
        'renewals.read',
        'masters.read',
        'reports.view',
        'files.read'
      ])
    });

    const supportRole = await createRole({
      code: 'support',
      name: 'Support',
      description: 'Support and follow-up team',
      isSystem: true,
      permissionIds: permissionIdsFor([
        'dashboard.view',
        'clients.read',
        'projects.read',
        'invoices.read',
        'reports.view',
        'files.read'
      ])
    });

    // 5. Create Super Admin User
    console.log('Creating Super Admin user...');
    await createUser({
      fullName: 'Super Admin',
      username: 'admin',
      email: 'admin@webitof.com',
      salary: 150000,
      password: 'Admin@123',
      isActive: true,
      roleIds: [adminRole.id]
    });
    const adminRes = await query(`SELECT id FROM users WHERE username = 'admin' LIMIT 1`);
    const adminId = adminRes.rows[0].id;

    await createUser({
      fullName: 'Sales Executive',
      username: 'sales',
      email: 'sales@webitof.com',
      salary: 45000,
      password: 'Sales@123',
      isActive: true,
      roleIds: [salesRole.id]
    }, { assignedBy: adminId });
    const salesRes = await query(`SELECT id FROM users WHERE username = 'sales' LIMIT 1`);
    const salesId = salesRes.rows[0].id;

    await createUser({
      fullName: 'Sales Manager',
      username: 'manager',
      email: 'manager@webitof.com',
      salary: 65000,
      password: 'Manager@123',
      isActive: true,
      roleIds: [managerRole.id]
    }, { assignedBy: adminId });
    const managerRes = await query(`SELECT id FROM users WHERE username = 'manager' LIMIT 1`);
    const managerId = managerRes.rows[0].id;

    await createUser({
      fullName: 'Support Executive',
      username: 'support',
      email: 'support@webitof.com',
      salary: 40000,
      password: 'Support@123',
      isActive: true,
      roleIds: [supportRole.id]
    }, { assignedBy: adminId });
    const supportRes = await query(`SELECT id FROM users WHERE username = 'support' LIMIT 1`);
    const supportId = supportRes.rows[0].id;

    // 6. Bank Account Setup
    console.log('Setting up Bank Accounts...');
    const bankAccount = await bankAccountModel.create({
      bankName: 'HDFC Bank',
      accountHolderName: 'Webitof IT Services',
      accountNumber: '50200000000000',
      ifsc: 'HDFC0000001',
      branch: 'Raipur',
      accountType: 'Current',
      upiId: 'webitof@hdfc',
      openingBalance: 50000,
      isPrimary: true
    });

    // 7. Dummy Clients
    console.log('Generating dummy clients...');
    const clients = [];
    for (let i = 1; i <= 5; i++) {
      const assignedUsers = [adminId, salesId, managerId, supportId, salesId];
      const followUpDates = ['2026-07-15', '2026-07-18', '2026-07-20', '2026-07-24', '2026-07-28'];
      const labelSets = [
        ['Consulting'],
        ['E-commerce', 'Hot'],
        ['SMB', 'Follow-up'],
        ['Healthcare'],
        ['Logistics', 'Warm']
      ];
      const client = await clientModel.create({
        name: `Dummy Client ${i}`,
        companyName: `Company ${i} Pvt Ltd`,
        mobile: `987654321${i}`,
        email: `client${i}@example.com`,
        contactPerson: [
          'Aarav Mehta',
          'Neha Sharma',
          'Vikas Gupta',
          'Priya Reddy',
          'Rahul Singh'
        ][i - 1],
        billingAddress: `${i}01, Tech Park, City`,
        state: 'Chhattisgarh',
        stateCode: '22',
        country: 'India',
        clientType: 'Organization',
        gstRegistrationType: 'Registered',
        gstin: `22AAAAA000${i}A1Z5`,
        pan: `AAAAA000${i}A`,
        currency: 'INR',
        openingBalance: 0,
        status: 'Active',
        assignedTo: assignedUsers[i - 1],
        followUpDate: followUpDates[i - 1],
        labels: labelSets[i - 1]
      });
      clients.push(client);
      await clientContactModel.create({
        clientId: client.id,
        firstName: client.contactPerson || `Contact ${i}`,
        lastName: '',
        email: client.email || '',
        phone: client.mobile || '',
        jobTitle: 'Primary Contact',
        gender: 'Other',
        notes: `Primary contact for ${client.companyName}`,
        isPrimary: true
      });
    }

    // 8. Dummy Projects
    console.log('Generating dummy projects...');
    const projects = [];
    for (let i = 0; i < clients.length; i++) {
      const proj1 = await projectModel.create({
        clientId: clients[i].id,
        title: `Website Redesign for ${clients[i].name}`,
        projectType: 'Website Development',
        value: 45000 + (i * 5000),
        startDate: new Date('2025-01-01').toISOString(),
        deadline: new Date('2025-02-15').toISOString(),
        status: 'Completed',
        billingType: 'Fixed',
        costEstimate: 20000
      });
      const proj2 = await projectModel.create({
        clientId: clients[i].id,
        title: `Digital Marketing ${clients[i].name}`,
        projectType: 'Marketing',
        value: 15000,
        startDate: new Date('2025-03-01').toISOString(),
        deadline: new Date('2025-09-01').toISOString(),
        status: 'In Progress',
        billingType: 'Recurring',
        costEstimate: 5000
      });
      projects.push(proj1, proj2);
    }

    // 9. Dummy Invoices & Payments
    console.log('Generating invoices & payments...');
    for (let i = 0; i < projects.length; i++) {
      if (projects[i].status === 'Completed') {
        const inv = await invoiceModel.create({
          invoiceNumber: `INV-00${i + 1}`,
          invoiceDate: new Date('2025-02-15').toISOString(),
          dueDate: new Date('2025-02-28').toISOString(),
          clientId: projects[i].clientId,
          projectId: projects[i].id,
          placeOfSupply: '22',
          invoiceType: 'B2B',
          amountType: 'Exclusive',
          status: 'Paid',
          taxableAmount: projects[i].value,
          cgst: projects[i].value * 0.09,
          sgst: projects[i].value * 0.09,
          igst: 0,
          gstAmount: projects[i].value * 0.18,
          totalAmount: projects[i].value * 1.18,
          items: [
            {
              description: projects[i].title,
              sac: '998314',
              quantity: 1,
              rate: projects[i].value,
              amount: projects[i].value,
              gstRate: 18,
              cgst: projects[i].value * 0.09,
              sgst: projects[i].value * 0.09
            }
          ]
        });

        // Payment
        await paymentModel.create({
          paymentDate: new Date('2025-02-20').toISOString(),
          clientId: projects[i].clientId,
          projectId: projects[i].id,
          invoiceId: inv.id,
          amountReceived: inv.totalAmount,
          tdsDeducted: 0,
          paymentMode: 'Bank Transfer',
          bankAccountId: bankAccount.id,
          transactionId: `TRX-00${i + 1}`
        });

        // Bank Transaction
        await bankTransactionModel.create({
          date: new Date('2025-02-20').toISOString(),
          bankAccountId: bankAccount.id,
          transactionType: 'Credit',
          amount: inv.totalAmount,
          linkedClientId: projects[i].clientId,
          linkedProjectId: projects[i].id,
          linkedInvoiceId: inv.id,
          notes: `Payment for ${inv.invoiceNumber}`
        });
      }
    }

    // 10. Dummy Expenses
    console.log('Generating dummy expenses...');
    const vendorIds = allItems.filter(item => item.type === 'vendor').map(v => v.id);
    const catIds = allItems.filter(item => item.type === 'expense_category').map(c => c.id);
    
    if (vendorIds.length && catIds.length) {
      for (let i = 0; i < 5; i++) {
        const amt = 2000 + (i * 100);
        const exp = await expenseModel.create({
          expenseDate: new Date(`2025-01-0${i + 1}`).toISOString(),
          vendor: 'GoDaddy',
          vendorId: vendorIds[0],
          categoryId: catIds[0],
          amountBeforeGst: amt,
          gstRate: 18,
          gstAmount: amt * 0.18,
          totalAmount: amt * 1.18,
          invoiceNumber: `VEND-00${i + 1}`,
          paymentMode: 'UPI',
          bankAccountId: bankAccount.id,
          itcEligible: true
        });

        await bankTransactionModel.create({
          date: new Date(`2025-01-0${i + 1}`).toISOString(),
          bankAccountId: bankAccount.id,
          transactionType: 'Debit',
          amount: exp.totalAmount,
          linkedExpenseId: exp.id,
          notes: `Expense ${exp.invoiceNumber}`
        });
      }
    }

    // 11. Dummy Leads
    console.log('Generating dummy leads...');
    const leadModel = require('../models/lead.model');
    const leadContacts = [
      {
        leadName: 'TechVision India Pvt Ltd',
        contacts: [
          {
            firstName: 'Sanjay',
            lastName: 'Mehta',
            email: 'sanjay.mehta@techvision.in',
            phone: '+91 9810011001',
            jobTitle: 'CTO',
            notes: 'Primary decision maker'
          },
          {
            firstName: 'Pooja',
            lastName: 'Nair',
            email: 'pooja.nair@techvision.in',
            phone: '+91 9810011002',
            jobTitle: 'Operations Head',
            notes: 'Secondary contact'
          }
        ]
      },
      {
        leadName: 'Sharma Retailers',
        contacts: [
          {
            firstName: 'Neel',
            lastName: 'Gupta',
            email: 'neel@sharmaretail.com',
            phone: '+91 9810022001',
            jobTitle: 'Owner',
            notes: 'Primary contact for pricing'
          }
        ]
      },
      {
        leadName: 'Patel Logistics',
        contacts: [
          {
            firstName: 'Harshil',
            lastName: 'Mehta',
            email: 'harshil@patellogistics.com',
            phone: '+91 9810033001',
            jobTitle: 'Logistics Head',
            notes: 'Handles purchase and operations'
          },
          {
            firstName: 'Ritika',
            lastName: 'Joshi',
            email: 'ritika@patellogistics.com',
            phone: '+91 9810033002',
            jobTitle: 'Accounts',
            notes: 'Billing and invoicing'
          }
        ]
      },
      {
        leadName: 'Reddy Healthcare',
        contacts: [
          {
            firstName: 'Dr. Kavya',
            lastName: 'Reddy',
            email: 'kavya@reddyhealth.in',
            phone: '+91 9810044001',
            jobTitle: 'Founder',
            notes: 'Primary decision maker'
          }
        ]
      },
      {
        leadName: 'Singh Enterprises',
        contacts: [
          {
            firstName: 'Aman',
            lastName: 'Singh',
            email: 'aman@singhent.com',
            phone: '+91 9810055001',
            jobTitle: 'Operations Manager',
            notes: 'Handles technology evaluation'
          }
        ]
      },
      {
        leadName: 'Gupta Traders',
        contacts: [
          {
            firstName: 'Deepak',
            lastName: 'Jain',
            email: 'deepak@guptatraders.in',
            phone: '+91 9810066001',
            jobTitle: 'Procurement Head',
            notes: 'Interested in CRM integrations'
          },
          {
            firstName: 'Sonal',
            lastName: 'Verma',
            email: 'sonal@guptatraders.in',
            phone: '+91 9810066002',
            jobTitle: 'Purchase Manager',
            notes: 'Secondary contact'
          }
        ]
      },
      {
        leadName: 'Das Consultancy',
        contacts: [
          {
            firstName: 'Sneha',
            lastName: 'Das',
            email: 'sneha@dasconsult.com',
            phone: '+91 9810077001',
            jobTitle: 'Partner',
            notes: 'Primary business contact'
          },
          {
            firstName: 'Kabir',
            lastName: 'Sen',
            email: 'kabir@dasconsult.com',
            phone: '+91 9810077002',
            jobTitle: 'Consultant',
            notes: 'Supports decision making'
          }
        ]
      }
    ];
    const dummyLeads = [
      {
        name: 'TechVision India Pvt Ltd',
        companyName: 'TechVision India Pvt Ltd',
        email: 'rajesh.k@techvision.in',
        phone: '+91 9876543210',
        website: 'https://techvision.in',
        status: 'New',
        source: 'Website',
        labels: ['Enterprise', 'Hot'],
        value: 150000,
        ownerName: 'Rajeev Sharma',
        followUpDate: '2026-07-15',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        notes: 'Looking for a comprehensive CRM solution for their sales team of 50 people.',
        assignedTo: salesId,
        createdBy: adminId
      },
      {
        name: 'Sharma Retailers',
        companyName: 'Sharma Retailers',
        email: 'priya@sharmaretail.com',
        phone: '+91 9123456789',
        website: '',
        status: 'Qualified',
        source: 'Referral',
        labels: ['Retail', 'Warm'],
        value: 45000,
        ownerName: 'Anjali Verma',
        followUpDate: '2026-07-05',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        notes: 'Needs basic GST billing and inventory tracking. Referral from existing client Amit.',
        assignedTo: managerId,
        createdBy: salesId
      },
      {
        name: 'Patel Logistics',
        companyName: 'Patel Logistics',
        email: 'anand.p@patellogistics.com',
        phone: '+91 9988776655',
        website: 'https://patellogistics.com',
        status: 'Qualified',
        source: 'Trade Show',
        labels: ['Logistics', 'Hot'],
        value: 320000,
        ownerName: 'Manoj Patel',
        followUpDate: '2026-06-30',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380001',
        notes: 'Negotiating on the final price. Very interested in the multi-branch tracking feature.',
        assignedTo: supportId,
        createdBy: managerId
      },
      {
        name: 'Reddy Healthcare',
        companyName: 'Reddy Healthcare',
        email: 'contact@reddyhealth.in',
        phone: '+91 8899776655',
        website: '',
        status: 'Lost',
        source: 'Cold Call',
        labels: ['Healthcare'],
        value: 25000,
        ownerName: 'Sunil Reddy',
        followUpDate: '2026-08-10',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500001',
        notes: 'Initial discussion done. They will get back to us next month when their budget opens.',
        assignedTo: salesId,
        createdBy: supportId
      },
      {
        name: 'Singh Enterprises',
        companyName: 'Singh Enterprises',
        email: 'vikram.s@singhent.com',
        phone: '+91 9888877777',
        website: '',
        status: 'New',
        source: 'Cold Call',
        labels: ['SMB', 'Follow-up'],
        value: 80000,
        ownerName: 'Vikas Singh',
        followUpDate: '2026-07-20',
        city: 'Chandigarh',
        state: 'Punjab',
        pincode: '160001',
        notes: 'Looking for a cloud-based CRM to replace their Excel sheets.',
        assignedTo: managerId,
        createdBy: adminId
      },
      {
        name: 'Gupta Traders',
        companyName: 'Gupta Traders',
        email: 'neha@guptatraders.in',
        phone: '+91 9777788888',
        website: 'https://guptatraders.in',
        status: 'Qualified',
        source: 'Website',
        labels: ['E-commerce', 'Hot'],
        value: 120000,
        ownerName: 'Neha Agarwal',
        followUpDate: '2026-07-25',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pincode: '226001',
        notes: 'Wants to integrate their e-commerce store with our CRM.',
        assignedTo: salesId,
        createdBy: managerId
      },
      {
        name: 'Das Consultancy',
        companyName: 'Das Consultancy',
        email: 'arjun.d@dasconsult.com',
        phone: '+91 9666655555',
        website: '',
        status: 'New',
        source: 'Referral',
        labels: ['Consulting'],
        value: 30000,
        ownerName: 'Arjun Das',
        followUpDate: '2026-08-15',
        city: 'Kolkata',
        state: 'West Bengal',
        pincode: '700001',
        notes: 'Referred by Priya. Just started a new business, needs basic client management.',
        assignedTo: supportId,
        createdBy: adminId
      }
    ];

    for (const lead of dummyLeads) {
      const createdLead = await leadModel.create(lead);
      const seedContacts = leadContacts.find((item) => item.leadName === lead.companyName)?.contacts || [];
      for (const contact of seedContacts) {
        await leadContactModel.create({
          leadId: createdLead.id,
          firstName: contact.firstName,
          lastName: contact.lastName,
          email: contact.email,
          phone: contact.phone,
          jobTitle: contact.jobTitle,
          gender: 'Other',
          notes: contact.notes
        });
      }
    }

    // 12. Link projects to leads and add project activities
    console.log('Linking projects with leads and adding project activities...');
    const leadRows = await query(`select id, company_name from leads`);
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];
      const client = clients.find((item) => String(item.id) === String(project.clientId));
      const leadId = leadRows.rows.length ? leadRows.rows[i % leadRows.rows.length].id : null;
      const isCompleted = String(project.status || '').toLowerCase() === 'completed';
      const activities = [
        {
          id: `activity-${i + 1}-task`,
          type: 'task',
          title: 'Kickoff and scope review',
          description: 'Review requirements and confirm deliverables with the client.',
          labels: ['Kickoff', 'Scope'],
          status: 'Done',
          priority: 'High',
          startDate: '2025-01-02',
          deadline: '2025-01-05',
          assignedTo: managerId,
          createdByName: 'Super Admin'
        },
        {
          id: `activity-${i + 1}-note`,
          type: 'note',
          title: 'Discovery notes',
          description: 'Client wants a clean CRM-friendly delivery flow with follow-up reminders.',
          category: 'Strategy',
          labels: ['Discovery', 'Client'],
          color: '#8b5cf6',
          createdByName: 'Sales Manager',
          createdAt: '2025-01-03'
        },
        {
          id: `activity-${i + 1}-reminder`,
          type: 'reminder',
          title: 'Check-in reminder',
          description: 'Follow up before milestone approval.',
          date: '2025-01-10',
          time: '10:00',
          repeat: false,
          color: '#f59e0b',
          createdByName: 'Support Executive'
        },
        {
          id: `activity-${i + 1}-event`,
          type: 'event',
          title: 'Client review meeting',
          description: 'Walkthrough of the current phase and next steps.',
          startDate: '2025-01-12',
          startTime: '15:00',
          endDate: '2025-01-12',
          endTime: '16:00',
          location: 'Google Meet',
          labels: ['Meeting'],
          color: '#10b981',
          createdByName: 'Sales Executive'
        }
      ];

      await projectModel.update(project.id, {
        leadId,
        assignedTo: client?.assignedTo || managerId,
        progressPercent: isCompleted ? 100 : 55,
        description: `${project.title} delivered for ${client?.companyName || client?.name || 'the client'}.`,
        labels: client?.labels || ['Project'],
        activities
      });
    }

    console.log('--- Seeding Completed Successfully ---');
    console.log('Super Admin Credentials:');
    console.log('Email: admin@webitof.com');
    console.log('Password: Admin@123');

  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  seed();
}

module.exports = {
  seed
};

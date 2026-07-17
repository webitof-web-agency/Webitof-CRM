const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool, query, closePool } = require('../config/db');
const permissionModel = require('../models/permission.model');

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
  { module: 'settings', action: 'read', name: 'Read Settings' }
];

async function fix() {
  console.log('Inserting default permissions...');
  try {
    for (const p of defaultPermissions) {
      await permissionModel.create({
        code: `${p.module}.${p.action}`,
        name: p.name,
        module: p.module,
        action: p.action,
        description: `Allow ${p.action} access to ${p.module}`
      });
    }
    
    // Assign all permissions to 'admin' role
    const adminRes = await query(`SELECT id FROM roles WHERE code = 'admin' LIMIT 1`);
    if (adminRes.rows.length > 0) {
      const adminId = adminRes.rows[0].id;
      const permsRes = await query(`SELECT id FROM permissions`);
      
      for (const row of permsRes.rows) {
        await query(`
          INSERT INTO role_permissions (role_id, permission_id) 
          VALUES ($1, $2) ON CONFLICT DO NOTHING
        `, [adminId, row.id]);
      }
      console.log('Assigned permissions to admin role.');
    }
    console.log('Done!');
  } catch (error) {
    console.error(error);
  } finally {
    await closePool();
  }
}

fix();

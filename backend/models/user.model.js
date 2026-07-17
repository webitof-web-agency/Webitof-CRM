const { createRepository, column } = require('./baseModel');

module.exports = createRepository({
  table: 'users',
  idPrefix: 'user',
  columns: [
    column({ key: 'fullName', db: 'full_name' }),
    column({ key: 'username', db: 'username' }),
    column({ key: 'email', db: 'email' }),
    column({ key: 'salary', db: 'salary', type: 'number' }),
    column({ key: 'passwordHash', db: 'password_hash' }),
    column({ key: 'isActive', db: 'is_active', type: 'boolean' }),
    column({ key: 'lastLoginAt', db: 'last_login_at', type: 'date' }),
    column({ key: 'phone', db: 'phone' }),
    column({ key: 'address', db: 'address' }),
    column({ key: 'gender', db: 'gender' }),
    column({ key: 'avatarUrl', db: 'avatar_url' }),
    column({ key: 'avatarFileId', db: 'avatar_file_id' })
  ],
  searchColumns: ['full_name', 'username', 'email', 'phone']
});

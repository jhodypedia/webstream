// 📁 seedAdmin.js
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { sequelize } from './models/db.js';
import { User } from './models/User.js';

dotenv.config();

async function seedAdmin() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const email = process.env.ADMIN_EMAIL || 'admin@pansa.my.id';
    const password = process.env.ADMIN_PASS || 'admin123';
    const fullname = process.env.ADMIN_NAME || 'Administrator';

    const existing = await User.findOne({ where: { email } });
    if (existing) {
      console.log('⚠️ Admin user already exists:', email);
      process.exit(0);
    }

    const hash = await bcrypt.hash(password, 10);
    await User.create({
      email,
      password_hash: hash,
      fullname
    });

    console.log('🎉 Admin created successfully:');
    console.log('   Email   :', email);
    console.log('   Password:', password);
    console.log('   Name    :', fullname);
    process.exit(0);
  } catch (e) {
    console.error('❌ Error seeding admin:', e);
    process.exit(1);
  }
}

await seedAdmin();
